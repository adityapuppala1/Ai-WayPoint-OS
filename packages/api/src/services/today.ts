/**
 * Today: one next step, the route it sits on, and only what changed for this person.
 * Calm by design — a few items, no feed, nothing to scroll forever.
 *
 * The step is chosen by the fixed ladder in `@waypoint/core/next-step` from what Waypoint
 * already knows: a safety note, a reminder that is due, the checklist for the person's
 * situation, money under pressure, their plan, the weekly review. This file gathers those
 * facts and puts words to the chosen step — from the translated messages or the person's own
 * data, never made up.
 */
import { z } from '@hono/zod-openapi';
import { getChecklist } from '@waypoint/content';
import {
  chooseNextStep,
  lifeEventFor,
  localDayKey,
  MODULE_IDS,
  NEXT_STEP_KINDS,
  NEXT_STEP_RUNGS,
  type NextStepCandidate,
  NOT_NOW_COOKIE,
  parseNotNow,
  rankNextSteps,
  weekStartOf,
} from '@waypoint/core';
import {
  and,
  count,
  type Database,
  desc,
  eq,
  goals,
  gt,
  isNull,
  moodCheckins,
  nudges,
  or,
  sql,
  weeklyReviews,
} from '@waypoint/db';
import { englishMessages, type Messages } from '@waypoint/i18n';
import { type ChecklistView, checklistFor } from './civic';
import { reminderTitles } from './health';
import { helpCountry, type Profile } from './me';
import { MONEY_STRESS, moneySummary } from './money';
import { activePlanWithNextStep, getUserSkills, PlanStepSchema, PlanSummarySchema } from './path';
import { relevantSignals, SignalSchema } from './signals';
import { supportDirectory } from './support';

const ModuleSchema = z.enum(MODULE_IDS);

export { NOT_NOW_COOKIE };

export const NextStepSchema = z
  .object({
    kind: z.enum(NEXT_STEP_KINDS),
    /** Where the step sits on the ladder: safety, start, deadline, money, plan, reflection, explore. */
    rung: z.enum(NEXT_STEP_RUNGS),
    module: ModuleSchema,
    title: z.string(),
    detail: z.string().nullable(),
    href: z.string(),
    minutes: z.number().int().nullable(),
    /** One line on why this step comes first. */
    why: z.string().nullable(),
    /** What the step belongs to: the plan's or the checklist's name. */
    from: z.string().nullable(),
    /** The language the title and detail are written in, when it is not the reader's. */
    titleLang: z.string().nullable(),
    /** Stands for this step when the person says "not now". It says nothing about the step. */
    key: z.string(),
    /** Whether another step waits behind this one, so "not now" has somewhere to go. */
    canDefer: z.boolean(),
    /** How to mark the step done, for steps that can be ticked off. */
    done: z
      .discriminatedUnion('type', [
        z.object({ type: z.literal('plan-step'), planId: z.string(), stepId: z.string() }),
        z.object({ type: z.literal('checklist-item'), event: z.string(), itemId: z.string() }),
        z.object({ type: z.literal('note'), noteId: z.string() }),
      ])
      .nullable(),
    planId: z.string().nullable(),
    stepId: z.string().nullable(),
  })
  .openapi('NextStep');

export const TodaySchema = z
  .object({
    name: z.string().nullable(),
    onboarded: z.boolean(),
    /** The person's local date (YYYY-MM-DD): "not now" is remembered for this day only. */
    day: z.string(),
    nextStep: NextStepSchema,
    plan: PlanSummarySchema.nullable(),
    week: z.array(PlanStepSchema),
    /** The plan's own next open step — the sign may be showing something from another module. */
    planStepId: z.string().nullable(),
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
    /** Goals at a glance: how many are active, and whether this week's review is written. */
    goals: z.object({ active: z.number().int(), reviewedThisWeek: z.boolean() }),
    /**
     * Whether the person has saved something of their own yet: a plan, a goal or a check-in.
     * A guest is told where that lives only once there is something to keep.
     */
    hasSaved: z.boolean(),
  })
  .openapi('Today');

export type TodayView = z.infer<typeof TodaySchema>;
export type NextStep = z.infer<typeof NextStepSchema>;

type Words = { title: string; detail: string };

/**
 * Words for Today's next steps, localised by the caller. Every one is an existing message:
 * the step is described the way its own module describes it.
 */
export interface TodayCopy {
  onboard: Words;
  makePlan: Words;
  explore: Words;
  moneyStart: Words;
  checkIn: Words;
  talk: Words;
  review: Words;
  /** Money under pressure, in Money's own words for each level. */
  money: Record<'tight' | 'critical', Words>;
  /** The checklist's urgency bands ("Do now", "This week", …). */
  urgency: Record<ChecklistView['items'][number]['urgency'], string>;
  /** What the person said is going on, as they chose it in getting started. */
  situations: Record<string, string>;
  /** Why a step comes first. `checklist` and `situation` carry one `{placeholder}` each. */
  why: {
    start: string;
    checklist: string;
    money: string;
    plan: string;
    situation: string;
    review: string;
    nothingElse: string;
  };
}

