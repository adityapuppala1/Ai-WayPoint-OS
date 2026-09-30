'use client';

import type { ReactElement, ReactNode } from 'react';
import {
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  type MenuItemProps as AriaMenuItemProps,
  MenuTrigger,
  Popover,
  Separator,
} from 'react-aria-components';
import { cn } from '../cn';
import type { IconName } from '../icons';
import { Icon } from './Icon';
import styles from './Menu.module.css';

export function Menu({
  trigger,
  children,
  label,
  placement = 'bottom end',
}: {
  trigger: ReactElement;
  children: ReactNode;
  label: string;
  placement?: 'bottom end' | 'bottom start' | 'top end';
}) {
  return (
    <MenuTrigger>
      {trigger}
      <Popover className={styles.popover} placement={placement}>
        <AriaMenu className={styles.menu} aria-label={label}>
          {children}
        </AriaMenu>
      </Popover>
    </MenuTrigger>
  );
}

export function MenuItem({
  icon,
  tone,
  children,
  ...rest
}: Omit<AriaMenuItemProps, 'className' | 'children'> & {
  icon?: IconName;
  tone?: 'danger';
  children: ReactNode;
}) {
  return (
    <AriaMenuItem
      {...rest}
      className={cn(styles.item, tone === 'danger' && styles.danger)}
      textValue={typeof children === 'string' ? children : undefined}
    >
      {icon ? <Icon name={icon} size={18} /> : null}
      {children}
    </AriaMenuItem>
  );
}

export function MenuSeparator() {
  return <Separator className={styles.separator} />;
}
