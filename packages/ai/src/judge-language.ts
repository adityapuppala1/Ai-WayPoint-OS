/**
 * The language a text is written in, as the judge's gate needs it: named only when it is
 * clear. TypeSafe says Jev is weaker outside English, and a language is switched on for it
 * only after it has been measured (AI_JUDGE_LOCALES), so text that is not clearly written in
 * one of those languages must not reach it.
 *
 * Core's `detectLanguage` (used by the crisis check and the texting service, and left as it
 * is) answers "English" when it finds nothing better. For the judge that sent Spanish,
 * Portuguese and Swahili messages with few common words, and Russian or Chinese ones carrying
 * a link, as English. Here nothing is assumed:
 *  - links and addresses are left out first: their letters are in no language;
 *  - one script must hold nine letters in ten, and it must be one Waypoint has words for.
 *    Cyrillic, Chinese, Greek, Thai and the rest are "und";
 *  - Devanagari, Arabic and Bengali are named by their script, as core does;
 *  - Latin-script text is named only when enough different words are common words of one
 *    language, ahead of every other. English has its own list here; the others are core's.
 *    Dutch and German, which Waypoint does not speak but which share short words with
 *    English ("is", "we", "was"), have lists here too, and text that reads as either is "und".
 */
import { foldText, LANGUAGE_MARKERS } from '@waypoint/core/text';

/** Undetermined: not clearly any language. The judge is never asked about it. */
const UNDETERMINED = 'und';

/** Web addresses, bare domains and email addresses. */
const NOT_WORDS = /\S+@\S+|https?:\/\/\S+|www\.\S+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/gi;

const SCRIPTS = [
  ['latin', /\p{Script=Latin}/u],
  ['hi', /\p{Script=Devanagari}/u],
  ['ar', /\p{Script=Arabic}/u],
  ['bn', /\p{Script=Bengali}/u],
] as const;

/** The share of letters the main script must hold. */
const ONE_SCRIPT = 0.9;

/**
 * Common English words, folded: grammar words, which other languages rarely borrow, not words
 * such as "account" or "please" that turn up in Swahili or Hindi messages too. "a", "as",
 * "do", "for", "has", "he", "me", "no", "on" and "or" are left out: they are common words in
 * Waypoint's other Latin-script languages as well ("has" in Spanish, "for" in Portuguese).
 */
const ENGLISH = [
  'the',
  'you',
  'your',
  'yours',
  "you're",
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'to',
  'and',
  'of',
  'per',
  'without',
  'this',
  'that',
  'these',
  'those',
  'have',
  'had',
  'with',
  'we',
  'our',
  'us',
  'will',
  'would',
  'can',
  'could',
  'should',
  'not',
  "don't",
  "can't",
  'it',
  "it's",
  'from',
  'what',
  'how',
  'why',
  'when',
  'where',
  'who',
  'which',
  'my',
  'i',
  "i'm",
  'if',
  'at',
  'by',
  'get',
  'now',
  'just',
  'there',
  'here',
  'they',
  'them',
  'their',
  'she',
  'his',
  'her',
  'about',
  'all',
  'any',
  'some',
  'only',
  'than',
  'then',
  'very',
  'more',
  'need',
  'want',
  'am',
  'up',
  'out',
];

/**
 * Common Dutch and German words that no language Waypoint speaks uses. They are here only to
 * outscore English in a Dutch or German text: neither language is ever named.
 */
const NEVER_NAMED: ReadonlyArray<readonly [string, readonly string[]]> = [
  [
    'nl',
    [
      'het',
      'een',
      'uw',
      'ik',
      'niet',
      'hebben',
      'heeft',
      'ons',
      'op',
      'zijn',
      'wij',
      'jij',
      'jouw',
      'bent',
      'naar',
      'voor',
      'dat',
      'deze',
      'wordt',
      'kunt',
    ],
  ],
  [
    'de',
    [
      'der',
      'und',
      'ist',
      'nicht',
      'sie',
      'wir',
      'ihr',
      'ihre',
      'ihnen',
      'ich',
      'sind',
      'mit',
      'fur',
      'auf',
      'ein',
      'eine',
      'dein',
      'bitte',
      'wird',
      'haben',
      'werden',
    ],
  ],
];

