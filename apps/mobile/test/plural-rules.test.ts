import { locales } from '@waypoint/i18n';
import { describe, expect, it } from 'vitest';
import { installPluralRules, operands, WaypointPluralRules } from '../src/plural-rules';

// Whole numbers people see (counts, minutes, months, money) and fractions with 1–3 digits.
const VALUES = [
  ...Array.from({ length: 251 }, (_, i) => i),
  1000,
  1001,
  100_000,
  1_000_000,
  2_000_000,
  1_000_001,
  10_000_000,
  0.1,
  0.5,
  1.0,
  1.5,
  2.25,
  3.75,
  10.5,
  11.25,
  100.5,
  1.005,
  2.3456,
  -1,
  -2,
  -3,
];

describe('Intl.PluralRules for the app', () => {
  for (const locale of locales) {
    it(`${locale}: chooses the same form as the full Unicode data`, () => {
      const ours = new WaypointPluralRules(locale);
      const icu = new Intl.PluralRules(locale);
      const wrong = VALUES.filter((n) => ours.select(n) !== icu.select(n)).map(
        (n) => `${n}: ${ours.select(n)} ≠ ${icu.select(n)}`,
      );
      expect(wrong).toEqual([]);
      expect([...ours.resolvedOptions().pluralCategories].sort()).toEqual(
        [...icu.resolvedOptions().pluralCategories].sort(),
      );
    });
  }

  it('matches regional tags to their language', () => {
    expect(new WaypointPluralRules('ar-EG').select(3)).toBe('few');
    expect(new WaypointPluralRules(['xx', 'fr-CA']).resolvedOptions().locale).toBe('fr');
    expect(WaypointPluralRules.supportedLocalesOf(['sw-KE', 'de', 'hi'])).toEqual(['sw-KE', 'hi']);
  });

  it('reads CLDR operands from the number as formatted', () => {
    expect(operands(1)).toEqual({ n: 1, i: 1, v: 0 });
    expect(operands(1.5)).toEqual({ n: 1.5, i: 1, v: 1 });
    expect(operands(2.3456)).toEqual({ n: 2.346, i: 2, v: 3 });
    expect(operands(100)).toEqual({ n: 100, i: 100, v: 0 });
  });

  it('is only installed where the engine has none', () => {
    const native = Intl.PluralRules;
    installPluralRules();
    expect(Intl.PluralRules).toBe(native);
  });
});
