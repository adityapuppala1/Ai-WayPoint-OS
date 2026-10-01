'use client';

import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '../../cn';
import { Segmented } from '../Tabs';
import styles from './charts.module.css';
import type { SeriesSlot } from './scale';

/** The words of the chart / table switch. Translate them. */
export interface ChartViewLabels {
  /** The name of the picture view ("Chart"). */
  chart: string;
  /** The name of the table view ("Table"). */
  table: string;
  /** What the switch is, read out to screen readers ("View as"). */
  view: string;
}

/** What every chart takes besides its data: its title, the words around it and its state. */
export interface ChartCommonProps {
  /** What the chart shows ("API requests per hour"). Names the figure and the table. */
  title: string;
  /** The heading level of the title, to fit the page's outline. */
  headingLevel?: 2 | 3 | 4 | 5;
  /** One line under the title: the period, the unit, what counts. */
  description?: ReactNode;
  /** A note under the chart (the source, when it was last updated). */
  caption?: ReactNode;
  /**
   * New data is on its way: the chart keeps what it shows, faded, until it arrives, so
   * nothing jumps and nothing flashes empty.
   */
  pending?: boolean;
  /** Which view shows first. */
  defaultView?: 'chart' | 'table';
  className?: string;
}

export interface LegendEntry {
  id: string;
  label: string;
  /** The mark's colour, e.g. `var(--wp-series-1)`. */
  colour: string;
}

/**
 * The same numbers as the picture, as a table: a header row, then one row per item whose
 * first cell names it. Every cell is already written out in the reader's language.
 */
export interface ChartTable {
  head: readonly string[];
  rows: ReadonlyArray<{ id: string; cells: readonly string[] }>;
}

export interface ChartFrameProps extends ChartCommonProps {
  labels: ChartViewLabels;
  /** The series, when there are two or more. One series needs no legend: the title names it. */
  legend?: readonly LegendEntry[];
  /** Draw each legend key like the marks it stands for: a short line or a block. */
  legendShape?: 'line' | 'rect';
  table: ChartTable;
  /** The picture. */
  children: ReactNode;
}

/** The colour of a series slot, as a stylesheet value. */
export const slotColour = (slot: SeriesSlot) => `var(--wp-series-${slot})`;

/** The grey of everything that is context, not the point (the other lines beside the one). */
export const MUTED_COLOUR = 'var(--chart-muted)';

/**
 * The frame every chart sits in: its title, the switch between the picture and the same
 * numbers as a table, the legend and a caption. The picture and the table are the same
 * information; the table is there for anyone who cannot or would rather not read a picture,
 * and for exact numbers.
 */
export function ChartFrame({
  title,
  headingLevel = 3,
  description,
  caption,
  pending,
  defaultView = 'chart',
  className,
  labels,
  legend,
  legendShape = 'rect',
  table,
  children,
}: ChartFrameProps) {
  const [view, setView] = useState<'chart' | 'table'>(defaultView);
  const titleId = useId();
  const Heading = `h${headingLevel}` as 'h3';
  const showLegend = view === 'chart' && legend !== undefined && legend.length >= 2;
  return (
    <figure
      className={cn(styles.frame, className)}
      aria-labelledby={titleId}
      aria-busy={pending || undefined}
    >
      <div className={styles.head}>
        <div className={styles.heading}>
          <Heading id={titleId} className={styles.title}>
            {title}
          </Heading>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        <Segmented
          label={labels.view}
          value={view}
          onChange={(next) => setView(next === 'table' ? 'table' : 'chart')}
          options={[
            { id: 'chart', label: labels.chart },
            { id: 'table', label: labels.table },
          ]}
        />
      </div>
      {showLegend ? <Legend entries={legend} shape={legendShape} /> : null}
      <div className={styles.body} data-pending={pending || undefined}>
        {view === 'chart' ? children : <DataTable caption={title} table={table} />}
      </div>
      {caption ? <figcaption className={styles.caption}>{caption}</figcaption> : null}
    </figure>
  );
}

