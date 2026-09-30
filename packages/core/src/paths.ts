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

/**
 * A link built from data — a source an AI model cited, a signal's or a forecast's source — as
 * something safe to put in `href`: a secure web page and nothing else. `javascript:` and
 * `data:` addresses would run in the page, and an address carrying a user name and password
 * is a classic way to make one site look like another. Null when it is not safe to link.
 */
export function safeExternalHref(value: string | null | undefined): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  return url.href;
}

/** `next` if it is a path on this site, otherwise the fallback. */
export function safeNextPath(next: string | null | undefined, fallback = '/'): string {
  return next && isInternalPath(next) ? next : fallback;
}
