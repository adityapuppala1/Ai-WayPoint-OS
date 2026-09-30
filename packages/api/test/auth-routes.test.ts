/**
 * The sign-in endpoints as an attacker would try them: switched-off paths, text-message codes
 * for any number, and forged addresses to dodge the limits.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'waypoint-auth-routes-'));
const SITE = 'https://waypoint.example';
Object.assign(process.env, {
  WAYPOINT_DATA_DIR: dir,
  WAYPOINT_URL: SITE,
  LOG_LEVEL: 'silent',
  WAYPOINT_CLIENT_IP_HEADER: 'x-real-ip',
});
for (const k of ['DATABASE_URL', 'TRUSTED_PROXIES']) delete process.env[k];

let app: ReturnType<typeof import('../src').createApp>;
let db: typeof import('@waypoint/db');

beforeAll(async () => {
  db = await import('@waypoint/db');
  await db.dbReady();
  const api = await import('../src');
  app = api.createApp();
}, 120_000);

afterAll(async () => {
  await db.closeDb();
  rmSync(dir, { recursive: true, force: true });
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(`${SITE}/api/auth${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: SITE, ...headers },
    body: JSON.stringify(body),
  });

describe('switched-off sign-in paths', () => {
  it('answer "not found": no silent password reset for phone accounts, no open redirect', async () => {
    expect(
      (await post('/phone-number/request-password-reset', { phoneNumber: '+15550001234' })).status,
    ).toBe(404);
    expect(
      (
        await post('/phone-number/reset-password', {
          phoneNumber: '+15550001234',
          otp: '123456',
          newPassword: 'a long new password',
        })
      ).status,
    ).toBe(404);
    expect(
      (await post('/sign-in/phone-number', { phoneNumber: '+15550001234', password: 'x' })).status,
    ).toBe(404);
    const redirect = await app.request(
      `${SITE}/api/auth/expo-authorization-proxy?authorizationURL=${encodeURIComponent('https://evil.example/')}&oauthState=x`,
    );
    expect(redirect.status).toBe(404);
    expect(redirect.headers.get('location')).toBeNull();
    expect((await post('/update-user', { name: 'x' })).status).toBe(404);
  });
});

describe('sign-in codes by text message', () => {
  it('go only to full international numbers in countries Waypoint serves', async () => {
    for (const phoneNumber of [
      '0711 000 000',
      '+254 711 000000',
      '254711000000',
      '+79161234567',
      'x',
    ])
      expect(
        (await post('/phone-number/send-otp', { phoneNumber }, { 'x-real-ip': '198.51.100.1' }))
          .status,
        phoneNumber,
      ).toBe(400);
  });

  it('are limited per number, whichever address asks', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++)
      statuses.push(
        (
          await post(
            '/phone-number/send-otp',
            { phoneNumber: '+254711000123' },
            { 'x-real-ip': `203.0.113.${i + 1}` },
          )
        ).status,
      );
    expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
    expect(statuses[3]).toBe(429);
  });
});

describe('the visitor address the sign-in limits use', () => {
  it('comes from the configured header, and a forged internal header changes nothing', async () => {
    const attempt = (ip: string, forged?: string) =>
      post(
        '/sign-in/email',
        { email: 'nobody@example.org', password: 'not the password at all' },
        { 'x-real-ip': ip, ...(forged ? { 'x-waypoint-client-ip': forged } : {}) },
      );
    const first: number[] = [];
    for (let i = 0; i < 11; i++)
      first.push((await attempt('192.0.2.10', `192.0.2.${100 + i}`)).status);
    // Ten tries a minute from one visitor, however many addresses they claim in the header.
    expect(first.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(first[10]).toBe(429);
    // Someone else is not affected.
    expect((await attempt('192.0.2.20')).status).toBe(401);
  });
});
