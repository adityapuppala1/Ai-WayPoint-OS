import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../cn';
import { Icon } from './Icon';
import type { ModuleKey } from './ModuleMark';
import styles from './Route.module.css';

export type StationState = 'done' | 'current' | 'upcoming';

export interface Station {
  id: string;
  label: ReactNode;
  detail?: ReactNode;
  meta?: ReactNode;
  state: StationState;
}

export interface RouteProps {
  stations: Station[];
  module?: ModuleKey;
  orientation?: 'vertical' | 'horizontal';
  /** Horizontal only: hide labels except the current station (small screens). */
  compact?: boolean;
  label: string;
  /** Screen-reader text for each state, translated by the app. */
  stateLabels?: Record<StationState, string>;
  className?: string;
}

const STATE_TEXT: Record<StationState, string> = {
  done: 'Done',
  current: 'You are here',
  upcoming: 'Coming up',
};

/**
 * A sequence drawn as a transit line. Completed track is solid; track ahead is dashed.
 * Use only for real sequences (plans, onboarding, progress) — never as decoration.
 */
export function Route({
  stations,
  module = 'path',
  orientation = 'vertical',
  compact,
  label,
  stateLabels = STATE_TEXT,
  className,
}: RouteProps) {
  const style = {
    '--line': module === 'support' ? 'var(--wp-support)' : `var(--wp-line-${module})`,
  } as CSSProperties;
  return (
    <ol
      className={cn(styles.route, styles[orientation], compact && styles.compact, className)}
      style={style}
      aria-label={label}
    >
      {stations.map((s) => (
        <li
          key={s.id}
          className={styles.station}
          data-state={s.state}
          aria-current={s.state === 'current' ? 'step' : undefined}
        >
          <span className={styles.dotCell}>
            <span className={styles.dot}>
              {s.state === 'done' ? <Icon name="check" size={10} weight="bold" /> : null}
            </span>
          </span>
          <span className={styles.content}>
            <span className="wp-visually-hidden">{stateLabels[s.state]}: </span>
            <span className={styles.label}>{s.label}</span>
            {s.detail ? <span className={styles.detail}>{s.detail}</span> : null}
            {s.meta ? <span className={styles.meta}>{s.meta}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
