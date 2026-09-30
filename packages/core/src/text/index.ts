/** Text helpers shared by the web, the phone app and the text-message replies. */
export { isolateNumbers, ltr } from './bidi';
export { unicodeBoundaries, WORD_BLOCKS, WORD_CHAR, WORD_EDGE } from './boundary';
export {
  detectLanguage,
  detectScript,
  foldArabic,
  foldIndic,
  foldPattern,
  foldText,
  LANGUAGE_MARKERS,
  normalizeText,
  unleet,
} from './normalize';
