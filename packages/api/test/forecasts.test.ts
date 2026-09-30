/**
 * "What's next?": forecasts are published and judged by staff, shown with a chance in numbers
 * and words, their sources, what to do and the day they will be judged — and scored in public.
 * Nothing is ever invented: with nothing published, there is nothing to see.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'waypoint-forecasts-'));
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

async function account(name: string, role?: 'admin'): Promise<{ cookie: string; id: string }> {
  const email = `${name.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}@example.org`;
  const password = 'correct horse battery';
  await req('/api/auth/sign-up/email', { method: 'POST', json: { email, password, name } });
  const [user] = await db
    .getDb()
    .select({ id: db.users.id })
    .from(db.users)
    .where(db.eq(db.users.email, email));
  await db
    .getDb()
    .update(db.users)
    .set({ emailVerified: true, ...(role ? { role } : {}) })
    .where(db.eq(db.users.id, user!.id));
  const res = await req('/api/auth/sign-in/email', { method: 'POST', json: { email, password } });
  expect(res.status).toBe(200);
  return { cookie: cookieFrom(res), id: user!.id };
}

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

const forecast = (over: Record<string, unknown> = {}) => ({
  question: 'Will the central bank cut its main interest rate before the end of the year?',
  description: 'Loan and mortgage costs follow this rate within a few months.',
  whatToDo:
    'If you have a loan with a changing rate, ask your lender what a cut or a rise would do to your payment before you sign anything new.',
  resolutionCriteria:
    'Yes if the bank announces a lower main rate at any meeting on or before the date. Judged from the bank’s own announcements.',
  category: 'money',
  regions: ['ke'],
  probability: 0.62,
  baseRate: 0.3,
  rationale:
    'Inflation has fallen for four months and two of five committee members already voted for a cut.',
  sources: [{ name: 'Central Bank of Kenya', url: 'https://www.centralbank.go.ke/' }],
  resolvesOn: inDays(60),
  ...over,
});

type View = {
  id: string;
  question: string;
  language: string;
  translated: boolean;
  probability: number;
  words: string;
  baseRate: number | null;
  sources: Array<{ name: string; url: string }>;
  whatToDo: string;
  resolutionCriteria: string;
  resolvesAt: string;
  state: string;
  outcome: string | null;
  score: number | null;
  history: Array<{ probability: number }>;
  reasons: string[];
  isDemo: boolean;
  resolutionNote: string | null;
};
type List = { open: View[]; awaiting: View[]; judged: View[] };
type Record_ = {
  open: number;
  awaiting: number;
  judged: number;
  annulled: number;
  happened: number;
  brier: number | null;
  reference: number | null;
  calibration: Array<{ n: number; meanPredicted: number; observed: number }> | null;
  minForScore: number;
  minForCalibration: number;
};

const list = async (cookie?: string, locale?: string) =>
  (await (
    await req(`/api/forecasts${locale ? `?locale=${locale}` : ''}`, { cookie })
  ).json()) as List;
const record = async () => (await (await req('/api/forecasts/record')).json()) as Record_;

let staff: { cookie: string; id: string };

describe('before anything is published', () => {
  it('shows nothing, and claims no record', async () => {
    expect(await list()).toEqual({ open: [], awaiting: [], judged: [] });
    expect(await record()).toMatchObject({
      open: 0,
      judged: 0,
      brier: null,
      reference: null,
      calibration: null,
    });
  });

  it('never counts example data as real', async () => {
    const { seedDemo } = await import('@waypoint/db/seed');
    const demo = await seedDemo(db.getDb());
    expect(demo.forecasts).toBeGreaterThan(0);
    // The record is for real forecasts only, however many examples were loaded.
    expect(await record()).toMatchObject({ judged: 0, open: 0, brier: null });
    // Outside production the examples are listed, each one labelled.
    const shown = await list();
    const all = [...shown.open, ...shown.awaiting, ...shown.judged];
    expect(all.length).toBeGreaterThan(0);
    for (const f of all) expect(f.isDemo).toBe(true);
    // Staff never see them among the forecasts they manage.
    staff = await account('Editor', 'admin');
    for (const state of ['open', 'awaiting', 'resolved', 'annulled']) {
      const managed = (await (
        await req(`/api/admin/forecasts?state=${state}`, { cookie: staff.cookie })
      ).json()) as { items: View[] };
      expect(managed.items).toEqual([]);
    }
    await db.getDb().delete(db.forecasts).where(db.eq(db.forecasts.isDemo, true));
  });
});

describe('publishing', () => {
  it('is for staff only', async () => {
    const someone = await account('Visitor');
    for (const cookie of [undefined, someone.cookie]) {
      const res = await req('/api/admin/forecasts', { method: 'POST', cookie, json: forecast() });
      expect(res.status).toBe(cookie ? 403 : 401);
      expect((await req('/api/admin/forecasts', { cookie })).status).toBe(cookie ? 403 : 401);
    }
    expect((await list()).open).toEqual([]);
  });

  it('needs a question, a source, a date ahead and a chance that is never certain', async () => {
    const refused = async (over: Record<string, unknown>) =>
      (
        await req('/api/admin/forecasts', {
          method: 'POST',
          cookie: staff.cookie,
          json: forecast(over),
        })
      ).status;
    expect(await refused({ probability: 1 })).toBe(422);
    expect(await refused({ probability: 0 })).toBe(422);
    expect(await refused({ probability: 0.999 })).toBe(422);
    expect(await refused({ sources: [] })).toBe(422);
    expect(await refused({ sources: [{ name: 'A site', url: 'javascript:alert(1)' }] })).toBe(422);
    expect(await refused({ sources: [{ name: 'A site', url: 'http://plain.example/' }] })).toBe(
      422,
    );
    expect(await refused({ question: 'Rates will fall this year.' })).toBe(422);
    expect(await refused({ whatToDo: '' })).toBe(422);
    expect(await refused({ resolutionCriteria: 'Soon.' })).toBe(422);
    expect(await refused({ resolvesOn: inDays(-1) })).toBe(422);
    expect(await refused({ resolvesOn: inDays(5 * 366) })).toBe(422);
    expect(await refused({ category: 'astrology' })).toBe(422);
    expect((await list()).open).toEqual([]);
  });

  it('shows the chance in numbers and words, its sources, what to do and the day it is judged', async () => {
    const created = await req('/api/admin/forecasts', {
      method: 'POST',
      cookie: staff.cookie,
      json: forecast({
        translations: {
          sw: {
            question: 'Je, benki kuu itapunguza riba yake kuu kabla ya mwisho wa mwaka?',
            whatToDo:
              'Ikiwa una mkopo wenye riba inayobadilika, muulize mkopeshaji wako malipo yako yatabadilikaje.',
            resolutionCriteria:
              'Ndiyo ikiwa benki itatangaza riba kuu ya chini katika mkutano wowote kabla ya tarehe hiyo.',
          },
        },
      }),
    });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };

    const [shown] = (await list()).open;
    expect(shown).toMatchObject({
      id,
      probability: 0.62,
      words: 'about-even',
      baseRate: 0.3,
      state: 'open',
      outcome: null,
      score: null,
      language: 'en',
      translated: false,
      isDemo: false,
    });
    expect(shown?.sources).toEqual([
      { name: 'Central Bank of Kenya', url: 'https://www.centralbank.go.ke/' },
    ]);
    expect(shown?.whatToDo).toContain('ask your lender');
    expect(shown?.resolutionCriteria).toContain('Judged from');
    expect(shown?.resolvesAt.slice(0, 10)).toBe(inDays(60));
    expect(shown?.history).toHaveLength(1);

    // In Swahili, the words staff wrote in Swahili; in French, the original, named as English.
    const [sw] = (await list(undefined, 'sw')).open;
    expect(sw).toMatchObject({ language: 'sw', translated: true });
    expect(sw?.question).toContain('benki kuu');
    const [fr] = (await list(undefined, 'fr')).open;
    expect(fr).toMatchObject({ language: 'en', translated: false });

    // For someone in Kenya it says why it is shown; for someone elsewhere it does not.
    const kenyan = await account('Wanjiru');
    await req('/api/me/profile', {
      method: 'PATCH',
      cookie: kenyan.cookie,
      json: { country: 'KE' },
    });
    expect((await list(kenyan.cookie)).open[0]?.reasons).toEqual(['country']);
    expect((await list()).open[0]?.reasons).toEqual([]);

    // Publishing is on the record of who did what.
    const log = (await (await req('/api/admin/audit', { cookie: staff.cookie })).json()) as {
      items: Array<{ action: string }>;
    };
    expect(log.items.map((e) => e.action)).toContain('forecast.published');
  });
});

describe('changing and judging', () => {
  const publish = async (over: Record<string, unknown> = {}) =>
    (
      (await (
        await req('/api/admin/forecasts', {
          method: 'POST',
          cookie: staff.cookie,
          json: forecast(over),
        })
      ).json()) as { id: string }
    ).id;
  const judge = (id: string, json: Record<string, unknown>, cookie = staff.cookie) =>
    req(`/api/admin/forecasts/${id}/judge`, { method: 'POST', cookie, json });
  const find = async (id: string) => {
    const all = await list();
    return [...all.open, ...all.awaiting, ...all.judged].find((f) => f.id === id);
  };

  it('keeps every chance that was shown, and fixes the question once published', async () => {
    const id = await publish({
      question: 'Will fuel cost more at the pump next quarter than this one?',
    });
    const changed = await req(`/api/admin/forecasts/${id}/chance`, {
      method: 'POST',
      cookie: staff.cookie,
      json: {
        probability: 0.7,
        rationale: 'The government confirmed the levy will rise in March.',
      },
    });
    expect(changed.status).toBe(200);
    const f = await find(id);
    expect(f?.probability).toBe(0.7);
    expect(f?.words).toBe('likely');
    expect(f?.history.map((h) => h.probability)).toEqual([0.62, 0.7]);
    // Certainty is refused here too.
    expect(
      (
        await req(`/api/admin/forecasts/${id}/chance`, {
          method: 'POST',
          cookie: staff.cookie,
          json: { probability: 1, rationale: 'It has been announced officially.' },
        })
      ).status,
    ).toBe(422);
    // The advice and sources may change; the question and the date may not.
    const edited = await req(`/api/admin/forecasts/${id}`, {
      method: 'PATCH',
      cookie: staff.cookie,
      json: {
        whatToDo: 'Fill up before the end of the month if you drive for a living.',
        question: 'Will fuel be free next quarter?',
        resolvesOn: inDays(1),
      },
    });
    expect(edited.status).toBe(200);
    const after = await find(id);
    expect(after?.whatToDo).toContain('Fill up');
    expect(after?.question).toBe('Will fuel cost more at the pump next quarter than this one?');
    expect(after?.resolvesAt.slice(0, 10)).toBe(inDays(60));
  });

  it('judges once, with a source anyone can check, and scores it', async () => {
    const id = await publish({ probability: 0.8 });
    expect(
      (await judge(id, { outcome: 'yes', note: 'The bank cut the rate on 4 June.' })).status,
    ).toBe(422);
    const done = await judge(id, {
      outcome: 'yes',
      note: 'The bank cut the rate by a quarter point on 4 June.',
      sourceUrl: 'https://www.centralbank.go.ke/press/',
    });
    expect(done.status).toBe(200);
    const f = await find(id);
    expect(f).toMatchObject({ state: 'resolved', outcome: 'yes' });
    expect(f?.score).toBeCloseTo(0.04);
    expect(f?.resolutionNote).toContain('quarter point');
    // Judged is judged: no second verdict, no new chance, no edits.
    expect(
      (
        await judge(id, {
          outcome: 'no',
          note: 'Changed our mind.',
          sourceUrl: 'https://x.example/',
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await req(`/api/admin/forecasts/${id}/chance`, {
          method: 'POST',
          cookie: staff.cookie,
          json: { probability: 0.99, rationale: 'It already happened, as everyone knows.' },
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await req(`/api/admin/forecasts/${id}`, {
          method: 'PATCH',
          cookie: staff.cookie,
          json: { whatToDo: 'Pretend we always said this would happen.' },
        })
      ).status,
    ).toBe(409);
    const log = (await (await req('/api/admin/audit', { cookie: staff.cookie })).json()) as {
      items: Array<{ action: string }>;
    };
    const actions = log.items.map((e) => e.action);
    expect(actions).toContain('forecast.resolved');
    expect(actions).toContain('forecast.chance-updated');
    expect(actions).toContain('forecast.edited');
  });

  it('waits to be judged once its date has passed, and can be withdrawn without being scored', async () => {
    const id = await publish({
      question: 'Will the new bus line open before the summer holidays?',
    });
    await db
      .getDb()
      .update(db.forecasts)
      .set({
        resolvesAt: new Date(Date.now() - 86_400_000),
        closesAt: new Date(Date.now() - 86_400_000),
      })
      .where(db.eq(db.forecasts.id, id));
    expect((await find(id))?.state).toBe('awaiting');
    // Its chance can no longer be changed: that would be hindsight.
    expect(
      (
        await req(`/api/admin/forecasts/${id}/chance`, {
          method: 'POST',
          cookie: staff.cookie,
          json: { probability: 0.9, rationale: 'We now know how it went, more or less.' },
        })
      ).status,
    ).toBe(409);
    const counts = (await (
      await req('/api/admin/forecasts?state=awaiting', { cookie: staff.cookie })
    ).json()) as { counts: Record<string, number>; items: View[] };
    expect(counts.counts.awaiting).toBe(1);
    expect(counts.items.map((f) => f.id)).toEqual([id]);
    const before = await record();
    expect(
      (await judge(id, { outcome: 'annulled', note: 'The city cancelled the line altogether.' }))
        .status,
    ).toBe(200);
    const f = await find(id);
    expect(f).toMatchObject({ state: 'annulled', outcome: null, score: null });
    const after = await record();
    expect(after.annulled).toBe(before.annulled + 1);
    expect(after.judged).toBe(before.judged);
  });
});

describe('the public record', () => {
  /** Judged forecasts straight into the database, as if published and judged over months. */
  async function history(n: number, probability: number, happened: number) {
    for (let i = 0; i < n; i++) {
      const opensAt = new Date(Date.now() - 120 * 86_400_000);
      const resolvesAt = new Date(Date.now() - 20 * 86_400_000);
      const [row] = await db
        .getDb()
        .insert(db.forecasts)
        .values({
          question: `Will thing ${crypto.randomUUID().slice(0, 6)} happen?`,
          description: '',
          resolutionCriteria: 'Judged from the official announcement.',
          whatToDo: 'Nothing to do in a test.',
          sources: [{ name: 'Source', url: 'https://example.org/' }],
          category: 'other',
          opensAt,
          closesAt: resolvesAt,
          resolvesAt,
          status: 'resolved',
          outcome: i < happened ? 1 : 0,
          resolvedAt: resolvesAt,
          resolutionNote: 'Checked.',
          resolutionSourceUrl: 'https://example.org/result',
        })
        .returning({ id: db.forecasts.id });
      await db.getDb().insert(db.forecastPredictions).values({
        forecastId: row!.id,
        predictor: 'waypoint',
        probability,
        createdAt: opensAt,
      });
    }
  }

  it('gives no score while only a few have been judged', async () => {
    const early = await record();
    expect(early.judged).toBeGreaterThan(0);
    expect(early.judged).toBeLessThan(early.minForScore);
    expect(early.brier).toBeNull();
    expect(early.calibration).toBeNull();
  });

  it('gives the score with its size once there are enough, and calibration later still', async () => {
    const start = await record();
    await history(12, 0.8, 10);
    const scored = await record();
    expect(scored.judged).toBe(start.judged + 12);
    expect(scored.brier).not.toBeNull();
    expect(scored.brier as number).toBeGreaterThan(0);
    expect(scored.brier as number).toBeLessThan(0.25);
    expect(scored.reference).not.toBeNull();
    expect(scored.calibration).toBeNull();

    await history(20, 0.2, 4);
    const full = await record();
    expect(full.judged).toBeGreaterThanOrEqual(full.minForCalibration);
    expect(full.calibration).not.toBeNull();
    const bands = full.calibration ?? [];
    expect(bands.length).toBeGreaterThanOrEqual(2);
    for (const b of bands) expect(b.n).toBeGreaterThanOrEqual(5);
    const low = bands.find((b) => b.meanPredicted < 0.3);
    expect(low?.observed).toBeCloseTo(0.2);
    expect(full.happened).toBeGreaterThan(0);
    // Readable by anyone, without an account, and safe for a shared cache.
    const res = await req('/api/forecasts/record');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toMatch(/^public/);
  });
});
