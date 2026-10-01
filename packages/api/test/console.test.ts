/**
 * The platform console's own parts: outside services and their keys (and, as they are added,
 * the rest). Nothing here reaches the network: a stand-in plays each service.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'waypoint-console-'));
process.env.WAYPOINT_DATA_DIR = dir;
process.env.WAYPOINT_URL = 'http://localhost:3000';
process.env.LOG_LEVEL = 'silent';
for (const k of [
  'DATABASE_URL',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'OLLAMA_BASE_URL',
  'RESEND_API_KEY',
  'SMTP_URL',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
])
  delete process.env[k];

const ORIGIN = 'http://localhost:3000';
let app: ReturnType<typeof import('../src').createApp>;
let db: typeof import('@waypoint/db');
let providers: typeof import('../src/channels/providers');
let env: typeof import('@waypoint/core/env');

beforeAll(async () => {
  db = await import('@waypoint/db');
  await db.dbReady();
  app = (await import('../src')).createApp();
  providers = await import('../src/channels/providers');
  env = await import('@waypoint/core/env');
}, 120_000);

afterAll(async () => {
  await db.closeDb();
  rmSync(dir, { recursive: true, force: true });
});

function req(path: string, init: RequestInit & { cookie?: string; json?: unknown } = {}) {
  const headers = new Headers(init.headers);
  headers.set('origin', ORIGIN);
  if (init.cookie) headers.set('cookie', init.cookie);
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

let visitor = 0;

/** Someone with an account (confirmed), and the role given. */
async function person(name: string, role: 'admin' | 'staff' | null = null) {
  visitor++;
  const email = `${name.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}@example.org`;
  const headers = { 'x-forwarded-for': `10.61.${Math.floor(visitor / 250)}.${visitor % 250}` };
  const up = await req('/api/auth/sign-up/email', {
    method: 'POST',
    headers,
    json: { email, password: 'correct horse battery', name },
  });
  expect(up.status).toBe(200);
  await db
    .getDb()
    .update(db.users)
    .set({ emailVerified: true, ...(role ? { role } : {}) })
    .where(db.eq(db.users.email, email));
  const res = await req('/api/auth/sign-in/email', {
    method: 'POST',
    headers,
    json: { email, password: 'correct horse battery' },
  });
  expect(res.status).toBe(200);
  const [row] = await db
    .getDb()
    .select({ id: db.users.id })
    .from(db.users)
    .where(db.eq(db.users.email, email));
  return { cookie: cookieFrom(res), email, id: row!.id };
}

type View = {
  integrations: Array<{
    id: string;
    configured: boolean;
    status: string;
    fields: Array<{ key: string; source: string; shown: string | null }>;
    check: { ok: boolean; detail: string } | null;
  }>;
};

const view = async (cookie: string) =>
  (await (await req('/api/admin/integrations', { cookie })).json()) as View;
const card = (v: View, id: string) => v.integrations.find((i) => i.id === id)!;
const field = (v: View, id: string, key: string) => card(v, id).fields.find((f) => f.key === key)!;

