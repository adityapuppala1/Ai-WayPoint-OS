/**
 * The Waypoint design system on the phone: the same tokens as the web (wayfinding signage,
 * transit-line module colours, one signal yellow), resolved to hex and pixels.
 */
import { nativeTheme } from '@waypoint/tokens';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { TextStyle } from 'react-native';

const BASE = { light: nativeTheme('light'), dark: nativeTheme('dark') } as const;

export type Mode = 'light' | 'dark';
export type FontWeightName = 'regular' | 'medium' | 'semibold';

export type Theme = (typeof BASE)['light'] & {
  /** Overpass covers Latin script; Hindi and Arabic use the phone's own fonts. */
  script: 'latin' | 'system';
  isRTL: boolean;
};

const OVERPASS: Record<FontWeightName, string> = {
  regular: 'Overpass_400Regular',
  medium: 'Overpass_500Medium',
  semibold: 'Overpass_600SemiBold',
};

/** A font family per weight: custom fonts on Android can't be made bolder by fontWeight. */
export function font(theme: Theme, weight: FontWeightName = 'regular'): TextStyle {
  if (theme.script === 'latin') return { fontFamily: OVERPASS[weight] };
  const numeric = String(theme.fontWeight[weight]) as TextStyle['fontWeight'];
  return { fontWeight: numeric };
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({
  mode,
  script,
  isRTL,
  children,
}: {
  mode: Mode;
  script: Theme['script'];
  isRTL: boolean;
  children: ReactNode;
}) {
  const theme = useMemo<Theme>(() => ({ ...BASE[mode], script, isRTL }), [mode, script, isRTL]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside ThemeProvider');
  return theme;
}

/** Touch targets: 48px on phones (WCAG asks for 24, platforms for 44–48). */
export const TOUCH = 48;
