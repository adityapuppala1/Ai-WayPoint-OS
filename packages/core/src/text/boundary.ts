/**
 * Word boundaries that work in every script and stay cheap on phones.
 *
 * JavaScript's `\b` only knows ASCII letters, so the safety patterns need their own word edge.
 * The obvious one — `(?<=[\p{L}\p{M}\p{N}_])(?!…)|(?<!…)(?=…)` — costs four copies of every
 * letter range in Unicode per `\b`. Hermes (the engine in the mobile app) compiles each copy
 * into the pattern, so the Scam Shield rules grew to about 19 MB and took seconds to compile
 * on a low-cost phone. Two changes keep the meaning and drop the cost by about 40×:
 *
 *  1. WORD_CHAR lists letters, marks and digits exactly for the scripts people write to
 *     Waypoint in (Latin, Greek, Cyrillic, Armenian, Hebrew, Arabic, Syriac, Thaana, the Indic
 *     scripts, Thai, Lao, Georgian, Hangul, Ethiopic, Khmer, kana and CJK), with unassigned
 *     code points folded into their neighbours so the class stays short.
 *  2. Most `\b` sit where one side is known to be a word character — before "(?:pay|send)",
 *     after "fee" — and then only the other side needs checking: one lookaround instead of
 *     four. Where the pattern doesn't say, the full edge is used.
 *
 * test/boundary.test.ts checks WORD_CHAR against Unicode and that every Shield pattern
 * matches exactly as the full edge would.
 */

/**
 * `[\p{L}\p{M}\p{N}_]` for the blocks in WORD_BLOCKS (exact for every assigned character).
 * Regenerate with the script in test/boundary.test.ts if the blocks change.
 */
export const WORD_CHAR =
  '[0-9A-Z_a-z\\u00AA\\u00B2\\u00B3\\u00B5\\u00B9\\u00BA\\u00BC-\\u00BE\\u00C0-\\u00D6' +
  '\\u00D8-\\u00F6\\u00F8-\\u02C1\\u02C6-\\u02D1\\u02E0-\\u02E4\\u02EC\\u02EE' +
  '\\u0300-\\u0374\\u0376-\\u037D\\u037F\\u0386\\u0388-\\u03F5\\u03F7-\\u0481' +
  '\\u0483-\\u052F\\u0531-\\u0559\\u0560-\\u0588\\u0591-\\u05BD\\u05BF\\u05C1\\u05C2' +
  '\\u05C4\\u05C5\\u05C7-\\u05F2\\u0610-\\u061A\\u0620-\\u0669\\u066E-\\u06D3' +
  '\\u06D5-\\u06DC\\u06DF-\\u06E8\\u06EA-\\u06FC\\u06FF\\u0710-\\u07B1\\u0870-\\u0887' +
  '\\u0889-\\u088F\\u0897-\\u08E1\\u08E3-\\u0963\\u0966-\\u096F\\u0971-\\u09F1' +
  '\\u09F4-\\u09F9\\u09FC\\u09FE-\\u0A75\\u0A81-\\u0AEF\\u0AF9-\\u0B6F\\u0B71-\\u0BF2' +
  '\\u0C00-\\u0C6F\\u0C78-\\u0C7E\\u0C80-\\u0C83\\u0C85-\\u0D4E\\u0D54-\\u0D78' +
  '\\u0D7A-\\u0DF3\\u0E01-\\u0E3A\\u0E40-\\u0E4E\\u0E50-\\u0E59\\u0E81-\\u0EDF' +
  '\\u10A0-\\u10FA\\u10FC-\\u135F\\u1369-\\u138F\\u1780-\\u17D3\\u17D7\\u17DC-\\u17F9' +
  '\\u1E00-\\u1FBC\\u1FBE\\u1FC2-\\u1FCC\\u1FD0-\\u1FDB\\u1FE0-\\u1FEC\\u1FF2-\\u1FFC' +
  '\\u3041-\\u309A\\u309D-\\u309F\\u30A1-\\u30FA\\u30FC-\\u30FF\\u3400-\\u4DBF' +
  '\\u4E00-\\u9FFF\\uAC00-\\uD7A3\\uFB00-\\uFB28\\uFB2A-\\uFBB1\\uFBD3-\\uFD3D' +
  '\\uFD50-\\uFD8F\\uFD92-\\uFDC7\\uFDF0-\\uFDFB\\uFE70-\\uFEFC]';

