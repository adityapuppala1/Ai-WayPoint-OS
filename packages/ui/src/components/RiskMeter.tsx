import type { CSSProperties } from 'react';
import { cn } from '../cn';
import type { IconName } from '../icons';
import { Icon } from './Icon';
import styles from './RiskMeter.module.css';

export type RiskLevel = 'low' | 'unclear' | 'high' | 'very-high';

const ORDER: RiskLevel[] = ['low', 'unclear', 'high', 'very-high'];
const ICON: Record<RiskLevel, IconName> = {
  low: 'safe',
  unclear: 'caution',
  high: 'danger',
  'very-high': 'danger',
};
const CLASS: Record<RiskLevel, string> = {
  low: 'low',
  unclear: 'unclear',
  high: 'high',
  'very-high': 'veryHigh',
};

export interface RiskMeterProps {
  level: RiskLevel;
  verdict: string;
  /** Labels for the four steps, in order: low → very high. */
  scale: [string, string, string, string];
  className?: string;
}

/** Scam Shield's verdict: a four-step meter with words, never colour alone. */
export function RiskMeter({ level, verdict, scale, className }: RiskMeterProps) {
  const idx = ORDER.indexOf(level);
  return (
    <div className={cn(styles.meter, styles[CLASS[level]], className)}>
      <p className={styles.verdict} role="status">
        <Icon name={ICON[level]} size={24} weight="fill" />
        {verdict}
      </p>
      <div className={styles.segments} aria-hidden="true">
        {ORDER.map((l, i) => (
          <span
            key={l}
            className={styles.segment}
            data-on={i <= idx}
            style={{ '--step': i } as CSSProperties}
          />
        ))}
      </div>
      <div className={styles.scale} aria-hidden="true">
        {scale.map((s, i) => (
          <span key={s} data-current={i === idx}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
