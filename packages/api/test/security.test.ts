/**
 * Regression tests for the security review: each test reproduces a finding the way an attacker
 * (or an unlucky coincidence) would, and fails without its fix.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'waypoint-security-'));
const ORIGIN = 'http://localhost:3000';
Object.assign(process.env, {
  WAYPOINT_DATA_DIR: dir,
  WAYPOINT_URL: ORIGIN,
  LOG_LEVEL: 'silent',
  WAYPOINT_CLIENT_IP_HEADER: 'x-real-ip',
});
for (const k of [
  'DATABASE_URL',
  'TRUSTED_PROXIES',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'OLLAMA_BASE_URL',
  'SMTP_URL',
  'RESEND_API_KEY',
])
  delete process.env[k];

let app: ReturnType<typeof import('../src').createApp>;
let db: typeof import('@waypoint/db');

beforeAll(async () => {
  db = await import('@waypoint/db');
  await db.dbReady();
  app = (await import('../src')).createApp();
}, 120_000);

afterAll(async () => {
  await db.closeDb();
  rmSync(dir, { recursive: true, force: true });
});

let visitor = 0;
/** A fresh visitor address, so one test's tries never count against another's limits. */
const newIp = () => `198.51.${100 + Math.floor(visitor / 250)}.${1 + (visitor++ % 250)}`;

