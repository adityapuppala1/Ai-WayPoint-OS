import { isLocale, loadMessages } from '@waypoint/i18n';
import { getRequestConfig } from 'next-intl/server';
import { savedPreferences } from '@/lib/saved-preferences';

export default getRequestConfig(async ({ locale: override }) => {
  // The language and time zone cookies, then the saved profile, then the browser's language
  // and UTC (src/lib/saved-preferences.ts).
  const saved = await savedPreferences();
  const locale = isLocale(override) ? override : saved.locale;
  return { locale, messages: await loadMessages(locale), timeZone: saved.timeZone };
});
