/**
 * The arithmetic of `pnpm --filter @waypoint/ai eval:judge`: the two release gates per
 * language with and without the judge, how well its combined score matches reality, and
 * which languages stop a release. A stub plays the judge; no service is called.
 */
import type { AiOpinion } from '@waypoint/core';
import { describe, expect, it } from 'vitest';
import {
  failingLanguages,
  formatReport,
  type JudgeReading,
  measure,
  reliability,
  type ScamCase,
  summarise,
} from '../src/evals/judge-measure';

const opinion = (level: AiOpinion['level']): AiOpinion => ({
  level,
  categories: [],
  reasons: [],
  model: 'stub',
});
const reading = (level: AiOpinion['level'], score: number): JudgeReading => ({
  opinion: opinion(level),
  score,
});

// Messages the rules have nothing on, so what the judge says is what decides.
const quiet = (lang: string, label: 'scam' | 'legit', n: number): ScamCase[] =>
  Array.from({ length: n }, (_, i) => ({
    text: `Hello, we saw your profile. We have a role for you. Message ${i}.`,
    lang,
    label,
  }));
const HIGH: ScamCase = {
  text: 'Congratulations! You are selected for a work from home job. Pay a registration fee of Rs 999 to confirm your seat.',
  lang: 'en',
  label: 'scam',
  country: 'IN',
};
const CERTAIN: ScamCase = {
  text: 'You are under digital arrest. Do not tell anyone. Stay on the video call and transfer the money to the safe account now.',
  lang: 'en',
  label: 'scam',
};

describe('measuring the judge on the golden set', () => {
  it('rates each message by the rules, then with the judge, and never below the rules', async () => {
    const cases: ScamCase[] = [
      ...quiet('en', 'scam', 2),
      ...quiet('en', 'legit', 2),
      { text: 'Act now. This offer ends today, do not wait.', lang: 'en', label: 'legit' },
    ];
    const rows = await measure(cases, async (c) =>
      c.label === 'scam' ? reading('high', 0.7) : reading('low', 0),
    );
    expect(rows.map((r) => [r.rules, r.withJudge])).toEqual([
      ['low', 'high'],
      ['low', 'high'],
      ['low', 'low'],
      ['low', 'low'],
      // The rules said unclear: a judge that says "low" cannot take that away.
      ['unclear', 'unclear'],
    ]);
    expect(rows.every((r) => r.asked && r.answered)).toBe(true);

    // A judge that calls everything "low" lowers nothing.
    const lowered = await measure(cases, async () => reading('low', 0));
    expect(lowered.map((r) => r.withJudge)).toEqual(lowered.map((r) => r.rules));
  });

  it('does not ask the judge about a message the rules already rate high or above, as in the app', async () => {
    let asked = 0;
    const rows = await measure([CERTAIN, HIGH], async () => {
      asked += 1;
      return reading('low', 0);
    });
    expect(asked).toBe(0);
    expect(rows[0]).toMatchObject({
      rules: 'very-high',
      withJudge: 'very-high',
      asked: false,
      answered: false,
      score: null,
    });
    expect(rows[1]).toMatchObject({ rules: 'high', withJudge: 'high', asked: false, score: null });
    // Not asking is not failing to answer: such a language still counts as measured.
    expect(summarise(rows).languages[0]).toMatchObject({ asked: 0, answered: 0, measured: true });
  });

  it('counts a judge that gives no answer, or throws, as unanswered: the rules’ level stands', async () => {
    const rows = await measure(quiet('en', 'scam', 2), async (_c, _rules, i) => {
      if (i === 0) throw new Error('boom');
      return null;
    });
    expect(rows.map((r) => [r.asked, r.answered, r.withJudge, r.score])).toEqual([
      [true, false, 'low', null],
      [true, false, 'low', null],
    ]);
  });
});

