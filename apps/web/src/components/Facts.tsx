import { Children, type ReactNode } from 'react';
import styles from './Facts.module.css';

/**
 * A few short facts on one line, each on its own with a thin rule between them, never joined
 * with middle dots. When the line is full they wrap. Pass each fact as a child; empty ones
 * are left out.
 *
 * A message with several facts marks each with `<f>…</f>`, so translators keep the order that
 * reads well in their language: `<Facts>{t.rich('key', { …, f: fact })}</Facts>`.
 */
export function Facts({ children, className }: { children: ReactNode; className?: string }) {
  // Children.toArray leaves out null, undefined and booleans, and gives each fact a key.
  const items = Children.toArray(children).filter((c) => c !== '');
  const parts: ReactNode[] = [];
  items.forEach((item, i) => {
    if (i > 0) parts.push(<span key={`sep-${i}`} aria-hidden="true" className={styles.sep} />);
    parts.push(
      <span key={`fact-${i}`} className={styles.item}>
        {item}
      </span>,
    );
  });
  return <span className={className ? `${styles.facts} ${className}` : styles.facts}>{parts}</span>;
}

/** One fact in a message marked with `<f>…</f>` (see Facts). */
export const fact = (chunks: ReactNode) => <span>{chunks}</span>;
