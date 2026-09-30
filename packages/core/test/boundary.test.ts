import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHIELD_PATTERN_SOURCES, SHIELD_RULES } from '../src/shield/rules';
import { unicodeBoundaries, WORD_BLOCKS, WORD_CHAR } from '../src/text/boundary';
import { foldText, unleet } from '../src/text/normalize';

const UNICODE_WORD = /[\p{L}\p{M}\p{N}_]/u;
const UNASSIGNED = /\p{Cn}/u;
const OLD_WORD = '[\\p{L}\\p{M}\\p{N}_]';
/** The edge the Shield used before: exact, but four full Unicode classes per `\b`. */
const OLD_EDGE = `(?:(?<=${OLD_WORD})(?!${OLD_WORD})|(?<!${OLD_WORD})(?=${OLD_WORD}))`;
const reference = (source: string) => new RegExp(source.replace(/(?<!\\)\\b/g, OLD_EDGE), 'u');

/** Builds WORD_CHAR from WORD_BLOCKS. If the blocks change, paste this output into boundary.ts. */
function generateWordChar(): string {
  const ranges: Array<[number, number]> = [];
  for (const [lo, hi] of WORD_BLOCKS) {
    let start = -1;
    let end = -1;
    for (let cp = lo; cp <= hi; cp++) {
      const ch = String.fromCodePoint(cp);
      if (UNICODE_WORD.test(ch)) {
        if (start < 0) start = cp;
        end = cp;
      } else if (!UNASSIGNED.test(ch) && start >= 0) {
        ranges.push([start, end]);
        start = -1;
      }
    }
    if (start >= 0) ranges.push([start, end]);
  }
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged.at(-1);
    if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  const hex = (cp: number) =>
    cp < 128 && /[0-9A-Za-z_]/.test(String.fromCharCode(cp))
      ? String.fromCharCode(cp)
      : `\\u${cp.toString(16).toUpperCase().padStart(4, '0')}`;
  const parts = merged.map(([a, b]) =>
    a === b ? hex(a) : b === a + 1 ? hex(a) + hex(b) : `${hex(a)}-${hex(b)}`,
  );
  return `[${parts.join('')}]`;
}

describe('WORD_CHAR', () => {
  const word = new RegExp(WORD_CHAR, 'u');

  it('is generated from WORD_BLOCKS', () => {
    expect(WORD_CHAR).toBe(generateWordChar());
  });

  it('agrees with Unicode letters, marks and digits for every assigned character it covers', () => {
    const disagreements: string[] = [];
    for (const [lo, hi] of WORD_BLOCKS) {
      for (let cp = lo; cp <= hi; cp++) {
        const ch = String.fromCodePoint(cp);
        if (UNASSIGNED.test(ch)) continue;
        if (word.test(ch) !== UNICODE_WORD.test(ch)) disagreements.push(cp.toString(16));
      }
    }
    expect(disagreements).toEqual([]);
  });

  it('treats sentence and word punctuation in every supported script as a separator', () => {
    for (const ch of [
      '.',
      ',',
      ' ',
      '-',
      "'",
      '،',
      '؛',
      '؟',
      '۔',
      '।',
      '॥',
      '፡',
      '።',
      '·',
      '€',
      '₹',
    ])
      expect(word.test(ch), ch).toBe(false);
    for (const ch of ['a', 'é', 'ß', 'क', 'ि', 'ं', '९', 'ب', 'ة', '٣', 'ж', 'ا', '_', '7'])
      expect(word.test(ch), ch).toBe(true);
  });
});

