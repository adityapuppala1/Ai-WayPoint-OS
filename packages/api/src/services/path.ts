/**
 * Path (Earn + Learn): skills, role suggestions and week-by-week plans.
 * The deterministic planner decides gaps, hours and resources; AI may only reword it.
 */
import { z } from '@hono/zod-openapi';
import { personalisePlan } from '@waypoint/ai';
import {
  getResourcesForSkills,
  getRole,
  getSkill,
  LEARNING_RESOURCES,
  type LearningResource,
  localizeRole,
  localizeSkill,
  ROLES,
  roleTitle,
  SKILLS,
  skillName,
} from '@waypoint/content';
import {
  draftPlan,
  type PathInput,
  PLAN_TEMPLATES_EN,
  type PlanDraft,
  type PlanNames,
  type PlanTemplates,
  renderPlanText,
  type Situation,
  type SkillLevel,
  suggestRoles,
} from '@waypoint/core';
import { currentStepHref } from '@waypoint/core/path';
import {
  and,
  asc,
  type Database,
  desc,
  eq,
  inArray,
  ne,
  planSteps,
  plans,
  savePlan,
  userSkills,
} from '@waypoint/db';
import { isLocale, loadMessages } from '@waypoint/i18n';
import { badRequest, notFound } from '../lib/problem';
import type { Consents } from '../types';
import type { Profile } from './me';

type PathData = Parameters<typeof suggestRoles>[1];
const dataCache = new Map<string, PathData>();

/** Roles and skills with names in the person's language; the planner writes plans from these. */
function dataFor(locale: string): PathData {
  let data = dataCache.get(locale);
  if (!data) {
    data = {
      roles: ROLES.map((r) => localizeRole(r, locale)),
      skills: SKILLS.map((s) => localizeSkill(s, locale)),
      resources: LEARNING_RESOURCES,
    };
    dataCache.set(locale, data);
  }
  return data;
}

export const SKILL_LEVELS = [0, 1, 2, 3, 4] as const;
export const STEP_STATUSES = ['todo', 'doing', 'done', 'skipped'] as const;
export const PLAN_STATUSES = ['active', 'paused', 'completed', 'archived'] as const;

export const UserSkillSchema = z
  .object({ skillId: z.string(), level: z.number().int().min(0).max(4), source: z.string() })
  .openapi('UserSkill');

export const SkillsInputSchema = z
  .object({
    skills: z
      .array(z.object({ skillId: z.string().max(60), level: z.number().int().min(0).max(4) }))
      .max(80),
    /** Replace the whole list (true) or only update the skills given (false). */
    replace: z.boolean().optional(),
  })
  .openapi('SkillsInput');

const ResourceViewSchema = z.object({
  id: z.string(),
  title: z.string(),
  provider: z.string(),
  url: z.string(),
  cost: z.string(),
  hours: z.number().optional(),
  languages: z.array(z.string()),
  format: z.string(),
});

export const RoleSuggestionSchema = z
  .object({
    roleId: z.string(),
    title: z.string(),
    family: z.string(),
    summary: z.string(),
    fit: z.number(),
    reasons: z.array(z.string()),
    missingSkills: z.array(z.object({ id: z.string(), name: z.string() })),
    aiExposure: z.enum(['low', 'medium', 'high']),
    aiNote: z.string(),
  })
  .openapi('RoleSuggestion');

export const PlanStepSchema = z
  .object({
    id: z.string(),
    week: z.number().int(),
    position: z.number().int(),
    kind: z.enum(['learn', 'build', 'connect', 'apply', 'reflect']),
    title: z.string(),
    detail: z.string(),
    minutes: z.number().int(),
    status: z.enum(STEP_STATUSES),
    href: z.string().nullable(),
    skillIds: z.array(z.string()),
    resource: ResourceViewSchema.nullable(),
    doneAt: z.string().nullable(),
  })
  .openapi('PlanStep');

