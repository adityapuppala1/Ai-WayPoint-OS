'use client';

import type { ReactNode } from 'react';
import {
  Button as AriaButton,
  Checkbox as AriaCheckbox,
  type CheckboxProps as AriaCheckboxProps,
  NumberField as AriaNumberField,
  type NumberFieldProps as AriaNumberFieldProps,
  Radio as AriaRadio,
  RadioGroup as AriaRadioGroup,
  type RadioGroupProps as AriaRadioGroupProps,
  type RadioProps as AriaRadioProps,
  SearchField as AriaSearchField,
  type SearchFieldProps as AriaSearchFieldProps,
  Switch as AriaSwitch,
  type SwitchProps as AriaSwitchProps,
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
  FieldError,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  type SelectProps,
  SelectValue,
  Slider,
  SliderOutput,
  type SliderProps,
  SliderThumb,
  SliderTrack,
  Text,
  TextArea,
} from 'react-aria-components';
import { cn } from '../cn';
import styles from './Field.module.css';
import { Icon } from './Icon';

interface FieldChrome {
  label: ReactNode;
  /** Keep the label for screen readers but hide it visually (e.g. a compact header picker). */
  hideLabel?: boolean;
  description?: ReactNode;
  errorMessage?: ReactNode;
  optionalLabel?: string;
  className?: string;
}

function FieldLabel({
  label,
  isRequired,
  optionalLabel,
  hidden,
}: {
  label: ReactNode;
  isRequired?: boolean;
  optionalLabel?: string;
  hidden?: boolean;
}) {
  return (
    <Label className={cn(styles.label, hidden && 'wp-visually-hidden')}>
      {label}
      {!isRequired && optionalLabel ? (
        <span className={styles.optional}> ({optionalLabel})</span>
      ) : null}
    </Label>
  );
}

function FieldMessages({
  description,
  errorMessage,
}: {
  description?: ReactNode;
  errorMessage?: ReactNode;
}) {
  return (
    <>
      {description ? (
        <Text slot="description" className={styles.description}>
          {description}
        </Text>
      ) : null}
      <FieldError className={styles.error}>{errorMessage}</FieldError>
    </>
  );
}

export interface TextFieldProps
  extends FieldChrome,
    Omit<AriaTextFieldProps, 'className' | 'children'> {
  multiline?: boolean;
  placeholder?: string;
  rows?: number;
}

/** A labelled text input. Placeholders are only for format hints, never the label. */
export function TextField({
  label,
  hideLabel,
  description,
  errorMessage,
  optionalLabel,
  className,
  multiline,
  placeholder,
  rows,
  ...rest
}: TextFieldProps) {
  return (
    <AriaTextField {...rest} className={cn(styles.field, className)} validationBehavior="aria">
      <FieldLabel
        label={label}
        isRequired={rest.isRequired}
        optionalLabel={optionalLabel}
        hidden={hideLabel}
      />
      {/* dir="auto": people type in many scripts; each field follows what's typed into it. */}
      {multiline ? (
        <TextArea className={styles.control} placeholder={placeholder} rows={rows} dir="auto" />
      ) : (
        <Input className={styles.control} placeholder={placeholder} dir="auto" />
      )}
      <FieldMessages description={description} errorMessage={errorMessage} />
    </AriaTextField>
  );
}

export interface SelectOption {
  id: string;
  label: ReactNode;
  textValue?: string;
}

export interface SelectFieldProps
  extends FieldChrome,
    Omit<SelectProps<SelectOption>, 'className' | 'children'> {
  options: SelectOption[];
  placeholder?: string;
}

