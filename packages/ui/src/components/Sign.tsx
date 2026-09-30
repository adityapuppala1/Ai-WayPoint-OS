'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '../cn';
import { type ModuleKey, ModuleMark } from './ModuleMark';
import styles from './Sign.module.css';

export interface SignDetail {
  label: ReactNode;
  value: ReactNode;
}

export interface SignProps {
  /** Short orientation text, e.g. "Your next step". Sentence case, no caps. */
  eyebrow: ReactNode;
  title: ReactNode;
  /** Changing this plays the one orchestrated moment: the title flips like a departures board. */
  flipKey?: string | number;
  module?: ModuleKey;
  context?: ReactNode;
  details?: SignDetail[];
  children?: ReactNode;
  actions?: ReactNode;
  headingLevel?: 1 | 2;
  className?: string;
}

/** Waypoint's Next Step sign. One per screen, at most. */
export function Sign({
  eyebrow,
  title,
  flipKey,
  module = 'today',
  context,
  details,
  children,
  actions,
  headingLevel = 2,
  className,
}: SignProps) {
  const Heading = `h${headingLevel}` as 'h2';
  const first = useRef(true);
  const [animate, setAnimate] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: only react to the step changing, not first paint
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setAnimate(true);
  }, [flipKey]);

  return (
    <section className={cn(styles.sign, className)} aria-live="polite">
      <div className={styles.top}>
        <ModuleMark module={module} tone="sign" size="md" />
        <p className={styles.eyebrow}>{eyebrow}</p>
        {context ? <p className={styles.context}>{context}</p> : null}
      </div>
      <div className={styles.titleWrap}>
        <Heading key={flipKey} className={cn(styles.title, animate && styles.flip)}>
          {title}
        </Heading>
      </div>
      {children ? <div className={styles.body}>{children}</div> : null}
      {details?.length ? (
        <dl className={styles.details}>
          {details.map((d, i) => (
            <div key={i} className={styles.detail}>
              <dt>{d.label}</dt>
              <dd>{d.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </section>
  );
}