function req(
  path: string,
  init: RequestInit & { cookie?: string; json?: unknown; ip?: string } = {},
) {
  const headers = new Headers(init.headers);
  if (!headers.has('origin')) headers.set('origin', ORIGIN);
  if (init.cookie) headers.set('cookie', init.cookie);
  if (init.ip) headers.set('x-real-ip', init.ip);
  if (init.json !== undefined) headers.set('content-type', 'application/json');
  return app.request(`${ORIGIN}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
}

const cookieFrom = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');

async function guest(ip = newIp()): Promise<string> {
  const res = await req('/api/auth/sign-in/anonymous', { method: 'POST', json: {}, ip });
  expect(res.status).toBe(200);
  return cookieFrom(res);
}

const PASSWORD = 'correct horse battery';

/** A confirmed, signed-in account: its cookie, address and id. */
async function account(name: string): Promise<{ cookie: string; email: string; id: string }> {
  const email = `${name.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}@example.org`;
  const ip = newIp();
  const signUp = await req('/api/auth/sign-up/email', {
    method: 'POST',
    json: { email, password: PASSWORD, name },
    ip,
  });
  expect(signUp.status).toBe(200);
  const [user] = await db
    .getDb()
    .select({ id: db.users.id })
    .from(db.users)
    .where(db.eq(db.users.email, email))
    .limit(1);
  await db
    .getDb()
    .update(db.users)
    .set({ emailVerified: true })
    .where(db.eq(db.users.id, user!.id));
  const res = await req('/api/auth/sign-in/email', {
    method: 'POST',
    json: { email, password: PASSWORD },
    ip,
  });
  expect(res.status).toBe(200);
  return { cookie: cookieFrom(res), email, id: user!.id };
}

async function rows<T>(query: ReturnType<typeof db.sql>): Promise<T[]> {
  return (await db.getDb().execute(query)).rows as T[];
}

describe('names other people will read', () => {
  it('cannot carry a web address into an organisation, a programme or a circle', async () => {
    const owner = await account('Nadia');
    for (const name of ['SECURE-BANK.COM Support', 'Visit evil.top today', 'Pay。Evil。Com']) {
      const res = await req('/api/org', {
        method: 'POST',
        cookie: owner.cookie,
        json: { name, kind: 'ngo' },
      });
      expect(res.status, name).toBe(422);
    }
    const created = await req('/api/org', {
      method: 'POST',
      cookie: owner.cookie,
      json: { name: 'St.John Ambulance', kind: 'ngo' },
    });
    expect(created.status).toBe(201);
    const { id: orgId } = (await created.json()) as { id: string };
    const renamed = await req(`/api/org/${orgId}`, {
      method: 'PATCH',
      cookie: owner.cookie,
      json: { name: 'Secure-Bank.Com' },
    });
    expect(renamed.status).toBe(422);
    const programme = await req(`/api/org/${orgId}/programmes`, {
      method: 'POST',
      cookie: owner.cookie,
      json: { name: 'Claim at PRIZE-DRAW.NET', targetRoleIds: [] },
    });
    expect(programme.status).toBe(422);

    const list = (await (await req('/api/circles', { cookie: owner.cookie })).json()) as {
      suggested: Array<{ id: string }>;
      browse: Array<{ id: string }>;
    };
    const circle = [...list.suggested, ...list.browse][0]!;
    for (const name of ['Visit Evil.Top', 'Moderator', 'Waypoint Team', 'waypoint-support']) {
      const joined = await req(`/api/circles/${circle.id}/join`, {
        method: 'POST',
        cookie: owner.cookie,
        json: { name, acceptGuidelines: true },
      });
      expect(joined.status, name).toBe(422);
    }
  });

  it('cannot carry a web address into an account name', async () => {
    for (const name of ['SECURE-BANK.COM', 'evil.com。', 'Ada www.evil.example']) {
      const res = await req('/api/auth/sign-up/email', {
        method: 'POST',
        json: {
          email: `n-${crypto.randomUUID().slice(0, 8)}@example.org`,
          password: PASSWORD,
          name,
        },
        ip: newIp(),
      });
      expect(res.status, name).toBe(400);
    }
    const fine = await req('/api/auth/sign-up/email', {
      method: 'POST',
      json: {
        email: `n-${crypto.randomUUID().slice(0, 8)}@example.org`,
        password: PASSWORD,
        name: 'Dr. J. R. Okafor',
      },
      ip: newIp(),
    });
    expect(fine.status).toBe(200);
  });
});

describe('background work', () => {
  it('stores time zones by name only, never as an offset the database reads backwards', async () => {
    const me = await account('Tariq');
    for (const timezone of ['+05:00', '-0800', 'Not/AZone'])
      expect(
        (await req('/api/me/profile', { method: 'PATCH', cookie: me.cookie, json: { timezone } }))
          .status,
        timezone,
      ).toBe(422);
    expect(
      (
        await req('/api/me/profile', {
          method: 'PATCH',
          cookie: me.cookie,
          json: { timezone: 'Asia/Kolkata' },
        })
      ).status,
    ).toBe(200);
  });

  it('keeps delivering to everyone else when one person’s settings are broken', async () => {
    const { jobs } = await import('../src');
    const broken = await account('Bea');
    const fine = await account('Femi');
    // A value that could only get here from an older version or a direct change to the database.
    await db
      .getDb()
      .update(db.profiles)
      .set({ timezone: 'Not/AZone', attentionBudget: 3, quietStart: null, quietEnd: null })
      .where(db.eq(db.profiles.userId, broken.id));
    await db
      .getDb()
      .update(db.profiles)
      .set({ timezone: 'UTC', attentionBudget: 3, quietStart: null, quietEnd: null })
      .where(db.eq(db.profiles.userId, fine.id));
    for (const userId of [broken.id, fine.id])
      await db.getDb().insert(db.nudges).values({
        userId,
        module: 'today',
        priority: 'normal',
        title: 'A note',
      });
    const result = await jobs.deliverNudges(db.getDb());
    expect(result.delivered).toBeGreaterThanOrEqual(1);
    const [note] = await rows<{ status: string }>(
      db.sql`select status from nudges where user_id = ${fine.id}`,
    );
    expect(note?.status).toBe('delivered');
  });

  it('delivers the check-in after a hard moment even when someone asked for no other messages', async () => {
    const { jobs } = await import('../src');
    const me = await account('Imani');
    await db
      .getDb()
      .update(db.profiles)
      .set({ timezone: 'UTC', attentionBudget: 0, quietStart: null, quietEnd: null })
      .where(db.eq(db.profiles.userId, me.id));
    await db
      .getDb()
      .insert(db.crisisEvents)
      .values({
        userId: me.id,
        channel: 'ask',
        tier: 2,
        categories: ['self-harm'],
        ruleIds: ['x'],
        rulesVersion: 'test',
        language: 'en',
        followUpAt: new Date(Date.now() - 60_000),
        followUpStatus: 'scheduled',
      });
    expect(await jobs.crisisFollowUps(db.getDb())).toBeGreaterThanOrEqual(1);
    await jobs.deliverNudges(db.getDb());
    const [checkIn] = await rows<{ status: string }>(
      db.sql`select status from nudges where user_id = ${me.id} and dedupe_key = 'crisis-follow-up'`,
    );
    expect(checkIn?.status).toBe('delivered');
  });

  it('forgets what it no longer needs: used sign-in codes and safety records of unlinked numbers', async () => {
    const { jobs } = await import('../src');
    await db.getDb().execute(db.sql`
      insert into verifications (id, identifier, value, expires_at, created_at, updated_at)
      values ('v-old', '+15550009999', '123456:0', now() - interval '2 days', now() - interval '2 days', now() - interval '2 days'),
             ('v-new', '+15550009998', '654321:0', now() + interval '5 minutes', now(), now())`);
    await db.getDb().execute(db.sql`
      insert into crisis_events (id, user_id, channel, tier, categories, rule_ids, rules_version, created_at)
      values (gen_random_uuid(), null, 'sms', 2, '{}', '{}', 'test', now() - interval '200 days'),
             (gen_random_uuid(), null, 'sms', 2, '{}', '{}', 'test', now() - interval '10 days')`);
    await jobs.retention(db.getDb());
    const left = await rows<{ id: string }>(db.sql`select id from verifications`);
    expect(left.map((r) => r.id)).toEqual(['v-new']);
    const events = await rows<{ n: number }>(
      db.sql`select count(*)::int as n from crisis_events where user_id is null and channel = 'sms'`,
    );
    expect(events[0]?.n).toBe(1);
  });
});

describe('signing in', () => {
  const signIn = (email: string, password: string, init: { ip?: string; cookie?: string } = {}) =>
    req('/api/auth/sign-in/email', {
      method: 'POST',
      json: { email, password },
      ip: init.ip ?? newIp(),
      cookie: init.cookie,
    });
  const deviceCookie = (cookie: string) =>
    cookie.split('; ').find((c) => c.startsWith('waypoint.device=')) ?? '';

  it('counts password tries per account whatever the request looks like', async () => {
    // The per-account count read the address from a JSON body only; the auth library also
    // accepts a form, which slipped past it.
    const form = await req('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: 'someone@example.org', password: 'wrong' }).toString(),
      ip: newIp(),
    });
    expect(form.status).toBe(415);
    const email = `target-${crypto.randomUUID().slice(0, 8)}@example.org`;
    let refused = 0;
    for (let i = 0; i < 25; i++)
      if ((await signIn(email, 'not the password')).status === 429) refused++;
    expect(refused).toBe(5);
  });

  it('lets someone’s own device sign in while a stranger is guessing their password', async () => {
    const victim = await account('Vera');
    const other = await account('Otto');
    expect(deviceCookie(victim.cookie)).not.toBe('');
    for (let i = 0; i < 21; i++) await signIn(victim.email, 'a wrong guess');
    // A device that has never signed in to this account is held back with the guesser…
    expect((await signIn(victim.email, PASSWORD)).status).toBe(429);
    // …and so is one showing another account's cookie, or a made-up one.
    expect(
      (await signIn(victim.email, PASSWORD, { cookie: deviceCookie(other.cookie) })).status,
    ).toBe(429);
    expect(
      (await signIn(victim.email, PASSWORD, { cookie: 'waypoint.device=abc.def' })).status,
    ).toBe(429);
    // The victim's own device is not.
    const own = await signIn(victim.email, PASSWORD, { cookie: deviceCookie(victim.cookie) });
    expect(own.status).toBe(200);
  });

  it('answers a wrong password and an unconfirmed address identically, byte for byte', async () => {
    const confirmed = await account('Wren');
    const email = `new-${crypto.randomUUID().slice(0, 8)}@example.org`;
    await req('/api/auth/sign-up/email', {
      method: 'POST',
      json: { email, password: PASSWORD, name: 'New' },
      ip: newIp(),
    });
    const wrong = await signIn(confirmed.email, 'not the password');
    const unconfirmed = await signIn(email, PASSWORD);
    const unknown = await signIn(`nobody-${crypto.randomUUID().slice(0, 8)}@example.org`, PASSWORD);
    const shape = async (res: Response) => ({
      status: res.status,
      body: await res.text(),
      headers: [...res.headers.keys()].filter((h) => h !== 'x-request-id').sort(),
    });
    const expected = await shape(wrong);
    expect(expected.status).toBe(401);
    expect(await shape(unconfirmed)).toEqual(expected);
    expect(await shape(unknown)).toEqual(expected);
  });

  it('sends reset links only back to the website', async () => {
    const me = await account('Rui');
    for (const redirectTo of [
      'waypoint://reset',
      'exp://x/reset',
      'https://evil.example/reset',
      '//evil.example',
    ])
      expect(
        (
          await req('/api/auth/request-password-reset', {
            method: 'POST',
            json: { email: me.email, redirectTo },
            ip: newIp(),
          })
        ).status,
        redirectTo,
      ).toBe(400);
    const fine = await req('/api/auth/request-password-reset', {
      method: 'POST',
      json: { email: me.email, redirectTo: '/reset-password' },
      ip: newIp(),
    });
    expect(fine.status).toBe(200);
  });

  it('cannot be used to flood an inbox with confirmation or reset emails', async () => {
    const tag = crypto.randomUUID().slice(0, 8);
    const email = `flood-${tag}@example.org`;
    const mails = (template: string) =>
      rows<{ n: number }>(
        db.sql`select count(*)::int as n from outbox o join users u on u.id = o.payload->>'userId'
               where o.payload->>'template' = ${template} and u.email like ${`flood-${tag}%`}`,
      ).then((r) => r[0]?.n ?? 0);
    await req('/api/auth/sign-up/email', {
      method: 'POST',
      json: { email, password: PASSWORD, name: 'Flo' },
      ip: newIp(),
    });
    expect(await mails('verify-email')).toBe(1);
    // Signing in again and again before confirming asked for a fresh link every time.
    for (let i = 0; i < 4; i++) await signIn(email, PASSWORD);
    // So did creating accounts for the same inbox under other tags.
    for (let i = 0; i < 3; i++)
      await req('/api/auth/sign-up/email', {
        method: 'POST',
        json: { email: `flood-${tag}+${i}@example.org`, password: PASSWORD, name: 'Flo' },
        ip: newIp(),
      });
    expect(await mails('verify-email')).toBe(1);

    await db
      .getDb()
      .update(db.users)
      .set({ emailVerified: true })
      .where(db.eq(db.users.email, email));
    for (let i = 0; i < 6; i++)
      await req('/api/auth/request-password-reset', {
        method: 'POST',
        json: { email, redirectTo: '/reset-password' },
        ip: newIp(),
      });
    expect(await mails('reset-password')).toBe(3);
  });

  it('limits sign-in codes per visitor, so one address cannot use up everyone’s', async () => {
    const { keyedHash } = await import('../src/lib/request');
    const ip = newIp();
    await db.getDb().execute(db.sql`
      insert into rate_limits (id, key, count, last_request)
      values (gen_random_uuid(), ${`api:otp-send-visitor:${keyedHash(ip, 'ip')}`}, 10, ${Date.now()})`);
    const res = await req('/api/auth/phone-number/send-otp', {
      method: 'POST',
      json: { phoneNumber: '+15557771234' },
      ip,
    });
    expect(res.status).toBe(429);
  });

  it('refuses a cross-site request whatever its body', async () => {
    const me = await account('Sam');
    const put = await req('/api/me/consents', {
      method: 'PUT',
      cookie: me.cookie,
      headers: { origin: 'https://evil.example' },
    });
    expect(put.status).toBe(403);
    const post = await req('/api/circles/x/join', {
      method: 'POST',
      cookie: me.cookie,
      headers: { origin: 'http://sub.localhost:3000' },
    });
    expect(post.status).toBe(403);
    // The site itself is unaffected.
    expect((await req('/api/me', { cookie: me.cookie })).status).toBe(200);
  });
});

describe('deleting an account', () => {
  it('takes feedback, unpublished scam reports and waiting messages with it', async () => {
    const me = await account('Dele');
    const count = async (query: ReturnType<typeof db.sql>) =>
      (await rows<{ n: number }>(query))[0]?.n ?? 0;
    await req('/api/feedback', {
      method: 'POST',
      cookie: me.cookie,
      json: { module: 'today', message: 'My private thoughts about the app', rating: 4 },
    });
    await req('/api/shield/reports', {
      method: 'POST',
      cookie: me.cookie,
      json: { category: 'job', description: 'They asked me to pay a fee', amountLost: 5000 },
    });
    await req('/api/auth/request-password-reset', {
      method: 'POST',
      json: { email: me.email, redirectTo: '/reset-password' },
      ip: newIp(),
    });
    expect(
      await count(db.sql`select count(*)::int as n from feedback where user_id = ${me.id}`),
    ).toBe(1);
    expect(
      await count(db.sql`select count(*)::int as n from scam_reports where user_id = ${me.id}`),
    ).toBe(1);
    expect(
      await count(
        db.sql`select count(*)::int as n from outbox where payload->>'userId' = ${me.id}`,
      ),
    ).toBeGreaterThan(0);
    const before = {
      feedback: await count(db.sql`select count(*)::int as n from feedback`),
      reports: await count(db.sql`select count(*)::int as n from scam_reports`),
    };
    const gone = await req('/api/me', {
      method: 'DELETE',
      cookie: me.cookie,
      json: { confirm: 'DELETE' },
    });
    expect(gone.status).toBeLessThan(300);
    expect(await count(db.sql`select count(*)::int as n from feedback`)).toBe(before.feedback - 1);
    expect(await count(db.sql`select count(*)::int as n from scam_reports`)).toBe(
      before.reports - 1,
    );
    expect(
      await count(
        db.sql`select count(*)::int as n from outbox where payload->>'userId' = ${me.id}`,
      ),
    ).toBe(0);
  });
});
