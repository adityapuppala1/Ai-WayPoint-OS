import type { CSSProperties } from 'react';
import { cn } from '../cn';
import type { IconName } from '../icons';
import { Icon } from './Icon';
import styles from './ModuleMark.module.css';

export type ModuleKey =
  | 'today'
  | 'path'
  | 'shield'
  | 'circles'
  | 'ask'
  | 'signals'
  | 'money'
  | 'mind'
  | 'health'
  | 'civic'
  | 'surroundings'
  | 'goals'
  | 'org'
  | 'support';

export interface ModuleMarkProps {
  module: ModuleKey;
  size?: 'sm' | 'md' | 'lg';
  /** `tint` = pale tile (default), `solid` = filled tile, `sign` = for use on the slate sign. */
  tone?: 'tint' | 'solid' | 'sign';
  label?: string;
  className?: string;
}

const PX = { sm: 28, md: 36, lg: 48 } as const;
const ICON_PX = { sm: 16, md: 20, lg: 26 } as const;

/**
 * A module's pictogram in its line colour — the way transit maps mark a line.
 * Always sits next to a text label; never carries meaning alone.
 */
export function ModuleMark({
  module,
  size = 'md',
  tone = 'tint',
  label,
  className,
}: ModuleMarkProps) {
  const lineKey = module === 'support' ? 'signals' : module;
  const style = {
    '--size': `${PX[size] / 16}rem`,
    '--line': module === 'support' ? 'var(--wp-support)' : `var(--wp-line-${lineKey})`,
    '--tint': module === 'support' ? 'var(--wp-support-tint)' : `var(--wp-tint-${lineKey})`,
  } as CSSProperties;
  return (
    <span
      className={cn(
        styles.mark,
        tone === 'solid' && styles.solid,
        tone === 'sign' && styles.onSign,
        className,
      )}
      style={style}
    >
      <Icon name={module as IconName} size={ICON_PX[size]} weight="fill" label={label} />
    </span>
  );
}
