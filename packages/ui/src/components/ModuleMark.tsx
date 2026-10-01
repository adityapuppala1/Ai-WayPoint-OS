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
 * A module's two colours as CSS values: its line and the pale tint of it. The help pages
 * have no line of their own; they use the calm harbour blue.
 */
export function moduleColours(module: ModuleKey): { line: string; tint: string } {
  return module === 'support'
    ? { line: 'var(--wp-support)', tint: 'var(--wp-support-tint)' }
    : { line: `var(--wp-line-${module})`, tint: `var(--wp-tint-${module})` };
}

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
  const { line, tint } = moduleColours(module);
  const style = {
    '--size': `${PX[size] / 16}rem`,
    '--line': line,
    '--tint': tint,
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
