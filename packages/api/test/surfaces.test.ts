/**
 * Things that were built underneath and had no surface: signals people can save or hide,
 * signals staff add by hand (always with a source, never generated), and the feedback people
 * send, which staff can read without learning who a guest is.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'waypoint-surfaces-'));
const ORIGIN = 'http://localhost:3000';
Object.assign(process.env, { WAYPOINT_DATA_DIR: dir, WAYPOINT_URL: ORIGIN, LOG_LEVEL: 'silent' });
for (const k of ['DATABASE_URL', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'OLLAMA_BASE_URL'])
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
    .filter((c) => !c?.startsWith('waypoint.session_data'))
    .join('; ');

let addresses = 0;
/** Each person arrives from an address of their own, as they would in real life. */
const from = () => {
  addresses++;
  return { 'x-forwarded-for': `10.61.${Math.floor(addresses / 250)}.${addresses % 250}` };
};

type Person = { cookie: string; id: string; email: string };

async function account(name: string, opts: { role?: 'admin'; country?: string } = {}) {
  const email = `${name.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}@example.org`;
  const password = 'correct horse battery';
  const headers = from();
  await req('/api/auth/sign-up/email', {
    method: 'POST',
    headers,
    json: { email, password, name },
  });
  const [user] = await db
    .getDb()
    .select({ id: db.users.id })
    .from(db.users)
    .where(db.eq(db.users.email, email));
  await db
    .getDb()
    .update(db.users)
    .set({ emailVerified: true, ...(opts.role ? { role: opts.role } : {}) })
    .where(db.eq(db.users.id, user!.id));
  const res = await req('/api/auth/sign-in/email', {
    method: 'POST',
    headers,
    json: { email, password },
  });
  expect(res.status).toBe(200);
  const person: Person = { cookie: cookieFrom(res), id: user!.id, email };
  if (opts.country) await liveIn(person.cookie, opts.country);
  return person;
}

async function guest(country?: string): Promise<{ cookie: string; id: string }> {
  const res = await req('/api/auth/sign-in/anonymous', {
    method: 'POST',
    headers: from(),
    json: {},
  });
  expect(res.status).toBe(200);
  const cookie = cookieFrom(res);
  if (country) await liveIn(cookie, country);
  const me = (await (await req('/api/me', { cookie })).json()) as { user: { id: string } };
  return { cookie, id: me.user.id };
}

const liveIn = (cookie: string, country: string) =>
  req('/api/me/profile', { method: 'PATCH', cookie, json: { country } });

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const day = (d: Date) => d.toISOString().slice(0, 10);

type Signal = {
  id: string;
  title: string;
  sourceName: string;
  sourceUrl: string;
  saved: boolean;
  reasons: string[];
  regions: string[];
  language: string;
  publishedAt: string;
};

const signalsFor = async (cookie?: string, query = '') =>
  (await (await req(`/api/signals${query}`, { cookie })).json()) as Signal[];

/** A signal as staff would type it in the console. */
const signal = (over: Record<string, unknown> = {}) => ({
  title: 'Kenya raises the minimum wage for farm workers from November',
  summary:
    'The labour ministry has published new minimum wages for agricultural workers. They apply from 1 November and employers must show the new rates at the workplace.',
  source: 'official',
  sourceName: 'Ministry of Labour and Social Protection',
  sourceUrl: 'https://www.labour.go.ke/minimum-wage-notice',
  publishedOn: day(daysAgo(3)),
  regions: ['ke'],
  sectors: ['Agriculture'],
  importance: 4,
  ...over,
});