/** The Unicode blocks WORD_CHAR covers exactly; characters outside them are not word characters. */
export const WORD_BLOCKS: ReadonlyArray<readonly [number, number]> = [
  [0x0000, 0x024f], // Basic Latin, Latin-1, Latin Extended-A/B
  [0x0250, 0x036f], // IPA, spacing modifiers, combining diacritics
  [0x0370, 0x052f], // Greek, Cyrillic
  [0x0530, 0x058f], // Armenian
  [0x0590, 0x05ff], // Hebrew
  [0x0600, 0x06ff], // Arabic
  [0x0700, 0x07bf], // Syriac, Arabic Supplement, Thaana
  [0x0870, 0x08ff], // Arabic Extended-B/A
  [0x0900, 0x097f], // Devanagari
  [0x0980, 0x0dff], // Bengali … Sinhala
  [0x0e00, 0x0eff], // Thai, Lao
  [0x10a0, 0x10ff], // Georgian
  [0x1100, 0x11ff], // Hangul Jamo
  [0x1200, 0x139f], // Ethiopic
  [0x1780, 0x17ff], // Khmer
  [0x1e00, 0x1fff], // Latin Extended Additional, Greek Extended
  [0x3040, 0x30ff], // Hiragana, Katakana
  [0x3400, 0x4dbf], // CJK Extension A
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0xac00, 0xd7af], // Hangul Syllables
  [0xfb00, 0xfdff], // Alphabetic and Arabic Presentation Forms-A
  [0xfe70, 0xfeff], // Arabic Presentation Forms-B
];

const IS_WORD = new RegExp(WORD_CHAR, 'u');
const START = `(?<!${WORD_CHAR})`; // the next character is a word character
const END = `(?!${WORD_CHAR})`; // the previous character is a word character
const EDGE = `(?:(?<=${WORD_CHAR})${END}|${START}(?=${WORD_CHAR}))`;

/** The general word edge, for callers that need it outside a pattern. */
export const WORD_EDGE = EDGE;

// ─────────────────────────────── A small pattern reader ───────────────────────────────
//
// Just enough of the regular-expression grammar (with the `u` flag) to know, for each `\b`,
// whether the characters on either side must be word characters. Anything it can't be sure
// about is treated as "might not be", which only ever falls back to the full edge.

interface Item {
  /** Can match without consuming anything (assertions, `?`, `*`, `{0,n}`). */
  nullable: boolean;
  /** Consumes nothing at all (assertions and `\b`). */
  zeroWidth: boolean;
  /** Whenever it consumes, the first / last character it consumes is a word character. */
  firstWord: boolean;
  lastWord: boolean;
  /** For `\b`: where it sits in the source, so it can be rewritten. */
  boundaryAt?: number;
}

type Choice = 'start' | 'end' | 'edge';

const isWordCodePoint = (cp: number) => IS_WORD.test(String.fromCodePoint(cp));

/** Every code point in [lo, hi] is a word character. */
function rangeIsWord(lo: number, hi: number): boolean {
  if (hi - lo > 0x3000) return false; // never needed by the patterns; keep the check cheap
  for (let cp = lo; cp <= hi; cp++) if (!isWordCodePoint(cp)) return false;
  return true;
}

class Reader {
  pos = 0;
  readonly choices = new Map<number, Choice>();
  constructor(readonly src: string) {}

  private peek(offset = 0): string {
    return this.src[this.pos + offset] ?? '';
  }

  /** alternative ('|' alternative)* */
  disjunction(): Item[][] {
    const alternatives = [this.alternative()];
    while (this.peek() === '|') {
      this.pos++;
      alternatives.push(this.alternative());
    }
    return alternatives;
  }

  private alternative(): Item[] {
    const items: Item[] = [];
    while (this.pos < this.src.length && this.peek() !== '|' && this.peek() !== ')') {
      const atom = this.atom();
      items.push(this.quantified(atom));
    }
    this.decide(items);
    return items;
  }

