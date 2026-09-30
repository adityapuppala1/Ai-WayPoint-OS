/**
 * Paths on this site that are safe to send people to: "come back here afterwards" (`?next=`),
 * and links written by the assistant.
 *
 * A path must start with a single `/` and contain only ordinary URL characters. That rules out
 * `//evil.example` and `/\evil.example` (browsers read both as another site), schemes such as
 * `javascript:`, and control characters — before and after percent-decoding.
 */
const PATH = /^\/(?![/\\])[\w\-/.?=&%#~+]*$/;

export function isInternalPath(value: string | null | undefined): boolean {
  if (!value || value.length > 2000 || !PATH.test(value)) return false;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return false;
  }
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are refused
  const hidden = /[\\\u0000-\u001f\u007f]/;
  return !hidden.test(decoded) && !/^\/[/\\]/.test(decoded);
}

/** `next` if it is a path on this site, otherwise the fallback. */
export function safeNextPath(next: string | null | undefined, fallback = '/'): string {
  return next && isInternalPath(next) ? next : fallback;
}
