'use client';

import { type KeyboardEvent, type PointerEvent, useId, useRef, useState } from 'react';
import {
  type ChartCommonProps,
  ChartFrame,
  type ChartViewLabels,
  type LegendEntry,
  MUTED_COLOUR,
  NO_DATA,
  Readout,
  slotColour,
  usePlotWidth,
  written,
} from './ChartFrame';
import styles from './charts.module.css';
import {
  foldIntoOther,
  labelsCollide,
  linear,
  MAX_SERIES,
  maxOf,
  moveIndex,
  nearestPoint,
  niceTicks,
  pointX,
  type SeriesSlot,
  seriesSlot,
  textWidth,
  tickEvery,
} from './scale';

export interface TimeSeries {
  id: string;
  /** The series' name, in the reader's language ("Errors"). */
  label: string;
  /** One value per point of `x`, in the same order; `null` where nothing was recorded. */
  values: readonly (number | null)[];
  /** A chart colour of its own; by default series take the chart order (blue, orange, …). */
  series?: SeriesSlot;
}

export interface TimeSeriesLabels extends ChartViewLabels {
  /** The heading of the time column in the table ("Hour", "Day"). */
  x: string;
  /** The name of the series that holds everything past the fourth ("Other"). */
  other?: string;
  /** What a missing value reads as. A dash by default. */
  noData?: string;
  /** How to move through the chart, read out when it is focused ("Use the arrow keys…"). */
  keys?: string;
}

export interface TimeSeriesChartProps extends ChartCommonProps {
  /** The points in time, oldest first, as ISO dates or hours ("2026-09-30T14:00"). */
  x: readonly string[];
  /** Up to four series. More are folded into one "other" when `labels.other` is given. */
  series: readonly TimeSeries[];
  /** A point in time written out in full, for the tooltip and the table. */
  formatX: (x: string) => string;
  /** A shorter form for the axis ("14:00", "30 Sep"). Defaults to `formatX`. */
  formatTick?: (x: string) => string;
  formatValue: (value: number) => string;
  /** `area` washes the space under a single line; with more series it draws lines. */
  variant?: 'line' | 'area';
  /** The id of the one series that matters; the others are drawn in grey as context. */
  emphasis?: string;
  /** The top of the scale (e.g. 1 for a rate), when it should not follow the data. */
  max?: number;
  /** The height of the drawing in px, axis labels included. */
  height?: number;
  /** What the chart shows in a sentence, read out when it is focused. Defaults to the title. */
  ariaLabel?: string;
  labels: TimeSeriesLabels;
}

const TOP = 12;
const BOTTOM = 26;
const FONT = 12;
const LABEL_HEIGHT = 15;
const DOT = 4;

const OTHER_ID = '__other';

interface Drawn {
  id: string;
  label: string;
  values: readonly (number | null)[];
  colour: string;
  muted: boolean;
}

/** The series as drawn: at most four, each with its colour (grey when it is context). */
function drawnSeries(
  series: readonly TimeSeries[],
  emphasis: string | undefined,
  other: string | undefined,
): Drawn[] {
  const kept: readonly (TimeSeries | { id: string; label: string; values: (number | null)[] })[] =
    series.length > MAX_SERIES && other
      ? foldIntoOther(series, MAX_SERIES, other)
      : series.slice(0, MAX_SERIES);
  return kept.map((s, i) => {
    const isOther = s.id === OTHER_ID;
    const muted = isOther || (emphasis !== undefined && s.id !== emphasis);
    const slot = 'series' in s ? s.series : undefined;
    return {
      id: s.id,
      label: s.label,
      values: s.values,
      // The one series that matters takes the first colour, wherever it sits in the list.
      colour: muted ? MUTED_COLOUR : slotColour(emphasis ? (slot ?? 1) : seriesSlot(i, slot)),
      muted,
    };
  });
}

type Point = [number, number];

/**
 * The line through the values as runs of points, broken wherever a value is missing (a gap
 * in the data stays a gap in the line, rather than a straight line across it).
 */
export function lineRuns(
  values: readonly (number | null)[],
  xAt: (i: number) => number,
  yAt: (v: number) => number,
): Point[][] {
  const runs: Point[][] = [];
  let run: Point[] = [];
  values.forEach((v, i) => {
    if (typeof v === 'number' && Number.isFinite(v)) run.push([round(xAt(i)), round(yAt(v))]);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  });
  if (run.length) runs.push(run);
  return runs;
}

