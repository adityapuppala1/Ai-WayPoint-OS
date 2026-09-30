'use client';

import { type ReactNode, useRef } from 'react';
import {
  Button as AriaButton,
  NumberField as AriaNumberField,
  type NumberFieldProps as AriaNumberFieldProps,
  Group,
  Input,
  Label,
  Text,
} from 'react-aria-components';
import { cn } from '../cn';
import { Icon } from './Icon';
import styles from './Stepper.module.css';

export interface StepperProps extends Omit<AriaNumberFieldProps, 'className' | 'children'> {
  label: ReactNode;
  description?: ReactNode;
  /** The unit shown after the number, e.g. "hours". */
  unit?: ReactNode;
  /** The unit as words for screen readers, added to the label (e.g. "hours"). */
  unitLabel?: string;
  /**
   * Where − and + start from when nothing is set yet (React Aria would jump to the minimum or
   * maximum), e.g. 7 for hours of sleep. Typing is never changed.
   */
  startValue?: number;
  className?: string;
}

/**
 * A number with large − and + buttons: quick to use with a thumb, and still typeable.
 * An empty value (NaN) means "not set". React Aria labels the buttons in the reader's language.
 */
export function Stepper({
  label,
  description,
  unit,
  unitLabel,
  startValue,
  className,
  onChange,
  ...rest
}: StepperProps) {
  // Set while a button press or arrow key is stepping, so only stepping from empty is adjusted.
  const stepping = useRef(false);
  const mark = () => {
    stepping.current = true;
    setTimeout(() => {
      stepping.current = false;
    }, 0);
  };
  return (
    <AriaNumberField
      {...rest}
      onChange={(v) => {
        const fromEmpty = stepping.current && rest.value !== undefined && Number.isNaN(rest.value);
        stepping.current = false;
        onChange?.(fromEmpty && startValue !== undefined ? startValue : v);
      }}
      className={cn(styles.stepper, className)}
    >
      <Label className={styles.label}>
        {label}
        {unitLabel ? <span className="wp-visually-hidden"> ({unitLabel})</span> : null}
      </Label>
      {description ? (
        <Text slot="description" className={styles.description}>
          {description}
        </Text>
      ) : null}
      <Group
        className={styles.group}
        onKeyDownCapture={(e) => {
          if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.key)) mark();
        }}
      >
        <span className={styles.slot} onPointerDownCapture={mark}>
          <AriaButton slot="decrement" className={styles.button}>
            <Icon name="minus" size={20} weight="bold" />
          </AriaButton>
        </span>
        <span className={styles.value}>
          <Input className={cn(styles.input, 'wp-num')} />
          {unit ? (
            <span className={styles.unit} aria-hidden="true">
              {unit}
            </span>
          ) : null}
        </span>
        <span className={styles.slot} onPointerDownCapture={mark}>
          <AriaButton slot="increment" className={styles.button}>
            <Icon name="add" size={20} weight="bold" />
          </AriaButton>
        </span>
      </Group>
    </AriaNumberField>
  );
}
