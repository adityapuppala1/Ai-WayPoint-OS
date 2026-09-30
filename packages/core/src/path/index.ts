/**
 * Path: from "where I am" to "a role I can reach", as a week-by-week plan.
 *
 * This deterministic planner is the backbone: it works offline, costs nothing, and is the
 * safety net when AI is unavailable or over budget. The AI layer may rewrite titles and
 * add context, but the gaps, hours and resources come from here, so plans stay honest
 * about how long things take.
 */
import type { LearningResource, ResourceCost, Role, Skill } from '@waypoint/content/types';
import type {
  PathInput,
  PlanDraft,
  PlanStepDraft,
  PlanText,
  PlanTextVar,
  RoleSuggestion,
  SkillLevel,
} from '../types';

export interface PathData {
  roles: Role[];
  skills: Skill[];
  resources: LearningResource[];
}

/** Rough hours of focused practice to move between levels (none → aware → basic → working → strong). */
const STEP_HOURS = [5, 15, 40, 80] as const;
const CUMULATIVE = [0, 5, 20, 60, 140] as const;

export function hoursToClose(from: SkillLevel, to: SkillLevel): number {
  if (to <= from) return 0;
  return CUMULATIVE[to] - CUMULATIVE[from];
}

export { STEP_HOURS };

const WORKING: SkillLevel = 3;
const BASIC: SkillLevel = 2;

function importanceWeight(index: number): number {
  return 1 / (1 + 0.35 * index);
}

function levelOf(input: PathInput, skillId: string): SkillLevel {
  return input.skills.find((s) => s.skillId === skillId)?.level ?? 0;
}

export type RoleReason =
  | 'strong-skill-match'
  | 'some-skill-match'
  | 'matches-interest'
  | 'reachable-in-horizon'
  | 'lower-ai-exposure'
  | 'your-target';

/** Roles that fit the person's skills, interests and time, best first, with reasons. */
export function suggestRoles(input: PathInput, data: PathData, limit = 5): RoleSuggestion[] {
  const skillCategory = new Map(data.skills.map((s) => [s.id, s.category] as const));
  const interests = input.interests.map((i) => i.toLowerCase());
  const capacity = Math.max(1, input.hoursPerWeek) * input.horizonWeeks;

  const scored = data.roles.map((role) => {
    const weights = role.skills.map((_, i) => importanceWeight(i));
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    const coverage =
      role.skills.reduce(
        (sum, id, i) => sum + (weights[i] ?? 0) * (Math.min(levelOf(input, id), WORKING) / WORKING),
        0,
      ) / total;
    const categories = new Set(
      role.skills.map((id) => skillCategory.get(id)).filter(Boolean) as string[],
    );
    const interested =
      interests.includes(role.family.toLowerCase()) ||
      interests.includes(role.id) ||
      [...categories].some((c) => interests.includes(c));
    const gapHours = role.skills
      .slice(0, 4)
      .reduce((sum, id) => sum + hoursToClose(levelOf(input, id), BASIC), 0);
    const reach = gapHours === 0 ? 1 : Math.min(1, capacity / gapHours);
    const ai = role.aiExposure === 'low' ? 1 : role.aiExposure === 'medium' ? 0.8 : 0.6;
    const target = input.targetRoleId === role.id;

    const fit = Math.min(1, 0.5 * coverage + 0.2 * (interested ? 1 : 0) + 0.2 * reach + 0.1 * ai);
    const reasons: RoleReason[] = [];
    if (target) reasons.push('your-target');
    if (coverage >= 0.6) reasons.push('strong-skill-match');
    else if (coverage >= 0.25) reasons.push('some-skill-match');
    if (interested) reasons.push('matches-interest');
    if (reach >= 1) reasons.push('reachable-in-horizon');
    if (role.aiExposure === 'low') reasons.push('lower-ai-exposure');

    return {
      roleId: role.id,
      fit: Math.round(fit * 100) / 100,
      reasons,
      missingSkills: role.skills.filter((id) => levelOf(input, id) < BASIC),
      target,
    };
  });

  scored.sort(
    (a, b) =>
      Number(b.target) - Number(a.target) || b.fit - a.fit || a.roleId.localeCompare(b.roleId),
  );
  return scored.slice(0, limit).map(({ target: _t, ...rest }) => rest);
}