/**
 * At least this many different common words of the winning language, and this share of all
 * words.
 */
const MARKERS_NEEDED = { words: 2, share: 0.1 } as const;

const LISTS: ReadonlyArray<readonly [string, ReadonlySet<string>]> = [
  ['en', new Set(ENGLISH)],
  ...LANGUAGE_MARKERS.map(([lang, words]) => [lang, new Set(words)] as const),
  ...NEVER_NAMED.map(([lang, words]) => [lang, new Set(words)] as const),
];
const UNNAMED = new Set(NEVER_NAMED.map(([lang]) => lang));

type Reading =
  | { script: 'hi' | 'ar' | 'bn' }
  | { script: 'latin'; words: number; scores: ReadonlyArray<readonly [string, number]> }
  | null;

/** The script that holds nine letters in ten, and for Latin, each list's common words. */
function read(text: string): Reading {
  const plain = text.replace(NOT_WORDS, ' ');
  const letters = plain.match(/\p{L}/gu) ?? [];
  if (!letters.length) return null;
  const counts = SCRIPTS.map(
    ([script, pattern]) => [script, letters.filter((l) => pattern.test(l)).length] as const,
  );
  const [script, most] = counts.reduce((a, b) => (b[1] > a[1] ? b : a));
  if (most < letters.length * ONE_SCRIPT) return null;
  if (script !== 'latin') return { script };

  const words = foldText(plain)
    .split(/[^a-z']+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
  // Different words: one word said twice ("has … has") is still one.
  const scores = LISTS.map(
    ([lang, set]) => [lang, new Set(words.filter((w) => set.has(w))).size] as const,
  ).sort((a, b) => b[1] - a[1]);
  return { script, words: words.length, scores };
}

/** The language `text` is clearly written in ("en", "es", "hi"…), or "und". */
export function judgeTextLanguage(text: string): string {
  const reading = read(text);
  if (!reading) return UNDETERMINED;
  if (reading.script !== 'latin') return reading.script;
  const [best, runnerUp] = reading.scores;
  if (!best || best[1] < MARKERS_NEEDED.words) return UNDETERMINED;
  if (best[1] < reading.words * MARKERS_NEEDED.share) return UNDETERMINED;
  if (runnerUp && runnerUp[1] === best[1]) return UNDETERMINED;
  return UNNAMED.has(best[0]) ? UNDETERMINED : best[0];
}

/**
 * The language of text Waypoint's own model wrote for a reader of `locale` (an answer, a
 * reworded plan): as `judgeTextLanguage`, except that Latin-script text that is not clearly in
 * any language is taken to be in the reader's, when that is a Latin-script language and no
 * other language has more of its common words in it. The model is told to write in the
 * reader's language, and its short answers ("Paracetamol 1g every 6 hours, max 4g daily") can
 * be too clipped to name one. Never for text a person pasted or typed: that is only ever read
 * when its language is clear.
 */
export function judgeWrittenLanguage(text: string, locale: string): string {
  const clear = judgeTextLanguage(text);
  const reading = read(text);
  if (clear !== UNDETERMINED || reading?.script !== 'latin') return clear;
  const reader = locale.trim().toLowerCase().split(/[-_]/)[0] ?? '';
  // A language written in the Latin script, with a list of its own ("hi" has one for Hindi
  // typed in Latin letters, but is written in Devanagari).
  const latin =
    LISTS.some(([lang]) => lang === reader) &&
    !UNNAMED.has(reader) &&
    !SCRIPTS.some(([script]) => script === reader);
  if (!latin) return UNDETERMINED;
  const own = reading.scores.find(([lang]) => lang === reader)?.[1] ?? 0;
  return reading.scores.some(([lang, n]) => lang !== reader && n > own) ? UNDETERMINED : reader;
}
