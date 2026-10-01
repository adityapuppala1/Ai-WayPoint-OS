/**
 * Feedback in the platform console: the team works through it, keeps notes, and writes back
 * to people who asked for a reply.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'waypoint-feedback-'));
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
  return `10.64.${Math.floor(visitor / 250)}.${visitor % 250}`;
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
  return { cookie: cookieFrom(res), email };
}

type Item = {
  id: string;
  status: string;
  note: string | null;
  replyTo: string | null;
  repliedAt: string | null;
  handledBy: string | null;
};
type List = {
  items: Item[];
  total: number;
  byStatus: Record<string, number>;
  modules: Array<{ module: string; n: number; avgRating: number | null }>;
  month: { n: number; avgRating: number | null; waitingReply: number };
};

async function send(cookie: string | undefined, body: Record<string, unknown>) {
  const res = await req('/api/feedback', {
    method: 'POST',
    headers: { 'x-forwarded-for': address() },
    cookie,
    json: body,
  });
  expect(res.status).toBe(201);
}

const list = async (cookie: string, query = '') =>
  (await (await req(`/api/admin/feedback${query}`, { cookie })).json()) as List;

describe('feedback in the console', () => {
  it('is filtered by state, part and rating, with counts for each state', async () => {
    const staff = await person('Sam', 'staff');
    const pat = await person('Pat');
    await send(pat.cookie, { module: 'money', rating: 1, message: 'The budget lost my numbers.' });
    await send(undefined, { module: 'money', rating: 5, message: 'Clear and kind.' });
    await send(undefined, { module: 'shield', rating: 4 });

    const all = await list(staff.cookie, '?status=all');
    expect(all.total).toBeGreaterThanOrEqual(3);
    expect(all.byStatus.new).toBeGreaterThanOrEqual(3);
    const money = all.modules.find((m) => m.module === 'money');
    expect(money?.n).toBeGreaterThanOrEqual(2);
    expect(money?.avgRating).toBe(3);
    expect(all.month.n).toBeGreaterThanOrEqual(3);

    const low = await list(staff.cookie, '?status=all&module=money&rating=low');
    expect(low.total).toBe(1);
    // A guest stays unnamed, and so does anyone who did not ask for a reply.
    expect(all.items.every((i) => i.replyTo === null)).toBe(true);
  });

  it('moves through states with a team note, and records who did it', async () => {
    const staff = await person('Lee', 'staff');
    await send(undefined, { module: 'path', message: 'Show me the next step sooner.' });
    const [item] = (await list(staff.cookie, '?module=path')).items;
    expect(item?.status).toBe('new');

    const moved = await req(`/api/admin/feedback/${item!.id}`, {
      method: 'PATCH',
      cookie: staff.cookie,
      json: { status: 'planned', note: 'Ask Kim at kim@example.org about the order.' },
    });
    expect(moved.status).toBe(200);
    const planned = await list(staff.cookie, '?status=planned&module=path');
    const after = planned.items.find((i) => i.id === item!.id);
    expect(after?.status).toBe('planned');
    expect(after?.handledBy).toBe('Lee');
    // Notes are the team's, but an address written into one is still taken out.
    expect(after?.note).toContain('Ask Kim');
    expect(after?.note).not.toContain('kim@example.org');
    // It has left the new ones.
    const fresh = await list(staff.cookie, '?module=path');
    expect(fresh.items.some((i) => i.id === item!.id)).toBe(false);

    const [entry] = await db
      .getDb()
      .select({ action: db.auditLog.action, meta: db.auditLog.meta })
      .from(db.auditLog)
      .where(db.eq(db.auditLog.targetId, item!.id));
    expect(entry).toMatchObject({
      action: 'feedback.update',
      meta: { from: 'new', to: 'planned' },
    });

    const empty = await req(`/api/admin/feedback/${item!.id}`, {
      method: 'PATCH',
      cookie: staff.cookie,
      json: {},
    });
    expect(empty.status).toBe(422);
  });

  it('writes back to someone who asked, sealed, and to nobody else', async () => {
    const staff = await person('Noor', 'staff');
    const asker = await person('Ines');
    await send(asker.cookie, {
      module: 'mind',
      message: 'Could the breathing exercise be slower?',
      wantsReply: true,
    });
    // A guest cannot ask for a reply: there is nobody to write to.
    await send(undefined, { module: 'mind', message: 'Love it.', wantsReply: true });
    const items = (await list(staff.cookie, '?module=mind&wantsReply=true')).items;
    expect(items).toHaveLength(1);
    const theirs = items[0]!;
    expect(theirs.replyTo).toBe(asker.email);
    expect((await list(staff.cookie, '?status=all')).month.waitingReply).toBeGreaterThanOrEqual(1);

    const reply = 'Yes, there is now a slower pace in the settings. Thank you!';
    const sent = await req(`/api/admin/feedback/${theirs.id}/reply`, {
      method: 'POST',
      cookie: staff.cookie,
      json: { message: reply },
    });
    expect(sent.status).toBe(200);
    const [mail] = await db
      .getDb()
      .select({ payload: db.outbox.payload })
      .from(db.outbox)
      .where(db.sql`${db.outbox.payload}->>'template' = 'feedback-reply'`);
    expect(mail?.payload).toMatchObject({ template: 'feedback-reply' });
    // The words travel sealed: not readable in the queue, and not kept in the log.
    expect(JSON.stringify(mail?.payload)).not.toContain('slower pace');
    expect(db.openOutboxPayload(mail!.payload as Record<string, unknown>)).toMatchObject({
      reply,
      name: 'Ines',
    });
    const log = await db
      .getDb()
      .select({ action: db.auditLog.action, meta: db.auditLog.meta })
      .from(db.auditLog)
      .where(db.eq(db.auditLog.targetId, theirs.id));
    expect(log.map((l) => l.action)).toContain('feedback.reply');
    expect(JSON.stringify(log)).not.toContain('slower pace');
    const replied = (await list(staff.cookie, '?status=all&module=mind')).items.find(
      (i) => i.id === theirs.id,
    );
    expect(replied?.repliedAt).not.toBeNull();

    // Someone who did not ask is not written to.
    await send(asker.cookie, { module: 'goals', message: 'Fine.' });
    const [quiet] = (await list(staff.cookie, '?module=goals')).items;
    const refused = await req(`/api/admin/feedback/${quiet!.id}/reply`, {
      method: 'POST',
      cookie: staff.cookie,
      json: { message: 'Thanks!' },
    });
    expect(refused.status).toBe(409);
  });

  it('is for the staff only', async () => {
    const member = await person('Max');
    expect((await req('/api/admin/feedback', { cookie: member.cookie })).status).toBe(403);
    const patch = await req('/api/admin/feedback/00000000-0000-0000-0000-000000000000', {
      method: 'PATCH',
      cookie: member.cookie,
      json: { status: 'done' },
    });
    expect(patch.status).toBe(403);
    expect((await req('/api/admin/feedback')).status).toBe(401);
  });
});
