import type { ReactNode } from 'react';
import { cn } from '../cn';
import styles from './Probability.module.css';

export interface ProbabilityProps {
  /** 0..1 */
  value: number;
  /** Calibrated words, e.g. "Likely" — always shown next to the number. */
  words: ReactNode;
  /** 0..1 — how often this kind of thing usually happens. Drawn as a tick. */
  baseRate?: number;
  baseRateLabel?: ReactNode;
  /** e.g. "Our record: 42 forecasts, Brier 0.18" */
  record?: ReactNode;
  label: string;
  /**
   * The percentages written in the reader's language ("٦٢٪", "62 %"). Without them the number
   * is shown as "62%".
   */
  valueText?: string;
  baseRateText?: string;
  className?: string;
}

const pct = (v: number) => `${Math.round(Math.min(1, Math.max(0, v)) * 100)}%`;

/** An honest probability: number, words, the usual rate for context, and our track record. */
export function Probability({
  value,
  words,
  baseRate,
  baseRateLabel,
  record,
  label,
  valueText,
  baseRateText,
  className,
}: ProbabilityProps) {
  const shown = valueText ?? pct(value);
  return (
    <div className={cn(styles.probability, className)}>
      <div className={styles.headline}>
        <span className={styles.value}>{shown}</span>
        <span className={styles.words}>{words}</span>
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: a styled track with a marker for the base rate; <meter> cannot draw it */}
      <div
        className={styles.track}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={shown}
      >
        <span className={styles.fill} style={{ inlineSize: pct(value) }} />
        {baseRate !== undefined ? (
          <span
            className={styles.base}
            style={{ insetInlineStart: `calc(${pct(baseRate)} - 1px)` }}
          />
        ) : null}
      </div>
      {baseRate !== undefined || record ? (
        <div className={styles.legend}>
          {baseRate !== undefined ? (
            <span className={styles.baseKey}>
              {baseRateLabel} {baseRateText ?? pct(baseRate)}
            </span>
          ) : null}
          {record ? <span>{record}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
