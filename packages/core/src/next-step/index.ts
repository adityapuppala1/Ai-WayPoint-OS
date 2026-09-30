/**
 * Today's one next step, chosen from everything Waypoint already knows about a person —
 * not only their career plan.
 *
 * Pure and deterministic: the same facts always give the same ranked steps. No AI, and no
 * words: a step names what it points at (a checklist item, a plan step, a note the person is
 * waiting on), and whoever shows it takes the words from the translated messages or from
 * the person's own data. Nothing here can invent a task.
 *
 * The ladder is fixed. A step on a higher rung always comes before one on a lower rung:
 *
 *   1. safety      a safety note waiting for the person (the check-in after a hard moment)
 *   2. start       getting started, until it is done — everything below depends on it
 *   3. deadline    a reminder the person set that is due; checklist items for now or this week
 *   4. money       money under pressure, by the numbers the person entered
 *   5. plan        the open step of their plan; the rest of the checklist; making a plan
 *   6. reflection  the weekly review; a short check-in
 *   7. explore     something to look at when nothing is waiting — always present
 */
import type { LifeEvent, Urgency } from '@waypoint/content/types';
import { MODULE_IDS, type ModuleId, SITUATIONS, type Situation } from '../types';

export const NEXT_STEP_RUNGS = [
  'safety',
  'start',
  'deadline',
  'money',
  'plan',
  'reflection',
  'explore',
] as const;
export type NextStepRung = (typeof NEXT_STEP_RUNGS)[number];

export const NEXT_STEP_KINDS = [
  'safety-note',
  'onboard',
  'reminder',
  'checklist',
  'money',
  'plan-step',
  'money-start',
  'make-plan',
  'review',
  'check-in',
  'explore',
  'talk',
] as const;
export type NextStepKind = (typeof NEXT_STEP_KINDS)[number];

/** Why a step is offered. Whoever shows the step words this from translated text. */
export const NEXT_STEP_REASONS = [
  'safety',
  'start',
  'reminder',
  'checklist',
  'money',
  'plan',
  'situation',
  'review',
  'nothing-else',
] as const;
export type NextStepReason = (typeof NEXT_STEP_REASONS)[number];

/** What Waypoint already knows. Every field comes from the person's own data. */
export interface NextStepFacts {
  /** Whether getting started is finished. */
  onboarded: boolean;
  /** What they said is going on (one of SITUATIONS); anything else counts as not said. */
  situation: string | null;
  /** Safety notes waiting to be read, newest first (the check-in after a hard moment). */
  safetyNotes: Array<{ id: string; href: string | null }>;
  /** Notes for reminders the person set that are now due, in the order to show them. */
  dueReminders: Array<{ id: string; href: string | null }>;
  /** Open items of the checklist written for their situation. Any order. */
  checklist: { event: LifeEvent; open: Array<{ id: string; urgency: Urgency }> } | null;
  /** Money pressure — only when they entered their numbers. */
  money: { stress: 'stable' | 'watch' | 'tight' | 'critical' } | null;
  /** Their active plan and its next open step, if any. */
  plan: { id: string; next: { id: string; href: string | null } | null } | null;
  goals: { active: number; reviewedThisWeek: boolean };
  checkedInToday: boolean;
}

interface StepBase {
  /**
   * Stands for this step when the person says "not now". Letters and digits only, and it
   * says nothing about the step: it is kept in the browser, where a name such as
   * "job-loss" would tell anyone who looked what is going on in this person's life.
   */
  key: string;
  rung: NextStepRung;
  module: ModuleId;
  href: string;
  /** How long it takes, where that is known and the same for everyone. */
  minutes: number | null;
  why: NextStepReason;
}

export type NextStepCandidate = StepBase &
  (
    | { kind: 'safety-note' | 'reminder'; noteId: string }
    | { kind: 'checklist'; event: LifeEvent; itemId: string; urgency: Urgency }
    | { kind: 'money'; stress: 'tight' | 'critical' }
    | { kind: 'plan-step'; planId: string; stepId: string }
    | {
        kind: 'onboard' | 'money-start' | 'make-plan' | 'review' | 'check-in' | 'explore' | 'talk';
      }
  );

