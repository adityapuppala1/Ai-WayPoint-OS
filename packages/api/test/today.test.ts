/**
 * Today's one next step comes from every module — a checklist, a reminder, money, the plan,
 * the weekly review — by a fixed ladder, in the person's language, and "not now" moves on
 * for the rest of the day without changing anything else.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'waypoint-today-'));
const ORIGIN = 'http://localhost:3000';
Object.assign(process.env, { WAYPOINT_DATA_DIR: dir, WAYPOINT_URL: ORIGIN, LOG_LEVEL: 'silent' });
for (const k of [
  'DATABASE_URL',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'OLLAMA_BASE_URL',
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

interface Step {
  kind: string;
  rung: string;
  module: string;
  title: string;
  detail: string | null;
  href: string;
  minutes: number | null;
  why: string | null;
  from: string | null;
  titleLang: string | null;
  key: string;
  canDefer: boolean;
  done:
    | { type: 'plan-step'; planId: string; stepId: string }
    | { type: 'checklist-item'; event: string; itemId: string }
    | { type: 'note'; noteId: string }
    | null;
}
interface View {
  day: string;
  nextStep: Step;
  goals: { active: number; reviewedThisWeek: boolean };
  nudges: Array<{ id: string; title: string }>;
  hasSaved: boolean;
}

/** A guest, optionally through getting started with a situation. */
async function person(situation?: string, extra: Record<string, unknown> = {}): Promise<string> {
  const res = await req('/api/auth/sign-in/anonymous', { method: 'POST', json: {} });
  expect(res.status).toBe(200);
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  if (situation !== undefined) {
    const done = await req('/api/me/onboarding', {
      method: 'POST',
      cookie,
      json: {
        profile: {
          locale: 'en',
          country: 'KE',
          timezone: 'Africa/Nairobi',
          ...(situation ? { situation } : {}),
          ...extra,
        },
        consents: {},
        skills: [],
      },
    });
    expect(done.status).toBe(200);
  }
  return cookie;
}

const today = async (cookie: string, more = ''): Promise<View> => {
  const res = await req('/api/today', { cookie: more ? `${cookie}; ${more}` : cookie });
  expect(res.status).toBe(200);
  return (await res.json()) as View;
};

/** Says "not now" the way the website does: the day and the keys set aside, in a cookie. */
const notNow = (view: View, ...keys: string[]) => `wp-not-now=${view.day}:${keys.join('.')}`;

const userId = async (cookie: string) =>
  ((await (await req('/api/me', { cookie })).json()) as { user: { id: string } }).user.id;