describe('signals a person can act on', () => {
  /** Straight into the database, as the seed does: these tests are about saving and hiding. */
  async function stored(title: string, publishedAt: Date, regions = ['TZ']) {
    const [row] = await db
      .getDb()
      .insert(db.signals)
      .values({
        source: 'official',
        sourceName: 'Bank of Tanzania',
        sourceUrl: 'https://www.bot.go.tz/',
        title,
        summary: 'A change that people in Tanzania may want to know about.',
        publishedAt,
        regions,
        contentHash: crypto.randomUUID(),
      })
      .returning({ id: db.signals.id });
    return row!.id;
  }
  const state = (cookie: string | undefined, id: string, json: Record<string, unknown>) =>
    req(`/api/signals/${id}/state`, { method: 'POST', cookie, json });

  it('keeps what someone saved, however old it gets, and only for them', async () => {
    const reader = await guest('TZ');
    const recent = await stored('Mobile money fees are capped from this month', daysAgo(10));
    const old = await stored('The bus rapid transit line opened its second phase', daysAgo(900));
    // The list of what is changing looks back a limited time: the old one is not on it.
    const now = await signalsFor(reader.cookie);
    expect(now.map((s) => s.id)).toContain(recent);
    expect(now.map((s) => s.id)).not.toContain(old);
    expect(await signalsFor(reader.cookie, '?saved=true')).toEqual([]);

    expect((await state(reader.cookie, recent, { saved: true })).status).toBe(200);
    expect((await state(reader.cookie, old, { saved: true })).status).toBe(200);
    const saved = await signalsFor(reader.cookie, '?saved=true');
    // Both are kept, the one saved last first, and each still says where it came from.
    expect(saved.map((s) => s.id)).toEqual([old, recent]);
    expect(saved.every((s) => s.saved)).toBe(true);
    expect(saved[0]).toMatchObject({ sourceName: 'Bank of Tanzania', reasons: ['country'] });
    expect((await signalsFor(reader.cookie)).find((s) => s.id === recent)?.saved).toBe(true);

    // Un-saving takes it off the list again.
    await state(reader.cookie, old, { saved: false });
    expect((await signalsFor(reader.cookie, '?saved=true')).map((s) => s.id)).toEqual([recent]);

    // Nobody else sees what this person saved, and someone with no session has no list at all.
    const other = await guest('TZ');
    expect(await signalsFor(other.cookie, '?saved=true')).toEqual([]);
    expect(await signalsFor(undefined, '?saved=true')).toEqual([]);
    expect((await state(undefined, recent, { saved: true })).status).toBe(401);
  });

  it('hides what someone says is not relevant, and brings it back when they undo', async () => {
    const reader = await guest('TZ');
    const id = await stored('Fuel prices for the coming month were announced', daysAgo(2));
    expect((await signalsFor(reader.cookie)).map((s) => s.id)).toContain(id);
    await state(reader.cookie, id, { dismissed: true, feedback: 'not-relevant' });
    expect((await signalsFor(reader.cookie)).map((s) => s.id)).not.toContain(id);
    // Hidden for them only.
    const other = await guest('TZ');
    expect((await signalsFor(other.cookie)).map((s) => s.id)).toContain(id);
    // Undo.
    await state(reader.cookie, id, { dismissed: false });
    expect((await signalsFor(reader.cookie)).map((s) => s.id)).toContain(id);
  });
});

