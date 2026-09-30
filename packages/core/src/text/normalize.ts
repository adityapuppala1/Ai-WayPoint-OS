/**
 * Text normalisation used by the deterministic safety classifiers (crisis, Scam Shield).
 * The goal is robust matching across languages and common evasion tricks, not display.
 */

const ZERO_WIDTH = /[​-‍⁠﻿­]/g;
const LATIN_MARKS = /[̀-ͯ]/g; // combining diacritics on Latin letters
const ARABIC_MARKS = /[ً-ٰٟۖ-ۭ]/g; // optional Arabic vowel marks (tashkeel)
const QUOTES = /[‘’‚‛′`´]/g;
const DQUOTES = /[“”„‟″]/g;
const DASHES = /[‐-―−]/g;

/** Lower-case, fold compatibility forms, remove zero-width characters, unify quotes. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFKC')
    .replace(ZERO_WIDTH, '')
    .replace(QUOTES, "'")
    .replace(DQUOTES, '"')
    .replace(DASHES, '-')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Arabic spellings that mean the same word: vowel marks and hamza seats dropped (أ إ آ → ا,
 * ؤ → و, ئ → ي), ى → ي, ة → ه, and tatweel removed.
 */
export function foldArabic(input: string): string {
  return input
    .normalize('NFD')
    .replace(ARABIC_MARKS, '')
    .normalize('NFC')
    .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627') // alef variants → bare alef
    .replace(/\u0649/g, '\u064A') // alef maqsura → yaa
    .replace(/\u0629/g, '\u0647') // taa marbuta → haa
    .replace(/\u0640/g, ''); // tatweel
}

/** Hindi spellings that mean the same word: nukta dropped (ज़ → ज), chandrabindu as anusvara. */
export function foldIndic(input: string): string {
  return input.replace(/\u093c/g, '').replace(/\u0901/g, '\u0902');
}

/**
 * Folds the letters in a pattern's source the way foldText folds what people write, so a
 * pattern can be written in its natural spelling ("جرعة زائدة", "ज़हर") and still match.
 * Only Arabic and Hindi letters change; regular-expression syntax is left alone.
 */
export function foldPattern(source: string): string {
  return foldIndic(foldArabic(source));
}

/**
 * Like normalizeText but also folds spelling variants: Latin diacritics ("médicaments" →
 * "medicaments"), Arabic vowel marks and hamza seats, and Hindi nukta and chandrabindu.
 */
export function foldText(input: string): string {
  return foldPattern(
    normalizeText(input).normalize('NFD').replace(LATIN_MARKS, '').normalize('NFC'),
  );
}

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
};

/** Undo common character substitutions used to dodge filters ("k1ll mys3lf"). Latin text only. */
export function unleet(input: string): string {
  // Only substitute inside words that contain letters, so "20 pills" keeps its number.
  return input.replace(/[a-z0-9@$!]+/g, (word) =>
    /[a-z]/.test(word) && /[0-9@$!]/.test(word)
      ? word.replace(/[013457@$!]/g, (c) => LEET[c] ?? c)
      : word,
  );
}

export type Script = 'latin' | 'devanagari' | 'bengali' | 'arabic' | 'other';

export function detectScript(text: string): Script {
  let latin = 0;
  let deva = 0;
  let beng = 0;
  let arab = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || (c >= 0xc0 && c <= 0x24f)) latin++;
    else if (c >= 0x900 && c <= 0x97f) deva++;
    else if (c >= 0x980 && c <= 0x9ff) beng++;
    else if ((c >= 0x600 && c <= 0x6ff) || (c >= 0x750 && c <= 0x77f)) arab++;
  }
  const max = Math.max(latin, deva, beng, arab);
  if (max === 0) return 'other';
  if (max === deva) return 'devanagari';
  if (max === arab) return 'arabic';
  if (max === beng) return 'bengali';
  return 'latin';
}

/**
 * Common words of each Latin-script language Waypoint speaks other than English (folded, as
 * `foldText` gives them). English has none here: `detectLanguage` falls back to it.
 */
export const LANGUAGE_MARKERS: ReadonlyArray<readonly [lang: string, words: readonly string[]]> = [
  [
    'es',
    [
      'que',
      'no',
      'quiero',
      'mi',
      'estoy',
      'para',
      'pero',
      'porque',
      'tengo',
      'como',
      'muy',
      'nada',
      'hoy',
      'usted',
      'dinero',
      'cuenta',
    ],
  ],
  [
    'fr',
    [
      'je',
      'ne',
      'pas',
      'suis',
      'mon',
      'mais',
      'avec',
      'pour',
      'plus',
      'votre',
      'vous',
      'est',
      "j'ai",
      'rien',
      'aujourd',
    ],
  ],
  [
    'pt',
    [
      'nao',
      'eu',
      'estou',
      'minha',
      'meu',
      'voce',
      'para',
      'mais',
      'hoje',
      'tenho',
      'muito',
      'nada',
      'sua',
      'conta',
      'dinheiro',
    ],
  ],
  [
    'sw',
    [
      'nataka',
      'sitaki',
      'mimi',
      'yangu',
      'kwa',
      'na',
      'ni',
      'sana',
      'leo',
      'wewe',
      'pesa',
      'tafadhali',
      'sijui',
      'nime',
    ],
  ],
  [
    'hi',
    [
      'hai',
      'nahi',
      'nahin',
      'mujhe',
      'mera',
      'meri',
      'kya',
      'hoon',
      'hu',
      'aur',
      'bhi',
      'kar',
      'paise',
      'aap',
      'mai',
      'main',
    ],
  ],
];

/** Best-effort language guess for short messages. Script first, then marker words. */
export function detectLanguage(text: string): string {
  const script = detectScript(text);
  if (script === 'devanagari') return 'hi';
  if (script === 'arabic') return 'ar';
  if (script === 'bengali') return 'bn';
  if (script !== 'latin') return 'und';
  const words = foldText(text)
    .split(/[^a-z']+/)
    .filter(Boolean);
  if (!words.length) return 'und';
  let best = 'en';
  let bestScore = 0;
  for (const [lang, markers] of LANGUAGE_MARKERS) {
    const set = new Set(markers);
    const score = words.filter((w) => set.has(w)).length;
    if (score > bestScore) {
      best = lang;
      bestScore = score;
    }
  }
  return bestScore >= 1 && bestScore / words.length >= 0.08 ? best : 'en';
}
