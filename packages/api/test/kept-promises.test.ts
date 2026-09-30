/**
 * Things Waypoint says it does, checked end to end through the API: a plan step never leads
 * to a page that is not there, goals and weekly reviews are screened for signs of danger
 * like the journal, and what the assistant was asked to remember can be seen and deleted by
 * its owner, and by nobody else.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'waypoint-promises-'));
process.env.WAYPOINT_DATA_DIR = dir;
process.env.WAYPOINT_URL = 'http://localhost:3000';
process.env.LOG_LEVEL = 'silent';
for (const k of [
  'DATABASE_URL',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'OLLAMA_BASE_URL',
])
  delete process.env[k];

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

/** A new guest who has answered the first questions (Kenya, English unless said otherwise). */
async function person(
  profile: Record<string, unknown> = {},
  consents: Record<string, boolean> = {},
): Promise<{ cookie: string; id: string }> {
  const signIn = await req('/api/auth/sign-in/anonymous', { method: 'POST', json: {} });
  expect(signIn.status).toBe(200);
  const cookie = signIn.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const res = await req('/api/me/onboarding', {
    method: 'POST',
    cookie,
    json: {
      profile: {
        displayName: 'Wanjiru',
        locale: 'en',
        country: 'KE',
        timezone: 'Africa/Nairobi',
        situation: 'lost-job',
        hoursPerWeek: 6,
        interests: ['data'],
        ...profile,
      },
      consents,
      skills: [{ skillId: 'spreadsheets', level: 3 }],
    },
  });
  expect(res.status).toBe(200);
  const me = (await res.json()) as { user: { id: string } };
  return { cookie, id: me.user.id };
}

const crisisEventsOf = (userId: string) =>
  db.getDb().select().from(db.crisisEvents).where(db.eq(db.crisisEvents.userId, userId));

describe('plans', () => {
  it('a plan saved with the old proof links opens pages that exist', async () => {
    const me = await person();
    const overview = (await (await req('/api/path', { cookie: me.cookie })).json()) as {
      suggestions: Array<{ roleId: string }>;
    };
    const created = await req('/api/path/plans', {
      method: 'POST',
      cookie: me.cookie,
      json: { roleId: overview.suggestions[0]!.roleId, hoursPerWeek: 6, horizonWeeks: 4 },
    });
    expect(created.status).toBe(201);
    type Plan = {
      id: string;
      weeks: Array<{ steps: Array<{ id: string; kind: string; href: string | null }> }>;
    };
    const plan = (await created.json()) as Plan;
    // A new plan never carries them.
    const hrefs = (p: Plan) => p.weeks.flatMap((w) => w.steps.map((s) => s.href));
    expect(hrefs(plan)).not.toContain('/path/projects/new');
    expect(hrefs(plan)).not.toContain('/path/proof');

    // A plan made before the fix: its steps were stored with the two addresses.
    const first = plan.weeks[0]!.steps[0]!;
    const second = plan.weeks[0]!.steps[1]!;
    const d = db.getDb();
    await d
      .update(db.planSteps)
      .set({ href: '/path/projects/new' })
      .where(db.eq(db.planSteps.id, first.id));
    await d
      .update(db.planSteps)
      .set({ href: '/path/proof' })
      .where(db.eq(db.planSteps.id, second.id));

    const again = (await (
      await req(`/api/path/plans/${plan.id}`, { cookie: me.cookie })
    ).json()) as Plan;
    const steps = again.weeks.flatMap((w) => w.steps);
    expect(steps.find((s) => s.id === first.id)?.href).toBeNull();
    expect(steps.find((s) => s.id === second.id)?.href).toBe('/circles');

    // Today's one bold button leads to the step on the plan, not to "not found".
    const today = (await (await req('/api/today', { cookie: me.cookie })).json()) as {
      nextStep: { kind: string; href: string; stepId: string };
    };
    expect(today.nextStep).toMatchObject({ kind: 'plan-step', stepId: first.id });
    expect(today.nextStep.href).toBe(`/path/plans/${plan.id}#step-${first.id}`);
  });
});