  /** Choose the cheapest exact form for each `\b` in one sequence. */
  private decide(items: Item[]): void {
    items.forEach((item, i) => {
      if (item.boundaryAt === undefined) return;
      const choice: Choice = nextIsWord(items, i + 1)
        ? 'start'
        : previousIsWord(items, i - 1)
          ? 'end'
          : 'edge';
      this.choices.set(item.boundaryAt, choice);
    });
  }

  private quantified(item: Item): Item {
    const c = this.peek();
    let min: number | null = null;
    if (c === '?' || c === '*') {
      min = 0;
      this.pos++;
    } else if (c === '+') {
      min = 1;
      this.pos++;
    } else if (c === '{') {
      const m = /^\{(\d+)(?:,(\d*))?\}/.exec(this.src.slice(this.pos));
      if (m) {
        min = Number(m[1]);
        this.pos += m[0].length;
      }
    }
    if (min === null) return item;
    if (this.peek() === '?') this.pos++; // lazy
    return { ...item, nullable: item.nullable || min === 0, boundaryAt: undefined };
  }

  private atom(): Item {
    const c = this.peek();
    if (c === '(') return this.group();
    if (c === '[') return this.characterClass();
    if (c === '\\') return this.escape();
    this.pos++;
    if (c === '^' || c === '$') return zeroWidth();
    if (c === '.') return consuming(false);
    const cp = this.src.codePointAt(this.pos - 1) ?? 0;
    if (cp > 0xffff) this.pos++;
    return consuming(isWordCodePoint(cp));
  }

  private group(): Item {
    this.pos++; // (
    let lookaround = false;
    if (this.peek() === '?') {
      const head = this.src.slice(this.pos, this.pos + 3);
      if (head.startsWith('?:')) this.pos += 2;
      else if (head.startsWith('?=') || head.startsWith('?!')) {
        this.pos += 2;
        lookaround = true;
      } else if (head === '?<=' || head === '?<!') {
        this.pos += 3;
        lookaround = true;
      } else if (head.startsWith('?<')) {
        const close = this.src.indexOf('>', this.pos);
        this.pos = close + 1; // named group
      }
    }
    const alternatives = this.disjunction();
    if (this.peek() === ')') this.pos++;
    if (lookaround) return zeroWidth();
    return {
      nullable: alternatives.some((a) => a.every((i) => i.nullable)),
      zeroWidth: alternatives.every((a) => a.every((i) => i.zeroWidth)),
      firstWord: alternatives.every((a) => sequenceFirstWord(a)),
      lastWord: alternatives.every((a) => sequenceLastWord(a)),
    };
  }

  private characterClass(): Item {
    this.pos++; // [
    let negated = false;
    if (this.peek() === '^') {
      negated = true;
      this.pos++;
    }
    let allWord = true;
    let previous: number | null = null;
    while (this.pos < this.src.length && this.peek() !== ']') {
      if (this.peek() === '-' && previous !== null && this.peek(1) !== ']') {
        this.pos++;
        const upper = this.classMember();
        if (typeof upper !== 'number' || !rangeIsWord(previous, upper)) allWord = false;
        previous = null;
        continue;
      }
      const member = this.classMember();
      if (typeof member === 'number') {
        if (!isWordCodePoint(member)) allWord = false;
        previous = member;
      } else {
        // A set such as \d or \s: only word-only sets keep the class word-only.
        if (member === 'other-set') allWord = false;
        previous = null;
      }
    }
    this.pos++; // ]
    return consuming(!negated && allWord);
  }

  /** One member of a class: its code point, or which kind of set it is. */
  private classMember(): number | 'word-set' | 'other-set' {
    if (this.peek() !== '\\') {
      const cp = this.src.codePointAt(this.pos) ?? 0;
      this.pos += cp > 0xffff ? 2 : 1;
      return cp;
    }
    const escaped = this.readEscape(true);
    if (typeof escaped === 'number') return escaped;
    return escaped.word ? 'word-set' : 'other-set';
  }

  private escape(): Item {
    const at = this.pos;
    const escaped = this.readEscape(false);
    if (typeof escaped === 'number') return consuming(isWordCodePoint(escaped));
    if (escaped.boundary) return { ...zeroWidth(), boundaryAt: at };
    if (escaped.assertion) return zeroWidth();
    return consuming(escaped.word);
  }

