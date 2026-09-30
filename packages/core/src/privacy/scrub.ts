/**
 * Text that goes where other people will read it — server logs, emails sent in someone's name —
 * with personal details and secrets taken out.
 */
import { redactPII } from './redact';

/**
 * For logs: database errors repeat the values of the failed statement after `params:`, links
 * carry one-time tokens, and messages can contain addresses or numbers. All of that goes.
 */
export function scrubLogText(text: string, max = 500): string {
  const cut = text.split(/\n\s*params:/i)[0] ?? '';
  const noTokens = cut.replace(
    /([?&;](?:token|code|otp|secret|key|signature|sig)=)[^&\s"']+/gi,
    '$1[redacted]',
  );
  return redactPII(noTokens.slice(0, 4000)).text.slice(0, max);
}

/**
 * Control, zero-width, direction-changing and other invisible characters (ranges of code
 * points): soft hyphen, combining grapheme joiner, Arabic letter mark, Hangul and Khmer
 * fillers, Mongolian separators, word joiners and invisible operators, byte-order marks and
 * interlinear annotations. Variation selectors stay, so emoji keep their look.
 */
const INVISIBLE = new RegExp(
  `[${(
    [
      [0x00, 0x1f],
      [0x7f, 0x9f],
      [0xad, 0xad],
      [0x34f, 0x34f],
      [0x61c, 0x61c],
      [0x115f, 0x1160],
      [0x17b4, 0x17b5],
      [0x180b, 0x180f],
      [0x200b, 0x200f],
      [0x2028, 0x202e],
      [0x2060, 0x206f],
      [0x3164, 0x3164],
      [0xfeff, 0xfeff],
      [0xffa0, 0xffa0],
      [0xfff9, 0xfffb],
    ] as const
  )
    .map(([from, to]) => `${String.fromCharCode(from)}-${String.fromCharCode(to)}`)
    .join('')}]`,
  'g',
);

/**
 * A name (a person's or an organisation's) to put in an email to someone else: one line, no
 * control characters, no links or web addresses — the text of an invitation must never become
 * a way to send people somewhere else from Waypoint's address.
 */
export function plainName(name: string | null | undefined, max = 60): string {
  const oneLine = (name ?? '').replace(INVISIBLE, ' ').replace(/\s+/g, ' ').trim();
  const noLinks = oneLine
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S*/gi, '…')
    .replace(/\bwww\.\S*/gi, '…')
    .replace(/\b[\w-]+(?:\.[\w-]+)*\.(?:[a-z]{2,24})(?:\/\S*)?(?=\s|$|[),.;:!?])/g, '…')
    .replace(/\s+/g, ' ')
    .trim();
  return noLinks.length > max ? `${noLinks.slice(0, max - 1).trimEnd()}…` : noLinks;
}
