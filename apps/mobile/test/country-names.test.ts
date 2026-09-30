import { COUNTRIES } from '@waypoint/content';
import { locales } from '@waypoint/i18n';
import { describe, expect, it } from 'vitest';
import { countryNames } from '../scripts/country-names';
import { COUNTRY_NAMES } from '../src/country-names';

describe('country names in the app', () => {
  it('covers every country with help lines, in every language', () => {
    for (const c of COUNTRIES) {
      for (const l of locales) expect(COUNTRY_NAMES[c.code]?.[l], `${c.code} ${l}`).toBeTruthy();
    }
  });

  it('is up to date (run `pnpm --filter @waypoint/mobile country-names` if not)', () => {
    expect(COUNTRY_NAMES).toEqual(countryNames());
  });
});