describe('Today’s next step', () => {
  it('before getting started: tell Waypoint where you are, with something behind it', async () => {
    const view = await today(await person());
    expect(view.nextStep).toMatchObject({
      kind: 'onboard',
      rung: 'start',
      href: '/start',
      title: 'Tell Waypoint where you are',
      why: 'So the steps Waypoint suggests fit where you are.',
      canDefer: true,
      done: null,
    });
    expect(view.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('someone who lost their job sees the first thing on their checklist, not a career form', async () => {
    const cookie = await person('lost-job');
    const view = await today(cookie);
    expect(view.nextStep).toMatchObject({
      kind: 'checklist',
      rung: 'deadline',
      module: 'civic',
      href: '/civic/job-loss',
      title: 'Get the decision and your final pay details in writing',
      from: 'If you have lost your job',
      why: 'It is on the checklist for your situation, under “Do now”.',
      canDefer: true,
      done: { type: 'checklist-item', event: 'job-loss', itemId: expect.any(String) },
      // In English the guidance needs no language mark.
      titleLang: null,
    });
    expect(view.nextStep.detail).toBeTruthy();
    // The key is what "not now" remembers; it gives nothing away.
    expect(view.nextStep.key).toMatch(/^[\w-]{16}$/);
  });

  it('a “not now” key holds for one person only, and no list of steps turns it back', async () => {
    const a = await person('lost-job');
    const b = await person('lost-job');
    const mine = await today(a);
    const theirs = await today(b);
    expect(theirs.nextStep.title).toBe(mine.nextStep.title);
    expect(theirs.nextStep.key).not.toBe(mine.nextStep.key);
    // On a shared phone, what one person set aside today does not hide the next person's step.
    expect((await today(b, notNow(mine, mine.nextStep.key))).nextStep.title).toBe(
      mine.nextStep.title,
    );

    // The key is not a plain hash of the step: hashing every step there is for this situation
    // (the ladder is public) finds nothing that matches it.
    const done = mine.nextStep.done;
    if (done?.type !== 'checklist-item') throw new Error('expected a checklist item');
    const { rankNextSteps } = await import('@waypoint/core');
    const everyStep = rankNextSteps({
      onboarded: true,
      situation: 'lost-job',
      safetyNotes: [],
      dueReminders: [],
      checklist: { event: 'job-loss', open: [{ id: done.itemId, urgency: 'now' }] },
      money: { stress: 'critical' },
      plan: null,
      goals: { active: 1, reviewedThisWeek: false },
      checkedInToday: false,
    }).map((c) => c.key);
    expect(everyStep.length).toBeGreaterThan(4);
    expect(everyStep).not.toContain(mine.nextStep.key);
  });

  it('“not now” moves to the next step for the rest of the day, and only that day', async () => {
    const cookie = await person('lost-job');
    const first = await today(cookie);
    const second = await today(cookie, notNow(first, first.nextStep.key));
    expect(second.nextStep.kind).toBe('checklist');
    expect(second.nextStep.title).toBe('Check unemployment support straight away');

    // Yesterday's "not now" is forgotten: the first step is back.
    const stale = await today(cookie, `wp-not-now=2001-01-01:${first.nextStep.key}`);
    expect(stale.nextStep.title).toBe(first.nextStep.title);

    // Setting the checklist steps aside reaches the plan, then what is left to explore —
    // and the last step has nothing behind it, so it cannot be set aside.
    const seen: string[] = [];
    const keys: string[] = [];
    let view = first;
    for (let i = 0; i < 12 && view.nextStep.canDefer; i++) {
      seen.push(view.nextStep.kind);
      keys.push(view.nextStep.key);
      view = await today(cookie, notNow(first, ...keys));
    }
    seen.push(view.nextStep.kind);
    expect(seen).toEqual([
      'checklist',
      'checklist',
      'checklist',
      'make-plan',
      'check-in',
      'explore',
    ]);
    // Those steps are still waiting: the sign says they were set aside, not that there are none.
    expect(view.nextStep).toMatchObject({
      kind: 'explore',
      canDefer: false,
      why: 'You set the other steps aside for today.',
    });
  });

  it('says nothing else is waiting only when that is true', async () => {
    const cookie = await person('steady');
    expect((await today(cookie)).nextStep).toMatchObject({
      kind: 'explore',
      why: 'Nothing else is waiting for you today.',
    });
    // A note that is not a step (someone in a circle is thinking of you) is listed right under
    // the sign, so the sign does not say that nothing is waiting.
    await db
      .getDb()
      .insert(db.nudges)
      .values({
        userId: await userId(cookie),
        module: 'circles',
        priority: 'high',
        title: 'Someone in your circle is thinking of you',
        href: '/support',
      });
    const view = await today(cookie);
    expect(view.nudges.map((n) => n.title)).toContain('Someone in your circle is thinking of you');
    expect(view.nextStep).toMatchObject({ kind: 'explore', why: null });
  });

  it('“not now” is kept for the day it is pressed, not the day the page was drawn', async () => {
    const cookie = await person('lost-job');
    const first = await today(cookie);
    const press = (stored: string) =>
      req('/api/today/not-now', {
        method: 'POST',
        cookie: `${cookie}; wp-not-now=${stored}`,
        json: { key: first.nextStep.key },
      });
    const kept = (res: Response) =>
      res.headers.getSetCookie().find((line) => line.startsWith('wp-not-now=')) ?? '';

    // Added to what today already holds (another tab set something aside too).
    const res = await press(`${first.day}:aaaaaaaaaaaaaaaa`);
    expect(res.status).toBe(200);
    const line = kept(res);
    expect(line).toContain(`wp-not-now=${first.day}:aaaaaaaaaaaaaaaa.${first.nextStep.key};`);
    expect(line.toLowerCase()).toContain('max-age=129600');
    expect(line.toLowerCase()).toContain('path=/');
    // Nothing on the page needs to read it.
    expect(line.toLowerCase()).toContain('httponly');

    // A list from another day is not added to: the day is the person's own, worked out now.
    expect(kept(await press('2001-01-01:bbbbbbbbbbbbbbbb'))).toContain(
      `wp-not-now=${first.day}:${first.nextStep.key};`,
    );
    const after = await today(cookie, `wp-not-now=${first.day}:${first.nextStep.key}`);
    expect(after.nextStep.title).not.toBe(first.nextStep.title);

    // Only a key Today gave.
    const bad = await req('/api/today/not-now', {
      method: 'POST',
      cookie,
      json: { key: 'not a key; Path=/x' },
    });
    expect(bad.status).toBe(422);
    expect(bad.headers.getSetCookie()).toEqual([]);
  });

  it('marking the checklist item done moves on for good', async () => {
    const cookie = await person('lost-job');
    const first = await today(cookie);
    const done = first.nextStep.done;
    if (done?.type !== 'checklist-item') throw new Error('expected a checklist item');
    const put = await req(`/api/civic/${done.event}/items/${done.itemId}`, {
      method: 'PUT',
      cookie,
      json: { status: 'done' },
    });
    expect(put.status).toBe(200);
    expect((await today(cookie)).nextStep.title).toBe('Check unemployment support straight away');
  });

  it('someone caring for another person is asked how they are — never sent to make a career plan', async () => {
    const cookie = await person('caring');
    const view = await today(cookie);
    expect(view.nextStep).toMatchObject({
      kind: 'check-in',
      rung: 'reflection',
      module: 'mind',
      href: '/mind',
      title: 'Check in with yourself',
      detail: 'Ten seconds, private to you.',
      why: 'You told Waypoint: “I’m caring for someone”.',
    });
    const talk = await today(cookie, notNow(view, view.nextStep.key));
    expect(talk.nextStep).toMatchObject({ kind: 'talk', href: '/ask', title: 'Talk it through' });
    expect(talk.nextStep.canDefer).toBe(false);

    // Once they have checked in today, the check-in is not asked for again.
    const checkin = await req('/api/mind/checkins', { method: 'POST', cookie, json: { mood: 3 } });
    expect(checkin.status).toBe(201);
    expect((await today(cookie)).nextStep.kind).toBe('talk');
  });

  it('a change in health leads to the illness checklist', async () => {
    const view = await today(await person('health-change'));
    expect(view.nextStep).toMatchObject({
      kind: 'checklist',
      href: '/civic/serious-illness',
      from: 'Facing a serious illness',
    });
  });

  it('gig work starts with how long the money lasts', async () => {
    const view = await today(await person('gig-work'));
    expect(view.nextStep).toMatchObject({
      kind: 'money-start',
      href: '/money',
      title: 'See how long your money lasts',
      why: 'You told Waypoint: “I do gig or freelance work”.',
    });
  });

  it('money under pressure comes before exploring, in the words Money itself uses', async () => {
    const cookie = await person('steady');
    expect((await today(cookie)).nextStep.kind).toBe('explore');
    const saved = await req('/api/money', {
      method: 'PUT',
      cookie,
      json: {
        currency: 'KES',
        income: { mode: 'none' },
        essentials: { housing: 30000, food: 20000 },
        other: 0,
        debt: 0,
        savings: 10000,
      },
    });
    expect(saved.status).toBe(200);
    const stress = ((await saved.json()) as { result: { stress: string } }).result.stress;
    expect(stress).toBe('critical');
    expect((await today(cookie)).nextStep).toMatchObject({
      kind: 'money',
      rung: 'money',
      href: '/money',
      title: 'This needs attention now',
      why: 'The numbers you entered show money is under pressure.',
    });
  });

  it('the weekly review is offered once there is a goal, until it is written', async () => {
    const cookie = await person('steady');
    const created = await req('/api/goals', {
      method: 'POST',
      cookie,
      json: { title: 'Walk every morning', area: 'health' },
    });
    expect(created.status).toBe(201);
    const view = await today(cookie);
    expect(view.goals).toEqual({ active: 1, reviewedThisWeek: false });
    expect(view.nextStep).toMatchObject({
      kind: 'review',
      rung: 'reflection',
      module: 'goals',
      href: '/goals#review',
      title: 'This week’s review',
      minutes: 5,
      why: 'You have a goal, and this week’s review is still open.',
    });
    const review = await req('/api/goals/review', {
      method: 'PUT',
      cookie,
      json: { wentWell: 'Three walks' },
    });
    expect(review.status).toBe(200);
    const after = await today(cookie);
    expect(after.goals).toEqual({ active: 1, reviewedThisWeek: true });
    expect(after.nextStep.kind).toBe('explore');
  });

  it('a reminder that is due is the next step, in the person’s own words', async () => {
    const cookie = await person('steady');
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const created = await req('/api/wellbeing/reminders', {
      method: 'POST',
      cookie,
      json: {
        title: 'Call the clinic about Mum’s results',
        repeat: 'once',
        date: tomorrow,
        time: '09:00',
      },
    });
    expect(created.status).toBe(201);
    const reminder = (await created.json()) as { id: string };
    await db
      .getDb()
      .update(db.reminders)
      .set({ nextAt: new Date(Date.now() - 60_000) })
      .where(db.eq(db.reminders.id, reminder.id));
    const { dueReminders } = await import('../src/jobs');
    expect(await dueReminders(db.getDb())).toBeGreaterThanOrEqual(1);

    const view = await today(cookie);
    expect(view.nextStep).toMatchObject({
      kind: 'reminder',
      rung: 'deadline',
      module: 'health',
      href: '/health#reminders',
      title: 'Call the clinic about Mum’s results',
      why: 'Something you asked Waypoint to remind you about.',
      done: { type: 'note', noteId: expect.any(String) },
    });
    // The note itself is still listed, for apps that show notes and the sign separately.
    expect(view.nudges.map((n) => n.title)).toContain('Call the clinic about Mum’s results');

    // Done: the note is marked, and the sign moves on.
    const done = view.nextStep.done;
    if (done?.type !== 'note') throw new Error('expected a note');
    const acted = await req(`/api/nudges/${done.noteId}`, {
      cookie,
      json: { action: 'acted' },
      method: 'POST',
    });
    expect(acted.status).toBe(200);
    expect((await today(cookie)).nextStep.kind).toBe('explore');
  });

  it('a safety note comes before everything else', async () => {
    const cookie = await person('lost-job');
    await db
      .getDb()
      .insert(db.nudges)
      .values({
        userId: await userId(cookie),
        module: 'today',
        priority: 'critical',
        title: 'Checking in on you',
        body: 'Last time we talked, things were hard. How are you doing now?',
        href: '/support',
        dedupeKey: 'crisis-follow-up',
        status: 'delivered',
      });
    const view = await today(cookie);
    expect(view.nextStep).toMatchObject({
      kind: 'safety-note',
      rung: 'safety',
      href: '/support',
      title: 'Checking in on you',
      detail: 'Last time we talked, things were hard. How are you doing now?',
      done: { type: 'note', noteId: expect.any(String) },
      canDefer: true,
    });
    // Not now is allowed here too, and the checklist is what waits behind it.
    const next = await today(cookie, notNow(view, view.nextStep.key));
    expect(next.nextStep.kind).toBe('checklist');
  });

  it('a safety note stays first, however many newer notes arrive after it', async () => {
    const cookie = await person('lost-job');
    await db
      .getDb()
      .insert(db.nudges)
      .values({
        userId: await userId(cookie),
        module: 'today',
        priority: 'critical',
        title: 'Checking in on you',
        body: 'Last time we talked, things were hard. How are you doing now?',
        href: '/support',
        dedupeKey: 'crisis-follow-up',
        status: 'delivered',
        createdAt: new Date(Date.now() - 3_600_000),
      });
    // Three reminders fall due after it, and each leaves a newer note.
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    for (const title of ['Morning pills', 'Noon pills', 'Evening pills']) {
      const created = await req('/api/wellbeing/reminders', {
        method: 'POST',
        cookie,
        json: { title, repeat: 'once', date: tomorrow, time: '09:00' },
      });
      expect(created.status).toBe(201);
      const reminder = (await created.json()) as { id: string };
      await db
        .getDb()
        .update(db.reminders)
        .set({ nextAt: new Date(Date.now() - 60_000) })
        .where(db.eq(db.reminders.id, reminder.id));
    }
    const { dueReminders } = await import('../src/jobs');
    expect(await dueReminders(db.getDb())).toBeGreaterThanOrEqual(3);

    const view = await today(cookie);
    expect(view.nextStep).toMatchObject({
      kind: 'safety-note',
      title: 'Checking in on you',
      detail: 'Last time we talked, things were hard. How are you doing now?',
    });
    expect(view.nudges.map((n) => n.title)).toContain('Checking in on you');
  });

  it('with a plan, things with a deadline still come first; then the plan’s own step', async () => {
    const cookie = await person('first-job');
    const overview = (await (await req('/api/path', { cookie })).json()) as {
      suggestions: Array<{ roleId: string }>;
    };
    const created = await req('/api/path/plans', {
      method: 'POST',
      cookie,
      json: { roleId: overview.suggestions[0]!.roleId, hoursPerWeek: 5, horizonWeeks: 4 },
    });
    expect(created.status).toBe(201);
    const plan = (await created.json()) as { id: string; title: string };

    const keys: string[] = [];
    let view = await today(cookie);
    const first = view;
    expect(view.nextStep.kind).toBe('checklist');
    while (view.nextStep.kind === 'checklist') {
      keys.push(view.nextStep.key);
      view = await today(cookie, notNow(first, ...keys));
    }
    expect(view.nextStep).toMatchObject({
      kind: 'plan-step',
      rung: 'plan',
      from: plan.title,
      why: 'It is the next open step in your plan.',
      done: { type: 'plan-step', planId: plan.id, stepId: expect.any(String) },
    });
    expect(view.nextStep.minutes).toBeGreaterThan(0);
  });

  it('says why in the reader’s language, and marks guidance that is still in English', async () => {
    const cookie = await person('lost-job');
    const es = await today(cookie, 'NEXT_LOCALE=es');
    expect(es.nextStep.why).toBe('Está en la lista para tu situación, en «Hazlo ya».');
    // The checklist itself has not been translated yet: say so, so a screen reader switches voice.
    expect(es.nextStep.titleLang).toBe('en');
    const keys = [es.nextStep.key];
    let view = es;
    while (view.nextStep.kind === 'checklist') {
      view = await today(cookie, `NEXT_LOCALE=es; ${notNow(es, ...keys)}`);
      keys.push(view.nextStep.key);
    }
    expect(view.nextStep).toMatchObject({
      kind: 'make-plan',
      title: 'Elige un rumbo y haz un plan',
      titleLang: null,
    });
    expect(view.nextStep.why).toContain('Le dijiste a Waypoint: «');
  });
});

describe('what Today knows about a guest’s own things', () => {
  it('nothing is saved until the person saves a goal, a check-in or a plan', async () => {
    // Getting started alone is not "something saved": there is nothing of theirs to lose yet.
    const goal = await person('steady');
    expect((await today(goal)).hasSaved).toBe(false);
    const created = await req('/api/goals', {
      method: 'POST',
      cookie: goal,
      json: { title: 'Walk every morning', area: 'health' },
    });
    expect(created.status).toBe(201);
    expect((await today(goal)).hasSaved).toBe(true);

    const checkin = await person('caring');
    expect((await today(checkin)).hasSaved).toBe(false);
    const checked = await req('/api/mind/checkins', {
      method: 'POST',
      cookie: checkin,
      json: { mood: 3 },
    });
    expect(checked.ok).toBe(true);
    expect((await today(checkin)).hasSaved).toBe(true);

    const plan = await person('first-job');
    const overview = (await (await req('/api/path', { cookie: plan })).json()) as {
      suggestions: Array<{ roleId: string }>;
    };
    expect((await today(plan)).hasSaved).toBe(false);
    const made = await req('/api/path/plans', {
      method: 'POST',
      cookie: plan,
      json: { roleId: overview.suggestions[0]!.roleId, hoursPerWeek: 5, horizonWeeks: 4 },
    });
    expect(made.status).toBe(201);
    expect((await today(plan)).hasSaved).toBe(true);
  });
});
