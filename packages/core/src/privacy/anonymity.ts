/**
 * k-anonymity for organisation dashboards. Employers, schools and NGOs only ever see
 * counts for groups of at least k people (default 50), never individuals, and never
 * numbers from which a small group could be worked out by subtraction.
 */
export interface GroupCount<T = unknown> {
  key: string;
  n: number;
  value?: T;
}

export type SafeGroup<T = unknown> =
  | (GroupCount<T> & { suppressed: false })
  | { key: string; suppressed: true };

/**
 * Hide every group smaller than k. Then apply complementary suppression: when the total is
 * known, a single hidden group — or hidden groups that add up to fewer than k people — could
 * be recovered by subtraction, so the smallest visible groups are hidden too until the hidden
 * set is both plural and at least k people in total.
 *
 * `thresholdFor` can ask for more than k for a given group (never less), so that the exact
 * size at which a group appears is not known to whoever is watching.
 */
export function suppressSmallGroups<T>(
  groups: GroupCount<T>[],
  k: number,
  thresholdFor: (key: string) => number = () => k,
): SafeGroup<T>[] {
  const hidden = new Set(
    groups.filter((g) => g.n < Math.max(k, thresholdFor(g.key))).map((g) => g.key),
  );
  if (hidden.size > 0) {
    const visible = groups.filter((g) => !hidden.has(g.key)).sort((a, b) => a.n - b.n);
    const hiddenTotal = () => groups.reduce((s, g) => s + (hidden.has(g.key) ? g.n : 0), 0);
    while ((hidden.size === 1 || hiddenTotal() < k) && visible.length > 0) {
      const next = visible.shift();
      if (next) hidden.add(next.key);
    }
  }
  return groups.map((g) =>
    hidden.has(g.key)
      ? { key: g.key, suppressed: true as const }
      : { ...g, suppressed: false as const },
  );
}

/**
 * A proportion that is only reported when the group has at least k people and neither the
 * "yes" nor the "no" side is a small cell (fewer than `minCell` people), which would reveal
 * something about identifiable individuals. A unanimous result (0% or 100%) says something
 * about every member, so it is hidden too unless `allowUnanimous` is set for non-sensitive
 * metrics. Rounded to `step` (default 5 percentage points).
 */
export function safeRate(
  numerator: number,
  denominator: number,
  k: number,
  opts: { minCell?: number; step?: number; allowUnanimous?: boolean } = {},
): number | null {
  const minCell = opts.minCell ?? 5;
  const step = opts.step ?? 0.05;
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator < k ||
    denominator <= 0
  )
    return null;
  const yes = Math.max(0, Math.min(numerator, denominator));
  const no = denominator - yes;
  if ((yes > 0 && yes < minCell) || (no > 0 && no < minCell)) return null;
  if (!opts.allowUnanimous && (yes === 0 || no === 0)) return null;
  const rate = yes / denominator;
  const stepped = step > 0 ? Math.round(rate / step) * step : rate;
  return Math.round(stepped * 10_000) / 10_000;
}
