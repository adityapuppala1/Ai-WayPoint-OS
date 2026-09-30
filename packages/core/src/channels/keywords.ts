/**
 * What someone texted, as a command. Keywords work in every supported language whatever
 * language the conversation is in, so a Swahili speaker who types HELP is still helped.
 */
import { COUNTRIES, type CountryCode } from '@waypoint/content';
import { foldText } from '../text/normalize';
import { LOCALES, type Locale } from '../types';

export type ChannelCommand =
  | { kind: 'help' }
  | { kind: 'stop' }
  | { kind: 'start' }
  | { kind: 'menu' }
  | { kind: 'language'; value: Locale | null }
  | { kind: 'country'; value: CountryCode | null; raw: string }
  | { kind: 'check'; text: string }
  | { kind: 'ai'; on: boolean | null }
  | { kind: 'text'; text: string };

const words = (...list: string[]) => new Set(list.map((w) => foldText(w)));

/** Opt-out words include the carrier-standard ones (STOP, END, CANCEL, QUIT, UNSUBSCRIBE…). */
const STOP = words(
  'stop',
  'stopall',
  'unsubscribe',
  'cancel',
  'end',
  'quit',
  'optout',
  'arret',
  'arrêt',
  'alto',
  'parar',
  'pare',
  'sair',
  'acha',
  'simama',
  'रोकें',
  'रोको',
  'बंद',
  'توقف',
  'إيقاف',
  'الغاء',
);
const START = words(
  'start',
  'unstop',
  'optin',
  'anza',
  'commencer',
  'empezar',
  'comenzar',
  'começar',
  'comecar',
  'शुरू',
  'ابدأ',
  'ابدا',
);
const HELP = words(
  'help',
  'sos',
  'aide',
  'aidez',
  'ayuda',
  'ajuda',
  'socorro',
  'msaada',
  'saidia',
  'मदद',
  'सहायता',
  'مساعدة',
  'النجدة',
);
const MENU = words(
  'menu',
  'hi',
  'hello',
  'hey',
  'info',
  'hola',
  'ola',
  'olá',
  'oi',
  'bonjour',
  'salut',
  'habari',
  'jambo',
  'hujambo',
  'mambo',
  'namaste',
  'नमस्ते',
  'मेनू',
  'مرحبا',
  'القائمة',
  'السلام',
  'menú',
  'cardápio',
);
const CHECK = words(
  'check',
  'scan',
  'scam',
  'verifier',
  'vérifier',
  'verifie',
  'revisar',
  'verificar',
  'checar',
  'angalia',
  'kagua',
  'जाँच',
  'जांच',
  'जाँचें',
  'जांचें',
  'تحقق',
  'فحص',
);
const LANGUAGE = words(
  'lang',
  'language',
  'langue',
  'idioma',
  'lingua',
  'língua',
  'lugha',
  'भाषा',
  'لغة',
  'اللغة',
);
const COUNTRY = words('country', 'pays', 'pais', 'país', 'nchi', 'देश', 'بلد', 'دولة', 'البلد');
const AI = words('ai', 'ia', 'एआई', 'الذكاء');
const YES = words(
  'on',
  'yes',
  'y',
  'si',
  'sí',
  'oui',
  'sim',
  'ndio',
  'ndiyo',
  'haan',
  'हाँ',
  'हां',
  'نعم',
  'موافق',
);
const NO = words('off', 'no', 'n', 'non', 'nao', 'não', 'hapana', 'नहीं', 'ना', 'لا');

/** Language names and codes people might type after LANG, and menu numbers 1–7. */
const LANGUAGE_NAMES: Record<string, Locale> = {
  english: 'en',
  anglais: 'en',
  ingles: 'en',
  inglês: 'en',
  kiingereza: 'en',
  hindi: 'hi',
  हिन्दी: 'hi',
  हिंदी: 'hi',
  spanish: 'es',
  espanol: 'es',
  español: 'es',
  castellano: 'es',
  french: 'fr',
  francais: 'fr',
  français: 'fr',
  frances: 'fr',
  kifaransa: 'fr',
  portuguese: 'pt',
  portugues: 'pt',
  português: 'pt',
  arabic: 'ar',
  arabe: 'ar',
  árabe: 'ar',
  العربية: 'ar',
  عربي: 'ar',
  swahili: 'sw',
  kiswahili: 'sw',
};
const LANGUAGE_BY_NAME = new Map(
  Object.entries(LANGUAGE_NAMES).map(([name, locale]) => [foldText(name), locale]),
);

