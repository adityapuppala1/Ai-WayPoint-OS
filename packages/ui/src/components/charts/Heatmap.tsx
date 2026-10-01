'use client';

import { type KeyboardEvent, type PointerEvent, useId, useRef, useState } from 'react';
import { cn } from '../../cn';
import {
  type ChartCommonProps,
  ChartFrame,
  type ChartViewLabels,
  NO_DATA,
  Readout,
  usePlotWidth,
  written,
} from './ChartFrame';
import styles from './charts.module.css';
import {
  type Cell,
  maxOf,
  moveCell,
  RAMP_INK,
  RAMP_MIX,
  rampStep,
  textWidth,
  tickEvery,
} from './scale';

export interface HeatmapLabels extends ChartViewLabels {
  /** The heading of the row names in the table ("Cohort", "Day"). */
  rows: string;
  /** What the colour measures, beside the scale ("Share still active"). */
  scale?: string;
  noData?: string;
  keys?: string;
}

export interface HeatmapProps extends ChartCommonProps {
  /** The row names, top to bottom, in the reader's language ("Week of 1 Sept", "Mon"). */
  rows: readonly string[];
  /** The column names, left to right, short ("0", "1", … or "00", "01", …). */
  cols: readonly string[];
  /** One row of values per row name, one value per column; `null` where there is no data. */
  values: ReadonlyArray<readonly (number | null)[]>;
  formatValue: (value: number) => string;
  /** A column's name in full for the tooltip and the table ("Week 3", "14:00"). */
  formatCol?: (col: string) => string;
  /** The ends of the colour scale. By default from 0 to the largest value. */
  min?: number;
  max?: number;
  /** Write each value in its cell, where it fits. */
  showValues?: boolean;
  /** The height of a row in px. */
  cellHeight?: number;
  ariaLabel?: string;
  labels: HeatmapLabels;
}

const FONT = 12;
const CELL_FONT = 11;
const GAP = 2;
const HEAD = 22;

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Numbers on a grid as shades of one colour, more is stronger: retention by cohort and week,
 * activity by day and hour. Each cell shows its value in a tooltip on hover or focus (the
 * arrow keys move between cells), and in the cell itself with `showValues` when it fits.
 * Cells with no data are left empty. A scale under the grid reads the shades.
 *
 * Columns run left to right in every language, as time does; the table follows the page.
 */
