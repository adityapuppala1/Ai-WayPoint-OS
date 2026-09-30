/**
 * Intl.PluralRules for Waypoint's seven languages, for engines without it (Hermes, the engine
 * in the app). Translations need it to choose "1 minute" or "2 minutes", and Arabic has six
 * forms. The general polyfill brings locale data and matching for every language (about
 * 450 KB); these are the CLDR cardinal rules for ours, checked against the full Unicode data
 * in test/plural-rules.test.ts.
 */

type Category = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/** CLDR operands: n (absolute value), i (integer digits), v (visible fraction digits). */
interface Operands {
  n: number;
  i: number;
  v: number;
}

/** Millions take "many" in Spanish, French and Portuguese ("1 millón de…"). */
const millions = ({ i, v }: Operands) => i !== 0 && i % 1_000_000 === 0 && v === 0;

const RULES: Record<string, { categories: Category[]; select: (o: Operands) => Category }> = {
  en: {
    categories: ['one', 'other'],
    select: ({ i, v }) => (i === 1 && v === 0 ? 'one' : 'other'),
  },
  sw: {
    categories: ['one', 'other'],
    select: ({ i, v }) => (i === 1 && v === 0 ? 'one' : 'other'),
  },
  hi: {
    categories: ['one', 'other'],
    select: ({ n, i }) => (i === 0 || n === 1 ? 'one' : 'other'),
  },
  es: {
    categories: ['one', 'many', 'other'],
    select: (o) => (o.n === 1 ? 'one' : millions(o) ? 'many' : 'other'),
  },
  fr: {
    categories: ['one', 'many', 'other'],
    select: (o) => (o.i === 0 || o.i === 1 ? 'one' : millions(o) ? 'many' : 'other'),
  },
  pt: {
    categories: ['one', 'many', 'other'],
    select: (o) => (o.i === 0 || o.i === 1 ? 'one' : millions(o) ? 'many' : 'other'),
  },
  ar: {
    categories: ['zero', 'one', 'two', 'few', 'many', 'other'],
    select: ({ n }) => {
      if (n === 0) return 'zero';
      if (n === 1) return 'one';
      if (n === 2) return 'two';
      const hundreds = n % 100;
      if (Number.isInteger(hundreds) && hundreds >= 3 && hundreds <= 10) return 'few';
      if (Number.isInteger(hundreds) && hundreds >= 11 && hundreds <= 99) return 'many';
      return 'other';
    },
  },
};

const baseOf = (tag: string) => tag.toLowerCase().split(/[-_]/)[0] ?? '';

function pick(locales?: string | readonly string[]): string {
  const list = typeof locales === 'string' ? [locales] : (locales ?? []);
  for (const tag of list) if (RULES[baseOf(tag)]) return baseOf(tag);
  return 'en';
}

/** The number as it would be formatted with 0–3 fraction digits, the PluralRules default. */
export function operands(value: number, maxFraction = 3): Operands {
  const text = Math.abs(value)
    .toFixed(maxFraction)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');
  const [int = '0', frac = ''] = text.split('.');
  return { n: Number(text), i: Number(int), v: frac.length };
}

export class WaypointPluralRules {
  private readonly locale: string;
  private readonly maxFraction: number;

  constructor(
    locales?: string | readonly string[],
    options: { type?: string; maximumFractionDigits?: number } = {},
  ) {
    this.locale = pick(locales);
    this.maxFraction = options.maximumFractionDigits ?? 3;
    if (options.type === 'ordinal') {
      // Waypoint's messages don't use ordinals; fall back to "other" rather than guess.
      this.select = () => 'other';
    }
  }

  select(value: number): Category {
    if (!Number.isFinite(value)) return 'other';
    const rules = RULES[this.locale] ?? RULES.en;
    return rules ? rules.select(operands(value, this.maxFraction)) : 'other';
  }

  resolvedOptions() {
    return {
      locale: this.locale,
      type: 'cardinal' as const,
      minimumIntegerDigits: 1,
      minimumFractionDigits: 0,
      maximumFractionDigits: this.maxFraction,
      pluralCategories: [...(RULES[this.locale]?.categories ?? ['other'])],
    };
  }

  static supportedLocalesOf(locales?: string | readonly string[]): string[] {
    const list = typeof locales === 'string' ? [locales] : (locales ?? []);
    return list.filter((tag) => RULES[baseOf(tag)]);
  }
}

/** Installs the rules when the engine has no Intl.PluralRules of its own. */
export function installPluralRules(): void {
  const intl = globalThis.Intl as unknown as Record<string, unknown> | undefined;
  if (!intl || typeof intl.PluralRules === 'function') return;
  Object.defineProperty(intl, 'PluralRules', {
    value: WaypointPluralRules,
    writable: true,
    configurable: true,
  });
}
