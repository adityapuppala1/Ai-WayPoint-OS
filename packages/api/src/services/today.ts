/**
 * Today: one next step, the route it sits on, and only what changed for this person.
 * Calm by design — a few items, no feed, nothing to scroll forever.
 */
import { z } from '@hono/zod-openapi';
import { getChecklist, type LifeEvent } from '@waypoint/content';
import { MODULE_IDS, type ModuleId } from '@waypoint/core';
import {
  and,
  type Database,
  desc,
  eq,
  gt,
  isNull,
  nudges,
  or,
  userChecklistItems,
  userChecklists,
} from '@waypoint/db';
import { reminderTitles } from './health';
import { helpCountry, type Profile } from './me';
import { MONEY_STRESS, moneySummary } from './money';
import { activePlanWithNextStep, getUserSkills, PlanStepSchema, PlanSummarySchema } from './path';
import { relevantSignals, SignalSchema } from './signals';
import { supportDirectory } from './support';

const ModuleSchema = z.enum(MODULE_IDS);

export const NextStepSchema = z
  .object({
    kind: z.enum(['onboard', 'plan-step', 'checklist', 'make-plan', 'explore']),
    module: ModuleSchema,
    title: z.string(),
    detail: z.string().nullable(),
    href: z.string(),
    minutes: z.number().int().nullable(),
    planId: z.string().nullable(),
    stepId: z.string().nullable(),
  })
  .openapi('NextStep');

export const TodaySchema = z
  .object({
    name: z.string().nullable(),
    onboarded: z.boolean(),
    nextStep: NextStepSchema,
    plan: PlanSummarySchema.nullable(),
    week: z.array(PlanStepSchema),
    nudges: z.array(
      z.object({
        id: z.string(),
        module: z.string(),
        priority: z.string(),
        title: z.string(),
        body: z.string().nullable(),
        href: z.string().nullable(),
      }),
    ),
    signals: z.array(SignalSchema),
    checklist: z
      .object({
        event: z.string(),
        title: z.string(),
        done: z.number().int(),
        total: z.number().int(),
        href: z.string(),
      })
      .nullable(),
    emergencyNumber: z.string().nullable(),
    /** Money at a glance, only when the person has added their numbers. Never amounts. */
    money: z
      .object({ stress: z.enum(MONEY_STRESS), monthsOfRunway: z.number().nullable() })
      .nullable(),
  })
  .openapi('Today');

export type TodayView = z.infer<typeof TodaySchema>;
export type NextStep = z.infer<typeof NextStepSchema>;

const SITUATION_EVENT: Partial<Record<string, LifeEvent>> = {
  'lost-job': 'job-loss',
  'first-job': 'first-job',
  'new-country': 'moving-country',
  retiring: 'retirement',
  'health-change': 'serious-illness',
  'running-business': 'starting-business',
};

/** Words for Today's generic next steps, localised by the caller (web passes its messages). */
export interface TodayCopy {
  onboardTitle: string;
  onboardDetail: string;
  makePlanTitle: string;
  makePlanDetail: string;
  exploreTitle: string;
  exploreDetail: string;
}

export const TODAY_COPY_EN: TodayCopy = {
  onboardTitle: 'Tell Waypoint where you are',
  onboardDetail: 'Two minutes. Everything is optional, and you can change it later.',
  makePlanTitle: 'Choose a direction and make a plan',
  makePlanDetail: 'Pick a role you could reach, and get a week-by-week plan that fits your time.',
  exploreTitle: 'Look at roles that fit you',
  exploreDetail: 'See what your skills already open up, and what one new skill would add.',
};