export function Heatmap({
  rows,
  cols,
  values,
  formatValue,
  formatCol,
  min = 0,
  max,
  showValues = false,
  cellHeight = 28,
  ariaLabel,
  labels,
  ...frame
}: HeatmapProps) {
  const { ref, width } = usePlotWidth();
  const [active, setActive] = useState<Cell | null>(null);
  const hovering = useRef(false);
  const keysId = useId();
  const noData = labels.noData ?? NO_DATA;
  const colName = formatCol ?? ((c: string) => c);

  const top = max ?? maxOf(values.flat());
  const rowLabelWidth = Math.min(
    Math.round(width * 0.4),
    Math.max(0, ...rows.map((r) => textWidth(r, FONT))) + 10,
  );
  const gridX = rowLabelWidth;
  const gridY = HEAD;
  const cellW = cols.length > 0 ? Math.max(4, (width - gridX) / cols.length) : 0;
  const cellH = cellHeight;
  const height = gridY + rows.length * cellH;
  const every = tickEvery(
    cols.map((c) => textWidth(c, FONT)),
    cellW,
    4,
  );

  const valueAt = (r: number, c: number) => values[r]?.[c] ?? null;
  const has = (v: number | null): v is number => typeof v === 'number' && Number.isFinite(v);

  const onPointer = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const scale = width / (box.width || width);
    const px = (e.clientX - box.left) * scale;
    const py = (e.clientY - box.top) * scale;
    const col = Math.floor((px - gridX) / cellW);
    const row = Math.floor((py - gridY) / cellH);
    if (col < 0 || row < 0 || col >= cols.length || row >= rows.length) setActive(null);
    else setActive({ row, col });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      setActive(null);
      return;
    }
    const next = moveCell(e.key, active, rows.length, cols.length);
    if (next === null) return;
    e.preventDefault();
    setActive(next);
  };

  const table = {
    head: [labels.rows, ...cols.map(colName)],
    rows: rows.map((r, i) => ({
      id: `${i}`,
      cells: [r, ...cols.map((_, c) => written(valueAt(i, c), formatValue, noData))],
    })),
  };
  const focusable = rows.length > 0 && cols.length > 0;

  return (
    <ChartFrame {...frame} labels={labels} table={table}>
      <div className={styles.plotWrap}>
        {/* biome-ignore lint/a11y/useSemanticElements: a focusable drawing, not a group of form fields */}
        <div
          ref={ref}
          className={styles.plot}
          dir="ltr"
          role="group"
          tabIndex={focusable ? 0 : -1}
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
          onFocus={() => setActive((a) => a ?? (focusable ? { row: 0, col: 0 } : null))}
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
            {cols.map((c, i) =>
              i % every === 0 ? (
                <text
                  key={i}
                  className={styles.tick}
                  x={round(gridX + cellW * (i + 0.5))}
                  y={HEAD - 8}
                  textAnchor="middle"
                >
                  {c}
                </text>
              ) : null,
            )}
            {rows.map((r, row) => (
              <g key={row}>
                <text
                  className={styles.tick}
                  x={gridX - 8}
                  y={round(gridY + cellH * (row + 0.5))}
                  textAnchor="end"
                  dy="0.32em"
                >
                  {r}
                </text>
                {cols.map((_, col) => {
                  const v = valueAt(row, col);
                  const x = gridX + cellW * col + GAP / 2;
                  const y = gridY + cellH * row + GAP / 2;
                  const w = Math.max(1, cellW - GAP);
                  const h = Math.max(1, cellH - GAP);
                  const isActive = active?.row === row && active.col === col;
                  if (!has(v)) {
                    return (
                      <rect
                        key={col}
                        className={cn(styles.cellEmpty, isActive && styles.cellActive)}
                        x={round(x + 0.5)}
                        y={round(y + 0.5)}
                        width={round(Math.max(0, w - 1))}
                        height={round(Math.max(0, h - 1))}
                        rx={2}
                      />
                    );
                  }
                  const step = rampStep(v, min, top);
                  const text = formatValue(v);
                  const fits = showValues && textWidth(text, CELL_FONT) + 8 <= w && h >= 16;
                  return (
                    <g key={col}>
                      <rect
                        className={cn(styles[`step${step}`], isActive && styles.cellActive)}
                        x={round(x)}
                        y={round(y)}
                        width={round(w)}
                        height={round(h)}
                        rx={2}
                      />
                      {fits ? (
                        <text
                          className={styles.cellValue}
                          style={{ fill: RAMP_INK[step] }}
                          x={round(x + w / 2)}
                          y={round(y + h / 2)}
                          textAnchor="middle"
                          dy="0.32em"
                        >
                          {text}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
              </g>
            ))}
          </svg>
        </div>
        <div className={styles.live} role="status">
          {active !== null && rows[active.row] !== undefined && cols[active.col] !== undefined ? (
            <Readout
              title={rows[active.row] as string}
              x={gridX + cellW * (active.col + 0.5)}
              y={
                active.row < rows.length / 2
                  ? gridY + cellH * (active.row + 1) + 4
                  : gridY + cellH * active.row - 4
              }
              above={active.row >= rows.length / 2}
              plotWidth={width}
              rows={[
                {
                  id: 'cell',
                  value: written(valueAt(active.row, active.col), formatValue, noData),
                  label: colName(cols[active.col] as string),
                },
              ]}
            />
          ) : null}
        </div>
      </div>
      <ScaleLegend
        label={labels.scale}
        low={formatValue(min)}
        high={formatValue(top)}
        steps={RAMP_MIX.length}
      />
    </ChartFrame>
  );
}

/** The shades from least to most, with the values at the two ends. */
function ScaleLegend({
  label,
  low,
  high,
  steps,
}: {
  label?: string;
  low: string;
  high: string;
  steps: number;
}) {
  const swatch = 16;
  return (
    <div className={styles.scale} dir="ltr">
      {label ? <span className={styles.scaleLabel}>{label}</span> : null}
      <span className={styles.scaleEnd}>{low}</span>
      <svg
        className={styles.scaleSwatches}
        width={steps * (swatch + GAP)}
        height={12}
        aria-hidden="true"
        focusable="false"
      >
        {Array.from({ length: steps }, (_, i) => (
          <rect
            key={i}
            className={styles[`step${i}`]}
            x={i * (swatch + GAP)}
            y={0}
            width={swatch}
            height={12}
            rx={2}
          />
        ))}
      </svg>
      <span className={styles.scaleEnd}>{high}</span>
    </div>
  );
}