describe('signals staff add', () => {
  let staff: Person;
  const publish = (json: Record<string, unknown>, cookie = staff.cookie) =>
    req('/api/admin/signals', { method: 'POST', cookie, json });
  const audited = async () =>
    (
      (await (await req('/api/admin/audit', { cookie: staff.cookie })).json()) as {
        items: Array<{ action: string; targetId: string | null }>;
      }
    ).items;

  beforeAll(async () => {
    staff = await account('Editor', { role: 'admin' });
  });

  it('is for staff only', async () => {
    const visitor = await account('Visitor');
    expect((await req('/api/admin/signals', { method: 'POST', json: signal() })).status).toBe(401);
    expect((await publish(signal(), visitor.cookie)).status).toBe(403);
    expect((await req('/api/admin/signals', { cookie: visitor.cookie })).status).toBe(403);
    expect(
      (
        await req(`/api/admin/signals/${crypto.randomUUID()}`, {
          method: 'DELETE',
          cookie: visitor.cookie,
        })
      ).status,
    ).toBe(403);
  });

  it('never publishes a signal without a source, or dated in the future', async () => {
    for (const bad of [
      { sourceUrl: undefined },
      { sourceUrl: '' },
      { sourceUrl: 'http://www.labour.go.ke/notice' },
      { sourceUrl: 'javascript:alert(1)' },
      { sourceName: '' },
      { sourceName: undefined },
      { title: 'Short' },
      { summary: 'Too short.' },
      { importance: 6 },
      { regions: ['QQ'] },
      { publishedOn: day(new Date(Date.now() + 3 * 86_400_000)) },
      { publishedOn: '2026-02-30' },
      // Older than the Signals page looks back: nobody would ever see it.
      { publishedOn: day(daysAgo(500)) },
    ]) {
      const res = await publish(signal(bad));
      expect(res.status, JSON.stringify(bad)).toBe(422);
    }
    const list = (await (await req('/api/admin/signals', { cookie: staff.cookie })).json()) as {
      items: Signal[];
    };
    expect(list.items.find((s) => s.title === signal().title)).toBeUndefined();
  });

  it('shows a published signal to the people it is about, with its source, and records who added it', async () => {
    const res = await publish(signal());
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };

    const kenyan = await guest('KE');
    const seen = (await signalsFor(kenyan.cookie)).find((s) => s.id === id);
    expect(seen).toMatchObject({
      title: signal().title,
      sourceName: 'Ministry of Labour and Social Protection',
      sourceUrl: 'https://www.labour.go.ke/minimum-wage-notice',
      // Countries are stored in their standard form, whatever was typed.
      regions: ['KE'],
      language: 'en',
      reasons: ['country'],
    });
    expect(seen?.publishedAt.slice(0, 10)).toBe(signal().publishedOn);
    // It is about Kenya: someone in Peru is not shown it.
    const peruvian = await guest('PE');
    expect((await signalsFor(peruvian.cookie)).map((s) => s.id)).not.toContain(id);

    // The same signal is not published twice.
    expect((await publish(signal())).status).toBe(409);

    const list = (await (await req('/api/admin/signals', { cookie: staff.cookie })).json()) as {
      items: Array<Signal & { sectors: string[]; importance: number }>;
    };
    expect(list.items[0]).toMatchObject({ id, sectors: ['agriculture'], importance: 4 });
    expect(await audited()).toContainEqual(
      expect.objectContaining({ action: 'signal.published', targetId: id }),
    );
  });

  it('shows a signal with no country to everyone', async () => {
    const res = await publish(
      signal({
        title: 'The ILO publishes its yearly report on wages around the world',
        sourceName: 'International Labour Organization',
        sourceUrl: 'https://www.ilo.org/global-wage-report',
        regions: [],
      }),
    );
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    const anyone = await guest('PE');
    expect((await signalsFor(anyone.cookie)).find((s) => s.id === id)?.reasons).toEqual(['global']);
  });

  it('withdraws a signal for everyone, including people who saved it, and records that too', async () => {
    const res = await publish(
      signal({
        title: 'County offices extend their opening hours for ID applications',
        sourceUrl: 'https://www.immigration.go.ke/opening-hours',
      }),
    );
    const { id } = (await res.json()) as { id: string };
    const reader = await guest('KE');
    await req(`/api/signals/${id}/state`, {
      method: 'POST',
      cookie: reader.cookie,
      json: { saved: true },
    });
    expect((await signalsFor(reader.cookie, '?saved=true')).map((s) => s.id)).toEqual([id]);

    const gone = await req(`/api/admin/signals/${id}`, { method: 'DELETE', cookie: staff.cookie });
    expect(gone.status).toBe(200);
    expect((await signalsFor(reader.cookie)).map((s) => s.id)).not.toContain(id);
    expect(await signalsFor(reader.cookie, '?saved=true')).toEqual([]);
    expect(
      (await req(`/api/admin/signals/${id}`, { method: 'DELETE', cookie: staff.cookie })).status,
    ).toBe(404);
    expect(await audited()).toContainEqual(
      expect.objectContaining({ action: 'signal.withdrawn', targetId: id }),
    );
  });

  it('keeps a withdrawn seed signal withdrawn when the seed runs again', async () => {
    const { seedBase } = await import('@waypoint/db/seed');
    const title = 'Fake QR codes on parking meters lead to payment scams';
    const listed = async () =>
      (
        (await (await req('/api/admin/signals', { cookie: staff.cookie })).json()) as {
          items: Signal[];
        }
      ).items.filter((s) => s.title === title);
    const [seeded] = await listed();
    expect(seeded).toBeDefined();

    expect(
      (await req(`/api/admin/signals/${seeded!.id}`, { method: 'DELETE', cookie: staff.cookie }))
        .status,
    ).toBe(200);
    expect(await listed()).toEqual([]);

    // Every start of the embedded database, and every deploy, runs the seed again.
    expect((await seedBase(db.getDb())).signals).toBe(0);
    expect(await listed()).toEqual([]);
    const american = await guest('US');
    expect((await signalsFor(american.cookie)).map((s) => s.title)).not.toContain(title);

    // Staff cannot put it back by typing it in again without being told it was withdrawn.
    const again = await publish(
      signal({
        title,
        sourceName: seeded!.sourceName,
        sourceUrl: seeded!.sourceUrl,
        regions: ['US'],
      }),
    );
    expect(again.status).toBe(409);
    expect(((await again.json()) as { code: string }).code).toBe('withdrawn');
    expect(await listed()).toEqual([]);
  });
});

