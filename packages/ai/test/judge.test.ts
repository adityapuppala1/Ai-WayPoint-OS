/**
 * The judge (TypeSafe's Jev) as Waypoint uses it: who may ask, what is sent, what it costs,
 * and what happens when it fails. A stand-in plays the service, so nothing leaves this machine.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JevRequest } from '../src/judge-client';

const dir = mkdtempSync(join(tmpdir(), 'waypoint-ai-judge-'));
process.env.WAYPOINT_DATA_DIR = dir;
process.env.AI_MONTHLY_BUDGET_USD = '10';
delete process.env.DATABASE_URL;
for (const key of [
  'TYPESAFE_API_KEY',
  'AI_JUDGE_MODEL',
  'AI_JUDGE_LOCALES',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'OLLAMA_BASE_URL',
])
  delete process.env[key];

// Each test makes several database calls; on a machine busy with other builds five seconds
// (the default) is not always enough.
vi.setConfig({ testTimeout: 30_000 });

let ai: typeof import('../src');
let db: typeof import('@waypoint/db');
let env: typeof import('@waypoint/core/env');

const KEY = 'ts_test_key_0123456789abcdef';

async function person(): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .getDb()
    .insert(db.users)
    .values({ id, name: 'Test', email: `${id}@example.org` });
  return id;
}

const rowsFor = (userId: string) =>
  db.getDb().select().from(db.aiUsage).where(db.eq(db.aiUsage.userId, userId));

/** Pretend this much has been spent this month already. */
async function spent(usd: number): Promise<void> {
  await db.getDb().delete(db.aiUsage);
  if (usd > 0)
    await db.getDb().insert(db.aiUsage).values({
      feature: 'ask',
      provider: 'anthropic',
      model: 'mock-large',
      costUsd: usd,
      status: 'ok',
    });
  ai.resetSpendCacheForTests();
}

function configure(values: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  env.resetEnvForTests();
}

// Defined after the package is loaded (see beforeAll): questions are constants in real code.
let SIGNS: ReturnType<typeof defineSigns>;
function defineSigns() {
  return ai.defineQuestions({
    reads: ['message', 'country'],
    questions: {
      asksForCode: ai.noul({
        instructions: 'The text in `message` asks the reader to share a one-time code or PIN',
      }),
      kind: ai.choice({
        instructions: 'What `message` is about, for someone living in `country`',
        options: { job: 'An offer of work', prize: 'A prize or lottery', other: null },
      }),
      pressure: ai.score({
        instructions: 'How much `message` hurries the reader',
        levels: ['No hurry at all', 'Some hurry', 'Act now or lose out'],
      }),
    },
  });
}

const reply = (over: Record<string, unknown> = {}) => ({
  model: 'jev-1.13.0',
  answers: {
    asksForCode: { type: 'noul', noul: 0.93 },
    kind: {
      type: 'choice',
      choice: 'prize',
      probabilities: { prize: 0.9, job: 0.05, other: 0.05 },
      confidence: 0.85,
    },
    pressure: {
      type: 'score',
      score: 1.6,
      confidence: 0.55,
      legend: { '0': 'No hurry at all', '1': 'Some hurry', '2': 'Act now or lose out' },
      probabilities: { '0': 0.1, '1': 0.2, '2': 0.7 },
    },
  },
  usage: { input_tokens: 392, output_tokens: 65 },
  ...over,
});

/** A stand-in for the service that answers as told and remembers what it was asked. */
function standIn(answer: () => unknown = reply) {
  const asked: Array<{ request: JevRequest; opts: { timeoutMs: number; maxRetries: number } }> = [];
  ai.overrideJudgeForTests(async (request, opts) => {
    asked.push({ request, opts });
    return answer();
  });
  return asked;
}

const state = { message: 'You won! Send the code we texted you today.', country: 'KE' };

const ctx = (userId: string, over: Record<string, unknown> = {}) => ({
  db: db.getDb(),
  userId,
  isGuest: false,
  allowExternal: true,
  locale: 'en',
  feature: 'judge-shield' as const,
  ...over,
});

beforeAll(async () => {
  db = await import('@waypoint/db');
  env = await import('@waypoint/core/env');
  ai = await import('../src');
  await db.dbReady();
  SIGNS = defineSigns();
}, 120_000);

