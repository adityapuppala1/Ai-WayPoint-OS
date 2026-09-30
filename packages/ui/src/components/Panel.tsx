import type { ReactNode } from 'react';
import { cn } from '../cn';
import styles from './Panel.module.css';

export interface PanelProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Leading mark (e.g. a ModuleMark) shown beside the title. */
  mark?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  /** `flush` removes body padding so a List's hairlines run edge to edge. */
  flush?: boolean;
  tone?: 'raised' | 'quiet';
  as?: 'section' | 'div' | 'article' | 'aside';
  headingLevel?: 2 | 3 | 4;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

/** An L1 surface: the frame every list, table and group of controls sits in. */
export function Panel({
  title,
  description,
  mark,
  actions,
  children,
  flush,
  tone = 'raised',
  as: Tag = 'section',
  headingLevel = 2,
  id,
  className,
  ...aria
}: PanelProps) {
  const Heading = `h${headingLevel}` as 'h2';
  const headingId = id ? `${id}-title` : undefined;
  return (
    <Tag
      id={id}
      className={cn(styles.panel, tone === 'quiet' && styles.quiet, className)}
      aria-labelledby={title && headingId ? headingId : undefined}
      {...aria}
    >
      {title || actions ? (
        <header className={styles.header}>
          {mark}
          <div className={styles.headerText}>
            {title ? (
              <Heading id={headingId} className={styles.title}>
                {title}
              </Heading>
            ) : null}
            {description ? <p className={styles.description}>{description}</p> : null}
          </div>
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </header>
      ) : null}
      {children !== undefined ? (
        <div className={cn(styles.body, flush && styles.flush)}>{children}</div>
      ) : null}
    </Tag>
  );
}
