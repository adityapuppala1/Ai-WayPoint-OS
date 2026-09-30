/**
 * Phone numbers as messaging providers send them: Twilio `+447700900123` (WhatsApp with a
 * `whatsapp:` prefix), Meta `447700900123`, Africa's Talking `+254711000000`.
 */
import { CALLING_CODES, type CountryCode } from '@waypoint/content';

/** The number in E.164 form (`+447700900123`), or null when it cannot be one. */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw
    .trim()
    .replace(/^(?:whatsapp|tel|sms):/i, '')
    .trim();
  let digits = s.replace(/\D/g, '');
  if (!s.startsWith('+') && digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length < 8 || digits.length > 15 || digits.startsWith('0')) return null;
  return `+${digits}`;
}

/** Calling codes, longest first. +1 is shared: read as the United States until told otherwise. */
const BY_CODE = (Object.entries(CALLING_CODES) as Array<[CountryCode, string]>)
  .filter(([country]) => country !== 'CA')
  .sort((a, b) => b[1].length - a[1].length);

/** The country a number belongs to, from its calling code (null when not one we support). */
export function countryOfNumber(e164: string): CountryCode | null {
  const digits = e164.replace(/\D/g, '');
  for (const [country, code] of BY_CODE) if (digits.startsWith(code)) return country;
  return null;
}

/** For showing a number to staff or its owner: `+44 •••• ••0123`. */
export function maskNumber(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (digits.length <= 4) return '••••';
  return `+${digits.slice(0, 2)} •••• ••${digits.slice(-4)}`;
}
