/**
 * Text in the Waypoint type scale. One family (Overpass, from road signage) for Latin
 * scripts; Hindi and Arabic use the phone's own fonts, which draw them better, with more room
 * between lines for marks above and below the letters.
 *
 * Sizes follow the phone's text-size setting, up to a limit for large headings so they
 * still fit a small screen.
 */
import type { ReactNode } from 'react';
import { Text as RNText, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { type FontWeightName, font, type Theme, useTheme } from '../theme';

export type TextVariant = 'meta' | 'small' | 'body' | 'lead' | 'h4' | 'h3' | 'h2' | 'h1' | 'sign';

export type TextTone =
  | 'default'
  | 'secondary'
  | 'muted'
  | 'inverse'
  | 'sign'
  | 'signMuted'
  | 'signalInk'
  | 'danger'
  | 'caution'
  | 'safe'
  | 'info'
  | 'support';

const LEADING: Record<TextVariant, 'tight' | 'snug' | 'meta' | 'body'> = {
  meta: 'meta',
  small: 'body',
  body: 'body',
  lead: 'body',
  h4: 'snug',
  h3: 'snug',
  h2: 'tight',
  h1: 'tight',
  sign: 'tight',
};

const DEFAULT_WEIGHT: Record<TextVariant, FontWeightName> = {
  meta: 'regular',
  small: 'regular',
  body: 'regular',
  lead: 'regular',
  h4: 'semibold',
  h3: 'semibold',
  h2: 'semibold',
  h1: 'semibold',
  sign: 'semibold',
};

/** Headings grow with the text-size setting, but not beyond what fits on a phone. */
const MAX_SCALE: Partial<Record<TextVariant, number>> = {
  h4: 1.8,
  h3: 1.6,
  h2: 1.5,
  h1: 1.4,
  sign: 1.3,
};

export function toneColor(theme: Theme, tone: TextTone): string {
  const c = theme.colors;
  switch (tone) {
    case 'secondary':
      return c.textSecondary;
    case 'muted':
      return c.textMuted;
    case 'inverse':
      return c.textInverse;
    case 'sign':
      return c.signText;
    case 'signMuted':
      return c.signMuted;
    case 'signalInk':
      return c.signalInk;
    case 'danger':
      return c.danger;
    case 'caution':
      return c.caution;
    case 'safe':
      return c.safe;
    case 'info':
      return c.info;
    case 'support':
      return c.support;
    default:
      return c.text;
  }
}

/** Font size, line height and family for a step of the scale. */
export function textStyle(
  theme: Theme,
  variant: TextVariant,
  weight: FontWeightName = DEFAULT_WEIGHT[variant],
): TextStyle {
  const size = theme.fontSize[variant];
  // Devanagari and Arabic carry marks above and below the line: never set them tight.
  const ratio = Math.max(theme.lineHeight[LEADING[variant]], theme.script === 'system' ? 1.35 : 0);
  return { fontSize: size, lineHeight: Math.round(size * ratio), ...font(theme, weight) };
}

export interface WPTextProps extends Omit<TextProps, 'style'> {
  variant?: TextVariant;
  tone?: TextTone;
  weight?: FontWeightName;
  /** Figures line up in columns (numbers that change or are compared). */
  tabular?: boolean;
  center?: boolean;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
}

export function Text({
  variant = 'body',
  tone = 'default',
  weight,
  tabular,
  center,
  style,
  accessibilityRole,
  ...rest
}: WPTextProps) {
  const theme = useTheme();
  const heading = variant.startsWith('h') || variant === 'sign';
  return (
    <RNText
      accessibilityRole={accessibilityRole ?? (heading ? 'header' : undefined)}
      maxFontSizeMultiplier={MAX_SCALE[variant]}
      style={[
        textStyle(theme, variant, weight),
        { color: toneColor(theme, tone) },
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        center ? { textAlign: 'center' } : null,
        style,
      ]}
      {...rest}
    />
  );
}
