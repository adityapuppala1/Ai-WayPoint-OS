import type { CSSProperties, ReactNode } from 'react';
import { type ChartCommonProps, ChartFrame, type ChartViewLabels } from './ChartFrame';
import styles from './charts.module.css';
import { maxOf } from './scale';

export interface BarListItem {
  id: string;
  /** The category, in the reader's language ("/v1/plans", "India", "Money"). */
  label: string;
  value: number;
  /** A few words of context beside the label ("p95 840 ms"). */
  note?: string;
}

export interface BarListLabels extends ChartViewLabels {
  /** The heading of the categories in the table ("Route", "Country"). */
  category: string;
  /** The heading of the values in the table ("Requests"). */
  value: string;
}

export interface BarListProps extends ChartCommonProps {
  /** The categories in the order to show them (sort them first: largest at the top). */
  items: readonly BarListItem[];
  formatValue?: (value: number) => string;
  /** The value of a full-length bar, when it should not be the largest item (e.g. a total). */
  max?: number;
  /** Makes each row a button that picks its category (to filter by it, to open it). */
  onSelect?: (id: string) => void;
  labels: BarListLabels;
}

/**
 * Categories ranked by size as horizontal bars, all in one colour (they are not series; the
 * length is the message). Each row names its category above its bar and writes the value at
 * the bar's end, so every number is on the page without hovering. Bars grow from the start
 * of the line: from the right in Arabic.
 */
export function BarList({
  items,
  formatValue = String,
  max,
  onSelect,
  labels,
  ...frame
}: BarListProps) {
  const full = max ?? maxOf(items.map((i) => i.value));
  const table = {
    head: [labels.category, labels.value],
    rows: items.map((item) => ({ id: item.id, cells: [item.label, formatValue(item.value)] })),
  };
  return (
    <ChartFrame {...frame} labels={labels} table={table}>
      {/* biome-ignore lint/a11y/noRedundantRoles: Safari drops list semantics when list-style is none. */}
      <ol role="list" className={styles.barList}>
        {items.map((item) => {
          const share = full > 0 ? Math.min(1, Math.max(0, item.value / full)) : 0;
          const content: ReactNode = (
            <>
              <span className={styles.barListLabel}>
                {item.label}
                {item.note ? <span className={styles.barListNote}>{item.note}</span> : null}
              </span>
              <span className={styles.barListTrack}>
                <span
                  className={styles.barListFill}
                  data-empty={share === 0 || undefined}
                  style={{ '--share': share } as CSSProperties}
                  aria-hidden="true"
                />
                <span className={styles.barListValue}>{formatValue(item.value)}</span>
              </span>
            </>
          );
          return (
            <li key={item.id} className={styles.barListItem}>
              {onSelect ? (
                <button
                  type="button"
                  className={styles.barListButton}
                  onClick={() => onSelect(item.id)}
                >
                  {content}
                </button>
              ) : (
                <div className={styles.barListRow}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </ChartFrame>
  );
}
