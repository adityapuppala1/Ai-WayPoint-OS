import { describe, expect, it } from 'vitest';
import {
  brierScore,
  brierSkillScore,
  calibrationBuckets,
  clampForecast,
  FORECAST_BOUNDS,
  forecastScore,
  formatPercent,
  meanBrier,
  probabilityWords,
  relevance,
  SCOREBOARD,
  scoreboard,
} from '../src/foresight';

describe('brier scores', () => {
  it('scores single forecasts', () => {
    expect(brierScore(1, 1)).toBe(0);
    expect(brierScore(0.5, 1)).toBe(0.25);
    expect(brierScore(0, 1)).toBe(1);
    expect(brierScore(1.4, 1)).toBe(0); // clamped
  });

  it('averages and handles empty input', () => {
    expect(meanBrier([])).toBeNull();
    expect(
      meanBrier([
        { p: 0.8, outcome: 1 },
        { p: 0.2, outcome: 0 },
      ]),
    ).toBeCloseTo(0.04);
  });

  it('computes skill against the base rate', () => {
    const items = [
      { p: 0.9, outcome: 1 as const },
      { p: 0.8, outcome: 1 as const },
      { p: 0.1, outcome: 0 as const },
      { p: 0.3, outcome: 0 as const },
    ];
    const bss = brierSkillScore(items);
    expect(bss).not.toBeNull();
    expect(bss!).toBeGreaterThan(0.7);
    // Always forecasting the base rate has zero skill.
    expect(brierSkillScore(items.map((f) => ({ ...f, p: 0.5 })))).toBeCloseTo(0);
    expect(brierSkillScore([])).toBeNull();
  });
});

describe('calibration', () => {
  it('buckets forecasts, including p = 1 in the top bin', () => {
    const buckets = calibrationBuckets(
      [
        { p: 0.05, outcome: 0 },
        { p: 0.95, outcome: 1 },
        { p: 1, outcome: 1 },
      ],
      10,
    );
    expect(buckets).toHaveLength(10);
    expect(buckets[0]!.n).toBe(1);
    expect(buckets[9]!.n).toBe(2);
    expect(buckets[9]!.observed).toBe(1);
    expect(Number.isNaN(buckets[5]!.observed)).toBe(true);
  });
});

describe('probability words', () => {
  it('maps numbers to calibrated words', () => {
    expect(probabilityWords(0.01)).toBe('remote');
    expect(probabilityWords(0.1)).toBe('very-unlikely');
    expect(probabilityWords(0.3)).toBe('unlikely');
    expect(probabilityWords(0.5)).toBe('about-even');
    expect(probabilityWords(0.7)).toBe('likely');
    expect(probabilityWords(0.9)).toBe('very-likely');
    expect(probabilityWords(0.99)).toBe('almost-certain');
    expect(formatPercent(0.456)).toBe('46%');
  });
});

describe('relevance', () => {
  const profile = {
    country: 'IN',
    lifeStage: 'early-career' as const,
    situation: 'lost-job' as const,
    sectors: ['it-services'],
    skills: ['spreadsheet-analysis'],
    roles: [],
  };

  it('explains why an item is relevant', () => {
    const r = relevance(profile, {
      regions: ['IN'],
      sectors: ['it-services'],
      skills: [],
      lifeStages: ['early-career'],
      situations: ['lost-job'],
    });
    expect(r.reasons).toEqual(['country', 'sector', 'life-stage', 'situation']);
    expect(r.score).toBeCloseTo(0.8);
  });

  it('ignores items about somewhere else and keeps global ones', () => {
    expect(
      relevance(profile, {
        regions: ['BR'],
        sectors: ['it-services'],
        skills: [],
        lifeStages: [],
        situations: [],
      }).score,
    ).toBe(0);
    const global = relevance(profile, {
      regions: ['ZZ'],
      sectors: [],
      skills: ['spreadsheet-analysis'],
      lifeStages: [],
      situations: [],
    });
    expect(global.reasons).toEqual(['global', 'skill']);
  });
});

