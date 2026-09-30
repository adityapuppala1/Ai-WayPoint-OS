import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../cn';
import { type ModuleKey, ModuleMark, moduleColours } from './ModuleMark';
import styles from './PageHeader.module.css';

export interface PageHeaderProps {
  /** Whose page this is: gives the band its tint and the mark its line colour. */
  module: ModuleKey;
  /** The page's one h1. */
  title: ReactNode;
  /** One or two sentences under the heading. */
  lead?: ReactNode;
  /** What can be done with the whole page (one or two buttons), at the end of the band. */
  actions?: ReactNode;
  /** An id for the heading, for `aria-labelledby` elsewhere on the page. */
  id?: string;
  className?: string;
}

/**
 * The top of a module page: one flat band in the module's tint, holding the module's mark,
 * the page heading, a lead and the page's actions. It tells the modules apart the way a
 * line's colour does on a station sign. Always a tint, never the line colour itself and
 * never a gradient; one per page.
 */
export function PageHeader({ module, title, lead, actions, id, className }: PageHeaderProps) {
  const style = { '--tint': moduleColours(module).tint } as CSSProperties;
  return (
    <header className={cn(styles.header, className)} style={style}>
      <ModuleMark module={module} size="lg" tone="solid" />
      <div className={styles.text}>
        <h1 id={id} className={styles.title}>
          {title}
        </h1>
        {lead ? <p className={styles.lead}>{lead}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}