afterAll(async () => {
  ai.overrideJudgeForTests(null);
  await db.closeDb();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(async () => {
  ai.overrideJudgeForTests(null);
  ai.resetProvidersForTests();
  configure({
    TYPESAFE_API_KEY: undefined,
    AI_JUDGE_MODEL: undefined,
    AI_JUDGE_LOCALES: undefined,
  });
  await spent(0);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('who may ask the judge', () => {
  it('is off without a key: nothing is asked and nothing is counted', async () => {
    const userId = await person();
    expect(ai.judgeConfigured()).toBe(false);
    expect(ai.judgeAvailable()).toBe(false);
    const out = await ai.runJudge(ctx(userId), state, SIGNS);
    expect(out).toEqual({ ok: false, reason: 'no-provider' });
    expect(await rowsFor(userId)).toHaveLength(0);
  });

  it('is on with a key, without becoming a provider that can answer in Ask', () => {
    configure({ TYPESAFE_API_KEY: KEY });
    ai.resetProvidersForTests();
    expect(ai.judgeConfigured()).toBe(true);
    expect(ai.judgeAvailable()).toBe(true);
    // Ask, the "AI YES" offer by text and "is AI set up?" all read this list: Jev cannot write.
    expect(ai.configuredProviders()).toEqual([]);
    expect(ai.aiAvailable()).toBe(false);
    expect(ai.modelCandidates('small')).toEqual([]);
  });

  it('is never asked without the person’s consent: it is always an outside service', async () => {
    const userId = await person();
    const asked = standIn();
    const out = await ai.runJudge(ctx(userId, { allowExternal: false }), state, SIGNS);
    expect(out).toEqual({ ok: false, reason: 'no-provider' });
    expect(asked).toHaveLength(0);
    expect(await rowsFor(userId)).toHaveLength(0);
  });

  it('is asked only in the languages switched on (English unless set)', async () => {
    const userId = await person();
    const asked = standIn();
    for (const locale of ['hi', 'es', 'fr', 'pt', 'ar', 'sw']) {
      const out = await ai.runJudge(ctx(userId, { locale }), state, SIGNS);
      expect(out).toEqual({ ok: false, reason: 'language' });
    }
    expect(asked).toHaveLength(0);
    expect(await rowsFor(userId)).toHaveLength(0);
    expect((await ai.runJudge(ctx(userId, { locale: 'en' }), state, SIGNS)).ok).toBe(true);
    expect((await ai.runJudge(ctx(userId, { locale: 'en-GB' }), state, SIGNS)).ok).toBe(true);

    configure({ AI_JUDGE_LOCALES: 'en,es' });
    expect((await ai.runJudge(ctx(userId, { locale: 'es' }), state, SIGNS)).ok).toBe(true);
    expect(await ai.runJudge(ctx(userId, { locale: 'sw' }), state, SIGNS)).toEqual({
      ok: false,
      reason: 'language',
    });
    expect(ai.judgeLanguageEnabled('es')).toBe(true);
    expect(ai.judgeLanguageEnabled('sw')).toBe(false);
  });
});

describe('what the judge is sent and what comes back', () => {
  it('asks the pinned version, with personal details removed, and returns typed answers', async () => {
    const userId = await person();
    const asked = standIn();
    const out = await ai.runJudge(
      ctx(userId),
      { message: 'Send the code to +254 711 000 000 or amina.k@example.org', country: 'KE' },
      SIGNS,
    );
    expect(asked).toHaveLength(1);
    expect(asked[0]?.request.model).toBe('jev-1.13.0');
    const sent = JSON.stringify(asked[0]?.request.state);
    expect(sent).toContain('Send the code to');
    expect(sent).not.toContain('711 000 000');
    expect(sent).not.toContain('amina.k@example.org');
    expect(Object.keys(asked[0]?.request.questions ?? {})).toEqual([
      'asksForCode',
      'kind',
      'pressure',
    ]);
    if (!out.ok) throw new Error(`expected an answer, got ${out.reason}`);
    expect(out.model).toBe('jev-1.13.0');
    expect(out.answers.asksForCode.noul).toBe(0.93);
    // Typed by the question: `choice` is 'job' | 'prize' | 'other'.
    const kind: 'job' | 'prize' | 'other' = out.answers.kind.choice;
    expect(kind).toBe('prize');
    expect(out.answers.kind.probabilities.prize).toBe(0.9);
    expect(out.answers.pressure.score).toBe(1.6);
  });

  it('asks another version only when AI_JUDGE_MODEL pins it', async () => {
    const userId = await person();
    configure({ AI_JUDGE_MODEL: 'jev-1.14.0' });
    const asked = standIn(() => reply({ model: 'jev-1.14.0' }));
    const out = await ai.runJudge(ctx(userId), state, SIGNS);
    expect(asked[0]?.request.model).toBe('jev-1.14.0');
    expect(out).toMatchObject({ ok: true, model: 'jev-1.14.0' });
  });

  it('asks once and briefly when someone is waiting; background work may wait and retry', async () => {
    const userId = await person();
    const asked = standIn();
    await ai.runJudge(ctx(userId), state, SIGNS);
    await ai.runJudge(ctx(userId, { pace: 'background' }), state, SIGNS);
    expect(asked[0]?.opts).toMatchObject({ timeoutMs: 2500, maxRetries: 0 });
    expect(asked[1]?.opts).toMatchObject({ timeoutMs: 10_000, maxRetries: 2 });
  });

  it('treats a reply outside what was asked as a failure, never as an answer', async () => {
    const userId = await person();
    const wrong = reply();
    (wrong.answers.kind as { choice: string }).choice = 'legal';
    standIn(() => wrong);
    const out = await ai.runJudge(ctx(userId), state, SIGNS);
    expect(out).toMatchObject({ ok: false, reason: 'failed' });
    expect(out).not.toHaveProperty('answers');

    const tooSure = reply();
    (tooSure.answers.asksForCode as { noul: number }).noul = 1.4;
    standIn(() => tooSure);
    expect(await ai.runJudge(ctx(userId), state, SIGNS)).toMatchObject({
      ok: false,
      reason: 'failed',
    });
  });

  it('sends nothing when the state is not what the questions read', async () => {
    const userId = await person();
    const asked = standIn();
    // @ts-expect-error `country` is missing: the types say so before the code runs
    const out = await ai.runJudge(ctx(userId), { message: 'Hello' }, SIGNS);
    expect(out).toMatchObject({ ok: false, reason: 'invalid-request' });
    expect(asked).toHaveLength(0);
    expect(await rowsFor(userId)).toHaveLength(0);
  });

  it('sends the key to TypeSafe and nowhere else, and never repeats it in a failure', async () => {
    const userId = await person();
    configure({ TYPESAFE_API_KEY: KEY });
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify(reply()), { status: 200 });
    });
    const out = await ai.runJudge(ctx(userId), state, SIGNS);
    expect(out.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(new Headers(calls[0]?.init.headers).get('authorization')).toBe(`Bearer ${KEY}`);

    vi.stubGlobal('fetch', async () => {
      return new Response(JSON.stringify({ detail: { message: `Bad key ${KEY}` } }), {
        status: 401,
      });
    });
    const refused = await ai.runJudge(ctx(userId), state, SIGNS);
    expect(refused).toMatchObject({ ok: false, reason: 'failed' });
    expect(JSON.stringify(refused)).not.toContain(KEY);
    expect(String((refused as { error?: unknown }).error)).not.toContain(KEY);
  });
});

describe('what the judge costs', () => {
  it('is priced at Jev’s own price, not the price of an unknown model', () => {
    // $0.042 per million tokens sent; answers are free.
    expect(ai.estimateCostUsd('typesafe', 'jev-1.13.0', 1_000_000, 1_000_000)).toBeCloseTo(0.042);
    expect(ai.estimateCostUsd('typesafe', 'jev-1.14.0', 1_000_000, 0)).toBeCloseTo(0.042);
    // An unknown model from anyone else is still assumed to be expensive.
    expect(ai.estimateCostUsd('anthropic', 'unknown-model', 1_000_000, 1_000_000)).toBe(18);
  });

  it('is counted before the call, then settled at what Jev says it used', async () => {
    const userId = await person();
    let during: Awaited<ReturnType<typeof rowsFor>> = [];
    ai.overrideJudgeForTests(async () => {
      during = await rowsFor(userId);
      return reply();
    });
    const out = await ai.runJudge(ctx(userId), state, SIGNS);
    expect(out.ok).toBe(true);
    expect(during).toHaveLength(1);
    expect(during[0]).toMatchObject({
      status: 'reserved',
      provider: 'typesafe',
      feature: 'judge-shield',
      model: 'jev-1.13.0',
    });
    expect(during[0]?.inputTokens).toBeGreaterThan(300);

    const rows = await rowsFor(userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: 'ok',
      provider: 'typesafe',
      feature: 'judge-shield',
      model: 'jev-1.13.0',
      inputTokens: 392,
      outputTokens: 65,
    });
    // 392 tokens at $0.042 a million: a sixtieth of a cent's hundredth, not a tenth of a cent.
    expect(rows[0]?.costUsd).toBeGreaterThan(0);
    expect(rows[0]?.costUsd).toBeLessThan(0.00003);
    expect(rows[0]?.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('stops at the monthly budget, and leaves guests only their share', async () => {
    const userId = await person();
    const asked = standIn();
    await spent(10);
    expect(await ai.runJudge(ctx(userId), state, SIGNS)).toEqual({
      ok: false,
      reason: 'monthly-budget',
    });
    // Room for nothing more, even something this small.
    await spent(9.999999);
    expect(await ai.runJudge(ctx(userId), state, SIGNS)).toEqual({
      ok: false,
      reason: 'monthly-budget',
    });
    await spent(7.5);
    expect(await ai.runJudge(ctx(userId, { isGuest: true }), state, SIGNS)).toEqual({
      ok: false,
      reason: 'monthly-budget',
    });
    expect(asked).toHaveLength(0);
    expect((await ai.runJudge(ctx(userId), state, SIGNS)).ok).toBe(true);
    expect(asked).toHaveLength(1);
  });

  it('is not made at all when it cannot be counted, and says so instead of throwing', async () => {
    const userId = await person();
    const asked = standIn();
    const broken = { db: {} as never };
    const out = await ai.runJudge(ctx(userId, broken), state, SIGNS);
    expect(out).toMatchObject({ ok: false, reason: 'failed' });
    expect(asked).toHaveLength(0);
  });

  it('still counts what was sent when the call fails', async () => {
    const userId = await person();
    ai.overrideJudgeForTests(async () => {
      throw new ai.JudgeError('provider', 'Jev answered HTTP 529', { status: 529 });
    });
    const out = await ai.runJudge(ctx(userId), state, SIGNS);
    expect(out).toMatchObject({ ok: false, reason: 'failed' });
    const rows = await rowsFor(userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('error');
    expect(rows[0]?.inputTokens).toBeGreaterThan(300);
    expect(rows[0]?.outputTokens).toBe(0);
    expect(rows[0]?.costUsd).toBeGreaterThan(0);
  });

  it('keeps the reservation when the person leaves before the answer', async () => {
    const userId = await person();
    let leaving = new AbortController();
    let asked = 0;
    // The person closes the page while the service is still thinking.
    ai.overrideJudgeForTests(
      (_request, opts) =>
        new Promise((_, reject) => {
          asked += 1;
          opts.signal?.addEventListener('abort', () => reject(opts.signal?.reason));
          leaving.abort();
        }),
    );
    const out = await ai.runJudge(ctx(userId, { signal: leaving.signal }), state, SIGNS);
    expect(out).toMatchObject({ ok: false, reason: 'failed', error: { kind: 'aborted' } });
    const rows = await rowsFor(userId);
    expect(rows).toHaveLength(1);
    // Not settled as an error at nothing: what was sent may well have been used.
    expect(rows[0]?.status).toBe('aborted');
    expect(rows[0]?.inputTokens).toBeGreaterThan(300);
    expect(rows[0]?.costUsd).toBeGreaterThan(0);
    // Leaving is not the service's fault: three more of these do not pause the judge.
    for (let i = 0; i < 3; i++) {
      leaving = new AbortController();
      await ai.runJudge(ctx(userId, { signal: leaving.signal }), state, SIGNS);
    }
    expect(asked).toBe(4);
    expect(ai.providerHealthy('typesafe')).toBe(true);
    // Someone who has already left is not asked about at all, and nothing is counted.
    expect(await ai.runJudge(ctx(userId, { signal: leaving.signal }), state, SIGNS)).toMatchObject({
      ok: false,
      reason: 'failed',
      error: { kind: 'aborted' },
    });
    expect(asked).toBe(4);
    expect(await rowsFor(userId)).toHaveLength(4);
  });
});

describe('a person’s daily allowance of AI answers', () => {
  const asks = (userId: string, n: number, feature = 'ask', provider = 'anthropic') =>
    db
      .getDb()
      .insert(db.aiUsage)
      .values(
        Array.from({ length: n }, () => ({
          userId,
          feature,
          provider,
          model: 'mock',
          status: 'ok',
        })),
      );

  it('is not used up by the judge: only answers count', async () => {
    const userId = await person();
    standIn();
    // More checks in a day than a guest has answers.
    for (let i = 0; i < ai.DAILY_LIMITS.guest + 5; i++)
      expect((await ai.runJudge(ctx(userId, { isGuest: true }), state, SIGNS)).ok).toBe(true);
    expect(await rowsFor(userId)).toHaveLength(ai.DAILY_LIMITS.guest + 5);
    expect(await ai.checkBudget(db.getDb(), { userId, isGuest: true })).toEqual({ ok: true });

    // Answers still count exactly as before.
    await asks(userId, ai.DAILY_LIMITS.guest - 1);
    expect(await ai.checkBudget(db.getDb(), { userId, isGuest: true })).toEqual({ ok: true });
    await asks(userId, 1);
    expect(await ai.checkBudget(db.getDb(), { userId, isGuest: true })).toEqual({
      ok: false,
      reason: 'daily-limit',
    });
  });

  it('covers every feature the judge records under', async () => {
    const userId = await person();
    for (const feature of ai.JUDGE_FEATURES)
      await asks(userId, ai.DAILY_LIMITS.guest, feature, 'typesafe');
    expect(await ai.checkBudget(db.getDb(), { userId, isGuest: true })).toEqual({ ok: true });
  });

  it('does not stop a check: someone out of answers is still checked', async () => {
    const userId = await person();
    const asked = standIn();
    await asks(userId, ai.DAILY_LIMITS.guest);
    expect((await ai.runJudge(ctx(userId, { isGuest: true }), state, SIGNS)).ok).toBe(true);
    expect(asked).toHaveLength(1);
  });
});

describe('when the judge keeps failing', () => {
  const failing = (error: () => unknown) => {
    let calls = 0;
    ai.overrideJudgeForTests(async () => {
      calls += 1;
      throw error();
    });
    return () => calls;
  };
  const busy = () => new ai.JudgeError('provider', 'Jev answered HTTP 529', { status: 529 });

  it('is left alone for a minute after three failures in a row, then tried again', async () => {
    const userId = await person();
    const calls = failing(busy);
    for (let i = 0; i < 3; i++)
      expect(await ai.runJudge(ctx(userId), state, SIGNS)).toMatchObject({ reason: 'failed' });
    expect(calls()).toBe(3);
    // Paused: not called, and nothing counted.
    expect(await ai.runJudge(ctx(userId), state, SIGNS)).toEqual({ ok: false, reason: 'paused' });
    expect(calls()).toBe(3);
    expect(await rowsFor(userId)).toHaveLength(3);

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 61_000);
    const asked = standIn();
    expect((await ai.runJudge(ctx(userId), state, SIGNS)).ok).toBe(true);
    expect(asked).toHaveLength(1);
    vi.restoreAllMocks();
    // One success clears the count: two more failures do not pause it again.
    const again = failing(busy);
    await ai.runJudge(ctx(userId), state, SIGNS);
    await ai.runJudge(ctx(userId), state, SIGNS);
    standIn();
    expect((await ai.runJudge(ctx(userId), state, SIGNS)).ok).toBe(true);
    expect(again()).toBe(2);
  });

  it('counts a refused key, a timeout, a network failure and a malformed reply as the service failing', async () => {
    const userId = await person();
    const kinds: Array<() => unknown> = [
      () => new ai.JudgeError('auth', 'Jev answered HTTP 403', { status: 403 }),
      () => new ai.JudgeError('provider', 'Jev did not answer within 2500 ms', { timedOut: true }),
      () => new ai.JudgeError('invalid-response', 'Jev’s reply was not what was asked for'),
      () => new TypeError('fetch failed'),
    ];
    for (const error of kinds) {
      ai.resetProvidersForTests();
      failing(error);
      for (let i = 0; i < 3; i++) await ai.runJudge(ctx(userId), state, SIGNS);
      expect(await ai.runJudge(ctx(userId), state, SIGNS)).toEqual({ ok: false, reason: 'paused' });
    }
  });

  it('does not blame the service for a request it refused as wrong', async () => {
    const userId = await person();
    const calls = failing(
      () => new ai.JudgeError('rejected', 'Jev answered HTTP 422', { status: 422 }),
    );
    for (let i = 0; i < 4; i++)
      expect(await ai.runJudge(ctx(userId), state, SIGNS)).toMatchObject({ reason: 'failed' });
    expect(calls()).toBe(4);
  });

  it('has a breaker of its own: a failing AI provider does not pause the judge, nor the reverse', async () => {
    const userId = await person();
    for (let i = 0; i < 5; i++) ai.reportProviderFailure('anthropic');
    const asked = standIn();
    expect((await ai.runJudge(ctx(userId), state, SIGNS)).ok).toBe(true);
    expect(asked).toHaveLength(1);

    ai.resetProvidersForTests();
    failing(busy);
    for (let i = 0; i < 3; i++) await ai.runJudge(ctx(userId), state, SIGNS);
    expect(ai.providerHealthy('typesafe')).toBe(false);
    expect(ai.providerHealthy('anthropic')).toBe(true);
  });
});