// ───────────────────────────── Situations ─────────────────────────────

/** The checklist written for a situation. Four situations have none yet. */
const SITUATION_EVENT: Partial<Record<Situation, LifeEvent>> = {
  'lost-job': 'job-loss',
  'first-job': 'first-job',
  'new-country': 'moving-country',
  retiring: 'retirement',
  'health-change': 'serious-illness',
  'running-business': 'starting-business',
};

interface SituationRoute {
  /**
   * What stands in for a plan step when there is no plan. Only situations that are about
   * work or learning are offered a career plan: someone caring for a relative, or whose
   * health changed, did not come for one.
   */
  plan: 'make-plan' | 'money-start' | null;
  /** Offer the ten-second check-in (once a day at most). */
  checkIn: boolean;
  /** What is left when nothing is waiting: roles that fit, or talking it through. */
  last: 'explore' | 'talk';
}

const STEADY: SituationRoute = { plan: null, checkIn: false, last: 'explore' };

const ROUTES: Record<Situation, SituationRoute> = {
  'first-job': { plan: 'make-plan', checkIn: false, last: 'explore' },
  'lost-job': { plan: 'make-plan', checkIn: true, last: 'explore' },
  'changing-career': { plan: 'make-plan', checkIn: false, last: 'explore' },
  studying: { plan: 'make-plan', checkIn: false, last: 'explore' },
  // Irregular income: knowing how long the money lasts comes before choosing a direction.
  'gig-work': { plan: 'money-start', checkIn: false, last: 'explore' },
  'running-business': { plan: null, checkIn: false, last: 'talk' },
  caring: { plan: null, checkIn: true, last: 'talk' },
  'new-country': { plan: null, checkIn: false, last: 'talk' },
  retiring: { plan: null, checkIn: false, last: 'talk' },
  'health-change': { plan: null, checkIn: true, last: 'talk' },
  steady: STEADY,
};

function asSituation(value: string | null | undefined): Situation | null {
  return (SITUATIONS as readonly string[]).includes(value ?? '') ? (value as Situation) : null;
}

export function lifeEventFor(situation: string | null | undefined): LifeEvent | undefined {
  const s = asSituation(situation);
  return s ? SITUATION_EVENT[s] : undefined;
}

// ─────────────────────────────── Ranking ───────────────────────────────

const URGENCY_ORDER: Record<Urgency, number> = {
  now: 0,
  'this-week': 1,
  'this-month': 2,
  later: 3,
};

/** FNV-1a, 32 bits, in base 36: short, stable, and unreadable. Not a secret, not security. */
function stepKey(id: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).padStart(7, '0');
}