describe('goals and the weekly review', () => {
  it('screens a goal’s words for signs of danger, like the journal', async () => {
    const me = await person();
    const calm = await req('/api/goals', {
      method: 'POST',
      cookie: me.cookie,
      json: { title: 'Finish the SQL course', why: 'To apply for analyst jobs', area: 'path' },
    });
    expect(calm.status).toBe(201);
    const calmBody = (await calm.json()) as {
      id: string;
      title: string;
      screening: { tier: number; plan: unknown };
    };
    expect(calmBody.title).toBe('Finish the SQL course');
    expect(calmBody.screening).toEqual({ tier: 0, plan: null });
    expect(await crisisEventsOf(me.id)).toHaveLength(0);

    const dark = await req('/api/goals', {
      method: 'POST',
      cookie: me.cookie,
      json: {
        title: 'Get through this month',
        why: 'Everyone would be better off without me, I want to end my life',
      },
    });
    expect(dark.status).toBe(201);
    const darkBody = (await dark.json()) as {
      id: string;
      why: string;
      screening: {
        tier: number;
        plan: { headline: string; actions: Array<{ kind: string; href?: string }> } | null;
      };
    };
    // The goal is still saved: the person is never refused.
    expect(darkBody.why).toContain('better off');
    expect(darkBody.screening.tier).toBeGreaterThanOrEqual(2);
    expect(darkBody.screening.plan?.headline).toBeTruthy();
    // Kenya's numbers, from the country they chose.
    expect(darkBody.screening.plan?.actions.some((a) => a.href?.startsWith('tel:'))).toBe(true);
    const events = await crisisEventsOf(me.id);
    expect(events).toHaveLength(1);
    expect(events[0]!.tier).toBeGreaterThanOrEqual(2);
    // A gentle check-in is scheduled, and the words are nowhere in the record.
    expect(events[0]!.followUpAt).toBeTruthy();
    expect(JSON.stringify(events)).not.toContain('better off');
    expect(JSON.stringify(events)).not.toContain('end my life');

    // Changing the words screens them again; moving the progress marker does not.
    const moved = await req(`/api/goals/${calmBody.id}`, {
      method: 'PATCH',
      cookie: me.cookie,
      json: { progress: 40 },
    });
    expect(((await moved.json()) as { screening: unknown }).screening).toEqual({
      tier: 0,
      plan: null,
    });
    expect(await crisisEventsOf(me.id)).toHaveLength(1);
    const reworded = await req(`/api/goals/${calmBody.id}`, {
      method: 'PATCH',
      cookie: me.cookie,
      json: { why: 'I have decided to kill myself after the exam' },
    });
    expect(reworded.status).toBe(200);
    const rewordedBody = (await reworded.json()) as {
      progress: number;
      screening: { tier: number; plan: unknown };
    };
    expect(rewordedBody.progress).toBe(40);
    expect(rewordedBody.screening.tier).toBeGreaterThanOrEqual(2);
    expect(rewordedBody.screening.plan).toBeTruthy();
    expect(await crisisEventsOf(me.id)).toHaveLength(2);
  });

  it('screens the weekly review, in the person’s own language', async () => {
    const me = await person({ locale: 'es', country: 'MX', timezone: 'America/Mexico_City' });
    const calm = await req('/api/goals/review', {
      method: 'PUT',
      cookie: me.cookie,
      json: {
        wentWell: 'Terminé dos lecciones',
        nextChange: 'Estudiar antes del trabajo',
        mood: 4,
      },
    });
    expect(calm.status).toBe(200);
    const calmBody = (await calm.json()) as { wentWell: string; screening: unknown };
    expect(calmBody.wentWell).toBe('Terminé dos lecciones');
    expect(calmBody.screening).toEqual({ tier: 0, plan: null });
    expect(await crisisEventsOf(me.id)).toHaveLength(0);

    // The danger is in the second answer: every answer is read, not only the first.
    const dark = await req('/api/goals/review', {
      method: 'PUT',
      cookie: me.cookie,
      json: { wentWell: 'Nada', gotInTheWay: 'Quiero suicidarme', mood: 1 },
    });
    expect(dark.status).toBe(200);
    const darkBody = (await dark.json()) as {
      gotInTheWay: string;
      screening: { tier: number; plan: { locale: string; headline: string } | null };
    };
    expect(darkBody.gotInTheWay).toBe('Quiero suicidarme');
    expect(darkBody.screening.tier).toBeGreaterThanOrEqual(2);
    expect(darkBody.screening.plan?.locale).toBe('es');
    const events = await crisisEventsOf(me.id);
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain('suicidarme');

    // Still one review for the week, sealed.
    const reviews = await db
      .getDb()
      .select()
      .from(db.weeklyReviews)
      .where(db.eq(db.weeklyReviews.userId, me.id));
    expect(reviews).toHaveLength(1);
    expect(JSON.stringify(reviews)).not.toContain('suicidarme');
  });
});