export const PlanSummarySchema = z
  .object({
    id: z.string(),
    title: z.string(),
    summary: z.string(),
    status: z.enum(PLAN_STATUSES),
    targetRoleId: z.string().nullable(),
    targetRoleTitle: z.string().nullable(),
    horizonWeeks: z.number().int(),
    hoursPerWeek: z.number().int(),
    generatedBy: z.enum(['template', 'ai']),
    startedAt: z.string(),
    completedAt: z.string().nullable(),
    progress: z.object({ done: z.number().int(), total: z.number().int() }),
    currentWeek: z.number().int(),
  })
  .openapi('PlanSummary');

export const PlanSchema = PlanSummarySchema.extend({
  gaps: z.array(
    z.object({ skillId: z.string(), name: z.string(), from: z.number(), to: z.number() }),
  ),
  weeks: z.array(z.object({ week: z.number().int(), steps: z.array(PlanStepSchema) })),
  nextStepId: z.string().nullable(),
}).openapi('Plan');

export const PathOverviewSchema = z
  .object({
    skills: z.array(UserSkillSchema.extend({ name: z.string(), category: z.string() })),
    activePlan: PlanSummarySchema.nullable(),
    nextStep: PlanStepSchema.nullable(),
    suggestions: z.array(RoleSuggestionSchema),
    otherPlans: z.array(PlanSummarySchema),
  })
  .openapi('PathOverview');

export const CreatePlanInputSchema = z
  .object({
    roleId: z.string().max(80).optional(),
    hoursPerWeek: z.number().int().min(1).max(40),
    horizonWeeks: z.union([z.literal(4), z.literal(8), z.literal(12)]),
    /** Ask AI to reword the plan for you (structure, hours and resources never change). */
    personalise: z.boolean().optional(),
    goal: z.string().trim().max(300).optional(),
  })
  .openapi('CreatePlanInput');

export type PlanStepView = z.infer<typeof PlanStepSchema>;
export type PlanSummary = z.infer<typeof PlanSummarySchema>;
export type PlanView = z.infer<typeof PlanSchema>;
export type PathOverview = z.infer<typeof PathOverviewSchema>;
export type RoleSuggestionView = z.infer<typeof RoleSuggestionSchema>;

// ─────────────────────────────── Skills ───────────────────────────────

export async function getUserSkills(db: Database, userId: string) {
  return db.select().from(userSkills).where(eq(userSkills.userId, userId));
}

export async function setUserSkills(
  db: Database,
  userId: string,
  input: z.infer<typeof SkillsInputSchema>,
) {
  const valid = input.skills.filter((s) => getSkill(s.skillId));
  if (valid.length !== input.skills.length) {
    const unknown = input.skills.filter((s) => !getSkill(s.skillId)).map((s) => s.skillId);
    throw badRequest(`Unknown skills: ${unknown.slice(0, 5).join(', ')}`);
  }
  await db.transaction(async (tx) => {
    if (input.replace) await tx.delete(userSkills).where(eq(userSkills.userId, userId));
    const keep = valid.filter((s) => s.level > 0);
    const drop = valid.filter((s) => s.level === 0).map((s) => s.skillId);
    if (drop.length && !input.replace)
      await tx
        .delete(userSkills)
        .where(and(eq(userSkills.userId, userId), inArray(userSkills.skillId, drop)));
    for (const s of keep) {
      await tx
        .insert(userSkills)
        .values({ userId, skillId: s.skillId, level: s.level, source: 'self' })
        .onConflictDoUpdate({
          target: [userSkills.userId, userSkills.skillId],
          set: { level: s.level, source: 'self', updatedAt: new Date() },
        });
    }
  });
  return getUserSkills(db, userId);
}