describe('scoring a published forecast', () => {
  const day = 86_400_000;
  const opened = new Date('2026-01-01T00:00:00Z');
  const closed = new Date(opened.getTime() + 100 * day);

  it('is the squared error of the chance shown, when it never changed', () => {
    const one = forecastScore([{ p: 0.7, at: opened }], opened, closed, 1);
    expect(one.brier).toBeCloseTo(0.09);
    expect(one.meanP).toBeCloseTo(0.7);
    expect(forecastScore([{ p: 0.7, at: opened }], opened, closed, 0).brier).toBeCloseTo(0.49);
  });

  it('weighs each chance by how long it was shown, so a last-minute change counts for little', () => {
    // 60% for 99 days, then 99% on the last day once the answer was obvious.
    const late = forecastScore(
      [
        { p: 0.6, at: opened },
        { p: 0.99, at: new Date(opened.getTime() + 99 * day) },
      ],
      opened,
      closed,
      1,
    );
    expect(late.meanP).toBeCloseTo(0.6039, 3);
    expect(late.brier).toBeCloseTo(0.99 * 0.16 + 0.01 * 0.0001, 4);
    // Half the time at each: the two errors count equally.
    const half = forecastScore(
      [
        { p: 0.2, at: opened },
        { p: 0.8, at: new Date(opened.getTime() + 50 * day) },
      ],
      opened,
      closed,
      1,
    );
    expect(half.brier).toBeCloseTo((0.64 + 0.04) / 2);
    expect(half.meanP).toBeCloseTo(0.5);
  });

  it('ignores changes made after the forecast closed, and copes with odd input', () => {
    const after = forecastScore(
      [
        { p: 0.3, at: opened },
        { p: 0.99, at: new Date(closed.getTime() + day) },
      ],
      opened,
      closed,
      0,
    );
    expect(after.brier).toBeCloseTo(0.09);
    // Given out of order, or published a moment before the official opening.
    const unordered = forecastScore(
      [
        { p: 0.8, at: new Date(opened.getTime() + 50 * day) },
        { p: 0.2, at: new Date(opened.getTime() - 1000) },
      ],
      opened,
      closed,
      1,
    );
    expect(unordered.meanP).toBeCloseTo(0.5, 2);
    expect(forecastScore([], opened, closed, 1)).toEqual({ brier: null, meanP: null });
    // Opened and closed at the same instant: the chance shown then is the one judged.
    expect(forecastScore([{ p: 0.4, at: opened }], opened, opened, 1).brier).toBeCloseTo(0.36);
  });
});

describe('the public scoreboard', () => {
  const judged = (n: number, p: number, happened: number) =>
    Array.from({ length: n }, (_, i) => ({
      brier: (p - (i < happened ? 1 : 0)) ** 2,
      meanP: p,
      outcome: (i < happened ? 1 : 0) as 0 | 1,
    }));

  it('says nothing about accuracy until enough forecasts have been judged', () => {
    const few = scoreboard(judged(9, 0.7, 6));
    expect(few.judged).toBe(9);
    expect(few.brier).toBeNull();
    expect(few.reference).toBeNull();
    expect(few.calibration).toBeNull();
    expect(scoreboard([]).judged).toBe(0);
  });

  it('gives the mean score, and what always saying the usual rate would have scored', () => {
    const items = [...judged(6, 0.8, 5), ...judged(6, 0.2, 1)];
    const board = scoreboard(items);
    expect(board.judged).toBe(12);
    expect(board.brier).toBeCloseTo(items.reduce((s, f) => s + f.brier, 0) / 12);
    // Six of twelve happened: always saying 50% scores 0.25.
    expect(board.reference).toBeCloseTo(0.25);
    expect(board.brier as number).toBeLessThan(board.reference as number);
    // Twelve is enough for a score but not for a calibration table.
    expect(board.calibration).toBeNull();
  });

  it('shows calibration only with enough forecasts, and only bands with enough in them', () => {
    const board = scoreboard([
      ...judged(20, 0.85, 17),
      ...judged(12, 0.15, 2),
      ...judged(3, 0.5, 1),
    ]);
    expect(board.calibration).not.toBeNull();
    const bands = board.calibration as NonNullable<typeof board.calibration>;
    // The band with three forecasts is left out: three cannot show anything.
    expect(bands.map((b) => b.n).sort((a, b) => a - b)).toEqual([12, 20]);
    const high = bands.find((b) => b.n === 20);
    expect(high?.observed).toBeCloseTo(0.85);
    expect(high?.meanPredicted).toBeCloseTo(0.85);
    for (const b of bands) expect(b.n).toBeGreaterThanOrEqual(SCOREBOARD.minPerBand);
  });
});

describe('words for a chance', () => {
  it('never say certain: the smallest and largest chance a forecast may show are 1% and 99%', () => {
    expect(FORECAST_BOUNDS).toEqual({ min: 0.01, max: 0.99 });
    expect(clampForecast(0)).toBe(0.01);
    expect(clampForecast(1)).toBe(0.99);
    expect(clampForecast(0.42)).toBe(0.42);
    expect(formatPercent(clampForecast(1))).toBe('99%');
    expect(formatPercent(clampForecast(0))).toBe('1%');
    // Every word is a degree of likelihood; none of them is "certain" or "impossible".
    for (let p = 0.01; p <= 0.99; p += 0.01)
      expect(['certain', 'impossible']).not.toContain(probabilityWords(p));
  });
});
