import type { LearningResource, Role, Skill } from '@waypoint/content/types';
import { describe, expect, it } from 'vitest';
import { isQuietTime, localDayKey, planDelivery, quietHoursEnd } from '../src/governor';
import { conservativeIncome, formatMoney, runway, toMonthly } from '../src/money';
import {
  draftPlan,
  hoursToClose,
  PLAN_TEMPLATES_EN,
  pickResource,
  renderPlanText,
  suggestRoles,
} from '../src/path';
import type { AttentionPrefs, Nudge, PathInput } from '../src/types';

// ─────────────────────────────── Governor ───────────────────────────────

const nudge = (
  id: string,
  priority: Nudge['priority'],
  minutesAgo = 0,
  extra: Partial<Nudge> = {},
): Nudge => ({
  id,
  module: 'today',
  priority,
  title: id,
  createdAt: new Date(Date.UTC(2026, 8, 29, 9, 0) - minutesAgo * 60_000),
  ...extra,
});

describe('attention governor', () => {
  const prefs: AttentionPrefs = {
    budgetPerDay: 1,
    quietHours: { start: '21:00', end: '08:00' },
    timezone: 'Asia/Kolkata',
  };
  const morningIST = new Date(Date.UTC(2026, 8, 29, 4, 30)); // 10:00 in India
  const nightIST = new Date(Date.UTC(2026, 8, 29, 17, 30)); // 23:00 in India

  it('knows local quiet hours across midnight', () => {
    expect(isQuietTime(morningIST, prefs)).toBe(false);
    expect(isQuietTime(nightIST, prefs)).toBe(true);
    expect(quietHoursEnd(nightIST, prefs).toISOString()).toBe('2026-09-30T02:30:00.000Z'); // 08:00 IST
    expect(localDayKey(nightIST, 'Asia/Kolkata')).toBe('2026-09-29');
    expect(localDayKey(new Date(Date.UTC(2026, 8, 29, 19, 0)), 'Asia/Kolkata')).toBe('2026-09-30');
  });

  it('delivers within budget, highest priority first', () => {
    const plan = planDelivery(
      [nudge('n1', 'normal'), nudge('h1', 'high', 5), nudge('l1', 'low')],
      prefs,
      {
        now: morningIST,
        deliveredToday: 0,
      },
    );
    expect(plan.deliverNow.map((n) => n.id)).toEqual(['h1']);
    expect(plan.defer.map((n) => n.id)).toEqual(['n1']);
    expect(plan.drop.map((n) => n.id)).toEqual(['l1']);
    expect(plan.reason).toBe('within-budget');
  });

  it('lets critical messages through quiet hours and an exhausted budget', () => {
    const plan = planDelivery([nudge('c1', 'critical'), nudge('n1', 'normal')], prefs, {
      now: nightIST,
      deliveredToday: 5,
    });
    expect(plan.deliverNow.map((n) => n.id)).toEqual(['c1']);
    expect(plan.defer.map((n) => n.id)).toEqual(['n1']);
    expect(plan.reason).toBe('quiet-hours');
  });

  it('merges duplicates, drops expired items and reports an exhausted budget', () => {
    const plan = planDelivery(
      [
        nudge('old', 'high', 60, { dedupeKey: 'plan-week' }),
        nudge('new', 'high', 1, { dedupeKey: 'plan-week' }),
        nudge('gone', 'high', 0, { expiresAt: new Date(morningIST.getTime() - 1) }),
      ],
      prefs,
      { now: morningIST, deliveredToday: 1 },
    );
    expect(plan.deliverNow).toEqual([]);
    expect(plan.defer.map((n) => n.id)).toEqual(['new']);
    expect(plan.drop.map((n) => n.id).sort()).toEqual(['gone', 'old']);
    expect(plan.reason).toBe('budget-exhausted');
    expect(planDelivery([], prefs, { now: morningIST, deliveredToday: 0 }).reason).toBe(
      'nothing-to-send',
    );
  });

  it('falls back to UTC for an unknown time zone', () => {
    expect(() => isQuietTime(morningIST, { ...prefs, timezone: 'Mars/Olympus' })).not.toThrow();
  });
});

// ─────────────────────────────── Money ───────────────────────────────