function pathInput(
  profile: Profile,
  skills: Array<{ skillId: string; level: number }>,
  overrides: Partial<PathInput> = {},
): PathInput {
  return {
    currentRole: profile.currentRole ?? undefined,
    skills: skills.map((s) => ({
      skillId: s.skillId,
      level: Math.max(0, Math.min(4, s.level)) as SkillLevel,
    })),
    interests: profile.interests,
    hoursPerWeek: profile.hoursPerWeek,
    horizonWeeks: 8,
    situation: (profile.situation ?? 'steady') as Situation,
    country: profile.country ?? undefined,
    languages: profile.languages.length ? profile.languages : [profile.locale],
    budget: profile.learningBudget,
    ...overrides,
  };
}

export function suggestionsFor(
  profile: Profile,
  skills: Array<{ skillId: string; level: number }>,
  limit = 3,
  locale: string = profile.locale,
): RoleSuggestionView[] {
  const data = dataFor(locale);
  return suggestRoles(pathInput(profile, skills), data, limit).flatMap((s) => {
    const role = data.roles.find((r) => r.id === s.roleId);
    if (!role) return [];
    return [
      {
        roleId: role.id,
        title: role.title,
        family: role.family,
        summary: role.summary,
        fit: Math.round(s.fit * 100) / 100,
        reasons: s.reasons,
        missingSkills: s.missingSkills.map((id) => ({ id, name: skillName(id, locale) })),
        aiExposure: role.aiExposure,
        aiNote: role.aiNote,
      },
    ];
  });
}

// ─────────────────────────────── Plans ───────────────────────────────

type PlanRow = typeof plans.$inferSelect;
type StepRow = typeof planSteps.$inferSelect;

function resourceView(id: string | null): z.infer<typeof ResourceViewSchema> | null {
  if (!id) return null;
  const r: LearningResource | undefined = LEARNING_RESOURCES.find((x) => x.id === id);
  return r
    ? {
        id: r.id,
        title: r.title,
        provider: r.provider,
        url: r.url,
        cost: r.cost,
        hours: r.hours,
        languages: r.languages,
        format: r.format,
      }
    : null;
}

/** Writes template-made plan text in the reader's language (AI-worded text stays as written). */
interface Renderer {
  t: PlanTemplates;
  names: PlanNames;
}
const renderers = new Map<string, Renderer>();

async function rendererFor(locale = 'en'): Promise<Renderer> {
  let r = renderers.get(locale);
  if (!r) {
    r = {
      t: (await templatesFor(locale)) ?? PLAN_TEMPLATES_EN,
      names: { skill: (id) => skillName(id, locale), role: (id) => roleTitle(id, locale) },
    };
    renderers.set(locale, r);
  }
  return r;
}

function stepView(s: StepRow, r?: Renderer): PlanStepView {
  return {
    id: s.id,
    week: s.week,
    position: s.position,
    kind: s.kind as PlanStepView['kind'],
    title: r && s.text ? renderPlanText(s.text.title, r.t, r.names) : s.title,
    detail: r && s.text ? renderPlanText(s.text.detail, r.t, r.names) : s.detail,
    minutes: s.minutes,
    status: (STEP_STATUSES as readonly string[]).includes(s.status)
      ? (s.status as PlanStepView['status'])
      : 'todo',
    // Plans saved earlier may still carry an address for a page that was never built.
    href: currentStepHref(s.href),
    skillIds: s.skillIds,
    resource: resourceView(s.resourceId),
    doneAt: s.doneAt?.toISOString() ?? null,
  };
}