/** The module a link belongs to: `/civic/job-loss` → civic. */
function moduleForHref(href: string | null): ModuleId | undefined {
  if (!href) return undefined;
  const seg = (href.split('/')[1] ?? '').split(/[?#]/)[0] ?? '';
  return (MODULE_IDS as readonly string[]).includes(seg) ? (seg as ModuleId) : undefined;
}

/**
 * Every step that is true for this person right now, most pressing first. Never empty:
 * the last one is always something to explore.
 */
export function rankNextSteps(facts: NextStepFacts): NextStepCandidate[] {
  const route = ROUTES[asSituation(facts.situation) ?? 'steady'] ?? STEADY;
  const out: NextStepCandidate[] = [];

  // 1. Safety.
  for (const note of facts.safetyNotes)
    out.push({
      kind: 'safety-note',
      key: stepKey(`safety-note:${note.id}`),
      rung: 'safety',
      module: moduleForHref(note.href) ?? 'today',
      href: note.href ?? '/support',
      minutes: null,
      why: 'safety',
      noteId: note.id,
    });

  // 2. Getting started. The steps below still follow, so "not now" has somewhere to go.
  if (!facts.onboarded)
    out.push({
      kind: 'onboard',
      key: stepKey('onboard'),
      rung: 'start',
      module: 'today',
      href: '/start',
      minutes: 2,
      why: 'start',
    });

  // 3. Deadlines. A time the person chose themselves comes before one a checklist suggests.
  for (const note of facts.dueReminders)
    out.push({
      kind: 'reminder',
      key: stepKey(`reminder:${note.id}`),
      rung: 'deadline',
      module: moduleForHref(note.href) ?? 'health',
      href: note.href ?? '/health#reminders',
      minutes: null,
      why: 'reminder',
      noteId: note.id,
    });

  // A checklist gives every open "do now" item, then one more: its next open item. That
  // one has a deadline if it is for this week; otherwise it waits behind the plan.
  const list = facts.checklist;
  const open = list
    ? list.open
        .map((item, index) => ({ item, index }))
        .sort(
          (a, b) =>
            URGENCY_ORDER[a.item.urgency] - URGENCY_ORDER[b.item.urgency] || a.index - b.index,
        )
        .map((x) => x.item)
    : [];
  const checklistStep = (
    item: { id: string; urgency: Urgency },
    rung: NextStepRung,
  ): NextStepCandidate => ({
    kind: 'checklist',
    key: stepKey(`checklist:${list?.event}:${item.id}`),
    rung,
    module: 'civic',
    href: `/civic/${list?.event}`,
    minutes: null,
    why: 'checklist',
    event: list?.event as LifeEvent,
    itemId: item.id,
    urgency: item.urgency,
  });
  for (const item of open.filter((i) => i.urgency === 'now'))
    out.push(checklistStep(item, 'deadline'));
  const after = open.find((i) => i.urgency !== 'now');
  if (after?.urgency === 'this-week') out.push(checklistStep(after, 'deadline'));

  // 4. Money under pressure.
  const stress = facts.money?.stress;
  if (stress === 'tight' || stress === 'critical')
    out.push({
      kind: 'money',
      key: stepKey(`money:${stress}`),
      rung: 'money',
      module: 'money',
      href: '/money',
      minutes: null,
      why: 'money',
      stress,
    });

  // 5. The plan.
  if (facts.plan?.next) {
    const { id, next } = facts.plan;
    out.push({
      kind: 'plan-step',
      key: stepKey(`plan-step:${next.id}`),
      rung: 'plan',
      module: moduleForHref(next.href) ?? 'path',
      href: next.href ?? `/path/plans/${id}#step-${next.id}`,
      // The step's own length: whoever shows it knows the step.
      minutes: null,
      why: 'plan',
      planId: id,
      stepId: next.id,
    });
  }
  if (after && after.urgency !== 'this-week') out.push(checklistStep(after, 'plan'));
  if (!facts.plan && route.plan === 'make-plan')
    out.push({
      kind: 'make-plan',
      key: stepKey('make-plan'),
      rung: 'plan',
      module: 'path',
      href: '/path/new',
      minutes: 5,
      why: 'situation',
    });
  if (!facts.plan && route.plan === 'money-start' && !facts.money)
    out.push({
      kind: 'money-start',
      key: stepKey('money-start'),
      rung: 'plan',
      module: 'money',
      href: '/money',
      minutes: 2,
      why: 'situation',
    });

  // 6. Reflection.
  if (facts.goals.active > 0 && !facts.goals.reviewedThisWeek)
    out.push({
      kind: 'review',
      key: stepKey('review'),
      rung: 'reflection',
      module: 'goals',
      href: '/goals#review',
      minutes: 5,
      why: 'review',
    });
  if (route.checkIn && !facts.checkedInToday)
    out.push({
      kind: 'check-in',
      key: stepKey('check-in'),
      rung: 'reflection',
      module: 'mind',
      href: '/mind',
      minutes: null,
      why: 'situation',
    });

  // 7. Always something to look at.
  out.push(
    route.last === 'talk'
      ? {
          kind: 'talk',
          key: stepKey('talk'),
          rung: 'explore',
          module: 'ask',
          href: '/ask',
          minutes: null,
          why: 'nothing-else',
        }
      : {
          kind: 'explore',
          key: stepKey('explore'),
          rung: 'explore',
          module: 'path',
          href: '/path',
          minutes: 5,
          why: 'nothing-else',
        },
  );
  return out;
}

// ─────────────────────────────── Not now ───────────────────────────────

/**
 * The step to show: the first one the person has not set aside today. `canDefer` says
 * whether another step waits behind it — the last one left cannot be set aside, so the
 * sign is never empty.
 */
export function chooseNextStep(
  ranked: NextStepCandidate[],
  notNow: Iterable<string>,
): { step: NextStepCandidate; canDefer: boolean } {
  const setAside = new Set(notNow);
  const remaining = ranked.filter((c) => !setAside.has(c.key));
  const step = remaining[0] ?? ranked.at(-1);
  if (!step) throw new Error('rankNextSteps always returns at least one step');
  return { step, canDefer: remaining.length > 1 };
}

/**
 * The cookie that remembers which steps the person set aside today. It holds the day and
 * the steps' keys — nothing readable — and is only ever read for that day.
 */
export const NOT_NOW_COOKIE = 'wp-not-now';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const KEY = /^[0-9a-z]{1,16}$/;
/** More than anyone could set aside in a day; keeps the stored value small. */
const MAX_NOT_NOW = 40;

/**
 * The keys set aside on `day` (the person's local date, YYYY-MM-DD), read from the stored
 * value `day:key.key.key`. Another day's list, or anything not written by addNotNow, reads
 * as empty: "not now" lasts for the day and no longer.
 */
export function parseNotNow(value: string | null | undefined, day: string): string[] {
  if (!value || !DAY.test(day)) return [];
  const at = value.indexOf(':');
  if (at < 0 || value.slice(0, at) !== day) return [];
  return value
    .slice(at + 1)
    .split('.')
    .filter((k) => KEY.test(k))
    .slice(-MAX_NOT_NOW);
}

/** The value to store after the person sets one more step aside on `day`. */
export function addNotNow(value: string | null | undefined, day: string, key: string): string {
  const keys = parseNotNow(value, day);
  if (KEY.test(key) && !keys.includes(key)) keys.push(key);
  return `${day}:${keys.slice(-MAX_NOT_NOW).join('.')}`;
}

// ───────────────────────────── Module order ─────────────────────────────

/** A module Today lists: every one except Today itself and the organisation console. */
export type ListedModule = Exclude<ModuleId, 'today' | 'org'>;

/** The listed modules in navigation order. */
const MODULES: ListedModule[] = [
  'path',
  'shield',
  'ask',
  'signals',
  'circles',
  'money',
  'mind',
  'health',
  'civic',
  'surroundings',
  'goals',
];

/** The four modules that matter most in each situation. A fixed table, not a guess. */
const FIRST: Record<Situation, ListedModule[]> = {
  'first-job': ['path', 'civic', 'shield', 'money'],
  'lost-job': ['money', 'civic', 'path', 'shield'],
  'changing-career': ['path', 'signals', 'money', 'goals'],
  studying: ['path', 'goals', 'mind', 'money'],
  'running-business': ['civic', 'money', 'shield', 'signals'],
  'gig-work': ['money', 'shield', 'path', 'civic'],
  caring: ['mind', 'circles', 'health', 'civic'],
  'new-country': ['civic', 'shield', 'circles', 'surroundings'],
  retiring: ['civic', 'money', 'shield', 'health'],
  'health-change': ['civic', 'health', 'mind', 'money'],
  steady: ['path', 'goals', 'signals', 'money'],
};

/**
 * The modules in the order Today lists them for a situation: the four that matter most,
 * then the rest as they appear in the navigation. With no situation, navigation order.
 */
export function moduleOrder(situation: string | null | undefined): ListedModule[] {
  const s = asSituation(situation);
  const first = s ? FIRST[s] : [];
  return [...first, ...MODULES.filter((m) => !first.includes(m))];
}
