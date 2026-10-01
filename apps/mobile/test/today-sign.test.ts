import type { TodayView } from '@waypoint/api/client';
import { describe, expect, it } from 'vitest';
import { todaySign } from '../src/features/today-sign';

type Step = TodayView['nextStep'];

const plan: NonNullable<TodayView['plan']> = {
  id: 'plan-1',
  title: 'Become a data analyst',
  summary: 'Eight weeks, a few hours each.',
  status: 'active',
  targetRoleId: null,
  targetRoleTitle: null,
  horizonWeeks: 8,
  hoursPerWeek: 5,
  generatedBy: 'template',
  startedAt: '2026-09-01T00:00:00.000Z',
  completedAt: null,
  progress: { done: 3, total: 24 },
  currentWeek: 2,
};

const planStep: Step = {
  kind: 'plan-step',
  rung: 'plan',
  module: 'path',
  title: 'Finish the spreadsheet course',
  detail: null,
  href: '/path/plans/plan-1',
  minutes: 30,
  why: 'It is next on your plan.',
  from: 'Become a data analyst',
  titleLang: null,
  key: 'k1',
  canDefer: true,
  done: { type: 'plan-step', planId: 'plan-1', stepId: 'step-2' },
  planId: 'plan-1',
  stepId: 'step-2',
};

const checklistStep: Step = {
  kind: 'checklist',
  rung: 'deadline',
  module: 'civic',
  title: 'Get the decision and your final pay details in writing',
  detail: 'Ask for it before your last day.',
  href: '/civic/job-loss',
  minutes: null,
  why: 'It has a deadline.',
  from: 'After losing a job',
  titleLang: 'en',
  key: 'k2',
  canDefer: true,
  done: { type: 'checklist-item', event: 'job-loss', itemId: 'writing' },
  planId: null,
  stepId: null,
};

const safetyStep: Step = {
  kind: 'safety-note',
  rung: 'safety',
  module: 'today',
  title: 'How are you doing today?',
  detail: 'Help is here whenever you want it.',
  href: '/support',
  minutes: null,
  why: null,
  from: null,
  titleLang: null,
  key: 'k3',
  canDefer: false,
  done: { type: 'note', noteId: 'note-crisis' },
  planId: null,
  stepId: null,
};

const note = (id: string, priority = 'normal') => ({
  id,
  module: 'support',
  priority,
  title: `Note ${id}`,
  body: null,
  href: '/support',
});

const today = (nextStep: Step) => ({
  nextStep,
  plan,
  planStepId: 'step-2',
  nudges: [note('note-crisis', 'critical'), note('note-other')],
});

describe('the sign on the phone’s Today screen', () => {
  it('shows a plan step as part of the plan, and marks it on the week', () => {
    const sign = todaySign(today(planStep));
    expect(sign.planContext).toEqual({ plan: 'Become a data analyst', week: 2, weeks: 8 });
    expect(sign.from).toBe('Become a data analyst');
    expect(sign.why).toBe('It is next on your plan.');
    expect(sign.currentStepId).toBe('step-2');
    expect(sign.notes.map((n) => n.id)).toEqual(['note-crisis', 'note-other']);
  });

  it('does not present a checklist item as coming from the plan', () => {
    const sign = todaySign(today(checklistStep));
    expect(sign.planContext).toBeNull();
    expect(sign.from).toBe('After losing a job');
    expect(sign.why).toBe('It has a deadline.');
    // Written in English whatever the reader's language: a screen reader is told so.
    expect(sign.lang).toBe('en');
    // The plan's own next step is still where the person is on the week.
    expect(sign.currentStepId).toBe('step-2');
  });

  it('does not present the safety note as a plan step, or list it twice', () => {
    const sign = todaySign(today(safetyStep));
    expect(sign.planContext).toBeNull();
    expect(sign.from).toBeNull();
    expect(sign.currentStepId).toBe('step-2');
    expect(sign.notes.map((n) => n.id)).toEqual(['note-other']);
  });

  it('marks no station when the plan has nothing left to do', () => {
    const sign = todaySign({ ...today(checklistStep), planStepId: null });
    expect(sign.currentStepId).toBeNull();
  });
});
