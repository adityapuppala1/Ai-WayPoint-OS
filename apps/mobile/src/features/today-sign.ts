/**
 * What the sign on Today says about its step, and what goes around it. The step can come from
 * any module (a safety note, a checklist item, a reminder, money, the plan), so only a plan
 * step is framed as part of the plan; the week marks the plan's own next step whatever the
 * sign shows; and a note that is on the sign is not listed a second time underneath it.
 * The web's Today page makes the same choices.
 */
import type { TodayView } from '@waypoint/api/client';

export interface TodaySign {
  /** "Week 2 of 8 of <plan>": only when the step on the sign is the plan's own. */
  planContext: { plan: string; week: number; weeks: number } | null;
  /** What the step belongs to (the plan's or the checklist's name), as the API names it. */
  from: string | null;
  /** One line on why this step comes first. */
  why: string | null;
  /** The language the title, detail and "from" are written in, when it is not the reader's. */
  lang: string | null;
  /** The station on this week's route that is marked current. */
  currentStepId: string | null;
  /** The notes listed below the sign. */
  notes: TodayView['nudges'];
}

export function todaySign(
  view: Pick<TodayView, 'nextStep' | 'plan' | 'planStepId' | 'nudges'>,
): TodaySign {
  const step = view.nextStep;
  const onSign = step.done?.type === 'note' ? step.done.noteId : null;
  return {
    planContext:
      step.kind === 'plan-step' && view.plan
        ? { plan: view.plan.title, week: view.plan.currentWeek, weeks: view.plan.horizonWeeks }
        : null,
    from: step.from,
    why: step.why,
    lang: step.titleLang,
    currentStepId: view.planStepId,
    notes: view.nudges.filter((n) => n.id !== onSign),
  };
}