describe('the release gates, per language', () => {
  it('are worked out with and without the judge', async () => {
    // English: 10 scams the rules miss, the judge catches 9; 10 everyday messages, the
    // judge wrongly flags 1.
    const en = [...quiet('en', 'scam', 10), ...quiet('en', 'legit', 10)];
    // Swahili: the judge flags 2 of 10 everyday messages.
    const sw = [...quiet('sw', 'scam', 10), ...quiet('sw', 'legit', 10)];
    const rows = await measure([...en, ...sw], async (c, _rules, i) => {
      const nth = i % 10;
      if (c.label === 'scam') return nth < 9 ? reading('high', 0.8) : reading('low', 0);
      const wrong = c.lang === 'sw' ? nth < 2 : nth < 1;
      return wrong ? reading('high', 0.7) : reading('low', 0);
    });
    const report = summarise(rows);
    expect(report.languages.map((l) => l.lang)).toEqual(['en', 'sw']);
    const [english, swahili] = report.languages;
    expect(english).toMatchObject({
      scams: 10,
      legit: 10,
      asked: 20,
      answered: 20,
      measured: true,
      rules: { scamsHigh: 0, legitHigh: 0, scamRate: 0, legitRate: 0, pass: false },
      judged: { scamsHigh: 9, legitHigh: 1, scamRate: 0.9, legitRate: 0.1, pass: true },
    });
    // 90% of scams, but 20% of everyday messages rated high: over the 10% gate.
    expect(swahili?.judged).toMatchObject({ scamRate: 0.9, legitRate: 0.2, pass: false });
  });

  it('stop a release only for languages the judge is switched on in', async () => {
    const rows = await measure(
      [
        ...quiet('en', 'scam', 10),
        ...quiet('en', 'legit', 10),
        ...quiet('sw', 'scam', 10),
        ...quiet('sw', 'legit', 10),
      ],
      async (c, _rules, i) => {
        if (c.label === 'scam') return reading('high', 0.8);
        return c.lang === 'sw' && i % 10 < 2 ? reading('high', 0.7) : reading('low', 0);
      },
    );
    const report = summarise(rows);
    expect(failingLanguages(report, ['en'])).toEqual([]);
    expect(failingLanguages(report, ['en', 'sw'])).toEqual([
      { lang: 'sw', why: 'everyday messages rated high: 20.0% (gate ≤ 10%)' },
    ]);
    // Switched on, but the golden set has no cases in it: it was never measured.
    expect(failingLanguages(report, ['en', 'de'])).toEqual([
      { lang: 'de', why: 'no cases in the golden set' },
    ]);
  });

  it('do not pass a language the judge mostly failed to answer in', async () => {
    // The rules-only numbers would pass on their own; with no answers nothing was measured.
    const cases = [...quiet('en', 'legit', 10)];
    const rows = await measure(cases, async (_c, _rules, i) => (i < 8 ? null : reading('low', 0)));
    const report = summarise(rows);
    expect(report.languages[0]).toMatchObject({ asked: 10, answered: 2, measured: false });
    expect(failingLanguages(report, ['en'])).toEqual([
      { lang: 'en', why: 'the judge answered 2 of 10 messages it was asked about' },
    ]);
  });
});

describe('how well the judge’s combined score matches reality', () => {
  const row = (score: number, label: 'scam' | 'legit') => ({
    lang: 'en',
    label,
    rules: 'low' as const,
    withJudge: 'low' as const,
    asked: true,
    answered: true,
    score,
  });

  it('is zero when scores match how often messages really were scams', () => {
    // Ten messages scored 0.8, eight of them scams; ten scored 0.2, two of them scams.
    const rows = [
      ...Array.from({ length: 8 }, () => row(0.8, 'scam')),
      ...Array.from({ length: 2 }, () => row(0.8, 'legit')),
      ...Array.from({ length: 2 }, () => row(0.2, 'scam')),
      ...Array.from({ length: 8 }, () => row(0.2, 'legit')),
    ];
    const out = reliability(rows);
    expect(out.n).toBe(20);
    expect(out.ece).toBeCloseTo(0);
    expect(out.bins.filter((b) => b.n > 0)).toEqual([
      { from: 0.2, to: 0.3, n: 10, meanScore: 0.2, scamRate: 0.2 },
      { from: 0.8, to: 0.9, n: 10, meanScore: 0.8, scamRate: 0.8 },
    ]);
  });

  it('is the average gap, weighted by how many messages fall in each band', () => {
    // 30 messages scored 0.9 of which a third are scams (gap 0.567); 10 scored 0.05, none
    // scams (gap 0.05). (30 × 0.5667 + 10 × 0.05) / 40 = 0.4375.
    const rows = [
      ...Array.from({ length: 10 }, () => row(0.9, 'scam')),
      ...Array.from({ length: 20 }, () => row(0.9, 'legit')),
      ...Array.from({ length: 10 }, () => row(0.05, 'legit')),
    ];
    expect(reliability(rows).ece).toBeCloseTo(0.4375, 4);
  });

  it('puts a score of exactly 1 in the top band, and ignores messages with no answer', () => {
    const out = reliability([
      row(1, 'scam'),
      { ...row(0.5, 'scam'), answered: false, score: null },
    ]);
    expect(out.n).toBe(1);
    expect(out.bins.at(-1)).toEqual({ from: 0.9, to: 1, n: 1, meanScore: 1, scamRate: 1 });
    expect(reliability([]).ece).toBeNull();
  });
});

describe('the printed report', () => {
  it('shows both gates for each language, with and without the judge, and the reliability table', async () => {
    const rows = await measure(
      [...quiet('en', 'scam', 10), ...quiet('en', 'legit', 10)],
      async (c) => (c.label === 'scam' ? reading('high', 0.8) : reading('low', 0)),
    );
    const text = formatReport(summarise(rows), { model: 'jev-1.13.0', enabled: ['en'] });
    expect(text).toContain('jev-1.13.0');
    expect(text).toMatch(/en\s+10\s+10/);
    expect(text).toContain('0.0%');
    expect(text).toContain('100.0%');
    expect(text).toContain('Expected calibration error');
    expect(text).toMatch(/switched on/i);
  });
});
