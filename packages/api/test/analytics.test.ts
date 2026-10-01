/**
 * The console's analytics: what is counted (and what never is), and how the totals come out.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'waypoint-analytics-'));
process.env.WAYPOINT_DATA_DIR = dir;
process.env.WAYPOINT_URL = 'http://localhost:3000';
process.env.LOG_LEVEL = 'silent';
delete process.env.DATABASE_URL;

const ORIGIN = 'http://localhost:3000';
let app: ReturnType<typeof import('../src').createApp>;
let db: typeof import('@waypoint/db');
let analytics: typeof import('../src/services/analytics');
let usage: typeof import('../src/lib/usage');

beforeAll(async () => {
  db = await import('@waypoint/db');
  await db.dbReady();
  app = (await import('../src')).createApp();
  analytics = await import('../src/services/analytics');
  usage = await import('../src/lib/usage');
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
  return `10.65.${Math.floor(visitor / 250)}.${visitor % 250}`;
};

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
  return { cookie: cookieFrom(res), id: row!.id };
}

const open = (path: string, cookie?: string, headers: Record<string, string> = {}) =>
  req('/api/activity', {
    method: 'POST',
    cookie,
    headers: { 'x-forwarded-for': address(), ...headers },
    json: { path },
  });

const viewsOf = async (module: string) => {
  const view = await analytics.analyticsView(db.getDb(), { range: '7d' });
  return view.views.byModule.find((m) => m.id === module)?.n ?? 0;
};

describe('what the analytics count', () => {
  it('names the part of Waypoint a page belongs to, and leaves the console out', () => {
    expect(usage.moduleOfPath('/')).toBe('today');
    expect(usage.moduleOfPath('/money/budget?x=1')).toBe('money');
    expect(usage.moduleOfPath('/(tabs)/mind')).toBe('mind');
    expect(usage.moduleOfPath('/welcome')).toBe('start');
    expect(usage.moduleOfPath('/somewhere-new')).toBe('other');
    expect(usage.moduleOfPath('/admin/analytics')).toBeNull();
    expect(usage.moduleOfPath('/api/today')).toBeNull();
  });

  it('counts a page opened, and the day someone used Waypoint, but nothing more', async () => {
    const pat = await person('Pat');
    const before = await viewsOf('money');
    expect((await open('/money', pat.cookie)).status).toBe(204);
    expect((await open('/money/budget', pat.cookie, { 'x-waypoint-client': 'phone' })).status).toBe(
      204,
    );
    expect(await viewsOf('money')).toBe(before + 2);
    const [day] = await db
      .getDb()
      .select()
      .from(db.activityDays)
      .where(db.eq(db.activityDays.userId, pat.id));
    // Both platforms on the one day, and no record of what was opened.
    expect(day?.platforms).toBe(usage.PLATFORM_BIT.web | usage.PLATFORM_BIT.phone);
    expect(Object.keys(day ?? {}).sort()).toEqual(['day', 'platforms', 'userId']);
  });

  it('counts nobody whose browser asks not to be tracked, nor the staff', async () => {
    const lee = await person('Lee');
    const sam = await person('Sam', 'staff');
    const before = await viewsOf('shield');
    await open('/shield', lee.cookie, { 'sec-gpc': '1' });
    await open('/shield', lee.cookie, { dnt: '1' });
    await open('/shield', sam.cookie);
    await open('/admin', lee.cookie);
    expect(await viewsOf('shield')).toBe(before);
    const days = await db
      .getDb()
      .select()
      .from(db.activityDays)
      .where(db.inArray(db.activityDays.userId, [lee.id, sam.id]));
    expect(days).toHaveLength(0);
  });

  it('takes a browser beacon (plain text holding JSON), but not from another site', async () => {
    const before = await viewsOf('goals');
    const beacon = (origin: string) =>
      app.request(`${ORIGIN}/api/activity`, {
        method: 'POST',
        headers: {
          origin,
          'content-type': 'text/plain;charset=UTF-8',
          'x-forwarded-for': address(),
        },
        body: JSON.stringify({ path: '/goals' }),
      });
    expect((await beacon(ORIGIN)).status).toBe(204);
    expect(await viewsOf('goals')).toBe(before + 1);
    expect((await beacon('https://elsewhere.example')).status).toBe(403);
    expect(await viewsOf('goals')).toBe(before + 1);
  });

  it('counts someone signed out as a visitor, with nobody attached', async () => {
    await open('/welcome');
    const view = await analytics.analyticsView(db.getDb(), { range: '7d' });
    expect(view.views.byAudience.find((a) => a.id === 'visitor')?.n).toBeGreaterThanOrEqual(1);
  });
});

describe('the analytics totals', () => {
  it('follow people from joining to coming back, week by week', async () => {
    const d = db.getDb();
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const monday = today - ((new Date(today).getUTCDay() + 6) % 7) * 86_400_000;
    const joinedAt = new Date(monday - 3 * 7 * 86_400_000 + 3_600_000);
    const day = (t: number) => new Date(t).toISOString().slice(0, 10);
    // Six people joined three weeks ago; four came back the week after, two the week after that.
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) {
      const id = `cohort-${i}-${crypto.randomUUID().slice(0, 6)}`;
      ids.push(id);
      await d.insert(db.users).values({
        id,
        name: `C${i}`,
        email: `${id}@example.org`,
        emailVerified: true,
        createdAt: joinedAt,
        updatedAt: joinedAt,
      });
      await d.insert(db.profiles).values({ userId: id, country: 'KE', onboardedAt: joinedAt });
      await d
        .insert(db.activityDays)
        .values({ userId: id, day: day(joinedAt.getTime()), platforms: 1 });
      if (i < 4)
        await d
          .insert(db.activityDays)
          .values({ userId: id, day: day(joinedAt.getTime() + 8 * 86_400_000), platforms: 1 });
      if (i < 2)
        await d
          .insert(db.activityDays)
          .values({ userId: id, day: day(joinedAt.getTime() + 15 * 86_400_000), platforms: 2 });
    }
    const view = await analytics.analyticsView(d, { range: '30d' });
    const cohort = view.cohorts.find((c) => c.week === day(monday - 3 * 7 * 86_400_000));
    expect(cohort?.size).toBe(6);
    expect(cohort?.returned[0]).toBeCloseTo(4 / 6);
    expect(cohort?.returned[1]).toBeCloseTo(2 / 6);
    // This week has not finished: no share for it yet.
    expect(cohort?.returned[3]).toBeNull();
    expect(view.funnel.find((f) => f.id === 'joined')?.n).toBeGreaterThanOrEqual(6);
    expect(view.funnel.find((f) => f.id === 'setUp')?.n).toBeGreaterThanOrEqual(6);
    expect(view.countries.find((c) => c.id === 'KE')?.n).toBe(6);
    expect(view.platforms.find((p) => p.id === 'web')?.n).toBeGreaterThanOrEqual(6);
  });

  it('never shows a group smaller than five people', async () => {
    const d = db.getDb();
    for (let i = 0; i < 2; i++) {
      const id = `few-${i}-${crypto.randomUUID().slice(0, 6)}`;
      await d.insert(db.users).values({ id, name: 'F', email: `${id}@example.org` });
      await d.insert(db.profiles).values({ userId: id, country: 'IS', locale: 'fr' });
      await d
        .insert(db.activityDays)
        .values({ userId: id, day: new Date().toISOString().slice(0, 10), platforms: 1 });
    }
    const view = await analytics.analyticsView(d, { range: '7d' });
    expect(view.countries.some((c) => c.id === 'IS')).toBe(false);
    // Narrowed to that country, there is nothing to show at all.
    const narrowed = await analytics.analyticsView(d, { range: '7d', country: 'IS' });
    expect(narrowed.tooFew).toBe(true);
    expect(narrowed.people.active).toBe(0);
  });

  it('are for the staff only', async () => {
    const member = await person('Max');
    const staff = await person('Noor', 'staff');
    expect((await req('/api/admin/analytics', { cookie: member.cookie })).status).toBe(403);
    const res = await req('/api/admin/analytics?range=7d&platform=web', { cookie: staff.cookie });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ range: { days: 7 }, tooFew: false });
    expect((await req('/api/admin/analytics')).status).toBe(401);
  });

  it('are forgotten after 400 days', async () => {
    const d = db.getDb();
    const pat = await person('Old');
    const old = new Date(Date.now() - 410 * 86_400_000).toISOString().slice(0, 10);
    await d.insert(db.activityDays).values({ userId: pat.id, day: old, platforms: 1 });
    await d.insert(db.usageViews).values({
      day: old,
      hour: 3,
      module: 'today',
      platform: 'web',
      audience: 'guest',
      n: 4,
    });
    const { jobs } = await import('../src');
    const result = await jobs.retention(d);
    expect(result.usage).toBeGreaterThanOrEqual(2);
    const left = await d.select().from(db.activityDays).where(db.eq(db.activityDays.day, old));
    expect(left).toHaveLength(0);
  });
});
