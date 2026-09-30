/**
 * Seven languages, the same messages as the web app. The phone's language is used until
 * the person picks one; Arabic switches the whole layout to right to left, which needs a
 * restart of the app.
 */
import {
  englishMessages,
  isLocale,
  type Locale,
  loadMessages,
  type Messages,
  textDirection,
} from '@waypoint/i18n';
import { getCalendars, getLocales } from 'expo-localization';
import * as Updates from 'expo-updates';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { DevSettings, I18nManager, Platform } from 'react-native';
import { IntlProvider } from 'use-intl';
import { setApiLocale } from './api';
import { useSettings } from './settings';

export function deviceLocale(): Locale {
  for (const l of getLocales()) if (isLocale(l.languageCode)) return l.languageCode;
  return 'en';
}

/** The phone's region (two letters), for help lines before the person picks a country. */
export function deviceCountry(): string | null {
  const region = getLocales()[0]?.regionCode;
  return region && /^[A-Z]{2}$/.test(region) ? region : null;
}

export function deviceTimeZone(): string {
  return getCalendars()[0]?.timeZone ?? 'UTC';
}

/** Restart so a change of text direction takes effect. */
export async function restartApp(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch {
    DevSettings.reload();
  }
}

interface LocaleState {
  locale: Locale;
  /** The layout direction doesn't match the language yet: a restart is needed. */
  directionPending: boolean;
}

const LocaleContext = createContext<LocaleState>({ locale: 'en', directionPending: false });
export const useAppLocale = () => useContext(LocaleContext);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const locale = settings.locale ?? deviceLocale();
  const [messages, setMessages] = useState<{ locale: Locale; messages: Messages } | null>(
    locale === 'en' ? { locale, messages: englishMessages } : null,
  );

  useEffect(() => {
    let alive = true;
    setApiLocale(locale);
    loadMessages(locale)
      .then((m) => {
        if (alive) setMessages({ locale, messages: m });
      })
      .catch(() => {
        if (alive) setMessages({ locale: 'en', messages: englishMessages });
      });
    return () => {
      alive = false;
    };
  }, [locale]);

  const rtl = textDirection(locale) === 'rtl';
  const directionPending = Platform.OS !== 'web' && I18nManager.isRTL !== rtl;
  useEffect(() => {
    if (Platform.OS === 'web') return;
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  }, [rtl]);

  if (!messages) return null;
  return (
    <LocaleContext.Provider value={{ locale: messages.locale, directionPending }}>
      <IntlProvider
        locale={messages.locale}
        messages={messages.messages}
        timeZone={deviceTimeZone()}
        onError={() => {
          // A missing translation falls back to English (see loadMessages); never crash.
        }}
      >
        {children}
      </IntlProvider>
    </LocaleContext.Provider>
  );
}
