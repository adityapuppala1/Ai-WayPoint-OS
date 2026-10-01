import { describe, expect, it } from 'vitest';
import {
  effectiveK,
  formatJoinCode,
  JOIN_CODE_ALPHABET,
  K_ANON_FLOOR,
  laplaceNoise,
  MARGIN_MAX,
  marginFrom,
  newJoinCode,
  normalizeJoinCode,
  orgSlug,
  participantCount,
  programmeInsights,
  roundDownCount,
  sameTargets,
} from '../src/org';

describe('join codes', () => {
  it('are 8 unambiguous characters, evenly spread', () => {
    const seen = new Set<string>();
    const tally = new Map<string, number>();
    for (let i = 0; i < 2000; i++) {
      const code = newJoinCode();
      expect(code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
      seen.add(code);
      for (const ch of code) tally.set(ch, (tally.get(ch) ?? 0) + 1);
    }
    expect(seen.size).toBe(2000);
    // 16,000 characters over 31 symbols: about 516 each; every symbol appears.
    expect(tally.size).toBe(JOIN_CODE_ALPHABET.length);
    for (const n of tally.values()) expect(n).toBeGreaterThan(350);
  });

  it('skips bytes that would bias the alphabet', () => {
    // 248 and above are rejected (256 - 256 % 31); 0 maps to 'A'.
    const bytes = [255, 250, 248, 0, 1, 2, 3, 4, 5, 6, 7];
    const code = newJoinCode((b) => {
      b.fill(0);
      bytes.forEach((v, i) => {
        if (i < b.length) b[i] = v;
      });
      return b;
    });
    expect(code).toBe('ABCDEFGH');
  });

  it('are read forgivingly from typing, printing or a link', () => {
    expect(normalizeJoinCode('k7qm-3wxa')).toBe('K7QM3WXA');
    expect(normalizeJoinCode(' K7QM 3WXA ')).toBe('K7QM3WXA');
    expect(normalizeJoinCode('https://waypoint.app/join/K7QM-3WXA')).toBe('K7QM3WXA');
    expect(normalizeJoinCode('https://waypoint.app/join/K7QM3WXA?utm=poster')).toBe('K7QM3WXA');
    expect(normalizeJoinCode('drop table;')).toBeNull();
    expect(normalizeJoinCode('')).toBeNull();
    expect(formatJoinCode('K7QM3WXA')).toBe('K7QM-3WXA');
  });

  it('take the code after the last /join/ of a link, and answer at once whatever is pasted', () => {
    expect(normalizeJoinCode('https://waypoint.app/join/K7QM 3WXA/#poster')).toBe('K7QM3WXA');
    expect(normalizeJoinCode('https://x.example/join/old/join/K7QM3WXA')).toBe('K7QM3WXA');
    expect(normalizeJoinCode('https://waypoint.app/join/K7QM3WXA/extra')).toBeNull();
    const started = performance.now();
    normalizeJoinCode(`${'/join/ #'.repeat(20_000)}\nx`);
    expect(performance.now() - started).toBeLessThan(250);
  });
});

describe('k-anonymity for organisations', () => {
  it('never goes below the floor and takes the strictest setting', () => {
    expect(effectiveK()).toBe(K_ANON_FLOOR);
    expect(effectiveK(5, 10)).toBe(20);
    expect(effectiveK(50, 30)).toBe(50);
    expect(effectiveK(20, 75, null)).toBe(75);
    expect(effectiveK(100_000)).toBe(1000);
  });

  it('rounds counts down and hides small groups', () => {
    expect(roundDownCount(57)).toBe(55);
    expect(roundDownCount(3)).toBe(0);
    expect(participantCount(19, 20)).toEqual({ value: null, k: 20 });
    expect(participantCount(23, 20)).toEqual({ value: 20, k: 20 });
    // Noise never lifts a hidden group into view, nor shows a visible one below k.
    expect(participantCount(19, 20, () => 5)).toEqual({ value: null, k: 20 });
    expect(participantCount(21, 20, () => -4)).toEqual({ value: 20, k: 20 });
  });

  it('shows nothing about a group smaller than k', () => {
    const view = programmeInsights(
      {
        counted: 19,
        withPlan: 10,
        movedForward: 8,
        onTarget: 6,
        goals: [{ key: 'data-analyst', n: 10 }],
        skills: [{ key: 'sql', n: 9 }],
      },
      20,
      { hasTargets: true },
    );
    expect(view.participants.value).toBeNull();
    expect(view.withPlan).toBeNull();
    expect(view.movedForward).toBeNull();
    expect(view.onTarget).toBeNull();
    expect(view.goals).toEqual([]);
    expect(view.goalsHidden).toBe(true);
  });

  it('shows rounded shares and only large enough groups', () => {
    const view = programmeInsights(
      {
        counted: 64,
        withPlan: 41,
        movedForward: 3, // a small cell: hidden
        onTarget: 30,
        goals: [
          { key: 'data-analyst', n: 26 },
          { key: 'nurse', n: 12 },
          { key: 'electrician', n: 3 },
        ],
        skills: [
          { key: 'sql', n: 33 },
          { key: 'excel', n: 28 },
        ],
      },
      20,
      { hasTargets: true },
    );
    expect(view.participants.value).toBe(60);
    expect(view.withPlan).toBe(0.65);
    expect(view.movedForward).toBeNull();
    expect(view.onTarget).toBe(0.45);
    // nurse (12) and electrician (3) are below k; data-analyst stays visible because the two
    // hidden groups add up to 15 < 20, so it is hidden too (complementary suppression).
    expect(view.goals).toEqual([]);
    expect(view.goalsHidden).toBe(true);
    expect(view.skills).toEqual([
      { key: 'sql', n: 30 },
      { key: 'excel', n: 25 },
    ]);
    expect(view.skillsHidden).toBe(false);
  });

  it('has no target share for programmes without target roles', () => {
    const view = programmeInsights(
      { counted: 40, withPlan: 20, movedForward: 20, onTarget: 0, goals: [], skills: [] },
      20,
      { hasTargets: false },
    );
    expect(view.onTarget).toBeNull();
    expect(view.withPlan).toBe(0.5);
  });

  it('needs k people on both sides of every share', () => {
    const counts = {
      counted: 64,
      withPlan: 44, // 20 without a plan: exactly k on both sides, shown
      movedForward: 45, // 19 did not move forward: hidden
      onTarget: 5, // five accounts aimed at one role could otherwise reveal a sixth person
      goals: [],
      skills: [],
    };
    const view = programmeInsights(counts, 20, { hasTargets: true });
    expect(view.withPlan).toBe(0.7);
    expect(view.movedForward).toBeNull();
    expect(view.onTarget).toBeNull();
  });

  it('hides the target share until the counts catch up with changed target roles', () => {
    const counts = {
      counted: 80,
      withPlan: 40,
      movedForward: 40,
      onTarget: 40,
      goals: [],
      skills: [],
      targets: ['nurse'],
    };
    expect(programmeInsights(counts, 20, { hasTargets: true }).onTarget).toBe(0.5);
    expect(
      programmeInsights(counts, 20, { hasTargets: true, targetsChanged: true }).onTarget,
    ).toBeNull();
    expect(sameTargets(['nurse', 'welder'], ['welder', 'nurse'])).toBe(true);
    expect(sameTargets(['nurse'], ['nurse', 'welder'])).toBe(false);
    expect(sameTargets(undefined, [])).toBe(true);
  });

  it('asks for a margin nobody outside the server knows, without changing the numbers', () => {
    expect(participantCount(22, 20, undefined, () => 3)).toEqual({ value: null, k: 20 });
    expect(participantCount(22, 20, undefined, () => 2)).toEqual({ value: 20, k: 20 });
    // The margin is capped: a group of k + MARGIN_MAX is always visible.
    expect(participantCount(20 + MARGIN_MAX, 20, undefined, () => 99).value).toBe(20);
    const counts = {
      counted: 60,
      withPlan: 30,
      movedForward: 30,
      onTarget: 0,
      goals: [{ key: 'nurse', n: 22 }],
      skills: [],
    };
    const strict = programmeInsights(counts, 20, { hasTargets: false, margin: () => 3 });
    expect(strict.goals).toEqual([]);
    expect(strict.goalsHidden).toBe(true);
    expect(strict.withPlan).toBe(0.5);
    expect(marginFrom(0)).toBe(0);
    expect(marginFrom(0.2)).toBe(1);
    expect(marginFrom(0.9999)).toBe(MARGIN_MAX);
  });

  it('orders lists by the rounded numbers shown, not the exact counts', () => {
    const view = programmeInsights(
      {
        counted: 200,
        withPlan: 100,
        movedForward: 100,
        onTarget: 0,
        goals: [
          { key: 'welder', n: 34 },
          { key: 'nurse', n: 31 },
          { key: 'electrician', n: 45 },
        ],
        skills: [],
      },
      20,
      { hasTargets: false },
    );
    // welder (34) and nurse (31) both show as 30: alphabetical, so their true order stays private.
    expect(view.goals).toEqual([
      { key: 'electrician', n: 45 },
      { key: 'nurse', n: 30 },
      { key: 'welder', n: 30 },
    ]);
  });
});

describe('noise', () => {
  it('is Laplace-shaped: centred on zero, mostly small, symmetric', () => {
    const samples = Array.from({ length: 10_000 }, (_, i) => laplaceNoise((i + 0.5) / 10_000));
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(Math.abs(mean)).toBeLessThan(0.05);
    const within4 = samples.filter((x) => Math.abs(x) <= 4).length / samples.length;
    expect(within4).toBeGreaterThan(0.93);
    expect(laplaceNoise(0.5)).toBe(0);
    expect(laplaceNoise(0.1)).toBe(-laplaceNoise(0.9));
  });

  it('changes the numbers shown, never which numbers are shown', () => {
    const counts = {
      counted: 64,
      withPlan: 60, // 4 without a plan: a small cell, so hidden whatever the noise
      movedForward: 30,
      onTarget: 0,
      goals: [
        { key: 'nurse', n: 30 },
        { key: 'electrician', n: 30 },
      ],
      skills: [],
    };
    const noisy = programmeInsights(counts, 20, { hasTargets: true, noise: () => 4 });
    expect(noisy.withPlan).toBeNull();
    expect(noisy.onTarget).toBeNull();
    expect(noisy.participants.value).toBe(65);
    expect(noisy.movedForward).toBe(0.5);
    expect(noisy.goals.map((g) => g.n)).toEqual([30, 30]);
    const low = programmeInsights(counts, 20, { hasTargets: true, noise: () => -40 });
    expect(low.participants.value).toBe(20);
    expect(low.movedForward).toBe(0.05);
  });
});

describe('organisation slugs', () => {
  it('are readable and unique', () => {
    expect(orgSlug('Acme Logistics Ltd.', 'x7k2')).toBe('acme-logistics-ltd-x7k2');
    expect(orgSlug('École Saint-Joseph', 'a1b2')).toBe('ecole-saint-joseph-a1b2');
    expect(orgSlug('मुंबई सेवा', 'q9w8')).toBe('org-q9w8');
  });
});