function summaryView(p: PlanRow, steps: StepRow[], locale?: string, r?: Renderer): PlanSummary {
  const done = steps.filter((s) => s.status === 'done' || s.status === 'skipped').length;
  const open = steps.filter((s) => s.status === 'todo' || s.status === 'doing').sort(byOrder);
  const elapsedWeeks = Math.floor((Date.now() - p.startedAt.getTime()) / (7 * 86_400_000)) + 1;
  return {
    id: p.id,
    title: r && p.text ? renderPlanText(p.text.title, r.t, r.names) : p.title,
    summary: r && p.text ? renderPlanText(p.text.summary, r.t, r.names) : p.summary,
    status: (PLAN_STATUSES as readonly string[]).includes(p.status)
      ? (p.status as PlanSummary['status'])
      : 'active',
    targetRoleId: p.targetRoleId,
    targetRoleTitle: p.targetRoleId ? roleTitle(p.targetRoleId, locale) : null,
    horizonWeeks: p.horizonWeeks,
    hoursPerWeek: p.hoursPerWeek,
    generatedBy: p.generatedBy === 'ai' ? 'ai' : 'template',
    startedAt: p.startedAt.toISOString(),
    completedAt: p.completedAt?.toISOString() ?? null,
    progress: { done, total: steps.length },
    // The week of the first open step (progress, not the calendar, sets the pace).
    currentWeek: open[0]?.week ?? Math.min(elapsedWeeks, p.horizonWeeks),
  };
}

const byOrder = (a: StepRow, b: StepRow) => a.week - b.week || a.position - b.position;

async function stepsFor(db: Database, planIds: string[]): Promise<Map<string, StepRow[]>> {
  const map = new Map<string, StepRow[]>();
  if (!planIds.length) return map;
  const rows = await db
    .select()
    .from(planSteps)
    .where(inArray(planSteps.planId, planIds))
    .orderBy(asc(planSteps.week), asc(planSteps.position));
  for (const r of rows) {
    const list = map.get(r.planId) ?? [];
    list.push(r);
    map.set(r.planId, list);
  }
  return map;
}

async function ownedPlan(db: Database, userId: string, planId: string): Promise<PlanRow> {
  const [p] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.userId, userId)))
    .limit(1);
  if (!p) throw notFound('Plan');
  return p;
}

export async function listPlans(
  db: Database,
  userId: string,
  locale?: string,
): Promise<PlanSummary[]> {
  const rows = await db
    .select()
    .from(plans)
    .where(and(eq(plans.userId, userId), ne(plans.status, 'archived')))
    .orderBy(desc(plans.createdAt))
    .limit(20);
  const [steps, r] = await Promise.all([
    stepsFor(
      db,
      rows.map((row) => row.id),
    ),
    rendererFor(locale),
  ]);
  return rows.map((p) => summaryView(p, steps.get(p.id) ?? [], locale, r));
}

export async function getPlan(
  db: Database,
  userId: string,
  planId: string,
  locale?: string,
): Promise<PlanView> {
  const p = await ownedPlan(db, userId, planId);
  const [stepMap, r] = await Promise.all([stepsFor(db, [p.id]), rendererFor(locale)]);
  const steps = stepMap.get(p.id) ?? [];
  const weeks = new Map<number, PlanStepView[]>();
  for (const s of steps) {
    const list = weeks.get(s.week) ?? [];
    list.push(stepView(s, r));
    weeks.set(s.week, list);
  }
  const next = steps.filter((s) => s.status === 'todo' || s.status === 'doing').sort(byOrder)[0];
  return {
    ...summaryView(p, steps, locale, r),
    gaps: p.gaps.map((g) => ({ ...g, name: skillName(g.skillId, locale) })),
    weeks: [...weeks.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([week, list]) => ({ week, steps: list })),
    nextStepId: next?.id ?? null,
  };
}

/** The active plan and its next open step, if any. */
export async function activePlanWithNextStep(
  db: Database,
  userId: string,
  locale?: string,
): Promise<{ plan: PlanSummary; next: PlanStepView | null; week: PlanStepView[] } | null> {
  const [p] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.userId, userId), eq(plans.status, 'active')))
    .orderBy(desc(plans.createdAt))
    .limit(1);
  if (!p) return null;
  const [stepMap, r] = await Promise.all([stepsFor(db, [p.id]), rendererFor(locale)]);
  const steps = stepMap.get(p.id) ?? [];
  const summary = summaryView(p, steps, locale, r);
  const next = steps.filter((s) => s.status === 'todo' || s.status === 'doing').sort(byOrder)[0];
  return {
    plan: summary,
    next: next ? stepView(next, r) : null,
    week: steps.filter((s) => s.week === summary.currentWeek).map((s) => stepView(s, r)),
  };
}

