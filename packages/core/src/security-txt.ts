/**
 * `/.well-known/security.txt` (RFC 9116): where someone who finds a security problem should
 * report it. Built for each installation from its own configuration, so it names the people
 * who run that Waypoint — and always offers the project's private reporting page as well, for
 * problems in the software itself.
 */

/** Private vulnerability reports for the Waypoint software (GitHub security advisories). */
export const SECURITY_REPORT_URL =
  'https://github.com/adityapuppala1/Ai-WayPoint-OS/security/advisories/new';

/** How reports are handled: what to send, what to expect, what is in scope. */
export const SECURITY_POLICY_URL =
  'https://github.com/adityapuppala1/Ai-WayPoint-OS/blob/main/SECURITY.md';

/** How long a served copy may be relied on. The standard asks for less than a year. */
const VALID_DAYS = 180;

/** The contact as RFC 9116 wants it: `mailto:` for an email address, or an https address. */
function contactUri(contact: string | null | undefined): string | null {
  const value = contact?.trim();
  if (!value || /\s/.test(value)) return null;
  if (/^[^@\s:/]+@[^@\s:/]+\.[^@\s:/]+$/.test(value)) return `mailto:${value}`;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function securityTxt(opts: {
  /** Where this Waypoint is served (WAYPOINT_URL). */
  site: string;
  /** WAYPOINT_SECURITY_CONTACT, or failing that WAYPOINT_CONTACT_EMAIL. */
  contact: string | null | undefined;
  now?: Date;
}): string {
  const now = opts.now ?? new Date();
  const expires = new Date(now.getTime() + VALID_DAYS * 86_400_000);
  expires.setUTCHours(0, 0, 0, 0);
  const operator = contactUri(opts.contact);
  return [
    '# Found a security problem? Thank you for telling us before anyone else.',
    '# About this installation: write to its operator (first contact, when one is listed).',
    '# About the Waypoint software itself: use the private report page.',
    ...(operator ? [`Contact: ${operator}`] : []),
    `Contact: ${SECURITY_REPORT_URL}`,
    `Expires: ${expires.toISOString().replace(/\.\d{3}Z$/, 'Z')}`,
    'Preferred-Languages: en',
    `Canonical: ${new URL('/.well-known/security.txt', opts.site).href}`,
    `Policy: ${SECURITY_POLICY_URL}`,
    '',
  ].join('\n');
}
