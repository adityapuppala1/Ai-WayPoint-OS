import '../src/polyfills';
import { Overpass_400Regular } from '@expo-google-fonts/overpass/400Regular';
import { Overpass_500Medium } from '@expo-google-fonts/overpass/500Medium';
import { Overpass_600SemiBold } from '@expo-google-fonts/overpass/600SemiBold';
import { textDirection } from '@waypoint/i18n';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { type ReactNode, useEffect } from 'react';
import { I18nManager, Platform, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslations } from 'use-intl';
import { I18nProvider, useAppLocale } from '../src/i18n';
import { SettingsProvider, useSettings } from '../src/settings';
import { font, ThemeProvider, useTheme } from '../src/theme';
import { ToastProvider } from '../src/ui';

// Keep the splash screen up until the language and fonts are ready, so nothing flashes.
SplashScreen.preventAutoHideAsync().catch(() => {});

/** Light, dark or the phone's choice; Latin or system fonts; the layout's direction. */
function Themed({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const { locale } = useAppLocale();
  const system = useColorScheme();
  const mode =
    settings.theme === 'system' ? (system === 'dark' ? 'dark' : 'light') : settings.theme;
  const rtl = textDirection(locale) === 'rtl';
  // Phones switch direction on restart (see i18n.tsx); the web build switches at once.
  const isRTL = Platform.OS === 'web' ? rtl : I18nManager.isRTL;
  const script = locale === 'hi' || locale === 'ar' ? 'system' : 'latin';
  return (
    <ThemeProvider mode={mode} script={script} isRTL={isRTL}>
      {children}
    </ThemeProvider>
  );
}

function Navigation() {
  const theme = useTheme();
  const common = useTranslations('common');
  const { locale } = useAppLocale();

  useEffect(() => {
    // The window behind the app (seen when the keyboard opens or a sheet slides) matches it.
    SystemUI.setBackgroundColorAsync(theme.colors.canvas).catch(() => {});
    SplashScreen.hideAsync().catch(() => {});
  }, [theme.colors.canvas]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      document.documentElement.dir = textDirection(locale);
    }
  }, [locale]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.canvas,
        direction: Platform.OS === 'web' ? (theme.isRTL ? 'rtl' : 'ltr') : undefined,
      }}
    >
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <ToastProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.colors.canvas },
            headerTintColor: theme.colors.text,
            headerTitleStyle: { ...font(theme, 'semibold'), fontSize: 17 },
            headerShadowVisible: false,
            headerBackTitle: common('back'),
            contentStyle: { backgroundColor: theme.colors.canvas },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="start" options={{ presentation: 'modal' }} />
          <Stack.Screen name="account" options={{ presentation: 'modal' }} />
          <Stack.Screen name="language" options={{ presentation: 'modal' }} />
          <Stack.Screen name="country" options={{ presentation: 'modal' }} />
          <Stack.Screen name="report" options={{ presentation: 'modal' }} />
          <Stack.Screen name="conversations" options={{ presentation: 'modal' }} />
        </Stack>
      </ToastProvider>
    </View>
  );
}

function Ready({ children }: { children: ReactNode }) {
  const { ready } = useSettings();
  const [fontsLoaded, fontError] = useFonts({
    Overpass_400Regular,
    Overpass_500Medium,
    Overpass_600SemiBold,
  });
  // A font that fails to load falls back to the system font rather than blocking the app.
  if (!ready || (!fontsLoaded && !fontError)) return null;
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <Ready>
          <I18nProvider>
            <Themed>
              <Navigation />
            </Themed>
          </I18nProvider>
        </Ready>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
