import type { CSSProperties, ReactNode } from 'react';
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
  className,
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(styles.skeleton, className)}
      style={{ inlineSize: width, blockSize: height }}
      aria-hidden="true"
    />
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
