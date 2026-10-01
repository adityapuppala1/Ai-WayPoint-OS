import type { ReactNode } from 'react';
import { cn } from '../../cn';
import { Sparkline } from '../Chart';
import styles from './charts.module.css';

export interface StatDelta {
  /** The change written out with its sign, in the reader's language ("+12%", "−3"). */
  text: string;
  /** What it is compared with ("vs last week"). */
  period: string;
  /** Which way the number moved. */
  direction: 'up' | 'down' | 'flat';
  /**
   * Which way is good news: up for sign-ups, down for errors, neither for a number that is
   * just information. It picks the colour; the arrow and the words carry the meaning.
   */
  good?: 'up' | 'down' | 'neither';
}

export interface StatTileProps {
  /** What the number is, in sentence case and without a colon ("Daily active people"). */
  label: ReactNode;
  /** The number, written out in the reader's language ("1,284", "12.9K"). */
  value: ReactNode;
  delta?: StatDelta;
  /** The recent values behind the number, oldest first, and that trend in words. */
  trend?: { values: readonly number[]; label: string };
  /** One more line of context. */
  note?: ReactNode;
  className?: string;
}

/** The tone of a change: good, bad, or neither. */
export function deltaTone(
  delta: Pick<StatDelta, 'direction' | 'good'>,
): 'good' | 'bad' | 'neutral' {
  const good = delta.good ?? 'up';
  if (delta.direction === 'flat' || good === 'neither') return 'neutral';
  return delta.direction === good ? 'good' : 'bad';
}

/**
 * A headline number with what it is, how it changed and, if given, the line of values it
 * came from. It is `Stat` with a change: the change is written as an arrow and words ("↑ +12%
 * vs last week"), green when it is good news and red when it is not, so the colour is never
 * the only thing that says which way it went.
 */
export function StatTile({ label, value, delta, trend, note, className }: StatTileProps) {
  return (
    <div className={cn(styles.statTile, className)}>
      <span className={styles.statTileLabel}>{label}</span>
      <span className={styles.statTileFigure}>
        <span className={styles.statTileValue}>{value}</span>
        {trend && trend.values.length > 1 ? (
          <span className={styles.statTileTrend}>
            <Sparkline values={trend.values} label={trend.label} width={80} height={24} />
          </span>
        ) : null}
      </span>
      {delta ? (
        <span className={styles.delta} data-tone={deltaTone(delta)}>
          <DeltaArrow direction={delta.direction} />
          <span className={styles.deltaText}>{delta.text}</span>
          <span className={styles.deltaPeriod}>{delta.period}</span>
        </span>
      ) : null}
      {note ? <span className={styles.statTileNote}>{note}</span> : null}
    </div>
  );
}

/** Up, down or level. Up and down are the same in every language, so it does not mirror. */
function DeltaArrow({ direction }: { direction: StatDelta['direction'] }) {
  const d =
    direction === 'up'
      ? 'M6 10V2M2.5 5.5 6 2l3.5 3.5'
      : direction === 'down'
        ? 'M6 2v8M2.5 6.5 6 10l3.5-3.5'
        : 'M2 6h8';
  return (
    <svg className={styles.deltaArrow} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