export async function today(
  db: Database,
  userId: string,
  profile: Profile,
  opts: { copy?: TodayCopy; matching: boolean; locale?: string } = { matching: false },
): Promise<TodayView> {
  const copy = opts.copy ?? TODAY_COPY_EN;
  const onboarded = Boolean(profile.onboardedAt);
  const [active, skills, money, nudgeRows] = await Promise.all([
    activePlanWithNextStep(db, userId, opts.locale ?? profile.locale),
    getUserSkills(db, userId),
    moneySummary(db, userId),
    db
      .select()
      .from(nudges)
      .where(
        and(
          eq(nudges.userId, userId),
          eq(nudges.channel, 'in-app'),
          or(eq(nudges.status, 'delivered'), eq(nudges.status, 'pending')),
          isNull(nudges.readAt),
          or(isNull(nudges.expiresAt), gt(nudges.expiresAt, new Date())),
        ),
      )
      .orderBy(desc(nudges.createdAt))
      .limit(3),
  ]);

  const reminderIds = nudgeRows
    .map((n) => /^reminder:([0-9a-f-]{36}):/.exec(n.dedupeKey ?? '')?.[1])
    .filter((id): id is string => Boolean(id));
  const reminderNames = await reminderTitles(db, userId, reminderIds);

  // The life-event checklist that matches the person's situation, if they started it.
  let checklist: TodayView['checklist'] = null;
  const event = profile.situation ? SITUATION_EVENT[profile.situation] : undefined;
  if (event) {
    const def = getChecklist(event, profile.country);
    if (def) {
      const [started] = await db
        .select()
        .from(userChecklists)
        .where(and(eq(userChecklists.userId, userId), eq(userChecklists.event, event)))
        .limit(1);
      const items = started
        ? await db
            .select()
            .from(userChecklistItems)
            .where(eq(userChecklistItems.checklistId, started.id))
        : [];
      const closed = items.filter((i) => i.status !== 'todo').length;
      checklist = {
        event,
        title: def.title,
        done: closed,
        total: def.items.length,
        href: `/civic/${event}`,
      };
    }
  }

  let nextStep: NextStep;
  if (!onboarded) {
    nextStep = {
      kind: 'onboard',
      module: 'today',
      title: copy.onboardTitle,
      detail: copy.onboardDetail,
      href: '/start',
      minutes: 2,
      planId: null,
      stepId: null,
    };
  } else if (active?.next) {
    nextStep = {
      kind: 'plan-step',
      module: moduleForHref(active.next.href) ?? 'path',
      title: active.next.title,
      detail: active.next.detail,
      href: active.next.href ?? `/path/plans/${active.plan.id}#step-${active.next.id}`,
      minutes: active.next.minutes,
      planId: active.plan.id,
      stepId: active.next.id,
    };
  } else if (profile.situation && profile.situation !== 'steady' && !active) {
    nextStep = {
      kind: 'make-plan',
      module: 'path',
      title: copy.makePlanTitle,
      detail: copy.makePlanDetail,
      href: '/path/new',
      minutes: 5,
      planId: null,
      stepId: null,
    };
  } else {
    nextStep = {
      kind: 'explore',
      module: 'path',
      title: copy.exploreTitle,
      detail: copy.exploreDetail,
      href: '/path',
      minutes: 5,
      planId: null,
      stepId: null,
    };
  }

  const signalList = await relevantSignals(
    db,
    { userId, profile, skillIds: skills.map((s) => s.skillId), matching: opts.matching },
    { limit: 3, days: 120 },
  );

  return {
    name: profile.displayName,
    onboarded,
    nextStep,
    plan: active?.plan ?? null,
    week: active?.week ?? [],
    nudges: nudgeRows.map((n) => ({
      id: n.id,
      module: n.module,
      priority: n.priority,
      // A due reminder says what it's about; its words are stored encrypted, not in the nudge.
      title: reminderTitle(n.dedupeKey, reminderNames) ?? n.title,
      body: n.body,
      href: n.href,
    })),
    signals: signalList,
    checklist,
    emergencyNumber: supportDirectory(helpCountry(profile)).emergency?.general ?? null,
    money,
  };
}

function reminderTitle(dedupeKey: string | null, names: Map<string, string>): string | undefined {
  const id = /^reminder:([0-9a-f-]{36}):/.exec(dedupeKey ?? '')?.[1];
  return id ? names.get(id) : undefined;
}

function moduleForHref(href: string | null): ModuleId | undefined {
  if (!href) return undefined;
  const seg = href.split('/')[1] ?? '';
  return (MODULE_IDS as readonly string[]).includes(seg) ? (seg as ModuleId) : undefined;
}