const COST_ALLOWED: Record<PathInput['budget'], ResourceCost[]> = {
  free: ['free', 'free-audit'],
  low: ['free', 'free-audit', 'low-cost'],
  any: ['free', 'free-audit', 'low-cost', 'paid'],
};

/** The best learning resource for a skill, respecting budget, language and country. */
export function pickResource(
  skillId: string,
  input: Pick<PathInput, 'budget' | 'languages' | 'country'>,
  resources: LearningResource[],
  exclude: Set<string> = new Set(),
): LearningResource | undefined {
  const langs = input.languages.map((l) => l.toLowerCase().split('-')[0] ?? l);
  const allowed = COST_ALLOWED[input.budget];
  const candidates = resources.filter(
    (r) => r.skills.includes(skillId) && allowed.includes(r.cost) && !exclude.has(r.id),
  );
  const score = (r: LearningResource) => {
    const langIdx = r.languages.findIndex((l) =>
      langs.includes(l.toLowerCase().split('-')[0] ?? l),
    );
    const langScore = langIdx === -1 ? (r.languages.includes('en') ? 2 : 4) : 0;
    const regionScore = r.regions?.length
      ? input.country && r.regions.includes(input.country)
        ? -1
        : 3
      : 0;
    const costScore = allowed.indexOf(r.cost) * 0.5;
    const focusScore = r.skills.indexOf(skillId) * 0.3; // resources centred on this skill first
    const lengthScore = r.hours ? Math.min(r.hours, 80) / 80 : 0.5;
    return langScore + regionScore + costScore + focusScore + lengthScore;
  };
  return candidates.sort((a, b) => score(a) - score(b) || a.id.localeCompare(b.id))[0];
}

/** Template strings. The web app passes translated versions; English is the default. */
export interface PlanTemplates {
  titleRole: string; // {role}
  titleGeneral: string;
  summary: string; // {weeks} {hours} {skills}
  summaryStretch: string; // {weeks} {hours} {skills} {moreWeeks}
  orientFocus: string;
  learnFocus: string; // {skill}
  proofFocus: string;
  reviewFocus: string;
  whyTitle: string;
  whyDetail: string;
  benefitsTitle: string;
  benefitsDetail: string;
  learnTitle: string; // {skill}
  learnDetailResource: string; // {resource} {provider}
  learnDetailNoResource: string; // {skill}
  practiceTitle: string; // {skill}
  practiceDetail: string; // {skill}
  circleTitle: string;
  circleDetail: string;
  projectTitle: string; // {role}
  projectDetail: string; // {skills}
  reviewTitle: string;
  reviewDetail: string;
  applyTitle: string; // {role}
  applyDetail: string;
  weeklyReviewTitle: string;
  weeklyReviewDetail: string;
  listJoin: string; // separator for lists, e.g. ', '
  listAnd: string; // last separator, e.g. ' and '
}

export const PLAN_TEMPLATES_EN: PlanTemplates = {
  titleRole: 'Towards {role}',
  titleGeneral: 'Your next steps',
  summary: 'A {weeks}-week plan at about {hours} hours a week, focused on {skills}.',
  summaryStretch:
    'A {weeks}-week plan at about {hours} hours a week, focused on {skills}. Reaching a working level in everything the role needs will take about {moreWeeks} more weeks at this pace, and that is normal.',
  orientFocus: 'Get your bearings',
  learnFocus: 'Build {skill}',
  proofFocus: 'Show what you can do',
  reviewFocus: 'Look back and choose what is next',
  whyTitle: 'Write down why this matters to you',
  whyDetail: 'Two or three sentences are enough. You will come back to them on harder weeks.',
  benefitsTitle: 'Check the support you are entitled to',
  benefitsDetail:
    'Losing work often comes with rights and support that are easy to miss. The job-loss checklist lists where to start in your country.',
  learnTitle: 'Learn: {skill}',
  learnDetailResource: 'Work through {resource} ({provider}). Take notes in your own words.',
  learnDetailNoResource:
    'Find one short, free introduction to {skill} and work through it. Ask in Ask if you are not sure where to start.',
  practiceTitle: 'Practise {skill} on something real',
  practiceDetail:
    'Use {skill} on a small task from your own life, work or community, and keep what you make.',
  circleTitle: 'Join a circle of people on the same path',
  circleDetail:
    "Introduce yourself and share this week's goal. People who plan together tend to follow through.",
  projectTitle: 'Make a proof project for {role}',
  projectDetail:
    'Combine {skills} in one small, finished piece of work that someone could look at in five minutes.',
  reviewTitle: 'Ask someone to review your project',
  reviewDetail:
    'Show it to someone whose opinion you trust: a peer, a mentor or your circle. Ask what is clear and what is missing, then improve it.',
  applyTitle: 'Apply or pitch: {role}',
  applyDetail:
    'Send three applications or one pitch to a potential client, and include your project so they can see what you can do.',
  weeklyReviewTitle: 'Weekly review',
  weeklyReviewDetail: 'What went well, what got in the way, and one change for next week.',
  listJoin: ', ',
  listAnd: ' and ',
};

