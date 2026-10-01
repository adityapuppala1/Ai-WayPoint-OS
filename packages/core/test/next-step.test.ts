import { describe, expect, it } from 'vitest';
import {
  addNotNow,
  chooseNextStep,
  lifeEventFor,
  moduleForHref,
  moduleOrder,
  NEXT_STEP_RUNGS,
  type NextStepFacts,
  parseNotNow,
  rankNextSteps,
} from '../src/next-step';
import { MODULE_IDS, SITUATIONS } from '../src/types';

/** Someone who finished getting started and about whom nothing else is known. */
const nothing: NextStepFacts = {
  onboarded: true,
  situation: null,
  safetyNotes: [],
  dueReminders: [],
  checklist: null,
  money: null,
  plan: null,
  goals: { active: 0, reviewedThisWeek: false },
  checkedInToday: false,
};

const facts = (over: Partial<NextStepFacts>): NextStepFacts => ({ ...nothing, ...over });
const kinds = (f: NextStepFacts) => rankNextSteps(f).map((c) => c.kind);
const rungIndex = (rung: string) => (NEXT_STEP_RUNGS as readonly string[]).indexOf(rung);

const jobLoss = {
  event: 'job-loss' as const,
  open: [
    { id: 'written-decision', urgency: 'now' as const },
    { id: 'unemployment-support', urgency: 'now' as const },
    { id: 'runway', urgency: 'this-week' as const },
    { id: 'lenders', urgency: 'this-week' as const },
    { id: 'next-role', urgency: 'this-month' as const },
    { id: 'routine', urgency: 'later' as const },
  ],
};

describe('the next step: nothing known', () => {
  it('before getting started, asks where the person is — and offers something else behind it', () => {
    const ranked = rankNextSteps(facts({ onboarded: false }));
    expect(ranked.map((c) => c.kind)).toEqual(['onboard', 'explore']);
    expect(ranked[0]).toMatchObject({ rung: 'start', href: '/start', minutes: 2, why: 'start' });
  });

  it('after getting started with no situation, looks at roles', () => {
    const ranked = rankNextSteps(nothing);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]).toMatchObject({
      kind: 'explore',
      rung: 'explore',
      module: 'path',
      href: '/path',
      why: 'nothing-else',
    });
  });

  it('always ends with something to explore, whatever the situation', () => {
    for (const situation of [...SITUATIONS, null, 'not-a-situation']) {
      const last = rankNextSteps(facts({ situation })).at(-1);
      expect(last?.rung, String(situation)).toBe('explore');
    }
  });

  it('is deterministic: the same facts give the same steps and the same keys', () => {
    const f = facts({ situation: 'lost-job', checklist: jobLoss, money: { stress: 'tight' } });
    expect(rankNextSteps(f)).toEqual(rankNextSteps(f));
  });
});