describe('feedback', () => {
  type Item = {
    id: string;
    module: string;
    rating: number | null;
    message: string | null;
    replyTo: string | null;
    createdAt: string;
  };
  const send = (cookie: string | undefined, json: Record<string, unknown>) =>
    req('/api/feedback', { method: 'POST', cookie, headers: from(), json });

  it('reaches staff newest first, and never says who a guest is', async () => {
    const staff = await account('Reader', { role: 'admin' });
    const visitor = await guest();
    const wantsReply = await account('Asha');
    const quiet = await account('Bilal');

    expect(
      (
        await send(visitor.cookie, {
          module: 'shield',
          rating: 2,
          message: 'The check was slow. Call me on +254 712 345 678 or write to me@example.com.',
          // A guest has no address to reply to: asking changes nothing.
          wantsReply: true,
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await send(wantsReply.cookie, {
          module: 'path',
          message: 'The plan helped me find a course.',
          wantsReply: true,
        })
      ).status,
    ).toBe(201);
    expect((await send(quiet.cookie, { module: 'money', rating: 5 })).status).toBe(201);
    expect((await send(undefined, { module: 'other', message: 'No session at all.' })).status).toBe(
      201,
    );

    expect((await req('/api/admin/feedback')).status).toBe(401);
    expect((await req('/api/admin/feedback', { cookie: quiet.cookie })).status).toBe(403);

    const res = await req('/api/admin/feedback', { cookie: staff.cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    const text = await res.text();
    const list = JSON.parse(text) as { items: Item[]; total: number };
    expect(list.total).toBe(4);
    expect(list.items.map((f) => f.module)).toEqual(['other', 'money', 'path', 'shield']);
    const [none, rated, reply, fromGuest] = list.items as [Item, Item, Item, Item];
    expect(none).toMatchObject({ replyTo: null, rating: null });
    expect(rated).toMatchObject({ rating: 5, message: null, replyTo: null });
    // Only someone who asked for a reply is named, and only by the address to reply to.
    expect(reply).toMatchObject({ replyTo: wantsReply.email });
    expect(fromGuest).toMatchObject({ rating: 2, replyTo: null });
    // What was written had its phone number and address removed before it was stored.
    expect(fromGuest.message).toContain('The check was slow.');
    expect(fromGuest.message).not.toContain('712');
    expect(fromGuest.message).not.toContain('me@example.com');
    // Nothing in the answer can be traced to the guest, or to the person who wanted no reply.
    expect(text).not.toContain(visitor.id);
    expect(text).not.toContain(quiet.id);
    expect(text).not.toContain(quiet.email);
    expect(text).not.toContain(wantsReply.id);
    expect(text).not.toContain('userId');
  });

  it('comes a page at a time', async () => {
    const staff = await account('Pager', { role: 'admin' });
    const first = (await (
      await req('/api/admin/feedback?limit=2', { cookie: staff.cookie })
    ).json()) as { items: Item[]; next: string | null };
    expect(first.items).toHaveLength(2);
    expect(first.next).toBeTruthy();
    const second = (await (
      await req(`/api/admin/feedback?limit=2&before=${encodeURIComponent(first.next!)}`, {
        cookie: staff.cookie,
      })
    ).json()) as { items: Item[]; next: string | null };
    expect(second.items).toHaveLength(2);
    expect(second.items.map((f) => f.id)).not.toContain(first.items[0]!.id);
    expect(second.next).toBeNull();
  });
});
