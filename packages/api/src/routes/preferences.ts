import { createRoute, z } from '@hono/zod-openapi';
import { NOT_NOW_COOKIE } from '@waypoint/core';
import { getEnv } from '@waypoint/core/env';
import { LOCALE_COOKIE, locales } from '@waypoint/i18n';
import { setCookie } from 'hono/cookie';
import { errors, jsonBody, jsonContent, OkSchema, router } from '../lib/openapi';
import { limit } from '../middleware';
import { isTimeZone } from '../services/me';

const app = router();

/** A year: what the page's own script used to ask for. */
const ONE_YEAR_SECONDS = 31_536_000;

/** A guest's "Not now" on the note about keeping their things (the website reads the same name). */
const GUEST_NOTE_COOKIE = 'wp-guest-note';

/**
 * The cookies that belong to a person rather than to the device: their language, theme and
 * lite mode (put back from their profile whenever they sign in), the steps they set aside
 * today, and a guest's "Not now" on the note about an account. The time zone is not among
 * them: it is the device's own, and the next person is in the same place.
 */
const PERSONAL_COOKIES = [
  LOCALE_COOKIE,
  'wp-theme',
  'wp-lite',
  NOT_NOW_COOKIE,
  GUEST_NOTE_COOKIE,
] as const;

/**
 * Expires the person's cookies on this device. Signing out and deleting an account call it, so
 * whoever uses a shared device next does not meet the last person's language or choices — on
 * every way out, whichever app or button started it.
 */
export function forgetPersonalCookies(headers: Headers): void {
  const secure = getEnv().WAYPOINT_URL.startsWith('https://') ? '; Secure' : '';
  for (const name of PERSONAL_COOKIES)
    headers.append('Set-Cookie', `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`);
}

const PreferencesSchema = z
  .strictObject({
    locale: z.enum(locales),
    theme: z.enum(['system', 'light', 'dark']),
    lite: z.boolean(),
    timezone: z.string().max(64).refine(isTimeZone, 'Unknown time zone'),
  })
  .partial()
  .refine((choices) => Object.keys(choices).length > 0, 'Nothing to save')
  .openapi('Preferences');

app.openapi(
  createRoute({
    method: 'post',
    path: '/preferences',
    tags: ['System'],
    summary: 'Remember a language, theme, lite mode or time zone on this device',
    description:
      'Public: guests choose a language and a theme too. Nothing is stored on the server. The answer sets a cookie for each choice sent (NEXT_LOCALE, wp-theme, wp-lite, wp-tz), which pages are drawn from before anyone is known.',
    middleware: [limit('preferences', 120, 60)] as const,
    request: jsonBody(PreferencesSchema),
    responses: { 200: jsonContent(OkSchema), 422: errors[422], 429: errors[429] },
  }),
  (c) => {
    const choices = c.req.valid('json');
    // Sent by the server, not written by the page: Safari, and every browser on an iPhone,
    // forgets a cookie a page's script wrote after seven days, but keeps one the server sent
    // for as long as it says. Not HttpOnly: they hold no secret, and the page reads the time
    // zone to see whether it is still right.
    const keep = {
      path: '/',
      maxAge: ONE_YEAR_SECONDS,
      sameSite: 'Lax',
      secure: getEnv().WAYPOINT_URL.startsWith('https://'),
    } as const;
    if (choices.locale) setCookie(c, LOCALE_COOKIE, choices.locale, keep);
    // "Follow my device" and "lite mode off" are choices too, so they are written down: a
    // missing cookie means nobody has chosen on this device, and the saved profile decides.
    if (choices.theme) setCookie(c, 'wp-theme', choices.theme, keep);
    if (choices.lite !== undefined) setCookie(c, 'wp-lite', choices.lite ? '1' : '0', keep);
    if (choices.timezone) setCookie(c, 'wp-tz', choices.timezone, keep);
    return c.json({ ok: true as const }, 200, { 'Cache-Control': 'no-store' });
  },
);

export default app;