/**
 * Plans saved before October 2026 sent their project and review steps to two proof-of-work
 * pages that were never built. Those addresses are stored with the step, so they are
 * translated here to where the planner sends the same step today (null: the step opens on
 * the plan itself). Every other address is returned as it is.
 */
const RETIRED_STEP_HREFS = new Map<string, string | null>([
  ['/path/projects/new', null],
  ['/path/proof', '/circles'],
]);

export function currentStepHref(href: string | null | undefined): string | null {
  if (!href) return null;
  return RETIRED_STEP_HREFS.has(href) ? (RETIRED_STEP_HREFS.get(href) ?? null) : href;
}

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

/** How to name skills and roles in the language being rendered. */
export interface PlanNames {
  skill: (id: string) => string;
  role: (id: string) => string;
}

function resolveVar(v: PlanTextVar, t: PlanTemplates, names: PlanNames): string | number {
  if (typeof v === 'string' || typeof v === 'number') return v;
  if ('skill' in v) return names.skill(v.skill);
  if ('role' in v) return names.role(v.role);
  if ('skills' in v) {
    const list = joinList(v.skills.map(names.skill), t);
    return list || (v.fallback ? t[v.fallback].toLocaleLowerCase() : '');
  }
  return t[v.template];
}

/**
 * Write planner text in a language: the template for `ref.key` with its variables resolved.
 * Unknown keys fall back to English so an old plan never shows a blank step.
 */
export function renderPlanText(ref: PlanText, t: PlanTemplates, names: PlanNames): string {
  const key = ref.key as keyof PlanTemplates;
  const template = t[key] ?? PLAN_TEMPLATES_EN[key] ?? '';
  const vars: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(ref.vars ?? {})) vars[k] = resolveVar(v, t, names);
  return fill(template, vars);
}

