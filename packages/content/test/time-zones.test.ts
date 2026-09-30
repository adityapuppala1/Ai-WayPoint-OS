import { describe, expect, it } from 'vitest';
import { COUNTRIES, countryFromTimeZone } from '../src';
import { TIME_ZONE_COUNTRY } from '../src/time-zones';

describe('countries from time zones', () => {
  it('knows at least one time zone for every supported country, and nothing else', () => {
    const supported = new Set(COUNTRIES.map((c) => c.code));
    const covered = new Set(Object.values(TIME_ZONE_COUNTRY));
    for (const code of supported) expect(covered.has(code), code).toBe(true);
    for (const code of covered) expect(supported.has(code), code).toBe(true);
  });

  it('only lists zones this platform knows', () => {
    const known = new Set(Intl.supportedValuesOf('timeZone'));
    const unknown = Object.keys(TIME_ZONE_COUNTRY).filter((zone) => {
      if (known.has(zone)) return false;
      try {
        new Intl.DateTimeFormat('en', { timeZone: zone });
        return false;
      } catch {
        return true;
      }
    });
    expect(unknown).toEqual([]);
  });

  it('finds the country, including the old names browsers still report', () => {
    expect(countryFromTimeZone('Africa/Nairobi')).toBe('KE');
    // A zone merged with its neighbour's keeps its own country.
    expect(countryFromTimeZone('Africa/Dar_es_Salaam')).toBe('TZ');
    expect(countryFromTimeZone('Asia/Kolkata')).toBe('IN');
    expect(countryFromTimeZone('Asia/Calcutta')).toBe('IN');
    expect(
      countryFromTimeZone(
        new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata' }).resolvedOptions().timeZone,
      ),
    ).toBe('IN');
    expect(countryFromTimeZone('America/Sao_Paulo')).toBe('BR');
    expect(countryFromTimeZone('Europe/Kyiv')).toBe('UA');
    expect(countryFromTimeZone('Europe/Kiev')).toBe('UA');
    expect(countryFromTimeZone(' Europe/London ')).toBe('GB');
  });

  it('says nothing for zones outside the supported countries, or none at all', () => {
    expect(countryFromTimeZone('Europe/Moscow')).toBeUndefined();
    expect(countryFromTimeZone('UTC')).toBeUndefined();
    expect(countryFromTimeZone('Etc/GMT+3')).toBeUndefined();
    expect(countryFromTimeZone('')).toBeUndefined();
    expect(countryFromTimeZone(null)).toBeUndefined();
    expect(countryFromTimeZone('Not/A_Zone')).toBeUndefined();
  });
});