describe('the next step: each rung', () => {
  it('safety: a safety note comes before everything, even getting started', () => {
    const ranked = rankNextSteps(
      facts({
        onboarded: false,
        safetyNotes: [{ id: 'n1', href: '/support' }],
        dueReminders: [{ id: 'n2', href: '/health#reminders' }],
      }),
    );
    expect(ranked.map((c) => c.kind)).toEqual(['safety-note', 'onboard', 'reminder', 'explore']);
    expect(ranked[0]).toMatchObject({ rung: 'safety', noteId: 'n1', href: '/support' });
  });

  it('safety: a note without a link opens Get help now', () => {
    const [first] = rankNextSteps(facts({ safetyNotes: [{ id: 'n1', href: null }] }));
    expect(first?.href).toBe('/support');
  });

  it('deadline: a reminder that is due points at where the person set it', () => {
    const [first] = rankNextSteps(
      facts({ dueReminders: [{ id: 'n1', href: '/health#reminders' }] }),
    );
    expect(first).toMatchObject({
      kind: 'reminder',
      rung: 'deadline',
      module: 'health',
      noteId: 'n1',
      href: '/health#reminders',
      why: 'reminder',
    });
  });

  it('deadline: every open “do now” item, then one for this week', () => {
    const ranked = rankNextSteps(facts({ situation: 'lost-job', checklist: jobLoss }));
    const deadline = ranked.filter((c) => c.rung === 'deadline');
    expect(deadline.map((c) => (c.kind === 'checklist' ? c.itemId : c.kind))).toEqual([
      'written-decision',
      'unemployment-support',
      'runway',
    ]);
    expect(deadline[0]).toMatchObject({
      kind: 'checklist',
      module: 'civic',
      event: 'job-loss',
      urgency: 'now',
      href: '/civic/job-loss',
      why: 'checklist',
    });
  });

  it('deadline: items arrive in any order and leave by urgency', () => {
    const ranked = rankNextSteps(
      facts({
        situation: 'lost-job',
        checklist: {
          event: 'job-loss',
          open: [
            { id: 'later-thing', urgency: 'later' },
            { id: 'week-thing', urgency: 'this-week' },
            { id: 'now-thing', urgency: 'now' },
          ],
        },
      }),
    );
    expect(ranked.filter((c) => c.kind === 'checklist').map((c) => c.itemId)).toEqual([
      'now-thing',
      'week-thing',
    ]);
  });

  it('plan: with nothing urgent left, the rest of the checklist waits behind the plan step', () => {
    const ranked = rankNextSteps(
      facts({
        situation: 'lost-job',
        checklist: {
          event: 'job-loss',
          open: [
            { id: 'next-role', urgency: 'this-month' },
            { id: 'routine', urgency: 'later' },
          ],
        },
        plan: { id: 'p1', next: { id: 's1', href: null } },
      }),
    );
    expect(ranked.filter((c) => c.rung === 'plan')).toMatchObject([
      { kind: 'plan-step', planId: 'p1', stepId: 's1', href: '/path/plans/p1#step-s1' },
      { kind: 'checklist', itemId: 'next-role', urgency: 'this-month' },
    ]);
    expect(ranked.some((c) => c.rung === 'deadline')).toBe(false);
  });

  it('money: only pressure counts, and only when the person entered their numbers', () => {
    expect(kinds(facts({ money: null }))).not.toContain('money');
    expect(kinds(facts({ money: { stress: 'stable' } }))).not.toContain('money');
    expect(kinds(facts({ money: { stress: 'watch' } }))).not.toContain('money');
    for (const stress of ['tight', 'critical'] as const) {
      const [first] = rankNextSteps(facts({ money: { stress } }));
      expect(first).toMatchObject({
        kind: 'money',
        rung: 'money',
        module: 'money',
        href: '/money',
        stress,
        why: 'money',
      });
    }
  });

  it('plan: the open step of the plan, at its own link when it has one', () => {
    const [own] = rankNextSteps(
      facts({ plan: { id: 'p1', next: { id: 's1', href: '/civic/job-loss' } } }),
    );
    expect(own).toMatchObject({
      kind: 'plan-step',
      rung: 'plan',
      module: 'civic',
      href: '/civic/job-loss',
      why: 'plan',
    });
    const [plain] = rankNextSteps(facts({ plan: { id: 'p1', next: { id: 's1', href: null } } }));
    expect(plain).toMatchObject({ module: 'path', href: '/path/plans/p1#step-s1' });
  });

  it('plan: a plan is only suggested to people whose situation is about work or learning', () => {
    for (const situation of ['first-job', 'lost-job', 'changing-career', 'studying']) {
      const ranked = rankNextSteps(facts({ situation }));
      expect(ranked[0], situation).toMatchObject({
        kind: 'make-plan',
        rung: 'plan',
        href: '/path/new',
        why: 'situation',
      });
    }
    for (const situation of [
      'caring',
      'health-change',
      'retiring',
      'new-country',
      'running-business',
      'steady',
    ])
      expect(kinds(facts({ situation })), situation).not.toContain('make-plan');
  });

  it('plan: nobody with an active plan is asked to make another', () => {
    expect(kinds(facts({ situation: 'lost-job', plan: { id: 'p1', next: null } }))).not.toContain(
      'make-plan',
    );
  });

  it('plan: gig work starts with money, until the numbers are in', () => {
    expect(rankNextSteps(facts({ situation: 'gig-work' }))[0]).toMatchObject({
      kind: 'money-start',
      rung: 'plan',
      module: 'money',
      href: '/money',
      why: 'situation',
    });
    expect(kinds(facts({ situation: 'gig-work', money: { stress: 'stable' } }))).toEqual([
      'explore',
    ]);
  });

  it('reflection: the weekly review, once there is a goal and until it is done', () => {
    expect(kinds(facts({ goals: { active: 0, reviewedThisWeek: false } }))).not.toContain('review');
    expect(kinds(facts({ goals: { active: 2, reviewedThisWeek: true } }))).not.toContain('review');
    const [first] = rankNextSteps(facts({ goals: { active: 1, reviewedThisWeek: false } }));
    expect(first).toMatchObject({
      kind: 'review',
      rung: 'reflection',
      module: 'goals',
      href: '/goals#review',
      minutes: 5,
      why: 'review',
    });
  });

  it('reflection: someone caring for another person is asked how they are, not about a career', () => {
    const ranked = rankNextSteps(facts({ situation: 'caring' }));
    expect(ranked.map((c) => c.kind)).toEqual(['check-in', 'talk']);
    expect(ranked[0]).toMatchObject({
      rung: 'reflection',
      module: 'mind',
      href: '/mind',
      why: 'situation',
    });
    expect(ranked[1]).toMatchObject({ rung: 'explore', module: 'ask', href: '/ask' });
    // Once a day is enough.
    expect(kinds(facts({ situation: 'caring', checkedInToday: true }))).toEqual(['talk']);
  });

  it('explore: roles for work situations, talking it through for the others', () => {
    for (const situation of ['caring', 'new-country', 'retiring', 'health-change'])
      expect(kinds(facts({ situation })).at(-1), situation).toBe('talk');
    for (const situation of ['lost-job', 'first-job', 'steady', 'gig-work', 'studying'])
      expect(kinds(facts({ situation })).at(-1), situation).toBe('explore');
  });
});

