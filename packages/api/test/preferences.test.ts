/**
 * The cookies a page is drawn from before anyone is known: language, theme, lite mode and the
 * device's time zone. The server sets them, for a year, and only with values it knows.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'waypoint-preferences-'));
const SITE = 'http://localhost:3000';
Object.assign(process.env, {
  WAYPOINT_DATA_DIR: dir,
  WAYPOINT_URL: SITE,
  LOG_LEVEL: 'silent',
  WAYPOINT_CLIENT_IP_HEADER: 'x-real-ip',
});
for (const k of ['DATABASE_URL', 'TRUSTED_PROXIES']) delete process.env[k];

let createApp: typeof import('../src').createApp;
let app: ReturnType<typeof createApp>;
let db: typeof import('@waypoint/db');

beforeAll(async () => {
  db = await import('@waypoint/db');
  await db.dbReady();
  ({ createApp } = await import('../src'));
  app = createApp();
}, 120_000);

afterAll(async () => {
  await db.closeDb();
  rmSync(dir, { recursive: true, force: true });
});

let visitors = 0;
/** A request from a visitor of its own (no session: guests choose a language too). */
const save = (body: unknown, init: { site?: string; ip?: string } = {}) => {
  const site = init.site ?? SITE;
  return app.request(`${site}/api/preferences`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: site,
      'x-real-ip': init.ip ?? `198.51.100.${++visitors}`,
    },
    body: JSON.stringify(body),
  });
};

/** The cookies an answer sets, by name: the value and the attributes, lower-cased. */
function cookiesOf(res: Response): Record<string, { value: string; attributes: string[] }> {
  return Object.fromEntries(
    res.headers.getSetCookie().map((line) => {
      const [pair = '', ...attributes] = line.split(';').map((part) => part.trim());
      const at = pair.indexOf('=');
      return [
        pair.slice(0, at),
        { value: pair.slice(at + 1), attributes: attributes.map((a) => a.toLowerCase()) },
      ];
    }),
  );
}

