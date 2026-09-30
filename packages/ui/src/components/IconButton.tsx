'use client';

import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';
import { cn } from '../cn';
import type { IconName } from '../icons';
import { Icon } from './Icon';
import styles from './IconButton.module.css';
import { Tooltip } from './Tooltip';

export interface IconButtonProps extends Omit<AriaButtonProps, 'className' | 'children'> {
  icon: IconName;
  /** Required: announced to screen readers and shown as the tooltip. */
  label: string;
  shortcut?: string;
  tone?: 'plain' | 'outlined' | 'onSign';
  tooltip?: boolean;
  className?: string;
}

/** Square icon-only button. Always has a label and (by default) a tooltip. */
export function IconButton({
  icon,
  label,
  shortcut,
  tone = 'plain',
  tooltip = true,
  className,
  ...rest
}: IconButtonProps) {
  const button = (
    <AriaButton
      {...rest}
      aria-label={label}
      className={cn(
        styles.iconButton,
        tone === 'outlined' && styles.outlined,
        tone === 'onSign' && styles.onSign,
        className,
      )}
    >
      <Icon name={icon} size={20} weight="bold" />
    </AriaButton>
  );
  return tooltip ? (
    <Tooltip content={label} shortcut={shortcut}>
      {button}
    </Tooltip>
  ) : (
    button
  );
}
