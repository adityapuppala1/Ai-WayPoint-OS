import type { ProbabilityWord } from '@waypoint/core';

/** The message key (under `forecasts.words`) for each calibrated word. */
export const WORD_KEYS = {
  remote: 'remote',
  'very-unlikely': 'veryUnlikely',
  unlikely: 'unlikely',
  'about-even': 'aboutEven',
  likely: 'likely',
  'very-likely': 'veryLikely',
  'almost-certain': 'almostCertain',
} as const satisfies Record<ProbabilityWord, string>;

export const wordKey = (words: string) => WORD_KEYS[words as ProbabilityWord] ?? 'aboutEven';