describe('POST /api/preferences', () => {
  it('sets each choice as a cookie the browser keeps for a year, without a session', async () => {
    const res = await save({
      locale: 'fr',
      theme: 'dark',
      lite: true,
      timezone: 'Africa/Nairobi',
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const cookies = cookiesOf(res);
    expect(Object.keys(cookies).sort()).toEqual(['NEXT_LOCALE', 'wp-lite', 'wp-theme', 'wp-tz']);
    expect(cookies.NEXT_LOCALE?.value).toBe('fr');
    expect(cookies['wp-theme']?.value).toBe('dark');
    expect(cookies['wp-lite']?.value).toBe('1');
    // Written the way the pages and the sign-up hook read it.
    expect(decodeURIComponent(cookies['wp-tz']?.value ?? '')).toBe('Africa/Nairobi');
    for (const [name, cookie] of Object.entries(cookies)) {
      expect(cookie.attributes, name).toContain('max-age=31536000');
      expect(cookie.attributes, name).toContain('path=/');
      expect(cookie.attributes, name).toContain('samesite=lax');
      // Plain http here (a developer's machine): Secure would make the browser drop it.
      expect(cookie.attributes, name).not.toContain('secure');
      // The page reads the time zone cookie to see whether it is still right.
      expect(cookie.attributes, name).not.toContain('httponly');
    }
  });

  it('sets only what was sent, and says "follow my device" and "lite mode off" out loud', async () => {
    const theme = cookiesOf(await save({ theme: 'system' }));
    expect(Object.keys(theme)).toEqual(['wp-theme']);
    expect(theme['wp-theme']?.value).toBe('system');
    const lite = cookiesOf(await save({ lite: false }));
    expect(Object.keys(lite)).toEqual(['wp-lite']);
    expect(lite['wp-lite']?.value).toBe('0');
  });

  it('remembers a guest’s “Not now” on the account note for as long as the other choices', async () => {
    // Written by the page, Safari and every iPhone browser would forget it after seven days,
    // and the note would come back every week.
    const res = await save({ guestNote: 'off' });
    expect(res.status).toBe(200);
    const cookies = cookiesOf(res);
    expect(Object.keys(cookies)).toEqual(['wp-guest-note']);
    expect(cookies['wp-guest-note']?.value).toBe('off');
    expect(cookies['wp-guest-note']?.attributes).toContain('max-age=31536000');
    expect(cookies['wp-guest-note']?.attributes).toContain('path=/');
  });

  it('refuses anything outside the lists, and sets no cookie at all', async () => {
    for (const body of [
      { locale: 'xx' },
      { locale: 'fr; Domain=evil.example' },
      { theme: 'pink' },
      { lite: 'yes' },
      { timezone: '+05:00' },
      { timezone: 'Mars/Olympus_Mons' },
      { timezone: 'Africa/Nairobi\r\nSet-Cookie: x=y' },
      // "Not now" is the only thing the account note remembers.
      { guestNote: 'on' },
      // One bad value refuses the good ones sent with it.
      { locale: 'fr', theme: 'pink' },
      // Only these five cookies can be set.
      { 'waypoint.session_token': 'abc' },
      {},
    ]) {
      const res = await save(body);
      expect(res.status, JSON.stringify(body)).toBe(422);
      expect(res.headers.getSetCookie(), JSON.stringify(body)).toEqual([]);
    }
  });

  it('marks the cookies Secure when the site is served over https', async () => {
    const { resetEnvForTests } = await import('@waypoint/core/env');
    const https = 'https://waypoint.example';
    process.env.WAYPOINT_URL = https;
    resetEnvForTests();
    try {
      const res = await createApp().request(`${https}/api/preferences`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: https,
          'x-real-ip': '198.51.100.250',
        },
        body: JSON.stringify({ locale: 'sw', theme: 'light' }),
      });
      expect(res.status).toBe(200);
      const cookies = cookiesOf(res);
      expect(Object.keys(cookies).sort()).toEqual(['NEXT_LOCALE', 'wp-theme']);
      for (const [name, cookie] of Object.entries(cookies))
        expect(cookie.attributes, name).toContain('secure');
    } finally {
      process.env.WAYPOINT_URL = SITE;
      resetEnvForTests();
    }
  });

  it('is limited per visitor like the other public routes', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 125; i++)
      statuses.push((await save({ theme: 'dark' }, { ip: '203.0.113.7' })).status);
    expect(statuses.slice(0, 120).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(120).every((s) => s === 429)).toBe(true);
    // Someone else is not affected.
    expect((await save({ theme: 'dark' }, { ip: '203.0.113.8' })).status).toBe(200);
  });
});

describe('leaving a shared device', () => {
  /** What one person leaves in the browser: their language, display choices and day. */
  const PERSONAL = ['NEXT_LOCALE', 'wp-guest-note', 'wp-lite', 'wp-not-now', 'wp-theme'];
  const LEFT =
    'NEXT_LOCALE=ar; wp-theme=dark; wp-lite=1; wp-not-now=2026-09-30:abc; wp-tz=Asia%2FDubai';

  /** A request as the website sends it, from a guest session of its own. */
  const signedIn = async () => {
    const res = await app.request(`${SITE}/api/auth/sign-in/anonymous`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: SITE, 'x-real-ip': '192.0.2.9' },
      body: '{}',
    });
    expect(res.status).toBe(200);
    const session = res.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    return (path: string, method: string, body: unknown = {}) =>
      app.request(`${SITE}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          origin: SITE,
          cookie: `${session}; ${LEFT}`,
        },
        body: JSON.stringify(body),
      });
  };

  const expectForgotten = (res: Response) => {
    const cookies = cookiesOf(res);
    for (const name of PERSONAL) {
      expect(cookies[name]?.value, name).toBe('');
      expect(cookies[name]?.attributes, name).toContain('max-age=0');
      expect(cookies[name]?.attributes, name).toContain('path=/');
    }
    // The time zone is the device's, not the person's: the next person is in the same place.
    expect(cookies['wp-tz']).toBeUndefined();
  };

  it('signing out forgets the language, display choices and steps set aside', async () => {
    const send = await signedIn();
    const res = await send('/api/auth/sign-out', 'POST');
    expect(res.status).toBe(200);
    expectForgotten(res);
  });

  it('deleting the account forgets them too', async () => {
    const send = await signedIn();
    const res = await send('/api/me', 'DELETE', { confirm: 'DELETE' });
    expect(res.status).toBe(200);
    expectForgotten(res);
  });
});
