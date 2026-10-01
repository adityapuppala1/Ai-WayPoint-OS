import { type Locale, languageOf } from '@waypoint/i18n';
import { useLocale } from 'next-intl';

/**
 * The page's language, for client components. Their next-intl locale is the formatting locale
 * (app/layout.tsx), which names its digits where engines disagree ("ar-u-nu-latn"): compare
 * this one, and send this one to the server.
 */
export function useLanguage(): Locale {
  return languageOf(useLocale());
}