describe('unicodeBoundaries', () => {
  const START = `(?<!${WORD_CHAR})`;
  const END = `(?!${WORD_CHAR})`;

  it('checks one side where the pattern already knows the other', () => {
    expect(unicodeBoundaries('\\bpay\\b')).toBe(`${START}pay${END}`);
    expect(unicodeBoundaries('\\b(?:pay|send)\\b')).toBe(`${START}(?:pay|send)${END}`);
    expect(unicodeBoundaries('x[^.]{0,40}\\b(?:fee|charges?)\\b')).toBe(
      `x[^.]{0,40}${START}(?:fee|charges?)${END}`,
    );
    // An optional word before the next one still starts with a letter.
    expect(unicodeBoundaries('\\b(?:a |the )?fee')).toBe(`${START}(?:a |the )?fee`);
    expect(unicodeBoundaries('\\bशुल्क')).toBe(`${START}शुल्क`);
    expect(unicodeBoundaries('\\d+\\b')).toBe(`\\d+${END}`);
  });

  it('keeps the full edge where the pattern doesn’t say', () => {
    const full = unicodeBoundaries('\\b');
    expect(full).toContain('(?<=');
    expect(unicodeBoundaries('\\b(?:\\$|€)')).toContain('(?<=');
    expect(unicodeBoundaries('(?:pay)?\\b(?:fee)?')).toContain('(?<=');
    expect(unicodeBoundaries('[.,]\\b')).toContain('(?<=');
  });

  it('leaves backspace in a class, escaped backslashes and other escapes alone', () => {
    expect(unicodeBoundaries('[\\b]x')).toBe('[\\b]x');
    expect(unicodeBoundaries('a\\\\b')).toBe('a\\\\b');
    expect(unicodeBoundaries('\\Bx\\.y')).toBe('\\Bx\\.y');
  });

  it('never uses the full Unicode classes', () => {
    for (const source of SHIELD_PATTERN_SOURCES)
      expect(unicodeBoundaries(source)).not.toContain('\\p{');
  });
});

describe('Scam Shield patterns with the new edges', () => {
  const read = (file: string) =>
    readFileSync(join(__dirname, '../../../evals/datasets', file), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => (JSON.parse(l) as { text: string }).text);

  // Real messages in seven languages, then the same messages with their spaces swapped for
  // punctuation, digits and letters of other scripts, so every edge meets every neighbour.
  const texts = [...read('scam.jsonl'), ...read('crisis.jsonl')];
  const neighbours = [' ', '،', '।', '-', '_', '.', '7', 'é', 'ب', 'क', '"', '\n', '٣', '॥'];
  const corpus = new Set<string>();
  for (const text of texts) {
    const folded = foldText(text);
    corpus.add(folded);
    corpus.add(unleet(folded));
    neighbours.forEach((n, i) => {
      let k = 0;
      // Swap every other space, so words keep some of their usual neighbours.
      corpus.add(folded.replace(/ /g, () => (k++ % 2 === i % 2 ? n : ' ')));
    });
  }

  it('builds one pattern per source', () => {
    const compiled = SHIELD_RULES.reduce((n, r) => n + r.all.length + (r.none?.length ?? 0), 0);
    expect(SHIELD_PATTERN_SOURCES.length).toBeGreaterThanOrEqual(compiled);
  });

  it('matches exactly what the full Unicode edge matches', { timeout: 60_000 }, () => {
    const differences: string[] = [];
    let compared = 0;
    for (const source of SHIELD_PATTERN_SOURCES) {
      const fast = new RegExp(unicodeBoundaries(source), 'u');
      const full = reference(source);
      // Without any edges the pattern only gets more permissive: where even that finds
      // nothing, both versions find nothing, so only the rest needs the slow comparison.
      const loose = new RegExp(source.replace(/(?<!\\)\\b/g, ''), 'u');
      for (const text of corpus) {
        if (!loose.test(text)) continue;
        compared++;
        if (fast.test(text) !== full.test(text))
          differences.push(`${source.slice(0, 50)} :: ${text.slice(0, 60)}`);
      }
    }
    expect(differences.slice(0, 10)).toEqual([]);
    expect(compared).toBeGreaterThan(1000);
  });
});