describe('money', () => {
  it('computes runway and stress for a shortfall', () => {
    const r = runway({
      currency: 'INR',
      monthlyIncome: 0,
      essentialExpenses: 18000,
      otherExpenses: 4000,
      savings: 50000,
      debtMonthly: 3000,
    });
    expect(r.monthlyGap).toBe(-25000);
    expect(r.monthsOfRunway).toBe(2);
    expect(r.essentialsCoverMonths).toBe(2.4);
    expect(r.stress).toBe('tight');
    expect(r.suggestions.map((s) => s.id)).toEqual(
      expect.arrayContaining(['protect-essentials', 'talk-to-lenders', 'check-benefits']),
    );
    expect(r.suggestions.length).toBeLessThanOrEqual(5);
  });

  it('flags critical when savings run out within a month', () => {
    expect(
      runway({
        currency: 'KES',
        monthlyIncome: 10000,
        essentialExpenses: 20000,
        otherExpenses: 0,
        savings: 5000,
        debtMonthly: 0,
      }).stress,
    ).toBe('critical');
  });

  it('is calm when things are stable', () => {
    const r = runway({
      currency: 'EUR',
      monthlyIncome: 3000,
      essentialExpenses: 1400,
      otherExpenses: 600,
      savings: 12000,
      debtMonthly: 150,
    });
    expect(r.monthsOfRunway).toBeNull();
    expect(r.stress).toBe('stable');
    expect(r.suggestions.map((s) => s.id)).toContain('invest-in-skills');
  });

  it('puts debt help and the loan-app warning first when debt is heavy', () => {
    const ids = runway({
      currency: 'INR',
      monthlyIncome: 10000,
      essentialExpenses: 25500,
      otherExpenses: 3000,
      savings: 91234,
      debtMonthly: 4000,
    }).suggestions.map((s) => s.id);
    expect(ids).toHaveLength(5);
    expect(ids.slice(0, 3)).toEqual(['protect-essentials', 'talk-to-lenders', 'free-advice']);
    expect(ids).toContain('avoid-high-cost-credit');
  });

  it('handles irregular income and periods', () => {
    expect(conservativeIncome([])).toBeNull();
    expect(conservativeIncome([400, 1000, 800, 600, 1200])).toBe(600);
    expect(toMonthly(100, 'week')).toBeCloseTo(434.81, 1);
    expect(formatMoney(1234.5, 'USD', 'en-US')).toBe('$1,235');
    expect(formatMoney(12.5, 'XYZ1', 'en')).toContain('XYZ1');
  });
});

// ─────────────────────────────── Path ───────────────────────────────

const src = [{ url: 'https://example.org', title: 'fixture', checkedAt: '2026-09-01' }];
const skills: Skill[] = [
  { id: 'spreadsheets', name: 'Spreadsheets', category: 'data', description: '' },
  { id: 'data-cleaning', name: 'Data cleaning', category: 'data', description: '' },
  { id: 'sql', name: 'SQL', category: 'data', description: '' },
  { id: 'storytelling', name: 'Data storytelling', category: 'communication', description: '' },
  { id: 'patient-care', name: 'Patient care', category: 'care', description: '' },
];
const roles: Role[] = [
  {
    id: 'data-analyst',
    title: 'Data analyst',
    family: 'Data & analytics',
    summary: '',
    skills: ['spreadsheets', 'sql', 'data-cleaning', 'storytelling'],
    entryPaths: [],
    aiExposure: 'medium',
    aiNote: '',
    sources: src,
  },
  {
    id: 'care-assistant',
    title: 'Care assistant',
    family: 'Care',
    summary: '',
    skills: ['patient-care'],
    entryPaths: [],
    aiExposure: 'low',
    aiNote: '',
    sources: src,
  },
];
const resources: LearningResource[] = [
  {
    id: 'r-sql-paid',
    title: 'SQL Pro',
    provider: 'Acme',
    url: 'https://example.org/1',
    skills: ['sql'],
    cost: 'paid',
    languages: ['en'],
    format: 'course',
    checkedAt: '2026-09-01',
    hours: 20,
  },
  {
    id: 'r-sql-free',
    title: 'SQL basics',
    provider: 'OpenLearn',
    url: 'https://example.org/2',
    skills: ['sql'],
    cost: 'free',
    languages: ['en'],
    format: 'course',
    checkedAt: '2026-09-01',
    hours: 10,
  },
  {
    id: 'r-sql-hi',
    title: 'SQL (Hindi)',
    provider: 'Portal',
    url: 'https://example.org/3',
    skills: ['sql'],
    cost: 'free',
    languages: ['hi'],
    format: 'video',
    checkedAt: '2026-09-01',
    hours: 8,
    regions: ['IN'],
  },
  {
    id: 'r-clean',
    title: 'Clean data',
    provider: 'OpenLearn',
    url: 'https://example.org/4',
    skills: ['data-cleaning', 'spreadsheets'],
    cost: 'free-audit',
    languages: ['en'],
    format: 'course',
    checkedAt: '2026-09-01',
  },
];
const data = { roles, skills, resources };

const input: PathInput = {
  skills: [{ skillId: 'spreadsheets', level: 3 }],
  interests: ['data'],
  hoursPerWeek: 6,
  horizonWeeks: 8,
  situation: 'lost-job',
  country: 'IN',
  languages: ['hi', 'en'],
  budget: 'free',
};

