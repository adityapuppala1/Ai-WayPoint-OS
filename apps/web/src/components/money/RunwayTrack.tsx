import { cn } from '@waypoint/ui';
import styles from './money.module.css';

const TICKS = [1, 3, 6, 12] as const;
const MAX = 12;

/** Square-root scale: the first months — where decisions matter most — get the most room. */
const pos = (months: number) => Math.sqrt(Math.min(Math.max(months, 0), MAX) / MAX) * 100;

/**
 * How far savings reach, drawn as a road from today to a year out. The words next to it carry
 * the meaning; the drawing is decoration for sighted readers (aria-hidden).
 */
export function RunwayTrack({
  months,
  stress,
  axisLabel,
}: {
  /** null when savings are not being drawn down. */
  months: number | null;
  stress: 'stable' | 'watch' | 'tight' | 'critical';
  axisLabel: (months: number) => string;
}) {
  const open = months === null;
  const at = open ? 100 : pos(months);
  return (
    <div className={cn(styles[stress])} aria-hidden="true">
      <div className={styles.track}>
        {TICKS.map((m) => (
          <span key={m} className={styles.tick} style={{ insetInlineStart: `${pos(m)}%` }} />
        ))}
        <span
          className={styles.fill}
          data-open={open}
          style={open ? undefined : { inlineSize: `${at}%` }}
        />
        {open ? null : <span className={styles.marker} style={{ insetInlineStart: `${at}%` }} />}
      </div>
      <div className={styles.axis}>
        {TICKS.map((m) => (
          <span key={m} style={{ insetInlineStart: `${pos(m)}%` }}>
            {axisLabel(m)}
          </span>
        ))}
      </div>
    </div>
  );
}
