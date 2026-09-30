import type { ReactNode } from 'react';
import { cn } from '../cn';
import type { IconName } from '../icons';
import { Icon } from './Icon';
import styles from './Notice.module.css';

export type NoticeTone = 'info' | 'caution' | 'danger' | 'safe' | 'support' | 'neutral';

const TONE_ICON: Record<NoticeTone, IconName> = {
  info: 'info',
  caution: 'caution',
  danger: 'danger',
  safe: 'safe',
  support: 'support',
  neutral: 'info',
};

export interface NoticeProps {
  tone?: NoticeTone;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  icon?: IconName;
  /** `alert` for urgent messages that must be announced immediately. */
  role?: 'status' | 'alert' | 'note';
  className?: string;
}

/** A callout that explains a situation and offers the next action. */
export function Notice({
  tone = 'info',
  title,
  children,
  actions,
  icon,
  role = 'note',
  className,
}: NoticeProps) {
  return (
    <div
      className={cn(styles.notice, tone !== 'info' && styles[tone], className)}
      role={role === 'note' ? undefined : role}
    >
      <span className={styles.icon}>
        <Icon name={icon ?? TONE_ICON[tone]} size={20} weight="fill" />
      </span>
      <p className={styles.title}>{title}</p>
      {children ? <div className={styles.body}>{children}</div> : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
