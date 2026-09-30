/**
 * The person's country (for help lines, scam reporting and local advice) and the choices
 * the app asks about. The country is the one they picked, or the phone's region until then.
 */
import { COUNTRIES, normalizeCountry } from '@waypoint/content';
import type { ConsentPurpose, Situation } from '@waypoint/core';
import type { Locale } from '@waypoint/i18n';
import { COUNTRY_NAMES } from './country-names';
import { deviceCountry } from './i18n';
import { useSettings } from './settings';

export function useCountry(): { country: string | null; chosen: boolean } {
  const { settings } = useSettings();
  if (settings.country) return { country: settings.country, chosen: true };
  return { country: normalizeCountry(deviceCountry()) ?? null, chosen: false };
}

/** The country's name in the app's language (English data as a fallback). */
export function countryName(code: string | null | undefined, locale: Locale): string | null {
  const c = normalizeCountry(code);
  if (!c) return null;
  return COUNTRY_NAMES[c]?.[locale] ?? COUNTRIES.find((x) => x.code === c)?.name ?? c;
}

/** The countries Waypoint has checked help lines for, sorted by name in the app's language. */
export function countryOptions(locale: Locale): Array<{ code: string; name: string }> {
  const collator = new Intl.Collator(locale);
  return COUNTRIES.map((c) => ({ code: c.code, name: countryName(c.code, locale) ?? c.name })).sort(
    (a, b) => collator.compare(a.name, b.name),
  );
}

export const SITUATION_OPTIONS = [
  'lost-job',
  'first-job',
  'changing-career',
  'new-country',
  'studying',
  'gig-work',
  'running-business',
  'caring',
  'health-change',
  'retiring',
  'steady',
] as const satisfies readonly Situation[];

/** Asked for when starting; the rest live in Privacy. Everything is off until turned on. */
export const START_CONSENTS = [
  'personalization',
  'foresight_matching',
  'memory',
  'ai_external',
] as const satisfies readonly ConsentPurpose[];

/**
 * The choices offered in Privacy, the same as on the website. `research_aggregates` (public
 * trend reports) is left out until such a report exists: nothing reads the answer today.
 */
export const OFFERED_CONSENTS = [
  'personalization',
  'foresight_matching',
  'memory',
  'ai_external',
  'circle_matching',
  'trusted_contact',
  'org_aggregates',
] as const satisfies readonly ConsentPurpose[];