describe('the next step: the whole ladder', () => {
  const everything = facts({
    situation: 'lost-job',
    safetyNotes: [{ id: 'note-safety', href: '/support' }],
    dueReminders: [
      { id: 'note-r1', href: '/health#reminders' },
      { id: 'note-r2', href: null },
    ],
    checklist: jobLoss,
    money: { stress: 'critical' },
    plan: { id: 'p1', next: { id: 's1', href: null } },
    goals: { active: 3, reviewedThisWeek: false },
    checkedInToday: false,
  });

  it('everything known: safety, deadlines, money, the plan, reflection, exploring', () => {
    expect(kinds(everything)).toEqual([
      'safety-note',
      'reminder',
      'reminder',
      'checklist',
      'checklist',
      'checklist',
      'money',
      'plan-step',
      'review',
      'check-in',
      'explore',
    ]);
  });

  it('rungs never interleave', () => {
    const order = rankNextSteps(everything).map((c) => rungIndex(c.rung));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i >= 0)).toBe(true);
  });

  it('ties keep the order they arrived in: two reminders, two “do now” items', () => {
    const ranked = rankNextSteps(everything);
    expect(ranked.flatMap((c) => (c.kind === 'reminder' ? [c.noteId] : []))).toEqual([
      'note-r1',
      'note-r2',
    ]);
    expect(
      ranked.flatMap((c) => (c.kind === 'checklist' && c.urgency === 'now' ? [c.itemId] : [])),
    ).toEqual(['written-decision', 'unemployment-support']);
  });

  it('on one rung, what the person set themselves comes before what a checklist says', () => {
    const deadline = rankNextSteps(everything).filter((c) => c.rung === 'deadline');
    expect(deadline.map((c) => c.kind)).toEqual([
      'reminder',
      'reminder',
      'checklist',
      'checklist',
      'checklist',
    ]);
  });

  it('every step has its own key, made only of letters and digits', () => {
    const keys = rankNextSteps(everything).map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[0-9a-z]{6,12}$/);
  });

  it('a key says nothing about the step it stands for', () => {
    const [item] = rankNextSteps(facts({ situation: 'lost-job', checklist: jobLoss }));
    expect(item?.key).not.toContain('job');
    expect(item?.key).not.toContain('checklist');
  });

  it('never sends a carer, or someone whose health changed, to make a career plan', () => {
    for (const situation of ['caring', 'health-change'])
      for (const c of rankNextSteps(facts({ situation }))) expect(c.href).not.toBe('/path/new');
  });
});

