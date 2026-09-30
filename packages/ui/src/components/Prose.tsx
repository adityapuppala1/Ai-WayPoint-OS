import type { ReactNode } from 'react';
import { cn } from '../cn';
import styles from './Prose.module.css';

/** Readable long-form text (AI answers, guides, legal pages). */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(styles.prose, className)}>{children}</div>;
}
