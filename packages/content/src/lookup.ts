/** Country lookups shared by the rest of the content package (and re-exported from it). */
import { COUNTRIES } from './countries';
import { EMERGENCY_NUMBERS } from './emergency';
import { SUPPORT_RESOURCES } from './support';
import { TIME_ZONE_COUNTRY } from './time-zones';
import type {
  CountryCode,
  CountryProfile,
  EmergencyNumbers,
  SupportKind,
  SupportResource,
} from './types';

export const GLOBAL: CountryCode = 'ZZ';

export function normalizeCountry(code?: string | null): CountryCode | undefined {
  if (!code) return undefined;
  const c = code.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : undefined;
}

/**
 * The supported country a device's time zone belongs to (Africa/Nairobi → KE), or undefined.
 * A fallback for where to find help when someone hasn't said where they are: it follows where
 * the phone or computer is set to be, which is also where local emergency numbers work.
 */
export function countryFromTimeZone(timeZone?: string | null): CountryCode | undefined {
  if (!timeZone) return undefined;
  return TIME_ZONE_COUNTRY[timeZone.trim()];
}

export function getCountry(code?: string | null): CountryProfile | undefined {
  const c = normalizeCountry(code);
  return c ? COUNTRIES.find((x) => x.code === c) : undefined;
}

export function getEmergency(code?: string | null): EmergencyNumbers | undefined {
  const c = normalizeCountry(code);
  return c ? EMERGENCY_NUMBERS.find((x) => x.country === c) : undefined;
}

/**
 * Support services for a country, most relevant first:
 * country-specific services of the requested kinds, then global directories.
 * Services in the person's language are ranked ahead of others.
 */
export function getSupportResources(
  code?: string | null,
  opts: { kinds?: SupportKind[]; language?: string; includeGlobal?: boolean } = {},
): SupportResource[] {
  const c = normalizeCountry(code);
  const kinds = opts.kinds;
  const lang = opts.language?.toLowerCase().split('-')[0];
  const matchesKind = (r: SupportResource) => !kinds || kinds.includes(r.kind);
  const local = c ? SUPPORT_RESOURCES.filter((r) => r.country === c && matchesKind(r)) : [];
  const global =
    opts.includeGlobal === false
      ? []
      : SUPPORT_RESOURCES.filter(
          (r) => r.country === GLOBAL && (matchesKind(r) || r.kind === 'directory'),
        );
  const rank = (r: SupportResource) => {
    const speaks =
      !lang || !r.languages?.length || r.languages.some((l) => l.toLowerCase().startsWith(lang));
    const kindRank = kinds ? kinds.indexOf(r.kind) : 0;
    return (speaks ? 0 : 100) + (kindRank < 0 ? 50 : kindRank);
  };
  return [...local.sort((a, b) => rank(a) - rank(b)), ...global];
}
