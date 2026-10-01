/**
 * Locales, text direction and message loading shared by web (next-intl) and mobile (use-intl).
 * Every locale falls back to English key-by-key, so a partial translation never breaks the UI.
 */
import en from '../messages/en.json';

export const locales = ['en', 'hi', 'es', 'fr', 'pt', 'ar', 'sw'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/** Native names, shown in the language picker so people can find their own language. */
export const localeNames: Record<Locale, string> = {
  en: 'English',
  hi: 'हिन्दी',
  es: 'Español',
  fr: 'Français',
  pt: 'Português',
  ar: 'العربية',
  sw: 'Kiswahili',
};

/** Translation status, surfaced in settings so people know a language is still being reviewed. */
export const localeStatus: Record<Locale, 'complete' | 'beta'> = {
  en: 'complete',
  hi: 'beta',
  es: 'beta',
  fr: 'beta',
  pt: 'beta',
  ar: 'beta',
  sw: 'beta',
};

export const isLocale = (v: unknown): v is Locale =>
  typeof v === 'string' && (locales as readonly string[]).includes(v);

export const textDirection = (l: Locale): 'ltr' | 'rtl' => (l === 'ar' ? 'rtl' : 'ltr');

/**
 * Digits named for languages whose default ICU versions disagree on. Node and current
 * browsers write Arabic numbers in Latin digits ("12"); older ICU, as in Linux WebKit and
 * older iPhones and Macs, in Arabic-Indic ones ("١٢"). Left to each engine, a page was drawn
 * one way on the server and another in the browser, and React threw it away.
 */
const DIGITS: Partial<Record<Locale, string>> = { ar: 'latn' };

/**
 * The locale to give Intl (and libraries that format with it) for text drawn both on the
 * server and in the browser: the language, with its digits named where engines disagree
 * ("ar-u-nu-latn").
 */
export function formattingLocale(locale: Locale): string {
  const digits = DIGITS[locale];
  return digits ? `${locale}-u-nu-${digits}` : locale;
}

/** The language of a locale that may name its digits: "ar-u-nu-latn" is "ar". */
export function languageOf(locale: string): Locale {
  const language = locale.split('-u-')[0];
  return isLocale(language) ? language : defaultLocale;
}

export function resolveLocale(cookie?: string | null, acceptLanguage?: string | null): Locale {
  if (isLocale(cookie)) return cookie;
  const ranked = (acceptLanguage ?? '')
    .split(',')
    .map((part) => {
      const [tag = '', q = 'q=1'] = part.trim().toLowerCase().split(';');
      return { base: tag.split('-')[0], q: Number(q.split('=')[1]) || 0 };
    })
    .filter((r) => r.base)
    .sort((a, b) => b.q - a.q);
  return (ranked.map((r) => r.base).find(isLocale) as Locale | undefined) ?? defaultLocale;
}

/**
 * Namespaces the website renders only on the server (whole pages, never an interactive
 * component), so they are left out of the messages sent to the browser with every page —
 * the privacy notice alone is a sixth of the catalogue. `mobile` is the phone app's own.
 * A test checks that no client component on the website uses them.
 */
export const SERVER_ONLY_NAMESPACES = [
  'meta',
  'modules',
  'stepKinds',
  'aiExposure',
  'relevanceReasons',
  'roleReasons',
  'supportKinds',
  'planTemplates',
  'signals',
  'forecasts',
  'explore',
  'byText',
  'legal',
  'mobile',
] as const;

export type Messages = typeof en;

/** English, available without waiting: the first render and the fallback for every key. */
export const englishMessages: Messages = en;

type Json = { [key: string]: Json | string };

function deepMerge(base: Json, over: Json): Json {
  const out: Json = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = base[k];
    out[k] =
      typeof v === 'object' && v !== null && typeof b === 'object' && b !== null
        ? deepMerge(b, v)
        : v;
  }
  return out;
}

const loaders: Record<Locale, () => Promise<{ default: Json }>> = {
  en: async () => ({ default: en as Json }),
  hi: () => import('../messages/hi.json') as Promise<{ default: Json }>,
  es: () => import('../messages/es.json') as Promise<{ default: Json }>,
  fr: () => import('../messages/fr.json') as Promise<{ default: Json }>,
  pt: () => import('../messages/pt.json') as Promise<{ default: Json }>,
  ar: () => import('../messages/ar.json') as Promise<{ default: Json }>,
  sw: () => import('../messages/sw.json') as Promise<{ default: Json }>,
};

export async function loadMessages(locale: Locale): Promise<Messages> {
  if (locale === 'en') return en;
  const translated = (await loaders[locale]()).default;
  return deepMerge(en as Json, translated) as unknown as Messages;
}

/** The plan-writing templates for a locale (English falls back key by key). */
export async function planTemplates(locale: Locale): Promise<Messages['planTemplates']> {
  return (await loadMessages(locale)).planTemplates;
}
