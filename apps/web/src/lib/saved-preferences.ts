/**
 * What a page is drawn with on the server: language, theme, lite mode and time zone. Each
 * comes from its cookie (set by POST /api/preferences), and when a cookie is missing, from the
 * saved profile of whoever is signed in: on a new device, or after the browser's cookies were
 * cleared, their language and appearance come with them.
 */
import { isLocale, LOCALE_COOKIE, type Locale, resolveLocale } from '@waypoint/i18n';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import type { Preferences } from './preferences';
import { getViewer } from './server';

type Theme = NonNullable<Preferences['theme']>;

const isTheme = (v: unknown): v is Theme => v === 'system' || v === 'light' || v === 'dark';

/** A time zone by name that this server can format dates in; anything else is ignored. */
function timeZoneOrNull(tz: string | undefined | null): string | null {
  if (!tz || !/^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,2}$/.test(tz)) return null;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

export interface SavedPreferences {
  locale: Locale;
  theme: Theme;
  lite: boolean;
  timeZone: string;
  /**
   * Choices taken from the profile because their cookie was missing. The page asks the server
   * to set those cookies again (src/app/providers.tsx), so the API, which reads the language
   * from the cookie, answers in the same language as the page.
   */
  restore: Pick<Preferences, 'locale' | 'theme' | 'lite'>;
}

/** Once per request: the layout and the translations both ask. */
export const savedPreferences = cache(async (): Promise<SavedPreferences> => {
  const store = await cookies();
  const localeCookie = store.get(LOCALE_COOKIE)?.value;
  const themeCookie = store.get('wp-theme')?.value;
  const liteCookie = store.get('wp-lite')?.value;
  const chosen = {
    locale: isLocale(localeCookie) ? localeCookie : undefined,
    theme: isTheme(themeCookie) ? themeCookie : undefined,
    lite: liteCookie === '1' ? true : liteCookie === '0' ? false : undefined,
    timeZone: timeZoneOrNull(store.get('wp-tz')?.value) ?? undefined,
  };
  // The profile is only looked up when something is missing, and a page is never lost to it.
  const complete = Object.values(chosen).every((value) => value !== undefined);
  const profile = complete ? undefined : (await getViewer().catch(() => null))?.profile;
  const restore: SavedPreferences['restore'] = {};
  if (profile) {
    if (chosen.locale === undefined) restore.locale = profile.locale;
    if (chosen.theme === undefined) restore.theme = profile.theme;
    if (chosen.lite === undefined) restore.lite = profile.liteMode;
  }
  return {
    locale:
      chosen.locale ??
      profile?.locale ??
      resolveLocale(null, (await headers()).get('accept-language')),
    theme: chosen.theme ?? profile?.theme ?? 'system',
    lite: chosen.lite ?? profile?.liteMode ?? false,
    // The cookie is this device's own time zone, written on its first page; before that, the
    // one the person saved. "UTC" in a profile only means nobody has said.
    timeZone: chosen.timeZone ?? timeZoneOrNull(profile?.timezone) ?? 'UTC',
    restore,
  };
});
