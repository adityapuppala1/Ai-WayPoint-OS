import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'waypoint-ai-'));
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

function streamingModel(text: string) {
  return new MockLanguageModelV4({
    provider: 'mock',
    modelId: 'mock-large',
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 't1' },
          { type: 'text-delta', id: 't1', delta: text },
          { type: 'text-end', id: 't1' },
          { type: 'finish', finishReason: finish, usage },
        ],
      }),
    }),
  });
}

function jsonModel(value: unknown) {
  return new MockLanguageModelV4({
    provider: 'mock',
    modelId: 'mock-small',
    doGenerate: async () => ({
      content: [{ type: 'text', text: JSON.stringify(value) }],
      finishReason: finish,
      usage,
      warnings: [],
    }),
  });
}

async function readChunks(res: Response): Promise<Array<Record<string, unknown>>> {
  const body = await res.text();
  return body
    .split('\n')
    .filter((l) => l.startsWith('data: ') && !l.includes('[DONE]'))
    .map((l) => JSON.parse(l.slice(6)) as Record<string, unknown>);
}

const textFrom = (chunks: Array<Record<string, unknown>>) =>
  chunks
    .filter((c) => c.type === 'text-delta')
    .map((c) => c.delta)
    .join('');

const userMessage = (text: string) => ({
  id: crypto.randomUUID(),
  role: 'user' as const,
  parts: [{ type: 'text' as const, text }],
});

let userId: string;

beforeAll(async () => {
  db = await import('@waypoint/db');
  ai = await import('../src');
  await db.dbReady();
  userId = crypto.randomUUID();
  await db
    .getDb()
    .insert(db.users)
    .values({ id: userId, name: 'Test', email: 'ai-test@example.org' });
}, 120_000);