describe('trusted contacts on the support card', () => {
  const DARK = { title: 'Get through today', why: 'I want to end my life' };
  type Saved = { screening: { plan: { actions: Array<{ kind: string }> } | null } };
  const kinds = async (res: Response) =>
    ((await res.json()) as Saved).screening.plan?.actions.map((a) => a.kind) ?? [];

  it('offers them only to someone who chose that and saved a contact', async () => {
    // A contact saved, but the choice is off: the card does not mention them.
    const quiet = await person();
    const added = await req('/api/me/trusted-contacts', {
      method: 'POST',
      cookie: quiet.cookie,
      json: { name: 'Asha', phone: '+254 700 000 001', relation: 'sister' },
    });
    expect(added.status).toBe(201);
    expect(
      await kinds(await req('/api/goals', { method: 'POST', cookie: quiet.cookie, json: DARK })),
    ).not.toContain('trusted-contact');

    // The choice is on, but nobody saved: nothing to offer.
    const alone = await person({}, { trusted_contact: true });
    expect(
      await kinds(await req('/api/goals', { method: 'POST', cookie: alone.cookie, json: DARK })),
    ).not.toContain('trusted-contact');

    // Both: wherever writing is screened (here a goal, the same for the journal and health
    // notes), the card offers the person's own contacts.
    const ready = await person({}, { trusted_contact: true });
    await req('/api/me/trusted-contacts', {
      method: 'POST',
      cookie: ready.cookie,
      json: { name: 'Baraka', email: 'baraka@example.org' },
    });
    expect(
      await kinds(await req('/api/goals', { method: 'POST', cookie: ready.cookie, json: DARK })),
    ).toContain('trusted-contact');
    const entry = await req('/api/mind/journal', {
      method: 'POST',
      cookie: ready.cookie,
      json: { promptId: 'free', body: 'I want to end my life' },
    });
    expect(await kinds(entry)).toContain('trusted-contact');

    // Their details are decrypted for their owner only, and sealed at rest.
    const mine = (await (
      await req('/api/me/trusted-contacts', { cookie: ready.cookie })
    ).json()) as Array<{ name: string; email: string | null }>;
    expect(mine).toEqual([
      expect.objectContaining({ name: 'Baraka', email: 'baraka@example.org' }),
    ]);
    const theirs = (await (
      await req('/api/me/trusted-contacts', { cookie: alone.cookie })
    ).json()) as unknown[];
    expect(theirs).toEqual([]);
    const rows = await db.getDb().select().from(db.trustedContacts);
    expect(JSON.stringify(rows)).not.toContain('Baraka');
    expect(JSON.stringify(rows)).not.toContain('700 000 001');
  });
});

