/**
 * Buttons. Primary is the one signal-yellow action on a screen; support is the calm blue for
 * help and crisis moments; quiet is for secondary choices. Every button is at least 48 pixels
 * tall, and long translations wrap instead of being cut off.
 */
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { type Theme, TOUCH, useTheme } from '../theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'support' | 'danger' | 'onSign';

interface Colors {
  bg: string;
  fg: string;
  border: string;
  pressed: string;
}

function colors(theme: Theme, variant: ButtonVariant): Colors {
  const c = theme.colors;
  switch (variant) {
    case 'primary':
      return { bg: c.signal, fg: c.signalInk, border: c.signalHover, pressed: c.signalHover };
    case 'support':
      return { bg: c.support, fg: c.raised, border: c.support, pressed: c.support };
    case 'danger':
      return { bg: c.danger, fg: c.raised, border: c.danger, pressed: c.danger };
    case 'quiet':
      return { bg: 'transparent', fg: c.text, border: 'transparent', pressed: c.sunken };
    case 'onSign':
      return {
        bg: 'transparent',
        fg: c.signText,
        border: `${c.signText.slice(0, 7)}66`,
        pressed: `${c.signText.slice(0, 7)}1a`,
      };
    default:
      return { bg: c.raised, fg: c.text, border: c.borderStrong, pressed: c.sunken };
  }
}

export interface ButtonProps {
  children: ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  /** Put the icon after the words (for "next" arrows). */
  iconAfter?: boolean;
  busy?: boolean;
  disabled?: boolean;
  /** Full width. */
  block?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Button({
  children,
  onPress,
  variant = 'secondary',
  size = 'md',
  icon,
  iconAfter,
  busy,
  disabled,
  block,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const c = colors(theme, variant);
  const inactive = disabled || busy;
  const minHeight = size === 'lg' ? 56 : size === 'sm' ? 40 : TOUCH;
  const text = size === 'lg' ? 'lead' : size === 'sm' ? 'small' : 'body';
  const iconSize = size === 'lg' ? 22 : size === 'sm' ? 16 : 20;
  const glyph = busy ? (
    <ActivityIndicator size="small" color={c.fg} />
  ) : icon ? (
    <Icon
      name={icon}
      size={iconSize}
      color={c.fg}
      weight={variant === 'support' ? 'fill' : 'regular'}
    />
  ) : null;

  return (
    <Pressable
      testID={testID}
      onPress={inactive ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(busy) }}
      hitSlop={size === 'sm' ? 4 : 0}
      style={({ pressed }) => [
        {
          minHeight,
          paddingHorizontal: size === 'lg' ? 24 : size === 'sm' ? 12 : 16,
          paddingVertical: 8,
          borderRadius: theme.radius.sm,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: pressed && !inactive ? c.pressed : c.bg,
          // Filled colours have no darker token: pressing dims them a little instead.
          opacity: disabled
            ? 0.5
            : pressed && (variant === 'support' || variant === 'danger')
              ? 0.85
              : 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          alignSelf: block ? 'stretch' : 'flex-start',
          maxWidth: '100%',
          transform: [{ translateY: pressed && !inactive ? 1 : 0 }],
        },
        style,
      ]}
    >
      {!iconAfter ? glyph : null}
      <View style={{ flexShrink: 1 }}>
        <Text variant={text} weight="medium" center style={{ color: c.fg }}>
          {children}
        </Text>
      </View>
      {iconAfter ? glyph : null}
    </Pressable>
  );
}

/** A square button with only an icon; the label is read out by screen readers. */
export function IconButton({
  icon,
  label,
  onPress,
  tone = 'default',
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  tone?: 'default' | 'outlined' | 'onSign';
  disabled?: boolean;
}) {
  const theme = useTheme();
  const color = tone === 'onSign' ? theme.colors.signText : theme.colors.text;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => ({
        width: TOUCH,
        height: TOUCH,
        borderRadius: theme.radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: tone === 'outlined' ? 1 : 0,
        borderColor: theme.colors.borderStrong,
        backgroundColor: pressed ? theme.colors.sunken : 'transparent',
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Icon name={icon} size={22} color={color} />
    </Pressable>
  );
}
