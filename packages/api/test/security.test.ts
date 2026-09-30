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
