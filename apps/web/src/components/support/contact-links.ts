/**
 * Links that open the phone's own apps to reach a trusted contact. Waypoint sends nothing:
 * the person's messaging, phone or mail app opens with their contact filled in and, for a
 * message, a few calm words they can change or not send at all.
 */

/** A phone number as a dialler wants it: digits, with a leading + kept. */
function dialable(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return phone.trim().startsWith('+') ? `+${digits}` : digits;
}

export function callHref(phone: string): string {
  return `tel:${dialable(phone)}`;
}

/**
 * A text message with its words filled in. "?&body=" is the one form both iPhones (which want
 * "&body=") and Android phones (which want "?body=") understand.
 */
export function textHref(phone: string, message: string): string {
  return `sms:${dialable(phone)}?&body=${encodeURIComponent(message)}`;
}

export function emailHref(email: string, subject: string, message: string): string {
  // The address is encoded apart from its @, so nothing in it can add fields to the link.
  const to = encodeURIComponent(email.trim()).replace(/%40/g, '@');
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
}
