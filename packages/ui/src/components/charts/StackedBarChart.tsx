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
  type ReadoutRow,
  slotColour,
  usePlotWidth,
  written,
} from './ChartFrame';
import styles from './charts.module.css';
import {
  bandAt,
  barThickness,
  foldIntoOther,
  linear,
  MAX_SERIES,
  maxOf,
  moveIndex,
  niceTicks,
  type SeriesSlot,
  seriesSlot,
  textWidth,
  tickEvery,
} from './scale';

export interface BarSeries {
  id: string;
  /** The series' name, in the reader's language ("Sign-ups"). */
  label: string;
  /** One value per column of `x`, in the same order; `null` where nothing was recorded. */
  values: readonly (number | null)[];
  series?: SeriesSlot;
}

export interface StackedBarLabels extends ChartViewLabels {
  /** The heading of the column of points in the table ("Day"). */
  x: string;
  /** The word for a column's sum ("Total"). Shown when there are two or more series. */
  total?: string;
  /** The name of the series that holds everything past the fourth ("Other"). */
  other?: string;
  noData?: string;
  keys?: string;
}

export interface StackedBarChartProps extends ChartCommonProps {
  /** The columns, oldest first, as ISO dates or hours. */
  x: readonly string[];
  /** Up to four series, stacked from the bottom in this order; one series is plain columns. */
  series: readonly BarSeries[];
  formatX: (x: string) => string;
  formatTick?: (x: string) => string;
  formatValue: (value: number) => string;
  max?: number;
  height?: number;
  ariaLabel?: string;
  labels: StackedBarLabels;
}

const TOP = 20;
const BOTTOM = 26;
const FONT = 12;
/** The surface showing between touching marks: it separates them instead of a border. */
const GAP = 2;
const RADIUS = 4;

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * A column segment: square where it stands on the one below (or the baseline), rounded at
 * the top when it is the top of its column, so the column reads as growing up from zero.
 */
export function columnPath(
  x: number,
  top: number,
  bottom: number,
  width: number,
  rounded: boolean,
) {
  const h = bottom - top;
  const r = rounded ? Math.min(RADIUS, width / 2, h) : 0;
  const x1 = x + width;
  if (r <= 0) return `M${round(x)} ${round(bottom)}V${round(top)}H${round(x1)}V${round(bottom)}Z`;
  return [
    `M${round(x)} ${round(bottom)}`,
    `V${round(top + r)}`,
    `A${r} ${r} 0 0 1 ${round(x + r)} ${round(top)}`,
    `H${round(x1 - r)}`,
    `A${r} ${r} 0 0 1 ${round(x1)} ${round(top + r)}`,
    `V${round(bottom)}Z`,
  ].join(' ');
}

/**
 * Amounts per day or hour as columns, the series stacked in each so the whole and its parts
 * read at once (one series makes plain columns). Hover or focus a column for a tooltip with
 * each part and the total; the arrow keys move between columns.
 */
