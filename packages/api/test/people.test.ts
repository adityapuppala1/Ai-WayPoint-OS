/**
 * People in the platform console: finding accounts, looking after them, and inviting staff.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'waypoint-people-'));
process.env.WAYPOINT_DATA_DIR = dir;
process.env.WAYPOINT_URL = 'http://localhost:3000';
process.env.LOG_LEVEL = 'silent';
delete process.env.DATABASE_URL;

const ORIGIN = 'http://localhost:3000';
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
const address = () => {
  visitor++;
  return `10.63.${Math.floor(visitor / 250)}.${visitor % 250}`;
};

/** Someone with an account (confirmed), and the role given. */
async function person(name: string, role: 'admin' | 'staff' | null = null) {
  const email = `${name.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}@example.org`;
  const headers = { 'x-forwarded-for': address() };
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

const signIn = (email: string) =>
  req('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'x-forwarded-for': address() },
    json: { email, password: 'correct horse battery' },
  });

type List = { items: Array<{ id: string; email: string | null; held: boolean }>; total: number };

describe('accounts in the console', () => {
  it('are found by address, kind and state, by admins only', async () => {
    const boss = await person('Ada', 'admin');
    const pat = await person('Pat');
    const staff = await person('Sam', 'staff');
    expect((await req('/api/admin/users', { cookie: staff.cookie })).status).toBe(403);
    const found = (await (
      await req(`/api/admin/users?q=${encodeURIComponent(pat.email)}`, { cookie: boss.cookie })
    ).json()) as List;
    expect(found.items.map((i) => i.id)).toEqual([pat.id]);
    const team = (await (
      await req('/api/admin/users?kind=staff', { cookie: boss.cookie })
    ).json()) as List;
    expect(team.items.map((i) => i.id)).toEqual(expect.arrayContaining([boss.id, staff.id]));
    expect(team.items.map((i) => i.id)).not.toContain(pat.id);
  });

  it('show what the platform holds about an account, nothing the person wrote, and record the look', async () => {
    const boss = await person('Ada', 'admin');
    const pat = await person('Pat');
    const res = await req(`/api/admin/users/${pat.id}`, { cookie: boss.cookie });
    expect(res.status).toBe(200);
    const detail = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(detail).sort()).toEqual(['account', 'history', 'sessions', 'uses']);
    expect(JSON.stringify(detail)).not.toMatch(/journal|mood|money|conversation/i);
    const [seen] = await db
      .getDb()
      .select()
      .from(db.auditLog)
      .where(db.and(db.eq(db.auditLog.action, 'user.view'), db.eq(db.auditLog.targetId, pat.id)));
    expect(seen?.actorUserId).toBe(boss.id);
  });

  it('can be held back at once, and let back in', async () => {
    const boss = await person('Ada', 'admin');
    const pat = await person('Pat');
    const held = await req(`/api/admin/users/${pat.id}`, {
      method: 'POST',
      cookie: boss.cookie,
      json: { action: 'hold', reason: 'Posting scams in circles', until: null },
    });
    expect(held.status).toBe(200);
    const sessions = await db
      .getDb()
      .select()
      .from(db.sessions)
      .where(db.eq(db.sessions.userId, pat.id));
    expect(sessions).toHaveLength(0);
    expect((await signIn(pat.email)).status).not.toBe(200);
    await req(`/api/admin/users/${pat.id}`, {
      method: 'POST',
      cookie: boss.cookie,
      json: { action: 'release' },
    });
    expect((await signIn(pat.email)).status).toBe(200);
  });

  it('are never changed by their own admin from here', async () => {
    const boss = await person('Ada', 'admin');
    const self = await req(`/api/admin/users/${boss.id}`, {
      method: 'POST',
      cookie: boss.cookie,
      json: { action: 'role', role: 'member' },
    });
    expect(self.status).toBe(403);
    // Another admin can: and the one demoted loses the platform's parts of the console.
    const other = await person('Bo', 'admin');
    const demote = await req(`/api/admin/users/${boss.id}`, {
      method: 'POST',
      cookie: other.cookie,
      json: { action: 'role', role: 'staff' },
    });
    expect(demote.status).toBe(200);
    const [row] = await db
      .getDb()
      .select({ role: db.users.role })
      .from(db.users)
      .where(db.eq(db.users.id, boss.id));
    expect(row?.role).toBe('staff');
  });

  it('are deleted only when the address is typed', async () => {
    const boss = await person('Ada', 'admin');
    const pat = await person('Pat');
    const wrong = await req(`/api/admin/users/${pat.id}`, {
      method: 'POST',
      cookie: boss.cookie,
      json: { action: 'delete', confirm: 'someone-else@example.org' },
    });
    expect(wrong.status).toBe(400);
    const gone = await req(`/api/admin/users/${pat.id}`, {
      method: 'POST',
      cookie: boss.cookie,
      json: { action: 'delete', confirm: pat.email.toUpperCase() },
    });
    expect(gone.status).toBe(200);
    expect(await db.getDb().select().from(db.users).where(db.eq(db.users.id, pat.id))).toHaveLength(
      0,
    );
  });
});