function joinList(items: string[], t: PlanTemplates): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(t.listJoin)}${t.listAnd}${items[items.length - 1]}`;
}

/** Round to a friendly 5-minute granularity with a sensible floor. */
function mins(n: number, floor = 15): number {
  return Math.max(floor, Math.round(n / 5) * 5);
}

/**
 * A week-by-week plan towards a role (or towards the person's own interests when no role
 * is chosen). Honest about pace: the summary says when the full gap needs more time.
 */
export function draftPlan(
  input: PathInput,
  data: PathData,
  opts: { roleId?: string; templates?: PlanTemplates; skillName?: (id: string) => string } = {},
): PlanDraft {
  const t = opts.templates ?? PLAN_TEMPLATES_EN;
  const roleId = opts.roleId ?? input.targetRoleId;
  const role = roleId ? data.roles.find((r) => r.id === roleId) : undefined;
  const skillName =
    opts.skillName ?? ((id: string) => data.skills.find((s) => s.id === id)?.name ?? id);
  const names: PlanNames = {
    skill: skillName,
    role: (id) => data.roles.find((r) => r.id === id)?.title ?? id,
  };
  /** Text plus how it was made, so it can be written again in another language later. */
  const txt = (key: keyof PlanTemplates, vars?: Record<string, PlanTextVar>) => {
    const ref: PlanText = vars ? { key, vars } : { key };
    return { ref, text: renderPlanText(ref, t, names) };
  };
  const step = (
    base: Omit<PlanStepDraft, 'title' | 'detail' | 'text'>,
    title: ReturnType<typeof txt>,
    detail: ReturnType<typeof txt>,
  ): PlanStepDraft => ({
    ...base,
    title: title.text,
    detail: detail.text,
    text: { title: title.ref, detail: detail.ref },
  });

  const weeks = input.horizonWeeks;
  const hoursPerWeek = Math.max(1, Math.min(40, input.hoursPerWeek));
  const weeklyMinutes = hoursPerWeek * 60;

  // Candidate skills: the role's (in order of importance) or the person's weakest interests.
  const candidateSkills = role
    ? role.skills
    : data.skills
        .filter((s) => input.interests.includes(s.category) || input.interests.includes(s.id))
        .map((s) => s.id);
  const gapsAll = candidateSkills
    .map((id) => ({ skillId: id, from: levelOf(input, id) }))
    .filter((g) => g.from < WORKING)
    .slice(0, 6);

  // Reserve the last quarter of the plan (at least one week) for proof and applying.
  const proofWeeks = Math.max(1, Math.round(weeks / 4));
  const learnWeeks = Math.max(1, weeks - proofWeeks - 1); // week 1 is orientation-plus-learning
  const learnHours = (learnWeeks + 0.5) * hoursPerWeek * 0.85;

  // Greedy allocation: everyone to basic first (in importance order), then top skills to working.
  const targets = new Map<string, SkillLevel>();
  let budget = learnHours;
  for (const g of gapsAll.slice(0, 4)) {
    const need = hoursToClose(g.from, BASIC);
    if (need <= budget || targets.size === 0) {
      targets.set(g.skillId, Math.max(g.from, BASIC) as SkillLevel);
      budget -= need;
    }
  }
  for (const g of gapsAll) {
    const cur = targets.get(g.skillId);
    if (cur === undefined) continue;
    const need = hoursToClose(cur, WORKING);
    if (need > 0 && need <= budget) {
      targets.set(g.skillId, WORKING);
      budget -= need;
    }
  }
  const gaps = gapsAll
    .filter((g) => targets.has(g.skillId))
    .map((g) => ({ skillId: g.skillId, from: g.from, to: targets.get(g.skillId) ?? BASIC }))
    .filter((g) => g.to > g.from);

  // Hours still needed to bring every candidate skill to a working level after this plan.
  const remaining = gapsAll.reduce(
    (sum, g) => sum + hoursToClose(targets.get(g.skillId) ?? g.from, WORKING),
    0,
  );
  const moreWeeks = Math.ceil(remaining / hoursPerWeek);

  // Spread learning weeks over gap skills in proportion to the hours each needs.
  const focusQueue: string[] = [];
  const totalNeed = gaps.reduce((s, g) => s + hoursToClose(g.from, g.to), 0) || 1;
  for (const g of gaps) {
    const share = Math.max(1, Math.round((hoursToClose(g.from, g.to) / totalNeed) * learnWeeks));
    for (let i = 0; i < share; i++) focusQueue.push(g.skillId);
  }
  while (focusQueue.length > learnWeeks) focusQueue.pop();
  while (focusQueue.length < learnWeeks && gaps.length)
    focusQueue.push(gaps[focusQueue.length % gaps.length]!.skillId);

  const used = new Set<string>();
  const resourceFor = new Map<string, LearningResource | undefined>();
  for (const g of gaps) {
    const r = pickResource(g.skillId, input, data.resources, used);
    if (r) used.add(r.id);
    resourceFor.set(g.skillId, r);
  }

  const learnStep = (skillId: string, share: number): PlanStepDraft => {
    const r = resourceFor.get(skillId);
    return step(
      {
        kind: 'learn',
        minutes: mins(weeklyMinutes * share),
        ...(r ? { resourceId: r.id } : {}),
        skillIds: [skillId],
      },
      txt('learnTitle', { skill: { skill: skillId } }),
      r
        ? txt('learnDetailResource', { resource: r.title, provider: r.provider })
        : txt('learnDetailNoResource', { skill: { skill: skillId } }),
    );
  };
  const practiceStep = (skillId: string, share: number): PlanStepDraft =>
    step(
      { kind: 'build', minutes: mins(weeklyMinutes * share), skillIds: [skillId] },
      txt('practiceTitle', { skill: { skill: skillId } }),
      txt('practiceDetail', { skill: { skill: skillId } }),
    );
  const reviewStep = (): PlanStepDraft =>
    step(
      { kind: 'reflect', minutes: 15, skillIds: [], href: '/goals#review' },
      txt('weeklyReviewTitle'),
      txt('weeklyReviewDetail'),
    );

  const planWeeks: PlanDraft['weeks'] = [];

  // Week 1: orientation plus a first taste of the most important skill.
  const first = gaps[0]?.skillId;
  const week1: PlanStepDraft[] = [
    step({ kind: 'reflect', minutes: 15, skillIds: [] }, txt('whyTitle'), txt('whyDetail')),
  ];
  if (input.situation === 'lost-job') {
    week1.push(
      step(
        { kind: 'connect', minutes: 30, skillIds: [], href: '/civic/job-loss' },
        txt('benefitsTitle'),
        txt('benefitsDetail'),
      ),
    );
  }
  if (first) week1.push(learnStep(first, 0.55));
  week1.push(
    step(
      { kind: 'connect', minutes: 20, skillIds: [], href: '/circles' },
      txt('circleTitle'),
      txt('circleDetail'),
    ),
  );
  planWeeks.push({ week: 1, focus: t.orientFocus, steps: week1 });

  // Learning weeks.
  for (let i = 0; i < learnWeeks && planWeeks.length < weeks - proofWeeks; i++) {
    const skillId = focusQueue[i] ?? first;
    const weekNo = planWeeks.length + 1;
    if (!skillId) break;
    const steps = [learnStep(skillId, 0.5), practiceStep(skillId, 0.35)];
    if (weekNo % 4 === 0) steps.push(reviewStep());
    planWeeks.push({
      week: weekNo,
      focus: fill(t.learnFocus, { skill: skillName(skillId) }),
      steps,
    });
  }

  // Proof and apply weeks.
  const proofSkillIds = gaps.slice(0, 3).map((g) => g.skillId);
  const roleVar: PlanTextVar = role ? { role: role.id } : { template: 'titleGeneral' };
  while (planWeeks.length < weeks) {
    const weekNo = planWeeks.length + 1;
    const isLast = weekNo === weeks;
    const steps: PlanStepDraft[] = [];
    if (!isLast || proofWeeks === 1) {
      // The project is made outside Waypoint, so this step links nowhere: it is ticked off
      // on the plan itself. (Proof of work, with its own pages, is not built yet.)
      steps.push(
        step(
          {
            kind: 'build',
            minutes: mins(weeklyMinutes * (isLast ? 0.45 : 0.75)),
            skillIds: proofSkillIds,
          },
          txt('projectTitle', { role: roleVar }),
          txt('projectDetail', { skills: { skills: proofSkillIds } }),
        ),
      );
    }
    if (isLast) {
      steps.push(
        step(
          { kind: 'connect', minutes: 20, skillIds: [], href: '/circles' },
          txt('reviewTitle'),
          txt('reviewDetail'),
        ),
      );
      if (role) {
        steps.push(
          step(
            { kind: 'apply', minutes: mins(weeklyMinutes * 0.3), skillIds: [] },
            txt('applyTitle', { role: { role: role.id } }),
            txt('applyDetail'),
          ),
        );
      }
      steps.push(reviewStep());
    }
    planWeeks.push({ week: weekNo, focus: isLast ? t.reviewFocus : t.proofFocus, steps });
  }

  const summaryVars: Record<string, PlanTextVar> = {
    weeks,
    hours: hoursPerWeek,
    skills: { skills: proofSkillIds, fallback: 'titleGeneral' },
    moreWeeks,
  };
  const title = role ? txt('titleRole', { role: { role: role.id } }) : txt('titleGeneral');
  const summary = txt(moreWeeks > 0 && role ? 'summaryStretch' : 'summary', summaryVars);
  return {
    title: title.text,
    summary: summary.text,
    ...(role ? { targetRoleId: role.id } : {}),
    weeks: planWeeks,
    gaps,
    generatedBy: 'template',
    text: { title: title.ref, summary: summary.ref },
  };
}
