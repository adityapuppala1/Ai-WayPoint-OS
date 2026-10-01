/**
 * AI spending and what reaches a model: every call is counted before it is made, a burst of
 * requests cannot overshoot the budget, guests cannot use all of it, and what Waypoint knows
 * about someone is cleaned of personal details before it goes to an outside provider.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'waypoint-ai-budget-'));
process.env.WAYPOINT_DATA_DIR = dir;
process.env.AI_MONTHLY_BUDGET_USD = '10';
delete process.env.DATABASE_URL;

let ai: typeof import('../src');
let db: typeof import('@waypoint/db');

const usage = {
  inputTokens: { total: 120, noCache: 120, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 30, text: 30, reasoning: 0 },
};
const finish = { unified: 'stop' as const, raw: 'stop' };

function streamingModel(text: string, chunkDelayInMs: number | null = null) {
  return new MockLanguageModelV4({
    provider: 'mock',
    modelId: 'mock-large',
    doStream: async () => ({
      stream: simulateReadableStream({
        chunkDelayInMs,
        chunks: [
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 't1' },
          ...text.split(' ').map((word) => ({
            type: 'text-delta' as const,
            id: 't1',
            delta: `${word} `,
          })),
          { type: 'text-end', id: 't1' },
          { type: 'finish', finishReason: finish, usage },
        ],
      }),
    }),
  });
}

const external = (model: MockLanguageModelV4) => [
  { provider: 'anthropic' as const, modelId: 'mock-large', model, local: false },
];
const local = (model: MockLanguageModelV4) => [
  { provider: 'ollama' as const, modelId: 'mock-large', model, local: true },
];

async function chunksOf(res: Response): Promise<Array<Record<string, unknown>>> {
  return (await res.text())
    .split('\n')
    .filter((l) => l.startsWith('data: ') && !l.includes('[DONE]'))
    .map((l) => JSON.parse(l.slice(6)) as Record<string, unknown>);
}
const modeOf = (chunks: Array<Record<string, unknown>>) =>
  (chunks.find((c) => c.type === 'data-mode') as { data: { mode: string; reason?: string } })?.data;

const userMessage = (text: string) => ({
  id: crypto.randomUUID(),
  role: 'user' as const,
  parts: [{ type: 'text' as const, text }],
});

async function person(isGuest = false): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .getDb()
    .insert(db.users)
    .values({ id, name: 'Test', email: `${id}@example.org` });
  await db
    .getDb()
    .insert(db.profiles)
    .values({
      userId: id,
      locale: 'en',
      timezone: 'UTC',
      dekWrapped: (await import('@waypoint/core/privacy')).newWrappedDek(),
    });
  return isGuest ? id : id;
}

const ask = (userId: string, text: string, over: Record<string, unknown> = {}) =>
  ai.askResponse({
    db: db.getDb(),
    user: { id: userId, isGuest: false },
    profile: { locale: 'en', country: 'IN' },
    consents: { aiExternal: true, memory: true },
    messages: [userMessage(text)],
    ...over,
  });

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

beforeAll(async () => {
  db = await import('@waypoint/db');
  ai = await import('../src');
  await db.dbReady();
}, 120_000);

afterAll(async () => {
  ai.overrideModelsForTests(null);
  await db.closeDb();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(async () => {
  ai.overrideModelsForTests(null);
  await spent(0);
});

describe('what an AI answer costs', () => {
  it('is counted even when the answer is cut off', async () => {
    const userId = await person();
    ai.overrideModelsForTests(external(streamingModel('one two three four five six seven', 40)));
    const abort = new AbortController();
    const res = await ask(userId, 'Tell me about data jobs', { abortSignal: abort.signal });
    const reader = res.body!.getReader();
    await reader.read();
    // The person closes the page while the answer is still arriving.
    abort.abort();
    await reader.cancel().catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const rows = await db.getDb().select().from(db.aiUsage).where(db.eq(db.aiUsage.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.provider).toBe('anthropic');
    expect(rows[0]?.costUsd).toBeGreaterThan(0);
  });

  it('settles at the real cost when the answer finishes', async () => {
    const userId = await person();
    ai.overrideModelsForTests(external(streamingModel('A short answer.')));
    await chunksOf(await ask(userId, 'Hello'));
    const rows = await db.getDb().select().from(db.aiUsage).where(db.eq(db.aiUsage.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'ok', inputTokens: 120, outputTokens: 30 });
    expect(rows[0]?.costUsd).toBeCloseTo(ai.estimateCostUsd('anthropic', 'mock-large', 120, 30));
  });

  it('still counts what was sent when the provider fails part-way', async () => {
    const userId = await person();
    const failing = new MockLanguageModelV4({
      provider: 'mock',
      modelId: 'mock-large',
      doStream: async () => {
        throw new Error('The provider stopped answering');
      },
    });
    ai.overrideModelsForTests(external(failing));
    await chunksOf(await ask(userId, 'Hello'));
    const rows = await db.getDb().select().from(db.aiUsage).where(db.eq(db.aiUsage.userId, userId));
    expect(rows).toHaveLength(1);
    // The prompt was sent (and may be billed); no answer came back.
    expect(rows[0]?.status).toBe('error');
    expect(rows[0]?.inputTokens).toBeGreaterThan(0);
    expect(rows[0]?.outputTokens).toBe(0);
    expect(rows[0]?.costUsd).toBeGreaterThan(0);
  });
});

describe('the monthly budget', () => {
  it('cannot be overshot by a burst of requests arriving together', async () => {
    const userId = await person();
    // Room for one more answer, not for ten.
    await spent(9.99);
    const model = streamingModel('An answer.');
    ai.overrideModelsForTests(external(model));
    const answers = await Promise.all(
      Array.from({ length: 10 }, () => ask(userId, 'Hello').then(chunksOf)),
    );
    const usedAi = answers.filter((chunks) => modeOf(chunks)?.mode === 'ai').length;
    expect(usedAi).toBeLessThanOrEqual(1);
    expect(model.doStreamCalls.length).toBeLessThanOrEqual(1);
    expect(
      answers.filter((chunks) => modeOf(chunks)?.reason === 'monthly-budget').length,
    ).toBeGreaterThanOrEqual(9);
  });

  it('keeps a share for people with accounts once guests have used theirs', async () => {
    const guestId = await person();
    const memberId = await person();
    await spent(7.5);
    const model = streamingModel('An answer.');
    ai.overrideModelsForTests(external(model));
    const asGuest = await chunksOf(
      await ask(guestId, 'Hello', { user: { id: guestId, isGuest: true } }),
    );
    expect(modeOf(asGuest)).toMatchObject({ mode: 'guided', reason: 'monthly-budget' });
    const asMember = await chunksOf(await ask(memberId, 'Hello'));
    expect(modeOf(asMember)?.mode).toBe('ai');
  });

  it('answers in guided mode when this visitor’s own allowance for the day is used up', async () => {
    const userId = await person();
    const model = streamingModel('An answer.');
    ai.overrideModelsForTests(external(model));
    let asked = 0;
    const gated = await chunksOf(
      await ask(userId, 'Hello', {
        aiGate: async () => {
          asked++;
          return false;
        },
      }),
    );
    expect(modeOf(gated)).toMatchObject({ mode: 'guided', reason: 'daily-limit' });
    expect(model.doStreamCalls).toHaveLength(0);
    expect(asked).toBe(1);
    // The allowance is only drawn on when a model would really be used.
    ai.overrideModelsForTests([]);
    await chunksOf(
      await ask(userId, 'Hello', {
        aiGate: async () => {
          asked++;
          return true;
        },
      }),
    );
    expect(asked).toBe(1);
  });
});

describe('what a model is told about someone', () => {
  const context = {
    goals: ['Call the agency on +254 711 000 000 about the visa'],
    memories: ['My landlord is reachable at amina.k@example.org'],
    currentPlan: 'Data skills — next step: email tutor at tutor@example.org (2/9 steps done)',
  };

  it('has personal details removed before it goes to an outside provider', async () => {
    const userId = await person();
    const model = streamingModel('An answer.');
    ai.overrideModelsForTests(external(model));
    await chunksOf(await ask(userId, 'What should I do next?', { context }));
    const sent = JSON.stringify(model.doStreamCalls[0]?.prompt);
    expect(sent).toContain('about the visa');
    expect(sent).not.toContain('711 000 000');
    expect(sent).not.toContain('amina.k@example.org');
    expect(sent).not.toContain('tutor@example.org');
  });

  it('stays whole for a model running on Waypoint’s own servers', async () => {
    const userId = await person();
    const model = streamingModel('An answer.');
    ai.overrideModelsForTests(local(model));
    await chunksOf(await ask(userId, 'What should I do next?', { context }));
    const sent = JSON.stringify(model.doStreamCalls[0]?.prompt);
    expect(sent).toContain('711 000 000');
    expect(sent).toContain('amina.k@example.org');
  });

  it('is kept sealed in the database: a memory is never stored as readable text', async () => {
    const userId = await person();
    const tools = ai.companionTools({
      db: db.getDb(),
      userId,
      isGuest: false,
      locale: 'en',
      canRemember: true,
    });
    const result = await tools.save_memory.execute?.(
      { content: 'I look after my mother on Tuesdays', kind: 'fact' },
      { toolCallId: 'call-1', messages: [] } as never,
    );
    expect(result).toMatchObject({ saved: true });
    const rows = await db
      .getDb()
      .select()
      .from(db.memories)
      .where(db.eq(db.memories.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.content).toBeNull();
    expect(rows[0]?.contentCt).toBeTruthy();
    expect(JSON.stringify(rows[0])).not.toContain('mother');
  });
});