describe('not now', () => {
  const ranked = rankNextSteps(
    facts({
      situation: 'lost-job',
      checklist: jobLoss,
      goals: { active: 1, reviewedThisWeek: false },
    }),
  );

  it('with nothing set aside, shows the first step and can move on', () => {
    const chosen = chooseNextStep(ranked, []);
    expect(chosen.step).toBe(ranked[0]);
    expect(chosen.canDefer).toBe(true);
  });

  it('moves to the next step, and the one after', () => {
    const one = chooseNextStep(ranked, [ranked[0]!.key]);
    expect(one.step).toBe(ranked[1]);
    const two = chooseNextStep(ranked, [ranked[1]!.key, ranked[0]!.key]);
    expect(two.step).toBe(ranked[2]);
  });

  it('the last step left has nothing behind it, so it cannot be set aside', () => {
    const allButLast = ranked.slice(0, -1).map((c) => c.key);
    const chosen = chooseNextStep(ranked, allButLast);
    expect(chosen.step).toBe(ranked.at(-1));
    expect(chosen.canDefer).toBe(false);
  });

  it('never leaves the sign empty, even if every key was set aside', () => {
    const chosen = chooseNextStep(
      ranked,
      ranked.map((c) => c.key),
    );
    expect(chosen.step).toBe(ranked.at(-1));
    expect(chosen.canDefer).toBe(false);
  });

  it('ignores keys it does not know', () => {
    expect(chooseNextStep(ranked, ['zzzzzz']).step).toBe(ranked[0]);
  });

  it('is remembered for one day only', () => {
    const monday = addNotNow(undefined, '2026-09-28', 'abc123');
    expect(parseNotNow(monday, '2026-09-28')).toEqual(['abc123']);
    expect(parseNotNow(monday, '2026-09-29')).toEqual([]);
    // Tuesday starts a fresh list rather than adding to Monday's.
    const tuesday = addNotNow(monday, '2026-09-29', 'def456');
    expect(parseNotNow(tuesday, '2026-09-29')).toEqual(['def456']);
  });

  it('adds to today’s list without repeating a key', () => {
    let value = addNotNow(undefined, '2026-09-28', 'abc123');
    value = addNotNow(value, '2026-09-28', 'def456');
    value = addNotNow(value, '2026-09-28', 'abc123');
    expect(parseNotNow(value, '2026-09-28')).toEqual(['abc123', 'def456']);
  });

  it('reads nothing from a value it did not write', () => {
    for (const bad of [undefined, '', 'nonsense', '2026-09-28', '2026-09-28:<script>', ':abc'])
      expect(parseNotNow(bad, '2026-09-28'), String(bad)).toEqual([]);
    expect(parseNotNow('2026-09-28:abc123.$$$.def456', '2026-09-28')).toEqual(['abc123', 'def456']);
  });

  it('keeps the keys the server gives (a keyed hash in base64url), and nothing longer', () => {
    const value = addNotNow(undefined, '2026-09-28', 'aB3_x-9QwErTyUiO');
    expect(parseNotNow(value, '2026-09-28')).toEqual(['aB3_x-9QwErTyUiO']);
    expect(parseNotNow('2026-09-28:aB3_x-9QwErTyUiOp', '2026-09-28')).toEqual([]);
  });

  it('keeps the list short however often it is pressed', () => {
    let value: string | undefined;
    for (let i = 0; i < 200; i++) value = addNotNow(value, '2026-09-28', `key${i}`);
    expect(parseNotNow(value, '2026-09-28').length).toBeLessThanOrEqual(40);
    expect(value?.length).toBeLessThan(600);
  });
});

describe('situations', () => {
  it('maps a situation to the checklist written for it, where there is one', () => {
    expect(lifeEventFor('lost-job')).toBe('job-loss');
    expect(lifeEventFor('health-change')).toBe('serious-illness');
    expect(lifeEventFor('new-country')).toBe('moving-country');
    for (const none of ['caring', 'studying', 'gig-work', 'changing-career', 'steady', null, 'x'])
      expect(lifeEventFor(none), String(none)).toBeUndefined();
  });

  it('orders the modules for every situation: all of them, once each, never Today itself', () => {
    const others = MODULE_IDS.filter((m) => m !== 'today' && m !== 'org');
    for (const situation of [...SITUATIONS, null, 'not-a-situation']) {
      const order = moduleOrder(situation);
      expect([...order].sort(), String(situation)).toEqual([...others].sort());
    }
  });

  it('knows which module a link on this site belongs to', () => {
    expect(moduleForHref('/goals')).toBe('goals');
    expect(moduleForHref('/path/plans/0192f0c1-7a2b')).toBe('path');
    expect(moduleForHref('/goals#review')).toBe('goals');
    expect(moduleForHref('/money?from=ask')).toBe('money');
    // Today's own address, pages that are not modules, and anything that is not a path here.
    for (const other of [
      '/',
      '/settings',
      '/support',
      '',
      null,
      'goals',
      '//goals',
      'https://x/goals',
    ])
      expect(moduleForHref(other), String(other)).toBeUndefined();
  });

  it('puts what matters for the situation first', () => {
    expect(moduleOrder('lost-job').slice(0, 4)).toEqual(['money', 'civic', 'path', 'shield']);
    expect(moduleOrder('caring').slice(0, 4)).toEqual(['mind', 'circles', 'health', 'civic']);
    expect(moduleOrder(null).slice(0, 4)).toEqual(['path', 'shield', 'ask', 'signals']);
  });
});
