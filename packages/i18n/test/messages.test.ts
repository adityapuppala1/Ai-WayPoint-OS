import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IntlMessageFormat } from 'intl-messageformat';
import { describe, expect, it } from 'vitest';
import {
  formattingLocale,
  languageOf,
  loadMessages,
  locales,
  resolveLocale,
  textDirection,
} from '../src';

describe('the locale given to Intl', () => {
  it('names Arabic digits, so every engine writes the same numbers and dates', () => {
    expect(formattingLocale('ar')).toBe('ar-u-nu-latn');
    expect(new Intl.NumberFormat(formattingLocale('ar')).format(1234)).toBe('1,234');
    expect(new Intl.DateTimeFormat(formattingLocale('ar')).resolvedOptions().numberingSystem).toBe(
      'latn',
    );
    expect(textDirection(languageOf(formattingLocale('ar')))).toBe('rtl');
  });

  it('leaves every other language as it is, and reads each back', () => {
    for (const l of locales) {
      if (l !== 'ar') expect(formattingLocale(l)).toBe(l);
      expect(languageOf(formattingLocale(l))).toBe(l);
    }
    expect(languageOf('xx-u-nu-latn')).toBe('en');
  });
});

type Json = { [k: string]: Json | string };
const dir = join(__dirname, '..', 'messages');
const read = (l: string) => JSON.parse(readFileSync(join(dir, `${l}.json`), 'utf8')) as Json;

function keys(o: Json, prefix = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`),
  );
}

function args(s: string): string[] {
  // Top-level ICU argument names, e.g. "{count, plural, …}" → count; ignores nested plural text.
  const out = new Set<string>();
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') {
      if (depth === 0) {
        const m = /^\{\s*([A-Za-z_]\w*)/.exec(s.slice(i));
        if (m?.[1]) out.add(m[1]);
      }
      depth += 1;
    } else if (s[i] === '}') depth -= 1;
  }
  return [...out].sort();
}

function get(o: Json, path: string): string | undefined {
  let cur: Json | string | undefined = o;
  for (const p of path.split('.')) cur = typeof cur === 'object' ? cur[p] : undefined;
  return typeof cur === 'string' ? cur : undefined;
}

describe('messages', () => {
  const en = read('en');
  const enKeys = new Set(keys(en));

  it('has a file for every locale', () => {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));
    for (const l of locales) expect(files).toContain(l);
  });

  for (const l of locales.filter((x) => x !== 'en')) {
    it(`${l}: only uses keys that exist in English, with the same placeholders`, () => {
      const m = read(l);
      for (const k of keys(m)) {
        expect(enKeys.has(k), `${l}: unknown key ${k}`).toBe(true);
        const source = get(en, k) ?? '';
        const translated = get(m, k) ?? '';
        expect(args(translated), `${l}: placeholders differ in ${k}`).toEqual(args(source));
      }
    });

    it(`${l}: translates every message (only names and number formats may fall back)`, () => {
      // The same in every language, so English is the translation.
      const sameEverywhere = new Set([
        'meta.title',
        'common.appName',
        'common.aiLabel',
        'common.percent',
      ]);
      const m = new Set(keys(read(l)));
      const missing = [...enKeys].filter((k) => !m.has(k) && !sameEverywhere.has(k));
      expect(missing, `${l}: untranslated`).toEqual([]);
    });
  }

  it('every message is valid ICU and renders with sample values in its own language', () => {
    const sample: Record<string, string | number | ((chunks: string[]) => string)> = {
      count: 3,
      months: 4.5,
      share: 0.4,
      value: 0.72,
      current: 2,
      total: 5,
      done: 1,
      week: 2,
      weeks: 8,
      max: 4000,
      link: (chunks) => chunks.join(''),
    };
    // Thousands of messages: problems are collected and checked once, which keeps this quick.
    const problems: string[] = [];
    for (const l of locales) {
      const m = read(l);
      for (const k of keys(m)) {
        const text = get(m, k) ?? '';
        const args = Object.fromEntries(
          [...text.matchAll(/\{\s*([A-Za-z_]\w*)|<([A-Za-z]\w*)>/g)].map(([, a, tag]) =>
            tag ? [tag, (chunks: string[]) => chunks.join('')] : [a, sample[a ?? ''] ?? 'x'],
          ),
        );
        try {
          const out = String(new IntlMessageFormat(text, l).format(args));
          if (!out) problems.push(`${l}: ${k} rendered empty`);
        } catch (err) {
          problems.push(`${l}: ${k} is not valid ICU (${(err as Error).message})`);
        }
      }
    }
    expect(problems).toEqual([]);
  }, 30_000);

  it('falls back to English key by key', async () => {
    const hi = await loadMessages('hi');
    expect(Object.keys(hi)).toEqual(Object.keys(en));
  });

  it('picks the best locale from the browser', () => {
    expect(resolveLocale(undefined, 'sw-KE,sw;q=0.9,en;q=0.8')).toBe('sw');
    expect(resolveLocale(undefined, 'de-DE,de;q=0.9')).toBe('en');
    expect(resolveLocale('ar', 'en')).toBe('ar');
    expect(textDirection('ar')).toBe('rtl');
    expect(textDirection('hi')).toBe('ltr');
  });
});