export function parseLanguage(value: string): Locale | null {
  const v = foldText(value).replace(/[^\p{L}\p{N}]/gu, '');
  if (!v) return null;
  if (/^[1-7]$/.test(v)) return LOCALES[Number(v) - 1] ?? null;
  if ((LOCALES as readonly string[]).includes(v)) return v as Locale;
  return LANGUAGE_BY_NAME.get(v) ?? null;
}

const COUNTRY_CODES = new Set(COUNTRIES.map((c) => c.code));

export function parseCountry(value: string): CountryCode | null {
  const v = value.trim().toUpperCase();
  const code = v === 'UK' ? 'GB' : v;
  return /^[A-Z]{2}$/.test(code) && COUNTRY_CODES.has(code) ? code : null;
}

/** Command words that belong to one language: a first text of "MSAADA" is answered in Swahili. */
const KEYWORD_LANGUAGE: Array<[Locale, string[]]> = [
  [
    'hi',
    ['मदद', 'सहायता', 'नमस्ते', 'मेनू', 'जाँच', 'जांच', 'जाँचें', 'जांचें', 'शुरू', 'रोकें', 'रोको', 'namaste'],
  ],
  ['es', ['ayuda', 'hola', 'revisar', 'empezar', 'comenzar', 'alto']],
  [
    'fr',
    [
      'aide',
      'aidez',
      'bonjour',
      'salut',
      'verifier',
      'vérifier',
      'verifie',
      'commencer',
      'arret',
      'arrêt',
    ],
  ],
  [
    'pt',
    ['ajuda', 'socorro', 'olá', 'oi', 'cardápio', 'checar', 'começar', 'comecar', 'pare', 'sair'],
  ],
  [
    'ar',
    [
      'مساعدة',
      'النجدة',
      'مرحبا',
      'القائمة',
      'السلام',
      'تحقق',
      'فحص',
      'ابدأ',
      'ابدا',
      'توقف',
      'إيقاف',
      'الغاء',
    ],
  ],
  [
    'sw',
    [
      'msaada',
      'saidia',
      'habari',
      'jambo',
      'hujambo',
      'mambo',
      'angalia',
      'kagua',
      'anza',
      'acha',
      'simama',
    ],
  ],
];
/** Words every language uses (HELP, MENU, STOP…) never pick a language. */
const SHARED = words(
  'help',
  'menu',
  'stop',
  'start',
  'check',
  'hi',
  'hello',
  'info',
  'sos',
  'lang',
);
const LANGUAGE_OF_KEYWORD = new Map(
  KEYWORD_LANGUAGE.flatMap(([locale, list]) =>
    list.map((w) => [foldText(w), locale] as const).filter(([w]) => !SHARED.has(w)),
  ),
);

/** The language a text's first word belongs to, when it is one of the command words. */
export function keywordLanguage(input: string): Locale | null {
  const first = input.trim().split(/\s+/)[0] ?? '';
  return LANGUAGE_OF_KEYWORD.get(foldText(first).replace(/[!.,?¡¿:;]+$/g, '')) ?? null;
}

export function parseCommand(input: string): ChannelCommand {
  const text = input.trim();
  const [first = '', ...rest] = text.split(/\s+/);
  const head = foldText(first).replace(/[!.,?¡¿:;]+$/g, '');
  const tail = rest.join(' ').trim();
  if (!head) return { kind: 'menu' };
  if (STOP.has(head) && !tail) return { kind: 'stop' };
  if (START.has(head) && !tail) return { kind: 'start' };
  if (HELP.has(head) && tail.split(/\s+/).length <= 2) return { kind: 'help' };
  if (MENU.has(head) && tail.split(/\s+/).filter(Boolean).length <= 2) return { kind: 'menu' };
  if (CHECK.has(head)) return { kind: 'check', text: tail };
  if (LANGUAGE.has(head)) return { kind: 'language', value: tail ? parseLanguage(tail) : null };
  if (COUNTRY.has(head)) return { kind: 'country', value: parseCountry(tail), raw: tail };
  if (AI.has(head)) {
    const answer = foldText(tail.split(/\s+/)[0] ?? '');
    return { kind: 'ai', on: YES.has(answer) ? true : NO.has(answer) ? false : null };
  }
  return { kind: 'text', text };
}