describe('path', () => {
  it('estimates hours between levels', () => {
    expect(hoursToClose(0, 2)).toBe(20);
    expect(hoursToClose(2, 3)).toBe(40);
    expect(hoursToClose(3, 1)).toBe(0);
  });

  it('suggests roles with reasons and gaps', () => {
    const [top] = suggestRoles(input, data);
    expect(top!.roleId).toBe('data-analyst');
    expect(top!.reasons).toContain('matches-interest');
    expect(top!.missingSkills).toEqual(['sql', 'data-cleaning', 'storytelling']);
  });

  it('puts the chosen target first', () => {
    expect(suggestRoles({ ...input, targetRoleId: 'care-assistant' }, data)[0]!.roleId).toBe(
      'care-assistant',
    );
  });

  it('picks resources by budget, language and country', () => {
    expect(pickResource('sql', input, resources)!.id).toBe('r-sql-hi');
    expect(pickResource('sql', { ...input, languages: ['en'], country: 'KE' }, resources)!.id).toBe(
      'r-sql-free',
    );
    expect(pickResource('sql', { ...input, budget: 'free' }, [resources[0]!])).toBeUndefined();
  });

  it('drafts an honest week-by-week plan', () => {
    const plan = draftPlan(input, data, { roleId: 'data-analyst' });
    expect(plan.weeks).toHaveLength(8);
    expect(plan.weeks.map((w) => w.week)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(plan.title).toBe('Towards Data analyst');
    expect(plan.gaps[0]).toMatchObject({ skillId: 'sql', from: 0 });
    // Lost job: the first week points to entitlements.
    expect(plan.weeks[0]!.steps.some((s) => s.href === '/civic/job-loss')).toBe(true);
    // The last week asks for a review and applies.
    const last = plan.weeks.at(-1)!;
    expect(last.steps.map((s) => s.kind)).toEqual(
      expect.arrayContaining(['connect', 'apply', 'reflect']),
    );
    // Weekly minutes stay within the person's time.
    for (const w of plan.weeks) {
      expect(w.steps.reduce((s, x) => s + x.minutes, 0)).toBeLessThanOrEqual(6 * 60 + 30);
    }
    // 48 hours can't make someone a working-level analyst: the summary says so.
    expect(plan.summary).toMatch(/more weeks/);
    expect(plan.generatedBy).toBe('template');
  });

  it('works without a role, from interests alone', () => {
    const plan = draftPlan({ ...input, situation: 'steady', horizonWeeks: 4 }, data);
    expect(plan.title).toBe('Your next steps');
    expect(plan.weeks).toHaveLength(4);
    expect(plan.weeks[0]!.steps.some((s) => s.href === '/civic/job-loss')).toBe(false);
  });

  it('keeps how each piece of text was made, so it can be written in another language', () => {
    const plan = draftPlan(input, data, { roleId: 'data-analyst' });
    const names = {
      skill: (id: string) => data.skills.find((x) => x.id === id)?.name ?? id,
      role: (id: string) => data.roles.find((x) => x.id === id)?.title ?? id,
    };
    // Rendering the stored references again gives exactly the same English.
    expect(renderPlanText(plan.text!.title, PLAN_TEMPLATES_EN, names)).toBe(plan.title);
    expect(renderPlanText(plan.text!.summary, PLAN_TEMPLATES_EN, names)).toBe(plan.summary);
    for (const w of plan.weeks)
      for (const st of w.steps) {
        expect(renderPlanText(st.text!.title, PLAN_TEMPLATES_EN, names)).toBe(st.title);
        expect(renderPlanText(st.text!.detail, PLAN_TEMPLATES_EN, names)).toBe(st.detail);
      }
    // …and in another language with translated names.
    const sw = {
      ...PLAN_TEMPLATES_EN,
      titleRole: 'Kuelekea {role}',
      learnTitle: 'Jifunze: {skill}',
      listJoin: ', ',
      listAnd: ' na ',
    };
    const swNames = { skill: (id: string) => `sw:${id}`, role: () => 'Mchambuzi wa data' };
    expect(renderPlanText(plan.text!.title, sw, swNames)).toBe('Kuelekea Mchambuzi wa data');
    const learn = plan.weeks.flatMap((w) => w.steps).find((x) => x.kind === 'learn')!;
    expect(renderPlanText(learn.text!.title, sw, swNames)).toBe(`Jifunze: sw:${learn.skillIds[0]}`);
    // Unknown keys fall back to English rather than going blank.
    expect(renderPlanText({ key: 'whyTitle' }, { ...sw, whyTitle: '' }, swNames)).toBe('');
    expect(renderPlanText({ key: 'nope' }, sw, swNames)).toBe('');
  });
});