/** Today's words from a language's messages (the website and the API both use this). */
export function todayCopy(m: Messages): TodayCopy {
  const t = m.today;
  return {
    onboard: { title: t.onboardTitle, detail: t.onboardDetail },
    makePlan: { title: t.makePlanTitle, detail: t.makePlanDetail },
    explore: { title: t.exploreTitle, detail: t.exploreDetail },
    moneyStart: { title: t.toolMoney, detail: t.toolMoneyHint },
    checkIn: { title: t.toolMind, detail: t.toolMindHint },
    talk: { title: t.toolAsk, detail: t.toolAskHint },
    review: { title: m.goals.reviewTitle, detail: m.goals.reviewLead },
    money: {
      tight: { title: m.money.stress.tight.title, detail: m.money.stress.tight.body },
      critical: { title: m.money.stress.critical.title, detail: m.money.stress.critical.body },
    },
    urgency: m.civic.urgency,
    situations: m.situations,
    why: t.why,
  };
}

export const TODAY_COPY_EN: TodayCopy = todayCopy(englishMessages);

export async function today(
  db: Database,
  userId: string,
  profile: Profile,
  opts: {
    copy?: TodayCopy;
    matching: boolean;
    locale?: string;
    /** The stored "not now" value (`day:key.key`), as the browser sent it. */
    notNow?: string | null;
  } = { matching: false },
): Promise<TodayView> {
  const copy = opts.copy ?? TODAY_COPY_EN;
  const locale = opts.locale ?? profile.locale;
  const onboarded = Boolean(profile.onboardedAt);
  const now = new Date();
  const day = localDayKey(now, profile.timezone);
  const event = lifeEventFor(profile.situation);
  const [active, skills, money, nudgeRows, list, goalRows, reviewRows, lastCheckin] =
    await Promise.all([
      activePlanWithNextStep(db, userId, locale),
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
            or(isNull(nudges.expiresAt), gt(nudges.expiresAt, now)),
          ),
        )
        // A safety note is read before the limit, not after it: however many newer notes
        // arrive (a reminder three times a day), the check-in after a hard moment stays first.
        .orderBy(sql`(${nudges.priority} = 'critical') desc`, desc(nudges.createdAt))
        .limit(3),
      // The life-event checklist that matches the person's situation, with their progress.
      event && getChecklist(event, profile.country)
        ? checklistFor(db, userId, event, profile.country)
        : null,
      // Only counts and dates: a goal's words stay encrypted and are not read here.
      db
        .select({ status: goals.status, n: count() })
        .from(goals)
        .where(eq(goals.userId, userId))
        .groupBy(goals.status),
      db
        .select({ id: weeklyReviews.id })
        .from(weeklyReviews)
        .where(
          and(
            eq(weeklyReviews.userId, userId),
            eq(weeklyReviews.weekStart, weekStartOf(now, profile.timezone)),
          ),
        )
        .limit(1),
      db
        .select({ at: moodCheckins.createdAt })
        .from(moodCheckins)
        .where(eq(moodCheckins.userId, userId))
        .orderBy(desc(moodCheckins.createdAt))
        .limit(1),
    ]);

  const reminderIds = nudgeRows
    .map((n) => reminderId(n.dedupeKey))
    .filter((id): id is string => Boolean(id));
  const reminderNames = await reminderTitles(db, userId, reminderIds);
  const notes = nudgeRows.map((n) => ({
    id: n.id,
    module: n.module,
    priority: n.priority,
    // A due reminder says what it's about; its words are stored encrypted, not in the nudge.
    title: reminderTitle(n.dedupeKey, reminderNames) ?? n.title,
    body: n.body,
    href: n.href,
  }));

  const goalState = {
    active: Number(goalRows.find((g) => g.status === 'active')?.n ?? 0),
    reviewedThisWeek: reviewRows.length > 0,
  };

  const ranked = rankNextSteps({
    onboarded,
    situation: profile.situation,
    safetyNotes: nudgeRows
      .filter((n) => n.priority === 'critical')
      .map((n) => ({ id: n.id, href: n.href })),
    dueReminders: nudgeRows
      .filter((n) => n.priority !== 'critical' && reminderId(n.dedupeKey))
      .map((n) => ({ id: n.id, href: n.href })),
    checklist: list
      ? {
          event: list.event,
          open: list.items
            .filter((i) => i.status === 'todo')
            .map((i) => ({ id: i.id, urgency: i.urgency })),
        }
      : null,
    money,
    plan: active
      ? {
          id: active.plan.id,
          next: active.next ? { id: active.next.id, href: active.next.href } : null,
        }
      : null,
    goals: goalState,
    checkedInToday: Boolean(
      lastCheckin[0] && localDayKey(lastCheckin[0].at, profile.timezone) === day,
    ),
  });
  const { step, canDefer } = chooseNextStep(ranked, parseNotNow(opts.notNow, day));

  const signalList = await relevantSignals(
    db,
    { userId, profile, skillIds: skills.map((s) => s.skillId), matching: opts.matching },
    { limit: 3, days: 120 },
  );

  return {
    name: profile.displayName,
    onboarded,
    day,
    nextStep: {
      ...describe(step, {
        copy,
        locale,
        situation: profile.situation,
        notes,
        list,
        plan: active,
      }),
      key: step.key,
      rung: step.rung,
      canDefer,
    },
    plan: active?.plan ?? null,
    week: active?.week ?? [],
    planStepId: active?.next?.id ?? null,
    nudges: notes,
    signals: signalList,
    checklist: list
      ? {
          event: list.event,
          title: list.title,
          done: list.progress.done,
          total: list.progress.total,
          href: `/civic/${list.event}`,
        }
      : null,
    emergencyNumber: supportDirectory(helpCountry(profile)).emergency?.general ?? null,
    money,
    goals: goalState,
    hasSaved: Boolean(active) || goalRows.length > 0 || lastCheckin.length > 0,
  };
}