export async function pathOverview(
  db: Database,
  userId: string,
  profile: Profile,
  locale: string = profile.locale,
): Promise<PathOverview> {
  const skills = await getUserSkills(db, userId);
  const [active, all] = await Promise.all([
    activePlanWithNextStep(db, userId, locale),
    listPlans(db, userId, locale),
  ]);
  return {
    skills: skills
      .map((s) => ({
        skillId: s.skillId,
        level: s.level,
        source: s.source,
        name: skillName(s.skillId, locale),
        category: getSkill(s.skillId)?.category ?? 'foundational',
      }))
      .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, locale)),
    activePlan: active?.plan ?? null,
    nextStep: active?.next ?? null,
    suggestions: suggestionsFor(profile, skills, 3, locale),
    otherPlans: all.filter((p) => p.id !== active?.plan.id),
  };
}

async function templatesFor(locale: string): Promise<PlanTemplates | undefined> {
  if (!isLocale(locale) || locale === 'en') return undefined;
  const messages = (await loadMessages(locale)) as unknown as { planTemplates?: PlanTemplates };
  return messages.planTemplates;
}

export async function createPlan(
  db: Database,
  who: { userId: string; isGuest: boolean },
  profile: Profile,
  consents: Consents,
  input: z.infer<typeof CreatePlanInputSchema>,
  locale: string = profile.locale,
): Promise<PlanView> {
  if (input.roleId && !getRole(input.roleId)) throw badRequest('Unknown role.');
  const skills = await getUserSkills(db, who.userId);
  const pin = pathInput(profile, skills, {
    hoursPerWeek: input.hoursPerWeek,
    horizonWeeks: input.horizonWeeks,
    targetRoleId: input.roleId,
  });
  let draft: PlanDraft = draftPlan(pin, dataFor(locale), {
    roleId: input.roleId,
    templates: await templatesFor(locale),
  });
  if (input.personalise && consents.personalization) {
    // A model may reword the plan; it cannot change its steps. Where the judge may be asked
    // (ai_external consent, a language switched on for it) the new wording is checked, and a
    // rewrite that promises a result or names a course the planner did not comes back as
    // the template, unchanged.
    draft = await personalisePlan(
      { db, userId: who.userId, isGuest: who.isGuest, allowExternal: consents.ai_external },
      draft,
      { locale, country: profile.country, goal: input.goal },
    );
  }

  const planId = await savePlan(db, {
    userId: who.userId,
    draft,
    horizonWeeks: input.horizonWeeks,
    hoursPerWeek: input.hoursPerWeek,
    locale,
  });
  return getPlan(db, who.userId, planId, locale);
}

/**
 * A step takes a status and nothing else. It used to accept a free-text note that no screen
 * showed, that was stored readable and that was never screened for signs of danger like other
 * writing: words people type belong in the journal, where they are sealed and screened.
 */
export const StepUpdateSchema = z.object({ status: z.enum(STEP_STATUSES) }).openapi('StepUpdate');

export async function updateStep(
  db: Database,
  userId: string,
  planId: string,
  stepId: string,
  input: z.infer<typeof StepUpdateSchema>,
  locale?: string,
): Promise<PlanView> {
  const plan = await ownedPlan(db, userId, planId);
  const now = new Date();
  const res = await db
    .update(planSteps)
    .set({
      status: input.status,
      doneAt: input.status === 'done' ? now : null,
      updatedAt: now,
    })
    .where(and(eq(planSteps.id, stepId), eq(planSteps.planId, plan.id)))
    .returning({ id: planSteps.id });
  if (!res.length) throw notFound('Step');

  const steps = (await stepsFor(db, [plan.id])).get(plan.id) ?? [];
  const allClosed =
    steps.length > 0 && steps.every((s) => s.status === 'done' || s.status === 'skipped');
  if (allClosed && plan.status !== 'completed') {
    await db
      .update(plans)
      .set({ status: 'completed', completedAt: now, updatedAt: now })
      .where(eq(plans.id, plan.id));
  } else if (!allClosed && plan.status === 'completed') {
    await db
      .update(plans)
      .set({ status: 'active', completedAt: null, updatedAt: now })
      .where(eq(plans.id, plan.id));
  }
  return getPlan(db, userId, planId, locale);
}

