'use client';

import type { ReactNode } from 'react';
import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
  Link as AriaLink,
  type LinkProps as AriaLinkProps,
} from 'react-aria-components';
import { cn } from '../cn';
import type { IconName } from '../icons';
import styles from './Button.module.css';
import { Icon } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'support' | 'onSign';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** Full-width button (mobile forms, sheets). */
  block?: boolean;
  className?: string;
  children?: ReactNode;
}

function classes(
  { variant = 'secondary', size = 'md', block }: CommonProps,
  extra?: string,
  busy?: boolean,
) {
  return cn(
    styles.button,
    styles[variant],
    size !== 'md' && styles[size],
    block && styles.block,
    busy && styles.busy,
    extra,
  );
}

export interface ButtonProps extends CommonProps, Omit<AriaButtonProps, 'className' | 'children'> {
  /** Shows a spinner and blocks presses while an action runs. Keep the label the same. */
  isBusy?: boolean;
}

/** Every button label starts with a verb and says exactly what happens. */
export function Button({
  variant,
  size,
  icon,
  block,
  className,
  children,
  isBusy,
  isDisabled,
  ...rest
}: ButtonProps) {
  return (
    <AriaButton
      {...rest}
      isDisabled={isDisabled || isBusy}
      isPending={isBusy}
      className={classes({ variant, size, block }, className, isBusy)}
    >
      {isBusy ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : icon ? (
        <Icon name={icon} size={size === 'lg' ? 22 : 18} weight="bold" />
      ) : null}
      <span className={styles.label}>{children}</span>
    </AriaButton>
  );
}

export interface LinkButtonProps
  extends CommonProps,
    Omit<AriaLinkProps, 'className' | 'children'> {}

/** A link that looks like a button — for navigation, never for actions. */
export function LinkButton({
  variant,
  size,
  icon,
  block,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <AriaLink {...rest} className={classes({ variant, size, block }, className)}>
      {icon ? <Icon name={icon} size={size === 'lg' ? 22 : 18} weight="bold" /> : null}
      <span className={styles.label}>{children}</span>
    </AriaLink>
  );
}