/** The series named beside a key drawn like their marks. It follows the page's direction. */
export function Legend({
  entries,
  shape,
}: {
  entries: readonly LegendEntry[];
  shape: 'line' | 'rect';
}) {
  return (
    // biome-ignore lint/a11y/noRedundantRoles: Safari drops list semantics when list-style is none.
    <ul role="list" className={styles.legend}>
      {entries.map((e) => (
        <li key={e.id} className={styles.legendItem}>
          <span
            className={shape === 'line' ? styles.keyLine : styles.keyRect}
            style={{ '--key': e.colour } as CSSProperties}
            aria-hidden="true"
          />
          {e.label}
        </li>
      ))}
    </ul>
  );
}

/** The chart's numbers as a real table, scrolling on its own when it is wider than the frame. */
export function DataTable({ caption, table }: { caption: string; table: ChartTable }) {
  return (
    // A table wider than a phone scrolls inside the frame, never the page; the region can
    // take focus so it can be scrolled from the keyboard too.
    // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region must be reachable by keyboard
    <section className={styles.tableWrap} aria-label={caption} tabIndex={0}>
      <table className={styles.table}>
        <caption className="wp-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {table.head.map((h, i) => (
              <th key={i} scope="col" className={i > 0 ? styles.numeric : undefined}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.id}>
              {row.cells.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={i} className={styles.numeric}>
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export interface ReadoutRow {
  id: string;
  /** The key's colour; none for a total. */
  colour?: string;
  value: string;
  label: string;
}

/**
 * The tooltip of a chart: the place (a date, a cell) and one row per series, the number
 * first and loud, the series name after it and quieter (the reader has found the series and
 * wants its number). It is announced as it changes, so moving with the arrow keys reads out
 * each point.
 */
export function Readout({
  title,
  rows,
  x,
  y = 0,
  above = false,
  plotWidth,
}: {
  title: string;
  rows: readonly ReadoutRow[];
  /** Where the point is, in px from the plot's left edge (the plot never mirrors). */
  x: number;
  /** Where the tooltip's edge goes, in px from the plot's top (the top by default). */
  y?: number;
  /** Set the tooltip above `y` rather than below it. */
  above?: boolean;
  plotWidth: number;
}) {
  // Kept on the side with more room, so it never hides the point it describes.
  const flip = x > plotWidth / 2;
  return (
    <div
      className={cn(styles.readout, flip && styles.readoutFlip, above && styles.readoutAbove)}
      // Placed in the plot's own coordinates, which run left to right in every language;
      // the words inside follow the page. The stylesheet keeps it inside the plot.
      style={
        {
          left: 0,
          insetBlockStart: `${Math.round(y)}px`,
          '--x': `${Math.round(x)}px`,
          '--plot': `${Math.round(plotWidth)}px`,
        } as CSSProperties
      }
    >
      <p className={styles.readoutTitle}>{title}</p>
      <ul className={styles.readoutRows}>
        {rows.map((r) => (
          <li key={r.id} className={styles.readoutRow}>
            {r.colour ? (
              <span
                className={styles.readoutKey}
                style={{ '--key': r.colour } as CSSProperties}
                aria-hidden="true"
              />
            ) : (
              <span className={styles.readoutKeySpace} aria-hidden="true" />
            )}
            <strong className={styles.readoutValue}>{r.value}</strong>
            <span className={styles.readoutLabel}>{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * The width of the plot's box in px, kept up to date as it changes. Charts are drawn at
 * their real size rather than stretched, so lines stay 2px and text stays its size. Before
 * the box can be measured (on the server) the chart is drawn at `fallback` and scaled to
 * fit, and redrawn at its real width straight after.
 */
export function usePlotWidth(fallback = 640) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = Math.floor(el.getBoundingClientRect().width);
      if (w > 0) setWidth(w);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width: width ?? fallback };
}

/** A data value written out, or the caller's words for "nothing recorded". */
export function written(
  value: number | null | undefined,
  format: (n: number) => string,
  noData: string,
): string {
  return typeof value === 'number' && Number.isFinite(value) ? format(value) : noData;
}

/** The default words for "no value here": a dash, which needs no translating. */
export const NO_DATA = '—';
