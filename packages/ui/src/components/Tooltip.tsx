'use client';

import type { ReactElement, ReactNode } from 'react';
import { Tooltip as AriaTooltip, TooltipTrigger } from 'react-aria-components';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  content: ReactNode;
  shortcut?: string;
  children: ReactElement;
  placement?: 'top' | 'bottom' | 'start' | 'end';
  delay?: number;
}

export function Tooltip({
  content,
  shortcut,
  children,
  placement = 'top',
  delay = 500,
}: TooltipProps) {
  return (
    <TooltipTrigger delay={delay} closeDelay={100}>
      {children}
      <AriaTooltip className={styles.tooltip} placement={placement} offset={8}>
        {content}
        {shortcut ? <kbd className={styles.shortcut}>{shortcut}</kbd> : null}
      </AriaTooltip>
    </TooltipTrigger>
  );
}
