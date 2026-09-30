/**
 * Form controls: a labelled text field, a switch with its explanation, and a set of choices.
 * Labels are always visible (never only a placeholder), and every control is 48 pixels tall.
 */
import { forwardRef, useState } from 'react';
import { Pressable, Switch, TextInput, type TextInputProps, View } from 'react-native';
import { TOUCH, useTheme } from '../theme';
import { Icon } from './Icon';
import { Text, textStyle } from './Text';

export interface FieldProps extends Omit<TextInputProps, 'style' | 'onChange'> {
  label: string;
  description?: string;
  error?: string;
  /** Shown after the label, e.g. "optional". */
  optionalLabel?: string;
  rows?: number;
}

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, description, error, optionalLabel, rows, multiline, ...input },
  ref,
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const body = textStyle(theme, 'body');
  const minHeight = multiline ? Math.max(TOUCH, (rows ?? 4) * (body.lineHeight ?? 24) + 20) : TOUCH;
  return (
    <View style={{ gap: 6 }}>
      <Text weight="medium">
        {label}
        {optionalLabel ? (
          <Text weight="regular" tone="muted">
            {` (${optionalLabel})`}
          </Text>
        ) : null}
      </Text>
      {description ? (
        <Text variant="small" tone="secondary">
          {description}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={description}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholderTextColor={theme.colors.textMuted}
        selectionColor={theme.colors.text}
        cursorColor={theme.colors.text}
        {...input}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        style={[
          body,
          {
            minHeight,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: theme.radius.sm,
            borderWidth: focused || error ? 2 : 1,
            borderColor: error
              ? theme.colors.danger
              : focused
                ? theme.colors.focusRing
                : theme.colors.borderStrong,
            backgroundColor: input.editable === false ? theme.colors.sunken : theme.colors.raised,
            color: theme.colors.text,
            textAlign: 'auto',
          },
        ]}
      />
      {error ? (
        <View
          style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}
          accessibilityLiveRegion="polite"
        >
          <Icon name="danger" size={16} weight="fill" color={theme.colors.danger} />
          <Text variant="small" weight="medium" tone="danger" style={{ flex: 1 }}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

/** An on/off choice with the words that explain what it does. */
export function SwitchRow({
  label,
  description,
  value,
  onChange,
  disabled,
  first,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  first?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : () => onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 56,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.colors.borderSubtle,
        backgroundColor: pressed ? theme.colors.sunken : 'transparent',
        opacity: disabled ? 0.6 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text weight="medium">{label}</Text>
        {description ? (
          <Text variant="small" tone="secondary">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        trackColor={{ false: theme.colors.borderStrong, true: theme.colors.text }}
        thumbColor={value ? theme.colors.signal : theme.colors.raised}
        ios_backgroundColor={theme.colors.borderStrong}
      />
    </Pressable>
  );
}

/** A row of mutually exclusive options (appearance, language), with a check on the chosen one. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string; icon?: Parameters<typeof Icon>[0]['name'] }>;
  value: T;
  onChange: (next: T) => void;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: on }}
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: 90,
              minHeight: TOUCH,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingHorizontal: 12,
              borderRadius: theme.radius.sm,
              borderWidth: on ? 2 : 1,
              borderColor: on ? theme.colors.text : theme.colors.borderStrong,
              backgroundColor: on
                ? theme.colors.signalTint
                : pressed
                  ? theme.colors.sunken
                  : theme.colors.raised,
            })}
          >
            {o.icon ? <Icon name={o.icon} size={18} color={theme.colors.text} /> : null}
            <Text weight={on ? 'semibold' : 'medium'}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
