import { describe, expect, it } from 'vitest';
import {
  brierScore,
  brierSkillScore,
  calibrationBuckets,
  formatPercent,
  meanBrier,
  probabilityWords,
  relevance,
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
