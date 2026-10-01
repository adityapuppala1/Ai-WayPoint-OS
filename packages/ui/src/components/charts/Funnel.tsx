import type { CSSProperties } from 'react';
import { cn } from '../../cn';
import { type ChartCommonProps, ChartFrame, type ChartViewLabels, NO_DATA } from './ChartFrame';
import styles from './charts.module.css';
import { maxOf, ordinalShade } from './scale';

export interface FunnelStep {
  id: string;
  /** The step, in the reader's language ("Signed up", "Finished onboarding"). */
  label: string;
  /** How many reached it. */
  value: number;
}

export interface FunnelLabels extends ChartViewLabels {
  /** The heading of the steps in the table ("Step"). */
  step: string;
  /** The heading of the counts in the table ("People"). */
  value: string;
  /** "Of the step before". */
  fromPrevious: string;
  /** "Of the first step". */
  fromFirst: string;
}

export interface FunnelProps extends ChartCommonProps {
  /** The steps in order, first to last. */
  steps: readonly FunnelStep[];
  formatValue: (value: number) => string;
  /** A share from 0 to 1 written out ("62%", "٦٢٪"). */
  formatShare: (share: number) => string;
  labels: FunnelLabels;
}

/** The share `part / whole`, or null when there is no whole to divide. */
export function shareOf(part: number, whole: number | undefined): number | null {
  if (whole === undefined || !(whole > 0) || !Number.isFinite(part)) return null;
  return part / whole;
}

/**
 * How many people reach each step of a path (signed up, set up, came back), as bars in
 * shades of one colour from dark to light, so the order shows in the colour too. Beside each
 * step after the first: the share that came on from the step before, and from the first.
 */
export function Funnel({ steps, formatValue, formatShare, labels, ...frame }: FunnelProps) {
  const full = maxOf(steps.map((s) => s.value));
  const first = steps[0]?.value;
  const share = (part: number, whole: number | undefined) => {
    const s = shareOf(part, whole);
    return s === null ? NO_DATA : formatShare(s);
  };
  const table = {
    head: [labels.step, labels.value, labels.fromPrevious, labels.fromFirst],
    rows: steps.map((s, i) => ({
      id: s.id,
      cells: [
        s.label,
        formatValue(s.value),
        i === 0 ? NO_DATA : share(s.value, steps[i - 1]?.value),
        i === 0 ? NO_DATA : share(s.value, first),
      ],
    })),
  };
  return (
    <ChartFrame {...frame} labels={labels} table={table}>
      {/* biome-ignore lint/a11y/noRedundantRoles: Safari drops list semantics when list-style is none. */}
      <ol role="list" className={styles.funnel}>
        {steps.map((s, i) => {
          const width = full > 0 ? Math.min(1, Math.max(0, s.value / full)) : 0;
          return (
            <li key={s.id} className={styles.funnelStep}>
              <span className={styles.funnelHead}>
                <span className={styles.funnelLabel}>{s.label}</span>
                <strong className={styles.funnelValue}>{formatValue(s.value)}</strong>
              </span>
              <span className={styles.funnelTrack} aria-hidden="true">
                <span
                  className={cn(styles.funnelBar, styles[`shade${ordinalShade(i)}`])}
                  data-empty={width === 0 || undefined}
                  style={{ '--share': width } as CSSProperties}
                />
              </span>
              {i > 0 ? (
                <span className={styles.funnelShares}>
                  <span>
                    {labels.fromPrevious} <b>{share(s.value, steps[i - 1]?.value)}</b>
                  </span>
                  <span>
                    {labels.fromFirst} <b>{share(s.value, first)}</b>
                  </span>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </ChartFrame>
  );
}