type Described = Omit<NextStep, 'key' | 'rung' | 'canDefer'>;

/**
 * The words for a chosen step. A step only names what it points at; the title, detail and
 * reason come from that thing itself (a checklist item, a plan step, a note) or from `copy`.
 */
function describe(
  step: NextStepCandidate,
  known: {
    copy: TodayCopy;
    locale: string;
    situation: string | null;
    notes: TodayView['nudges'];
    list: ChecklistView | null;
    plan: Awaited<ReturnType<typeof activePlanWithNextStep>>;
  },
): Described {
  const { copy } = known;
  const base = {
    kind: step.kind,
    module: step.module,
    href: step.href,
    minutes: step.minutes,
    from: null,
    titleLang: null,
    done: null,
    planId: null,
    stepId: null,
  };
  // "You told Waypoint: …" — only when the situation has words; otherwise say nothing.
  const said = known.situation ? copy.situations[known.situation] : undefined;
  const becauseOfSituation = said ? copy.why.situation.replace('{situation}', said) : null;

  switch (step.kind) {
    case 'safety-note':
    case 'reminder': {
      const note = known.notes.find((n) => n.id === step.noteId);
      const isReminder = step.kind === 'reminder';
      return {
        ...base,
        title: note?.title ?? '',
        // A safety note's own words say why it is here. A reminder's words are its title;
        // the line stored with it ("Something you asked Waypoint to remind you about") is why.
        detail: isReminder ? null : (note?.body ?? null),
        why: isReminder ? (note?.body ?? null) : null,
        done: { type: 'note', noteId: step.noteId },
      };
    }
    case 'checklist': {
      const item = known.list?.items.find((i) => i.id === step.itemId);
      return {
        ...base,
        title: item?.title ?? known.list?.title ?? '',
        detail: item?.detail ?? null,
        why: copy.why.checklist.replace('{urgency}', copy.urgency[step.urgency]),
        from: known.list?.title ?? null,
        // Checklists are long guidance, written in English until translators finish them.
        titleLang: known.locale === 'en' ? null : 'en',
        done: { type: 'checklist-item', event: step.event, itemId: step.itemId },
      };
    }
    case 'plan-step': {
      const next = known.plan?.next;
      return {
        ...base,
        title: next?.title ?? '',
        detail: next?.detail ?? null,
        minutes: next?.minutes ?? null,
        why: copy.why.plan,
        from: known.plan?.plan.title ?? null,
        done: { type: 'plan-step', planId: step.planId, stepId: step.stepId },
        planId: step.planId,
        stepId: step.stepId,
      };
    }
    case 'money':
      return { ...base, ...copy.money[step.stress], why: copy.why.money };
    case 'onboard':
      return { ...base, ...copy.onboard, why: copy.why.start };
    case 'make-plan':
      return { ...base, ...copy.makePlan, why: becauseOfSituation };
    case 'money-start':
      return { ...base, ...copy.moneyStart, why: becauseOfSituation };
    case 'check-in':
      return { ...base, ...copy.checkIn, why: becauseOfSituation };
    case 'review':
      return { ...base, ...copy.review, why: copy.why.review };
    case 'talk':
      return { ...base, ...copy.talk, why: copy.why.nothingElse };
    case 'explore':
      return { ...base, ...copy.explore, why: copy.why.nothingElse };
  }
}

/** The reminder a due-reminder note is about (`reminder:<id>:<when>`), if it is one. */
function reminderId(dedupeKey: string | null): string | undefined {
  return /^reminder:([0-9a-f-]{36}):/.exec(dedupeKey ?? '')?.[1];
}

function reminderTitle(dedupeKey: string | null, names: Map<string, string>): string | undefined {
  const id = reminderId(dedupeKey);
  return id ? names.get(id) : undefined;
}