  /**
   * Reads an escape and returns its code point, or what kind of set/assertion it is.
   * Unknown escapes are treated as "not only word characters".
   */
  private readEscape(
    inClass: boolean,
  ): number | { word: boolean; boundary?: boolean; assertion?: boolean } {
    this.pos++; // backslash
    const c = this.peek();
    this.pos++;
    switch (c) {
      case 'b':
        return inClass ? 8 : { word: false, boundary: true }; // backspace inside a class
      case 'B':
        return { word: false, assertion: true };
      case 'd':
      case 'w':
        return { word: true };
      case 'D':
      case 'W':
      case 's':
      case 'S':
        return { word: false };
      case 'p':
      case 'P': {
        const close = this.src.indexOf('}', this.pos);
        this.pos = close + 1;
        return { word: false };
      }
      case 'k': {
        const close = this.src.indexOf('>', this.pos);
        this.pos = close + 1;
        return { word: false };
      }
      case 'u': {
        if (this.peek() === '{') {
          const close = this.src.indexOf('}', this.pos);
          const cp = Number.parseInt(this.src.slice(this.pos + 1, close), 16);
          this.pos = close + 1;
          return cp;
        }
        const cp = Number.parseInt(this.src.slice(this.pos, this.pos + 4), 16);
        this.pos += 4;
        return cp;
      }
      case 'x': {
        const cp = Number.parseInt(this.src.slice(this.pos, this.pos + 2), 16);
        this.pos += 2;
        return cp;
      }
      case 'c': {
        this.pos++;
        return 0;
      }
      case 't':
        return 9;
      case 'n':
        return 10;
      case 'v':
        return 11;
      case 'f':
        return 12;
      case 'r':
        return 13;
      case '0':
        return 0;
      default:
        if (/[1-9]/.test(c)) return { word: false }; // backreference
        return c.codePointAt(0) ?? 0; // an escaped symbol such as \. or \-
    }
  }
}

function zeroWidth(): Item {
  return { nullable: true, zeroWidth: true, firstWord: true, lastWord: true };
}

function consuming(word: boolean): Item {
  return { nullable: false, zeroWidth: false, firstWord: word, lastWord: word };
}

/** Whenever the sequence consumes, its first character is a word character. */
function sequenceFirstWord(items: Item[]): boolean {
  for (const item of items) {
    if (item.zeroWidth) continue;
    if (!item.firstWord) return false;
    if (!item.nullable) return true;
  }
  return true;
}

function sequenceLastWord(items: Item[]): boolean {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i] as Item;
    if (item.zeroWidth) continue;
    if (!item.lastWord) return false;
    if (!item.nullable) return true;
  }
  return true;
}

/** From `from` on, the sequence must consume a word character next (inside this sequence). */
function nextIsWord(items: Item[], from: number): boolean {
  for (let i = from; i < items.length; i++) {
    const item = items[i] as Item;
    if (item.zeroWidth) continue;
    if (!item.firstWord) return false;
    if (!item.nullable) return true;
  }
  return false; // the next character may come from outside this sequence
}

function previousIsWord(items: Item[], from: number): boolean {
  for (let i = from; i >= 0; i--) {
    const item = items[i] as Item;
    if (item.zeroWidth) continue;
    if (!item.lastWord) return false;
    if (!item.nullable) return true;
  }
  return false;
}

/**
 * Rewrites every `\b` in a pattern source (compiled with the `u` flag) into a word edge that
 * works in every script — the cheapest form that means the same thing where it stands.
 */
export function unicodeBoundaries(source: string): string {
  const reader = new Reader(source);
  reader.disjunction();
  if (reader.pos < source.length) {
    // Unbalanced input: be safe and use the full edge everywhere.
    return source.replace(/(?<!\\)\\b/g, EDGE);
  }
  let out = '';
  let last = 0;
  for (const [at, choice] of [...reader.choices.entries()].sort((a, b) => a[0] - b[0])) {
    out += source.slice(last, at);
    out += choice === 'start' ? START : choice === 'end' ? END : EDGE;
    last = at + 2;
  }
  return out + source.slice(last);
}