describe('what Waypoint remembers', () => {
  /** A memory saved the way the assistant saves one after approval: sealed with the owner's key. */
  async function remember(userId: string, content: string, when: string): Promise<string> {
    const { sealFor, SEALED } = await import('@waypoint/core/privacy');
    const { newId } = await import('@waypoint/core/ids');
    const id = newId();
    const dek = await db.dataKeyFor(db.getDb(), userId);
    await db
      .getDb()
      .insert(db.memories)
      .values({
        id,
        userId,
        kind: 'fact',
        contentCt: sealFor(dek, content, SEALED.memory, userId, id),
        createdAt: new Date(when),
      });
    return id;
  }
  type Memory = { id: string; kind: string; content: string | null; createdAt: string };
  const list = async (cookie: string) =>
    (await (await req('/api/me/memories', { cookie })).json()) as Memory[];

  it('needs a session', async () => {
    expect((await req('/api/me/memories')).status).toBe(401);
    expect((await req('/api/me/memories', { method: 'DELETE' })).status).toBe(401);
  });

  it('shows the owner what was remembered and when, newest first', async () => {
    const me = await person({}, { memory: true });
    expect(await list(me.cookie)).toEqual([]);
    const older = await remember(me.id, 'I study best before work', '2026-09-01T08:00:00Z');
    const newer = await remember(me.id, 'My sister Asha is helping me', '2026-09-20T08:00:00Z');
    // One saved before memories were sealed: still shown, so it can be deleted.
    const [plain] = await db
      .getDb()
      .insert(db.memories)
      .values({
        userId: me.id,
        kind: 'preference',
        content: 'Prefers short answers',
        createdAt: new Date('2026-08-01T08:00:00Z'),
      })
      .returning({ id: db.memories.id });

    const mine = await list(me.cookie);
    expect(mine.map((m) => m.id)).toEqual([newer, older, plain!.id]);
    expect(mine[0]).toEqual({
      id: newer,
      kind: 'fact',
      content: 'My sister Asha is helping me',
      createdAt: '2026-09-20T08:00:00.000Z',
    });
    expect(mine[2]!.content).toBe('Prefers short answers');
    // Sealed at rest.
    const rows = await db.getDb().select().from(db.memories).where(db.eq(db.memories.id, newer));
    expect(JSON.stringify(rows)).not.toContain('Asha');
  });

  it('never lets anyone read or delete another person’s memories', async () => {
    const me = await person({}, { memory: true });
    const stranger = await person({}, { memory: true });
    const mine = await remember(me.id, 'I am saving for a bicycle', '2026-09-10T08:00:00Z');
    const theirs = await remember(stranger.id, 'I live in Kisumu', '2026-09-11T08:00:00Z');

    // Read: a stranger's list holds only their own.
    expect((await list(stranger.cookie)).map((m) => m.id)).toEqual([theirs]);
    expect(JSON.stringify(await list(stranger.cookie))).not.toContain('bicycle');

    // Delete by id: "not found", exactly as for an id that never existed, and nothing is lost.
    const tried = await req(`/api/me/memories/${mine}`, {
      method: 'DELETE',
      cookie: stranger.cookie,
    });
    expect(tried.status).toBe(404);
    const missing = await req('/api/me/memories/0190a3c2-1111-7000-8000-000000000000', {
      method: 'DELETE',
      cookie: stranger.cookie,
    });
    expect(missing.status).toBe(404);
    // (Every answer carries its own request id; everything else is the same.)
    const said = async (res: Response) => ({ ...(await res.json()), requestId: null });
    expect(await said(tried)).toEqual(await said(missing));
    expect((await list(me.cookie)).map((m) => m.id)).toEqual([mine]);

    // "Forget everything" for one person touches nobody else.
    const all = await req('/api/me/memories', { method: 'DELETE', cookie: stranger.cookie });
    expect(all.status).toBe(200);
    expect(await all.json()).toEqual({ ok: true, deleted: 1 });
    expect(await list(stranger.cookie)).toEqual([]);
    expect((await list(me.cookie)).map((m) => m.id)).toEqual([mine]);

    // The owner deletes their own, once.
    const gone = await req(`/api/me/memories/${mine}`, { method: 'DELETE', cookie: me.cookie });
    expect(gone.status).toBe(200);
    expect(await list(me.cookie)).toEqual([]);
    const again = await req(`/api/me/memories/${mine}`, { method: 'DELETE', cookie: me.cookie });
    expect(again.status).toBe(404);
    expect(await db.getDb().select().from(db.memories).where(db.eq(db.memories.id, mine))).toEqual(
      [],
    );
  });

  it('keeps memories when the choice is switched off, until the person deletes them', async () => {
    const me = await person({}, { memory: true });
    await remember(me.id, 'I am allergic to penicillin', '2026-09-12T08:00:00Z');
    await remember(me.id, 'I am learning SQL', '2026-09-13T08:00:00Z');

    const off = await req('/api/me/consents', {
      method: 'PUT',
      cookie: me.cookie,
      json: { memory: false },
    });
    expect(((await off.json()) as { memory: boolean }).memory).toBe(false);
    // Switching off stops Waypoint using and saving them. It deletes nothing: they are still
    // listed, still in the export, and still the person's to delete.
    expect((await list(me.cookie)).map((m) => m.content)).toEqual([
      'I am learning SQL',
      'I am allergic to penicillin',
    ]);
    const exported = (await (await req('/api/me/export', { cookie: me.cookie })).json()) as {
      memories: Array<{ content: string }>;
    };
    expect(exported.memories.map((m) => m.content).sort()).toEqual([
      'I am allergic to penicillin',
      'I am learning SQL',
    ]);

    const all = await req('/api/me/memories', { method: 'DELETE', cookie: me.cookie });
    expect(await all.json()).toEqual({ ok: true, deleted: 2 });
    expect(await list(me.cookie)).toEqual([]);
    const after = (await (await req('/api/me/export', { cookie: me.cookie })).json()) as {
      memories: unknown[];
    };
    expect(after.memories).toEqual([]);
  });
});

describe('a choice that is no longer offered', () => {
  it('keeps an answer given before, in the account and in the export', async () => {
    // "Include me in public trend reports" is hidden until a report exists; the purpose and
    // what people already answered stay.
    const me = await person();
    const set = await req('/api/me/consents', {
      method: 'PUT',
      cookie: me.cookie,
      json: { research_aggregates: true },
    });
    expect(set.status).toBe(200);
    expect(((await set.json()) as Record<string, boolean>).research_aggregates).toBe(true);
    const exported = (await (await req('/api/me/export', { cookie: me.cookie })).json()) as {
      consents: Record<string, boolean>;
      consentHistory: Array<{ purpose: string; granted: boolean }>;
    };
    expect(exported.consents.research_aggregates).toBe(true);
    expect(exported.consentHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ purpose: 'research_aggregates', granted: true }),
      ]),
    );
  });
});
