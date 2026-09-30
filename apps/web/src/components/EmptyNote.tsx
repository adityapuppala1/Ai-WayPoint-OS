import type { ReactNode } from 'react';
import styles from './EmptyNote.module.css';

/**
 * An empty place inside a page: one sentence saying what will be here, and one thing to do
 * about it. Never a sentence on its own, which leaves the person to work out the next move.
 *
 * (The design system's EmptyState is for a whole empty panel. This is the quieter line for a
 * part of a panel whose other parts are still there.)
 */
export function EmptyNote({ children, action }: { children: ReactNode; action: ReactNode }) {
  return (
    <div role="note" className={styles.empty}>
      <p>{children}</p>
      {action}
    </div>
  );
}