export function SelectField({
  label,
  hideLabel,
  description,
  errorMessage,
  optionalLabel,
  className,
  options,
  placeholder,
  ...rest
}: SelectFieldProps) {
  return (
    <Select
      {...rest}
      placeholder={placeholder}
      className={cn(styles.field, className)}
      validationBehavior="aria"
    >
      <FieldLabel
        label={label}
        isRequired={rest.isRequired}
        optionalLabel={optionalLabel}
        hidden={hideLabel}
      />
      <AriaButton className={cn(styles.control, styles.selectButton)}>
        <SelectValue className={styles.selectValue} />
        <Icon name="chevronDown" size={18} />
      </AriaButton>
      <FieldMessages description={description} errorMessage={errorMessage} />
      <Popover className={styles.popover}>
        <ListBox className={styles.listbox} items={options}>
          {(o) => (
            <ListBoxItem
              id={o.id}
              className={styles.option}
              textValue={o.textValue ?? (typeof o.label === 'string' ? o.label : o.id)}
            >
              {o.label}
              <span className={styles.optionCheck}>
                <Icon name="check" size={16} weight="bold" />
              </span>
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
}

export interface CheckboxProps extends Omit<AriaCheckboxProps, 'className' | 'children'> {
  children: ReactNode;
  description?: ReactNode;
  className?: string;
}

export function Checkbox({ children, description, className, ...rest }: CheckboxProps) {
  return (
    <AriaCheckbox {...rest} className={cn(styles.choice, className)}>
      {({ isSelected, isIndeterminate }) => (
        <>
          <span className={styles.box} aria-hidden="true">
            {isIndeterminate ? (
              <Icon name="more" size={14} weight="bold" />
            ) : isSelected ? (
              <Icon name="check" size={14} weight="bold" />
            ) : null}
          </span>
          <span className={styles.choiceText}>
            <span>{children}</span>
            {description ? <span className={styles.choiceDescription}>{description}</span> : null}
          </span>
        </>
      )}
    </AriaCheckbox>
  );
}

export interface RadioGroupProps
  extends FieldChrome,
    Omit<AriaRadioGroupProps, 'className' | 'children'> {
  children: ReactNode;
}

export function RadioGroup({
  label,
  description,
  errorMessage,
  optionalLabel,
  className,
  children,
  ...rest
}: RadioGroupProps) {
  return (
    <AriaRadioGroup {...rest} className={cn(styles.group, className)} validationBehavior="aria">
      <FieldLabel label={label} isRequired={rest.isRequired} optionalLabel={optionalLabel} />
      {description ? (
        <Text slot="description" className={styles.description}>
          {description}
        </Text>
      ) : null}
      <div className={styles.groupOptions}>{children}</div>
      <FieldError className={styles.error}>{errorMessage}</FieldError>
    </AriaRadioGroup>
  );
}

export interface RadioProps extends Omit<AriaRadioProps, 'className' | 'children'> {
  children: ReactNode;
  description?: ReactNode;
}

export function Radio({ children, description, ...rest }: RadioProps) {
  return (
    <AriaRadio {...rest} className={styles.choice}>
      <span className={cn(styles.box, styles.radioDot)} aria-hidden="true" />
      <span className={styles.choiceText}>
        <span>{children}</span>
        {description ? <span className={styles.choiceDescription}>{description}</span> : null}
      </span>
    </AriaRadio>
  );
}

export interface SwitchProps extends Omit<AriaSwitchProps, 'className' | 'children'> {
  children: ReactNode;
  description?: ReactNode;
  className?: string;
}

/** A setting that takes effect immediately. */
export function Switch({ children, description, className, ...rest }: SwitchProps) {
  return (
    <AriaSwitch {...rest} className={cn(styles.switch, className)}>
      <span className={styles.choiceText}>
        <span>{children}</span>
        {description ? <span className={styles.choiceDescription}>{description}</span> : null}
      </span>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
    </AriaSwitch>
  );
}

export interface NumberFieldProps
  extends FieldChrome,
    Omit<AriaNumberFieldProps, 'className' | 'children'> {
  placeholder?: string;
}

export function NumberField({
  label,
  description,
  errorMessage,
  optionalLabel,
  className,
  placeholder,
  ...rest
}: NumberFieldProps) {
  return (
    <AriaNumberField {...rest} className={cn(styles.field, className)} validationBehavior="aria">
      <FieldLabel label={label} isRequired={rest.isRequired} optionalLabel={optionalLabel} />
      <Input className={cn(styles.control, 'wp-num')} placeholder={placeholder} />
      <FieldMessages description={description} errorMessage={errorMessage} />
    </AriaNumberField>
  );
}

export interface SliderFieldProps extends Omit<SliderProps<number>, 'className' | 'children'> {
  label: ReactNode;
  className?: string;
}

export function SliderField({ label, className, ...rest }: SliderFieldProps) {
  return (
    <Slider {...rest} className={cn(styles.slider, className)}>
      <Label className={styles.label}>{label}</Label>
      <SliderOutput className={styles.sliderOutput} />
      <SliderTrack className={styles.sliderTrack}>
        <SliderThumb className={styles.sliderThumb} />
      </SliderTrack>
    </Slider>
  );
}

export interface SearchFieldProps extends Omit<AriaSearchFieldProps, 'className' | 'children'> {
  label: string;
  placeholder?: string;
  className?: string;
}

/** The one field allowed a leading icon: search. */
export function SearchField({ label, placeholder, className, ...rest }: SearchFieldProps) {
  return (
    <AriaSearchField {...rest} className={cn(styles.field, className)} aria-label={label}>
      <Input className={styles.control} placeholder={placeholder} />
    </AriaSearchField>
  );
}
