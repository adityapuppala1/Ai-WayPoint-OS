/**
 * International calling codes (ITU-T E.164) for supported countries, and helpers to turn a
 * published local number into links that work from any phone.
 */
import type { CountryCode } from './types';

export const CALLING_CODES: Record<CountryCode, string> = {
  IN: '91',
  PK: '92',
  BD: '880',
  NP: '977',
  LK: '94',
  ID: '62',
  PH: '63',
  VN: '84',
  TH: '66',
  MY: '60',
  SG: '65',
  CN: '86',
  JP: '81',
  KR: '82',
  EG: '20',
  MA: '212',
  SA: '966',
  AE: '971',
  NG: '234',
  ET: '251',
  TZ: '255',
  ZA: '27',
  KE: '254',
  UG: '256',
  GH: '233',
  RW: '250',
  TR: '90',
  DE: '49',
  GB: '44',
  FR: '33',
  IT: '39',
  ES: '34',
  PL: '48',
  NL: '31',
  SE: '46',
  IE: '353',
  PT: '351',
  UA: '380',
  US: '1',
  CA: '1',
  BR: '55',
  MX: '52',
  CO: '57',
  AR: '54',
  PE: '51',
  CL: '56',
  AU: '61',
  NZ: '64',
};

/**
 * A number in international digits-only form (no +), e.g. `0767 520 620` in LK → `94767520620`.
 * Returns undefined when the country code is unknown and the number is not already international.
 */
export function toInternational(number: string, country: CountryCode): string | undefined {
  const trimmed = number.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) return digits;
  if (trimmed.startsWith('00')) return digits.slice(2);
  const cc = CALLING_CODES[country];
  if (!cc) return undefined;
  // Italian numbers keep their leading 0 after the country code; most others drop it.
  const national = country === 'IT' ? digits : digits.replace(/^0/, '');
  return `${cc}${national}`;
}

/** https://wa.me link for a published WhatsApp number. */
export function whatsappLink(number: string, country: CountryCode): string | undefined {
  const intl = toInternational(number, country);
  return intl ? `https://wa.me/${intl}` : undefined;
}