export function StackedBarChart({
  x,
  series,
  formatX,
  formatTick,
  formatValue,
  max,
  height = 240,
  ariaLabel,
  labels,
  ...frame
}: StackedBarChartProps) {
  const { ref, width } = usePlotWidth();
  const [active, setActive] = useState<number | null>(null);
  const hovering = useRef(false);
  const keysId = useId();
  const noData = labels.noData ?? NO_DATA;

  const kept =
    series.length > MAX_SERIES && labels.other
      ? foldIntoOther(series, MAX_SERIES, labels.other)
      : series.slice(0, MAX_SERIES);
  const drawn = kept.map((s, i) => ({
    id: s.id,
    label: s.label,
    values: s.values,
    colour:
      s.id === '__other'
        ? MUTED_COLOUR
        : slotColour(seriesSlot(i, 'series' in s ? (s as BarSeries).series : undefined)),
  }));
  const n = x.length;
  const totals = x.map((_, i) =>
    drawn.reduce((sum, s) => {
      const v = s.values[i];
      return typeof v === 'number' && Number.isFinite(v) && v > 0 ? sum + v : sum;
    }, 0),
  );
  const ticks = niceTicks(max ?? maxOf(totals), 4);
  const top = ticks[ticks.length - 1] ?? 1;
  const tickText = ticks.map(formatValue);
  const left = Math.max(...tickText.map((t) => textWidth(t, FONT))) + 10;
  const right = 8;
  const plotW = Math.max(20, width - left - right);
  const plotH = Math.max(40, height - TOP - BOTTOM);
  const y = linear([0, top], [TOP + plotH, TOP]);
  const band = n > 0 ? plotW / n : plotW;
  const thick = barThickness(band);
  const centre = (i: number) => left + band * (i + 0.5);

  const xText = x.map(formatTick ?? formatX);
  const every = tickEvery(
    xText.map((t) => textWidth(t, FONT)),
    band,
  );

  const onPointer = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) * width) / (box.width || width);
    setActive(bandAt(px, n, left, plotW));
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

  const several = drawn.length > 1;
  const showTotal = several && labels.total !== undefined;
  const legend: LegendEntry[] = drawn.map((s) => ({ id: s.id, label: s.label, colour: s.colour }));
  const table = {
    head: [labels.x, ...drawn.map((s) => s.label), ...(showTotal ? [labels.total as string] : [])],
    rows: x.map((point, i) => ({
      id: point,
      cells: [
        formatX(point),
        ...drawn.map((s) => written(s.values[i], formatValue, noData)),
        ...(showTotal ? [formatValue(totals[i] ?? 0)] : []),
      ],
    })),
  };
  const readoutRows = (i: number): ReadoutRow[] => [
    ...drawn.map((s) => ({
      id: s.id,
      colour: s.colour,
      value: written(s.values[i], formatValue, noData),
      label: s.label,
    })),
    ...(showTotal
      ? [{ id: '__total', value: formatValue(totals[i] ?? 0), label: labels.total as string }]
      : []),
  ];

  // The one number written on the chart: the latest column's total, on its cap.
  const lastIndex = n - 1;
  const lastText = n > 0 ? formatValue(totals[lastIndex] ?? 0) : '';
  const lastWidth = textWidth(lastText, FONT);

  return (
    <ChartFrame {...frame} labels={labels} legend={legend} legendShape="rect" table={table}>
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
            {active !== null ? (
              <rect
                className={styles.bandActive}
                x={round(left + band * active)}
                y={TOP}
                width={round(band)}
                height={plotH}
              />
            ) : null}
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
              const px = centre(i);
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
            {x.map((point, i) => {
              const x0 = centre(i) - thick / 2;
              const segments: Array<{ id: string; colour: string; top: number; bottom: number }> =
                [];
              let sum = 0;
              for (const s of drawn) {
                const v = s.values[i];
                if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue;
                const bottom = y(sum) - (segments.length > 0 ? GAP : 0);
                sum += v;
                const segTop = y(sum);
                // Too thin to draw beside its gap: it is still in the tooltip and the table.
                if (bottom - segTop >= 0.5)
                  segments.push({ id: s.id, colour: s.colour, top: segTop, bottom });
              }
              return (
                <g key={point}>
                  {segments.map((seg, k) => (
                    <path
                      key={seg.id}
                      className={styles.bar}
                      style={{ color: seg.colour }}
                      d={columnPath(x0, seg.top, seg.bottom, thick, k === segments.length - 1)}
                    />
                  ))}
                </g>
              );
            })}
            {n > 0 && (totals[lastIndex] ?? 0) > 0 ? (
              <text
                className={styles.capLabel}
                x={round(Math.min(centre(lastIndex), width - lastWidth / 2 - 2))}
                y={round(y(totals[lastIndex] ?? 0) - 6)}
                textAnchor="middle"
              >
                {lastText}
              </text>
            ) : null}
          </svg>
        </div>
        <div className={styles.live} role="status">
          {active !== null && x[active] !== undefined ? (
            <Readout
              title={formatX(x[active] as string)}
              x={centre(active)}
              plotWidth={width}
              rows={readoutRows(active)}
            />
          ) : null}
        </div>
      </div>
    </ChartFrame>
  );
}