const pathOf = (run: Point[]) =>
  run.map(([px, py], k) => `${k === 0 ? 'M' : 'L'}${px} ${py}`).join(' ');

/** The wash under a run of the line, closed along the baseline. */
const areaOf = (run: Point[], base: number) => {
  const first = run[0] as Point;
  const last = run[run.length - 1] as Point;
  return `${pathOf(run)} L${last[0]} ${base} L${first[0]} ${base} Z`;
};

const round = (n: number) => Math.round(n * 10) / 10;

/** The last recorded value of a series and where it is. */
function lastValue(values: readonly (number | null)[]): { index: number; value: number } | null {
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if (typeof v === 'number' && Number.isFinite(v)) return { index: i, value: v };
  }
  return null;
}

/**
 * Values over time as lines (or one line with a wash under it). Hover or focus it and a
 * crosshair finds the nearest point in time, with one tooltip listing every series there;
 * the arrow keys move it, Home and End jump to the ends. Up to four series, each named in
 * the legend and, where they do not run into each other, at the end of its line.
 *
 * Time runs left to right in every language, Arabic too; the legend and the table follow
 * the page.
 */
export function TimeSeriesChart({
  x,
  series,
  formatX,
  formatTick,
  formatValue,
  variant = 'line',
  emphasis,
  max,
  height = 240,
  ariaLabel,
  labels,
  ...frame
}: TimeSeriesChartProps) {
  const { ref, width } = usePlotWidth();
  const [active, setActive] = useState<number | null>(null);
  const hovering = useRef(false);
  const keysId = useId();
  const noData = labels.noData ?? NO_DATA;

  const drawn = drawnSeries(series, emphasis, labels.other);
  const n = x.length;
  const ticks = niceTicks(max ?? maxOf(drawn.flatMap((s) => s.values)), 4);
  const top = ticks[ticks.length - 1] ?? 1;
  const tickText = ticks.map(formatValue);
  const left = Math.max(...tickText.map((t) => textWidth(t, FONT))) + 10;
  const plotH = Math.max(40, height - TOP - BOTTOM);
  const y = linear([Math.min(0, ticks[0] ?? 0), top], [TOP + plotH, TOP]);

  // End labels name each line where it ends; one line needs no name (the title says it), so
  // it gets its last value instead. Only where they fit and do not run into each other.
  const labelled = drawn.filter((s) => (emphasis ? s.id === emphasis : true));
  const ends = labelled
    .map((s) => {
      const last = lastValue(s.values);
      if (!last) return null;
      const text = drawn.length === 1 ? formatValue(last.value) : s.label;
      return { id: s.id, text, index: last.index, y: y(last.value) };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);
  const endRoom = Math.max(0, ...ends.map((e) => textWidth(e.text, FONT))) + 10;
  const showEnds =
    ends.length > 0 &&
    width >= 320 &&
    endRoom <= width * 0.3 &&
    !labelsCollide(
      ends.map((e) => e.y),
      LABEL_HEIGHT,
    );
  const right = showEnds ? endRoom : DOT + 4;
  const plotW = Math.max(20, width - left - right);
  const xAt = (i: number) => pointX(i, n, left, plotW);

  const tickOf = formatTick ?? formatX;
  const xText = x.map(tickOf);
  const every = tickEvery(
    xText.map((t) => textWidth(t, FONT)),
    n > 1 ? plotW / (n - 1) : plotW,
  );

  const onPointer = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) * width) / (box.width || width);
    setActive(nearestPoint(px, n, left, plotW));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      setActive(null);
      return;
    }
    const next = moveIndex(e.key, active, n);
    if (next === null) return;
    e.preventDefault();
    setActive(next);
  };

  const legend: LegendEntry[] = drawn.map((s) => ({ id: s.id, label: s.label, colour: s.colour }));
  const table = {
    head: [labels.x, ...drawn.map((s) => s.label)],
    rows: x.map((point, i) => ({
      id: point,
      cells: [formatX(point), ...drawn.map((s) => written(s.values[i], formatValue, noData))],
    })),
  };
  // Grey context lines first, so the coloured ones are drawn over them.
  const order = [...drawn].sort((a, b) => Number(b.muted) - Number(a.muted));
  const area = variant === 'area' && drawn.length === 1;

  return (
    <ChartFrame
      {...frame}
      labels={labels}
      legend={legend}
      legendShape={area ? 'rect' : 'line'}
      table={table}
    >
      <div className={styles.plotWrap}>
        {/* biome-ignore lint/a11y/useSemanticElements: a focusable drawing, not a group of form fields */}
        <div
          ref={ref}
          className={styles.plot}
          dir="ltr"
          role="group"
          tabIndex={n > 0 ? 0 : -1}
          aria-label={ariaLabel ?? frame.title}
          aria-describedby={labels.keys ? keysId : undefined}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerEnter={() => {
            hovering.current = true;
          }}
          onPointerLeave={() => {
            hovering.current = false;
            setActive(null);
          }}
          onFocus={() => setActive((a) => a ?? (n > 0 ? n - 1 : null))}
          onBlur={() => {
            if (!hovering.current) setActive(null);
          }}
          onKeyDown={onKeyDown}
        >
          {labels.keys ? (
            <span id={keysId} hidden>
              {labels.keys}
            </span>
          ) : null}
          <svg
            className={styles.svg}
            width="100%"
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            aria-hidden="true"
            focusable="false"
          >
            {ticks.map((t, i) => (
              <g key={t}>
                <line
                  className={t === 0 ? styles.baseline : styles.grid}
                  x1={left}
                  x2={left + plotW}
                  y1={round(y(t))}
                  y2={round(y(t))}
                />
                <text
                  className={styles.tick}
                  x={left - 8}
                  y={round(y(t))}
                  textAnchor="end"
                  dy="0.32em"
                >
                  {tickText[i]}
                </text>
              </g>
            ))}
            {xText.map((t, i) => {
              if (i % every !== 0) return null;
              const px = xAt(i);
              const w = textWidth(t, FONT);
              const anchor = px - w / 2 < 0 ? 'start' : px + w / 2 > width ? 'end' : 'middle';
              return (
                <text
                  key={x[i]}
                  className={styles.tick}
                  x={round(px)}
                  y={TOP + plotH + 18}
                  textAnchor={anchor}
                >
                  {t}
                </text>
              );
            })}
            {order.map((s) => {
              const runs = lineRuns(s.values, xAt, y);
              const lines = runs.filter((r) => r.length > 1);
              const base = round(y(0));
              return (
                <g key={s.id} style={{ color: s.colour }}>
                  {area && lines.length ? (
                    <path className={styles.area} d={lines.map((r) => areaOf(r, base)).join(' ')} />
                  ) : null}
                  {lines.length ? (
                    <path className={styles.line} d={lines.map(pathOf).join(' ')} />
                  ) : null}
                  {/* A value with no neighbour has no line to sit on: it is drawn as a dot. */}
                  {runs
                    .filter((r) => r.length === 1)
                    .map((r) => r[0] as Point)
                    .map(([px, py]) => (
                      <circle key={px} className={styles.dot} cx={px} cy={py} r={DOT} />
                    ))}
                </g>
              );
            })}
            {showEnds
              ? ends.map((e) => {
                  const s = drawn.find((d) => d.id === e.id);
                  return (
                    <g key={e.id}>
                      <circle
                        className={styles.dot}
                        style={{ color: s?.colour }}
                        cx={round(xAt(e.index))}
                        cy={round(e.y)}
                        r={DOT}
                      />
                      <text
                        className={styles.endLabel}
                        x={round(left + plotW + 10)}
                        y={round(e.y)}
                        dy="0.32em"
                      >
                        {e.text}
                      </text>
                    </g>
                  );
                })
              : null}
            {active !== null ? (
              <g>
                <line
                  className={styles.crosshair}
                  x1={round(xAt(active))}
                  x2={round(xAt(active))}
                  y1={TOP}
                  y2={TOP + plotH}
                />
                {order.map((s) => {
                  const v = s.values[active];
                  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
                  return (
                    <circle
                      key={s.id}
                      className={styles.dot}
                      style={{ color: s.colour }}
                      cx={round(xAt(active))}
                      cy={round(y(v))}
                      r={DOT}
                    />
                  );
                })}
              </g>
            ) : null}
          </svg>
        </div>
        <div className={styles.live} role="status">
          {active !== null && x[active] !== undefined ? (
            <Readout
              title={formatX(x[active] as string)}
              x={xAt(active)}
              plotWidth={width}
              rows={drawn.map((s) => ({
                id: s.id,
                colour: s.colour,
                value: written(s.values[active], formatValue, noData),
                label: s.label,
              }))}
            />
          ) : null}
        </div>
      </div>
    </ChartFrame>
  );
}
