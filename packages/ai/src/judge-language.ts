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
 *  - Latin-script text is named only when enough of its words are common words of one
 *    language, ahead of every other. English has its own list here; the others are core's.
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
 * "do", "he", "me", "no", "on" and "or" are left out: they are common words in Waypoint's
 * other Latin-script languages as well.
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
  'for',
  'this',
  'that',
  'these',
  'those',
  'have',
  'has',
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

/** At least this many common words of the winning language, and this share of all words. */
const MARKERS_NEEDED = { words: 2, share: 0.1 } as const;

const LISTS: ReadonlyArray<readonly [string, ReadonlySet<string>]> = [
  ['en', new Set(ENGLISH)],
  ...LANGUAGE_MARKERS.map(([lang, words]) => [lang, new Set(words)] as const),
];

/** The language `text` is clearly written in ("en", "es", "hi"…), or "und". */
export function judgeTextLanguage(text: string): string {
  const plain = text.replace(NOT_WORDS, ' ');
  const letters = plain.match(/\p{L}/gu) ?? [];
  if (!letters.length) return UNDETERMINED;
  const counts = SCRIPTS.map(
    ([script, pattern]) => [script, letters.filter((l) => pattern.test(l)).length] as const,
  );
  const [script, most] = counts.reduce((a, b) => (b[1] > a[1] ? b : a));
  if (most < letters.length * ONE_SCRIPT) return UNDETERMINED;
  if (script !== 'latin') return script;

  const words = foldText(plain)
    .split(/[^a-z']+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
  const scores = LISTS.map(
    ([lang, set]) => [lang, words.filter((w) => set.has(w)).length] as const,
  ).sort((a, b) => b[1] - a[1]);
  const [best, runnerUp] = scores;
  if (!best || best[1] < MARKERS_NEEDED.words) return UNDETERMINED;
  if (best[1] < words.length * MARKERS_NEEDED.share) return UNDETERMINED;
  if (runnerUp && runnerUp[1] === best[1]) return UNDETERMINED;
  return best[0];
}
