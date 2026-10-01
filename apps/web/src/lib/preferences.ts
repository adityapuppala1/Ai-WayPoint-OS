/**
 * The choices a page is drawn from before anyone is known: language, theme, lite mode, the
 * device's time zone, and a guest's "Not now" on the note about an account. They are cookies,
 * and the server sets them (POST /api/preferences): a cookie written by a page's own script is
 * forgotten after seven days by Safari and by every browser on an iPhone, while one the server
 * sent is kept for the year it asks for.
 */
import { LOCALE_COOKIE, type Locale } from '@waypoint/i18n';
import { GUEST_NOTE_COOKIE } from '@/components/today/guest-note';

export interface Preferences {
  locale?: Locale;
  theme?: 'system' | 'light' | 'dark';
  lite?: boolean;
  timezone?: string;
  /** A guest said "Not now" to the note about keeping their things with an account. */
  guestNote?: 'off';
}

/** Each choice as the cookie the server would set: the same names, the same values. */
function asCookies(choices: Preferences): Array<[name: string, value: string]> {
  const cookies: Array<[string, string]> = [];
  if (choices.locale) cookies.push([LOCALE_COOKIE, choices.locale]);
  if (choices.theme) cookies.push(['wp-theme', choices.theme]);
  if (choices.lite !== undefined) cookies.push(['wp-lite', choices.lite ? '1' : '0']);
  if (choices.timezone) cookies.push(['wp-tz', encodeURIComponent(choices.timezone)]);
  if (choices.guestNote) cookies.push([GUEST_NOTE_COOKIE, choices.guestNote]);
  return cookies;
}

/** Whether every one of these choices is already what this browser's cookies say. */
export function alreadySaved(choices: Preferences): boolean {
  try {
    const have = document.cookie.split('; ');
    return asCookies(choices).every(([name, value]) => have.includes(`${name}=${value}`));
  } catch {
    return false;
  }
}

/**
 * Asks the server to set the cookies. Resolves once they are in place, so a page redrawn
 * afterwards is drawn from them. It never rejects: if the server gives no answer (no
 * connection, or too many requests), the page writes the cookies itself, so the choice still
 * holds on this device for as long as the browser keeps a cookie a page wrote.
 */
export async function savePreferences(choices: Preferences): Promise<void> {
  try {
    const res = await fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(choices),
      credentials: 'same-origin',
      // Still sent when the person moves to another page straight away.
      keepalive: true,
    });
    // Read to the end, short as it is: Chrome counts an answer nobody read as still arriving,
    // and a page with a request still arriving never counts as settled.
    await res.text();
    if (res.ok) return;
  } catch {
    // As above: the page writes them itself.
  }
  try {
    for (const [name, value] of asCookies(choices)) {
      const secure = location.protocol === 'https:' ? '; secure' : '';
      // biome-ignore lint/suspicious/noDocumentCookie: only when the server could not set it
      document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax${secure}`;
    }
  } catch {
    // Cookies are off: the page is drawn from the browser's language and the saved profile.
  }
}
