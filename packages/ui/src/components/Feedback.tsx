import { Children, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../cn';
import styles from './Feedback.module.css';

/** Empty state: one sentence of direction and one action. No illustrations. */
export function EmptyState({
  title,
  children,
  action,
  centered,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  centered?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(styles.empty, centered && styles.emptyCentered, className)}>
      <p className={styles.emptyTitle}>{title}</p>
      {children ? <p className={styles.emptyBody}>{children}</p> : null}
      {action}
    </div>
  );
}

/** Placeholder for content loading longer than ~1s. */
export function Skeleton({
  width = '100%',
  height = '1rem',
  onCanvas,
  className,
}: {
  width?: string;
  height?: string;
  /** For a block that sits on the page itself rather than in a panel: a step darker. */
  onCanvas?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(styles.skeleton, onCanvas && styles.skeletonOnCanvas, className)}
      style={{ inlineSize: width, blockSize: height }}
      aria-hidden="true"
    />
  );
}

/**
 * The shape of a page while it loads: its heading, the Sign and some panels. Use it as a
 * route's loading state (a `loading.tsx`), so the page is never blank while the server
 * answers. Pass `sign={false}` for pages without a Sign. `label` is what a screen reader
 * hears; translate it.
 */
export function PageSkeleton({
  label = 'Loading',
  sign = true,
  panels = 2,
  className,
}: {
  label?: string;
  sign?: boolean;
  panels?: number;
  className?: string;
}) {
  return (
    <div className={cn(styles.pageSkeleton, className)} role="status" aria-busy="true">
      <span className="wp-visually-hidden">{label}</span>
      <div className={styles.pageSkeletonHead} aria-hidden="true">
        <Skeleton onCanvas width="min(18rem, 70%)" height="2.25rem" />
        <Skeleton onCanvas width="min(28rem, 90%)" height="1.125rem" />
      </div>
      {sign ? (
        <div className={styles.pageSkeletonSign} aria-hidden="true">
          <Skeleton onCanvas width="9rem" height="1rem" />
          <Skeleton onCanvas width="min(22rem, 85%)" height="2.5rem" />
          <Skeleton onCanvas width="8.5rem" height="2.75rem" />
        </div>
      ) : null}
      {Array.from({ length: panels }, (_, i) => (
        <div key={i} className={styles.pageSkeletonPanel} aria-hidden="true">
          <Skeleton width="40%" height="1.25rem" />
          <Skeleton />
          <Skeleton width="85%" />
          <Skeleton width="60%" />
        </div>
      ))}
    </div>
  );
}

/** Inline activity indicator for waits under a few seconds. */
export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <span className={styles.spinner} role="status" aria-label={label} />;
}

export function Avatar({
  name,
  size = 36,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?';
  return (
    <span
      className={cn(styles.avatar, className)}
      style={{ '--size': `${size / 16}rem` } as CSSProperties}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

/** A figure with its label and one line of context. Use sparingly. */
export function Stat({
  value,
  label,
  note,
  className,
}: {
  value: ReactNode;
  label: ReactNode;
  note?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(styles.stat, className)}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
      {note ? <span className={styles.statNote}>{note}</span> : null}
    </div>
  );
}

/**
 * A row of figures that wraps onto more lines when the row is full. Each figure keeps a rule
 * at its leading edge, so the strip reads the same on one line or three. A list, so a screen
 * reader says how many figures there are; `label` names it.
 */
export function StatStrip({
  children,
  label,
  className,
}: {
  /** `Stat` items. */
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    // biome-ignore lint/a11y/noRedundantRoles: Safari drops list semantics when list-style is none.
    <ul role="list" className={cn(styles.statStrip, className)} aria-label={label}>
      {Children.toArray(children).map((child, i) => (
        <li key={i} className={styles.statStripItem}>
          {child}
        </li>
      ))}
    </ul>
  );
}
