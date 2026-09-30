/**
 * Foresight maths. Every probability Waypoint shows is scored when it resolves, and the
 * running record is public (the accuracy scoreboard) — the way a weather service earns trust.
 */
import type {
  CalibrationBucket,
  ProbabilityWord,
  RelevanceProfile,
  ResolvedForecast,
  TaggedItem,
} from '../types';

const clamp01 = (p: number) => Math.min(1, Math.max(0, p));

/** Squared error of one forecast. 0 is perfect, 0.25 is a coin flip at 50%, 1 is certainly wrong. */
export function brierScore(p: number, outcome: 0 | 1): number {
  const d = clamp01(p) - outcome;
  return d * d;
}

export function meanBrier(items: ResolvedForecast[]): number | null {
  if (!items.length) return null;
  return items.reduce((s, f) => s + brierScore(f.p, f.outcome), 0) / items.length;
}

/**
 * Skill against always predicting the base rate: 1 = perfect, 0 = no better than the
 * base rate, negative = worse. The base rate defaults to the observed frequency.
 */
export function brierSkillScore(items: ResolvedForecast[], baseRate?: number): number | null {
  const mb = meanBrier(items);
  if (mb === null) return null;
  const rate = baseRate ?? items.reduce((s, f) => s + f.outcome, 0) / items.length;
  const ref = items.reduce((s, f) => s + brierScore(rate, f.outcome), 0) / items.length;
  if (ref === 0) return mb === 0 ? 1 : null;
  return 1 - mb / ref;
}

/** Reliability diagram data: in each probability band, how often things actually happened. */
export function calibrationBuckets(items: ResolvedForecast[], bins = 10): CalibrationBucket[] {
  const out: CalibrationBucket[] = [];
  for (let i = 0; i < bins; i++) {
    const from = i / bins;
    const to = (i + 1) / bins;
    const inBin = items.filter((f) => {
      const p = clamp01(f.p);
      return i === bins - 1 ? p >= from && p <= to : p >= from && p < to;
    });
    out.push({
      from,
      to,
      n: inBin.length,
      meanPredicted: inBin.length
        ? inBin.reduce((s, f) => s + f.p, 0) / inBin.length
        : (from + to) / 2,
      observed: inBin.length ? inBin.reduce((s, f) => s + f.outcome, 0) / inBin.length : Number.NaN,
    });
  }
  return out;
}

/**
 * Calibrated words for probabilities, always shown next to the number so people
 * who read numbers and people who read words get the same message.
 */
export function probabilityWords(p: number): ProbabilityWord {
  const x = clamp01(p);
  if (x < 0.05) return 'remote';
  if (x < 0.15) return 'very-unlikely';
  if (x < 0.35) return 'unlikely';
  if (x <= 0.65) return 'about-even';
  if (x < 0.85) return 'likely';
  if (x < 0.95) return 'very-likely';
  return 'almost-certain';
}

export type RelevanceReason =
  | 'country'
  | 'region'
  | 'global'
  | 'sector'
  | 'skill'
  | 'life-stage'
  | 'situation'
  | 'role';

/**
 * How relevant a signal or forecast is to one person, with the reasons — so every item
 * can answer "Why am I seeing this?" truthfully.
 */
export function relevance(
  profile: RelevanceProfile,
  item: TaggedItem,
): { score: number; reasons: RelevanceReason[] } {
  const reasons: RelevanceReason[] = [];
  let score = 0;
  const regions = item.regions.map((r) => r.toUpperCase());
  if (profile.country && regions.includes(profile.country.toUpperCase())) {
    score += 0.35;
    reasons.push('country');
  } else if (profile.region && regions.includes(profile.region.toUpperCase())) {
    score += 0.2;
    reasons.push('region');
  } else if (regions.includes('ZZ') || regions.length === 0) {
    score += 0.08;
    reasons.push('global');
  } else {
    return { score: 0, reasons: [] }; // about somewhere else entirely
  }
  const overlap = (a: string[], b: string[]) =>
    a.some((x) => b.map((y) => y.toLowerCase()).includes(x.toLowerCase()));
  if (profile.sectors.length && overlap(profile.sectors, item.sectors)) {
    score += 0.25;
    reasons.push('sector');
  }
  if (profile.skills.length && overlap(profile.skills, item.skills)) {
    score += 0.2;
    reasons.push('skill');
  }
  if (profile.roles.length && overlap(profile.roles, item.sectors.concat(item.skills))) {
    score += 0.05;
    reasons.push('role');
  }
  if (profile.lifeStage && item.lifeStages.includes(profile.lifeStage)) {
    score += 0.1;
    reasons.push('life-stage');
  }
  if (profile.situation && item.situations.includes(profile.situation)) {
    score += 0.1;
    reasons.push('situation');
  }
  return { score: Math.min(1, Math.round(score * 100) / 100), reasons };
}

export function formatPercent(p: number): string {
  return `${Math.round(clamp01(p) * 100)}%`;
}
