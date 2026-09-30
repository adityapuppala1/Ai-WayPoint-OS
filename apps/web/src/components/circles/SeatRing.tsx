import type { CSSProperties } from 'react';
import styles from './circles.module.css';

/**
 * A circle drawn as its seats: one dot per place, filled for each member. It shows at a glance
 * that circles are small, and how much room is left. Decorative — the count is always in text too.
 */
export function SeatRing({
  members,
  max,
  count,
  size = 'md',
}: {
  members: number;
  max: number;
  /** The member count formatted for the reader's locale. */
  count?: string;
  size?: 'md' | 'lg';
}) {
  const seats = Math.max(1, Math.min(max, 24));
  const taken = Math.max(0, Math.min(members, seats));
  const r = 20;
  const dot = seats > 16 ? 2.4 : 3.2;
  return (
    <svg
      className={styles.ring}
      viewBox="0 0 56 56"
      aria-hidden="true"
      focusable="false"
      style={{ '--ring-size': size === 'lg' ? '4.5rem' : '3.5rem' } as CSSProperties}
    >
      {Array.from({ length: seats }, (_, i) => {
        // Start at the top and go clockwise, so the ring fills like a clock.
        const a = (i / seats) * 2 * Math.PI - Math.PI / 2;
        return (
          <circle
            key={i}
            className={styles.seat}
            data-taken={i < taken}
            cx={(28 + r * Math.cos(a)).toFixed(2)}
            cy={(28 + r * Math.sin(a)).toFixed(2)}
            r={dot}
          />
        );
      })}
      <text
        className={styles.ringCount}
        x="28"
        y="28"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={members > 99 ? 11 : 14}
      >
        {count ?? members}
      </text>
    </svg>
  );
}