describe('staff invitations', () => {
  it('are sent by email, and only the person invited can answer', async () => {
    const boss = await person('Ada', 'admin');
    const invitee = await person('Iva');
    const stranger = await person('Stan');
    const sent = await req('/api/admin/staff/invitations', {
      method: 'POST',
      cookie: boss.cookie,
      json: { email: invitee.email, role: 'staff' },
    });
    expect(sent.status).toBe(200);
    const { id } = (await sent.json()) as { id: string };
    const [mail] = await db
      .getDb()
      .select({ payload: db.outbox.payload })
      .from(db.outbox)
      .where(db.sql`${db.outbox.payload}->>'template' = 'staff-invite'`);
    expect(mail?.payload).toMatchObject({ template: 'staff-invite', role: 'staff' });

    expect((await req(`/api/staff-invitations/${id}`, { cookie: stranger.cookie })).status).toBe(
      404,
    );
    const seen = await req(`/api/staff-invitations/${id}`, { cookie: invitee.cookie });
    expect(seen.status).toBe(200);
    expect(await seen.json()).toMatchObject({ role: 'staff' });
    const accepted = await req(`/api/staff-invitations/${id}`, {
      method: 'POST',
      cookie: invitee.cookie,
      json: { answer: 'accept' },
    });
    expect(accepted.status).toBe(200);
    expect(accepted.headers.getSetCookie().join(';')).toContain('waypoint.session_data=;');
    const [row] = await db
      .getDb()
      .select({ role: db.users.role })
      .from(db.users)
      .where(db.eq(db.users.id, invitee.id));
    expect(row?.role).toBe('staff');
    // Answered once: it is gone.
    expect((await req(`/api/staff-invitations/${id}`, { cookie: invitee.cookie })).status).toBe(
      404,
    );
    const view = (await (await req('/api/admin/staff', { cookie: boss.cookie })).json()) as {
      staff: Array<{ id: string }>;
      invitations: Array<{ id: string; status: string }>;
    };
    expect(view.staff.map((s) => s.id)).toContain(invitee.id);
    expect(view.invitations.find((i) => i.id === id)?.status).toBe('accepted');
  });

  it('can be withdrawn before they are answered', async () => {
    const boss = await person('Ada', 'admin');
    const invitee = await person('Iva');
    const { id } = (await (
      await req('/api/admin/staff/invitations', {
        method: 'POST',
        cookie: boss.cookie,
        json: { email: invitee.email, role: 'admin' },
      })
    ).json()) as { id: string };
    expect(
      (await req(`/api/admin/staff/invitations/${id}`, { method: 'DELETE', cookie: boss.cookie }))
        .status,
    ).toBe(200);
    expect((await req(`/api/staff-invitations/${id}`, { cookie: invitee.cookie })).status).toBe(
      404,
    );
  });
});