export const PlanStatusSchema = z
  .object({ status: z.enum(['active', 'paused', 'archived']) })
  .openapi('PlanStatusUpdate');

export async function setPlanStatus(
  db: Database,
  userId: string,
  planId: string,
  status: 'active' | 'paused' | 'archived',
  locale?: string,
): Promise<PlanSummary> {
  const plan = await ownedPlan(db, userId, planId);
  await db.transaction(async (tx) => {
    if (status === 'active') {
      await tx
        .update(plans)
        .set({ status: 'paused', updatedAt: new Date() })
        .where(and(eq(plans.userId, userId), eq(plans.status, 'active'), ne(plans.id, plan.id)));
    }
    await tx.update(plans).set({ status, updatedAt: new Date() }).where(eq(plans.id, plan.id));
  });
  const steps = (await stepsFor(db, [plan.id])).get(plan.id) ?? [];
  return summaryView({ ...plan, status }, steps, locale, await rendererFor(locale));
}

// ─────────────────────────────── Catalog ───────────────────────────────

export const RoleDetailSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    family: z.string(),
    summary: z.string(),
    entryPaths: z.array(z.string()),
    aiExposure: z.enum(['low', 'medium', 'high']),
    aiNote: z.string(),
    skills: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        yourLevel: z.number().int(),
      }),
    ),
    resources: z.array(ResourceViewSchema),
    sources: z.array(z.object({ url: z.string(), title: z.string(), checkedAt: z.string() })),
  })
  .openapi('RoleDetail');

export function roleDetail(
  roleId: string,
  opts: {
    skills?: Array<{ skillId: string; level: number }>;
    languages?: string[];
    country?: string | null;
    budget?: 'free' | 'low' | 'any';
    locale?: string;
  },
): z.infer<typeof RoleDetailSchema> {
  const found = getRole(roleId);
  if (!found) throw notFound('Role');
  const role = localizeRole(found, opts.locale);
  const levels = new Map((opts.skills ?? []).map((s) => [s.skillId, s.level]));
  return {
    id: role.id,
    title: role.title,
    family: role.family,
    summary: role.summary,
    entryPaths: role.entryPaths,
    aiExposure: role.aiExposure,
    aiNote: role.aiNote,
    skills: role.skills.map((id) => {
      const s = getSkill(id);
      return {
        id,
        name: skillName(id, opts.locale),
        description: s?.description ?? '',
        yourLevel: levels.get(id) ?? 0,
      };
    }),
    resources: getResourcesForSkills(role.skills, {
      budget: opts.budget ?? 'low',
      languages: opts.languages,
      country: opts.country,
      limit: 6,
    })
      .map((r) => resourceView(r.id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r)),
    sources: role.sources,
  };
}

export const CatalogSchema = z
  .object({
    skills: z.array(
      z.object({ id: z.string(), name: z.string(), category: z.string(), description: z.string() }),
    ),
    roles: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        family: z.string(),
        summary: z.string(),
        aiExposure: z.enum(['low', 'medium', 'high']),
      }),
    ),
  })
  .openapi('PathCatalog');

export function catalog(locale?: string): z.infer<typeof CatalogSchema> {
  const data = dataFor(locale ?? 'en');
  return {
    skills: data.skills.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      description: s.description,
    })),
    roles: data.roles.map((r) => ({
      id: r.id,
      title: r.title,
      family: r.family,
      summary: r.summary,
      aiExposure: r.aiExposure,
    })),
  };
}