afterAll(async () => {
  ai.overrideModelsForTests(null);
  await db.closeDb();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => ai.overrideModelsForTests(null));

const base = () => ({
  db: db.getDb(),
  user: { id: userId, isGuest: false },
  profile: { locale: 'en', country: 'IN' },
  consents: { aiExternal: true, memory: false },
});

describe('ask', () => {
  it('shows emergency help and does not call a model when someone is in immediate danger', async () => {
    const model = streamingModel('should not be used');
    ai.overrideModelsForTests([
      { provider: 'anthropic', modelId: 'mock-large', model, local: false },
    ]);
    let crisisLogged = false;
    const res = await ai.askResponse({
      ...base(),
      messages: [userMessage('I have the pills here and I am going to take them all tonight')],
      onCrisis: async () => {
        crisisLogged = true;
      },
    });
    const chunks = await readChunks(res);
    const crisis = chunks.find((c) => c.type === 'data-crisis') as
      | { data: { tier: number; emergencyNumber?: string } }
      | undefined;
    expect(crisis?.data.tier).toBe(3);
    expect(crisis?.data.emergencyNumber).toBe('112');
    expect(chunks.find((c) => c.type === 'data-mode')).toMatchObject({ data: { mode: 'safe' } });
    expect(model.doStreamCalls).toHaveLength(0);
    expect(crisisLogged).toBe(true);
  });

  it('answers in guided mode when no model is available', async () => {
    ai.overrideModelsForTests([]);
    const res = await ai.askResponse({
      ...base(),
      messages: [
        userMessage('Is this a scam? Pay Rs 2000 registration fee today to confirm your job offer'),
      ],
    });
    const chunks = await readChunks(res);
    expect(chunks.find((c) => c.type === 'data-mode')).toMatchObject({ data: { mode: 'guided' } });
    expect(textFrom(chunks)).toMatch(/Shield’s rules: (high|very high) risk/);
  });

  it('streams a model reply, redacting personal details sent to external providers', async () => {
    const model = streamingModel('Let’s look at roles that fit you.');
    ai.overrideModelsForTests([
      { provider: 'anthropic', modelId: 'mock-large', model, local: false },
    ]);
    let saved = 0;
    const res = await ai.askResponse({
      ...base(),
      messages: [userMessage('My number is +91 98765 43210. Can you help me find a data job?')],
      onFinish: async (messages) => {
        saved = messages.length;
      },
    });
    const chunks = await readChunks(res);
    expect(textFrom(chunks)).toBe('Let’s look at roles that fit you.');
    const sent = JSON.stringify(model.doStreamCalls[0]?.prompt);
    expect(sent).toContain('[phone]');
    expect(sent).not.toContain('98765');
    expect(saved).toBe(2);
  });

  it('uses guided mode instead of external AI without consent', async () => {
    const model = streamingModel('external');
    ai.overrideModelsForTests([{ provider: 'openai', modelId: 'mock', model, local: false }]);
    const res = await ai.askResponse({
      ...base(),
      consents: { aiExternal: false, memory: false },
      messages: [userMessage('Hello')],
    });
    const chunks = await readChunks(res);
    expect(chunks.find((c) => c.type === 'data-mode')).toMatchObject({
      data: { mode: 'guided', reason: 'no-consent' },
    });
    expect(model.doStreamCalls).toHaveLength(0);
  });
});

describe('shield second opinion', () => {
  it('parses a structured verdict and records usage', async () => {
    ai.overrideModelsForTests([
      {
        provider: 'google',
        modelId: 'mock-small',
        model: jsonModel({
          level: 'high',
          categories: ['job'],
          reasons: ['Asks for a fee before you can start'],
        }),
        local: false,
      },
    ]);
    const opinion = await ai.shieldOpinion(
      { db: db.getDb(), userId, allowExternal: true },
      { text: 'Pay 500 to start work tomorrow', locale: 'en', country: 'KE' },
    );
    expect(opinion).toEqual({
      level: 'high',
      categories: ['job'],
      reasons: ['Asks for a fee before you can start'],
      model: 'mock-small',
    });
    const rows = await db
      .getDb()
      .select()
      .from(db.aiUsage)
      .where(db.eq(db.aiUsage.feature, 'shield'));
    expect(rows[0]?.status).toBe('ok');
  });
});

describe('guided mode intents', () => {
  it('detects intents across languages', () => {
    expect(ai.detectIntent('necesito trabajo', 0)).toBe('work');
    expect(ai.detectIntent('मुझे पैसा चाहिए', 0)).toBe('money');
    expect(ai.detectIntent('check www.free-gift.xyz please', 0)).toBe('scam');
    expect(ai.detectIntent('anything', 1)).toBe('feelings');
  });
});

describe('guided mode replies', () => {
  it('explains scam warning signs in the person’s language', () => {
    const text =
      'Pay the registration fee of Rs 999 today to confirm your job. Contact on WhatsApp only.';
    const en = ai.offlineReply(text, { locale: 'en', country: 'IN' });
    const hi = ai.offlineReply(text, { locale: 'hi', country: 'IN' });
    const sw = ai.offlineReply(text, { locale: 'sw', country: 'KE' });
    expect(en).toContain('Asks you to pay before you can work');
    expect(hi).toContain('काम शुरू करने से पहले पैसे माँगता है');
    expect(hi).toContain('[स्कैम शील्ड खोलें](/shield)');
    expect(sw).toContain('Anakuomba ulipe kabla ya kuanza kazi');
    expect(sw).not.toContain('Asks you to pay');
  });

  it('never says a question about a scam showed no scam signs: it points to Shield instead', () => {
    // Someone describing a call has no message to check, so the rules find nothing: that is
    // not a reason to reassure them.
    const caller =
      'A man phoned me saying he is from my bank and asked for the number they just texted me. Should I give it?';
    const byKeyword = 'Is this a scam? A man phoned me from my bank asking for the code';
    for (const [text, opts] of [
      [caller, { locale: 'en', intent: 'scam' as const }],
      [byKeyword, { locale: 'en' }],
    ] as const) {
      const reply = ai.offlineReply(text, { country: 'IN', ...opts });
      expect(reply).toBe('[Shield: check a message for scams](/shield)');
    }
    const es = ai.offlineReply(caller, { locale: 'es', intent: 'scam' });
    expect(es).toBe('[Escudo: revisar si un mensaje es una estafa](/shield)');
    // A message that does show warning signs still gets the rules' verdict.
    expect(
      ai.offlineReply('Is this a scam? Pay the registration fee of Rs 999 today to get the job.', {
        locale: 'en',
        country: 'IN',
      }),
    ).toMatch(/Shield’s rules: (some warning signs|high risk|very high risk)/);
  });

  it('uses translated module names in the menu', () => {
    const es = ai.offlineReply('hola', { locale: 'es' });
    expect(es).toContain('[Escudo: revisar si un mensaje es una estafa](/shield)');
    expect(es).not.toMatch(/\bShield\b/);
  });
});
