import type { CSSProperties } from 'react';
import { cn } from '../cn';
import styles from './Chart.module.css';
import { type ModuleKey, moduleColours } from './ModuleMark';

/** One of the six chart colours (`--wp-series-1` … `--wp-series-6`). */
export type SeriesIndex = 1 | 2 | 3 | 4 | 5 | 6;

/** A module's line colour, a chart series colour, or (neither given) the text colour around it. */
function lineColour(module?: ModuleKey, series?: SeriesIndex): string | undefined {
  if (module) return moduleColours(module).line;
  if (series) return `var(--wp-series-${series})`;
  return undefined;
}

const round = (n: number) => Math.round(n * 100) / 100;

export interface SparklineProps {
  /** The values in the order they happened, oldest first. */
  values: readonly number[];
  /**
   * What the line shows, in words ("Savings runway over six weeks: from 3 to 5 weeks"). It is
   * read out instead of the picture, so say the trend, not "chart". Translate it.
   */
  label: string;
  module?: ModuleKey;
  series?: SeriesIndex;
  /** Size in px at the default text size (drawn in rem, so it grows with the text). */
  width?: number;
  height?: number;
  /** The bottom and top of the scale. Without them the line fills the height. */
  min?: number;
  max?: number;
  className?: string;
}

/** Radius of the dot on the last value, and the room kept around the line so it is not cut. */
const DOT = 3;
const PAD = DOT + 1;

/**
 * A small line of values with the last one marked: the shape of a trend, beside the number
 * that says where it stands. Drawn as an inline SVG in the colour of the text around it (or
 * a module line, or a chart series).
 *
 * It does not mirror in right-to-left languages: the oldest value is on the left and the
 * newest on the right everywhere, as charts and numbers are in Arabic too.
 */
export function Sparkline({
  values,
  label,
  module,
  series,
  width = 96,
  height = 28,
  min,
  max,
  className,
}: SparklineProps) {
  const data = values.filter((v) => Number.isFinite(v));
  if (data.length === 0) return null;
  const low = Math.min(min ?? Number.POSITIVE_INFINITY, ...data);
  const high = Math.max(max ?? Number.NEGATIVE_INFINITY, ...data);
  const span = high - low;
  const x = (i: number) =>
    data.length === 1 ? width - PAD : round(PAD + (i * (width - 2 * PAD)) / (data.length - 1));
  // Nothing changed: a level line through the middle.
  const y = (v: number) =>
    span === 0 ? height / 2 : round(PAD + (1 - (v - low) / span) * (height - 2 * PAD));
  const points = data.map((v, i) => [x(i), y(v)] as const);
  const last = points[points.length - 1] as readonly [number, number];
  const colour = lineColour(module, series);
  const style: CSSProperties = {
    inlineSize: `${width / 16}rem`,
    blockSize: `${height / 16}rem`,
    ...(colour ? { color: colour } : {}),
  };
  return (
    <svg
      className={cn(styles.sparkline, className)}
      style={style}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      focusable="false"
    >
      {points.length > 1 ? (
        <polyline
          points={points.map(([px, py]) => `${px},${py}`).join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      <circle cx={last[0]} cy={last[1]} r={DOT} fill="currentColor" />
    </svg>
  );
}

export interface ProgressRingProps {
  /** How much of the total is reached. */
  value: number;
  total?: number;
  /** What is being measured ("Steps done this week"). Translate it. */
  label: string;
  /**
   * The value as it is written in the middle and read out: a number, a fraction or a
   * percentage in the reader's language ("3/5", "٦٠٪"). Keep it short; words go beside the
   * ring. Without it the ring shows a percentage like "60%".
   */
  valueText?: string;
  size?: 'sm' | 'md' | 'lg';
  module?: ModuleKey;
  series?: SeriesIndex;
  className?: string;
}

/**
 * A value out of a total, as a ring with the number in the middle. The ring grows to its
 * value when it appears and moves when the value changes.
 *
 * It runs clockwise from the top in every language, like a clock face, so it does not mirror
 * in right-to-left languages.
 */
export function ProgressRing({
  value,
  total = 100,
  label,
  valueText,
  size = 'md',
  module,
  series,
  className,
}: ProgressRingProps) {
  const whole = total > 0 ? total : 1;
  const now = Math.min(whole, Math.max(0, Number.isFinite(value) ? value : 0));
  const percent = Math.round((now / whole) * 100);
  const shown = valueText ?? `${percent}%`;
  const colour = lineColour(module, series);
  const style = colour ? ({ '--line': colour } as CSSProperties) : undefined;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a ring with its number inside; <meter> cannot draw it
    <span
      className={cn(styles.ring, styles[size], className)}
      style={style}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={whole}
      aria-valuenow={now}
      aria-valuetext={shown}
    >
      <svg className={styles.ringArt} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className={styles.ringTrack} cx="50" cy="50" r="46" />
        {percent > 0 ? (
          <circle
            className={styles.ringValue}
            cx="50"
            cy="50"
            r="46"
            pathLength="100"
            strokeDasharray={`${percent} 100`}
            transform="rotate(-90 50 50)"
          />
        ) : null}
      </svg>
      <span className={styles.ringText}>{shown}</span>
    </span>
  );
}