describe('outside services in the console', () => {
  afterEach(() => providers.setOutboundFetch(null));

  it('are for admins only', async () => {
    const staff = await person('Sam', 'staff');
    expect((await req('/api/admin/integrations', { cookie: staff.cookie })).status).toBe(403);
    const someone = await person('Pat');
    expect((await req('/api/admin/integrations', { cookie: someone.cookie })).status).toBe(403);
    const boss = await person('Ada', 'admin');
    expect((await req('/api/admin/integrations', { cookie: boss.cookie })).status).toBe(200);
  });

  it('take a key once, keep it sealed, show only its end, and use it at once', async () => {
    const boss = await person('Ada', 'admin');
    expect(card(await view(boss.cookie), 'resend')).toMatchObject({
      configured: false,
      status: 'off',
    });

    const saved = await req('/api/admin/integrations/resend', {
      method: 'PUT',
      cookie: boss.cookie,
      json: { values: { RESEND_API_KEY: 're_live_secret_value_9f3k' } },
    });
    expect(saved.status).toBe(200);

    // In use straight away, in this process, without a restart.
    expect(env.getEnv().RESEND_API_KEY).toBe('re_live_secret_value_9f3k');
    const after = await view(boss.cookie);
    expect(card(after, 'resend')).toMatchObject({ configured: true, status: 'untested' });
    expect(field(after, 'resend', 'RESEND_API_KEY')).toEqual(
      expect.objectContaining({ source: 'console', shown: '••••9f3k' }),
    );
    // Never sent back, never stored readable, never written to the activity log.
    expect(JSON.stringify(after)).not.toContain('re_live_secret_value');
    const [row] = await db.getDb().select().from(db.integrationSettings);
    expect(row!.valueCt).not.toContain('re_live');
    const [entry] = await db
      .getDb()
      .select()
      .from(db.auditLog)
      .where(db.eq(db.auditLog.action, 'integration.update'));
    expect(entry).toMatchObject({ actorUserId: boss.id, targetId: 'resend' });
    expect(JSON.stringify(entry!.meta)).toBe('{"set":["RESEND_API_KEY"],"removed":[]}');

    // Removed again: back to off.
    await req('/api/admin/integrations/resend', {
      method: 'PUT',
      cookie: boss.cookie,
      json: { values: { RESEND_API_KEY: null } },
    });
    expect(env.getEnv().RESEND_API_KEY).toBeUndefined();
    expect(card(await view(boss.cookie), 'resend').status).toBe('off');
  });

  it('refuse a value that would break the server, or one the server already sets', async () => {
    const boss = await person('Ada', 'admin');
    const bad = await req('/api/admin/integrations/typesafe', {
      method: 'PUT',
      cookie: boss.cookie,
      json: { values: { AI_JUDGE_MODEL: 'jev-latest', AI_JUDGE_LOCALES: 'en,xx' } },
    });
    expect(bad.status).toBe(400);
    const body = (await bad.json()) as { problems: Record<string, string> };
    expect(Object.keys(body.problems).sort()).toEqual(['AI_JUDGE_LOCALES', 'AI_JUDGE_MODEL']);
    expect(env.getEnv().AI_JUDGE_MODEL).toBe('jev-1.13.0');

    // Not a setting of that service, or not the console's at all.
    const stray = await req('/api/admin/integrations/resend', {
      method: 'PUT',
      cookie: boss.cookie,
      json: { values: { BETTER_AUTH_SECRET: 'x'.repeat(40) } },
    });
    expect(stray.status).toBe(400);

    process.env.SMTP_URL = 'smtp://user:pass@mail.example.org:587';
    env.resetEnvForTests();
    try {
      const smtp = await view(boss.cookie);
      expect(field(smtp, 'smtp', 'SMTP_URL')).toMatchObject({
        source: 'server',
        shown: '••••:587',
      });
      const server = await req('/api/admin/integrations/smtp', {
        method: 'PUT',
        cookie: boss.cookie,
        json: { values: { SMTP_URL: 'smtp://other:pw@elsewhere.example.org:25' } },
      });
      expect(server.status).toBe(400);
    } finally {
      delete process.env.SMTP_URL;
      env.resetEnvForTests();
    }
  });

  it('check a service with one harmless call and keep its answer', async () => {
    const boss = await person('Ada', 'admin');
    await req('/api/admin/integrations/twilio', {
      method: 'PUT',
      cookie: boss.cookie,
      json: { values: { TWILIO_ACCOUNT_SID: 'ACtest', TWILIO_AUTH_TOKEN: 'tok_secret_1234' } },
    });
    const calls: Array<{ url: string; method: string }> = [];
    providers.setOutboundFetch(async (url, init) => {
      calls.push({ url: String(url), method: init?.method ?? 'GET' });
      return new Response(JSON.stringify({ status: 'active', type: 'Full' }), { status: 200 });
    });
    const ok = await req('/api/admin/integrations/twilio/check', {
      method: 'POST',
      cookie: boss.cookie,
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true, detail: 'Account active (Full)' });
    expect(calls).toEqual([
      { url: 'https://api.twilio.com/2010-04-01/Accounts/ACtest.json', method: 'GET' },
    ]);
    expect(card(await view(boss.cookie), 'twilio')).toMatchObject({ status: 'ok' });

    // A refusal is kept too, in words, with nothing key-like in them.
    providers.setOutboundFetch(
      async () => new Response('{"message":"Authenticate tok_secret_1234"}', { status: 401 }),
    );
    const refused = (await (
      await req('/api/admin/integrations/twilio/check', { method: 'POST', cookie: boss.cookie })
    ).json()) as { ok: boolean; detail: string };
    expect(refused.ok).toBe(false);
    expect(refused.detail).toMatch(/^401: key refused/);
    expect(card(await view(boss.cookie), 'twilio').status).toBe('failing');

    // Changing the settings forgets the old answer.
    await req('/api/admin/integrations/twilio', {
      method: 'PUT',
      cookie: boss.cookie,
      json: { values: { TWILIO_AUTH_TOKEN: 'tok_new_5678' } },
    });
    expect(card(await view(boss.cookie), 'twilio')).toMatchObject({
      status: 'untested',
      check: null,
    });
  });

  it('are loaded again from the database, as another server would load them', async () => {
    const boss = await person('Ada', 'admin');
    await req('/api/admin/integrations/openai', {
      method: 'PUT',
      cookie: boss.cookie,
      json: {
        values: { OPENAI_API_KEY: 'sk-test-loaded-again', AI_MODEL_OPENAI_SMALL: 'gpt-5.4-nano' },
      },
    });
    env.setConsoleSettings({});
    expect(env.getEnv().OPENAI_API_KEY).toBeUndefined();
    const { loadConsoleSettings } = await import('../src/services/integrations');
    await loadConsoleSettings(db.getDb());
    expect(env.getEnv().OPENAI_API_KEY).toBe('sk-test-loaded-again');
    expect(env.getEnv().AI_MODEL_OPENAI_SMALL).toBe('gpt-5.4-nano');
  });
});
