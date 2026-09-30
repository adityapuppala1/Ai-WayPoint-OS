/**
 * The judge (TypeSafe's Jev) as the API uses it: in Scam Shield and on answers sent by text.
 * A stand-in plays the service, so nothing leaves this machine. What is checked is what a
 * person gets: with no judge, or one that fails, exactly what they got before; with one, only
 * ever more caution.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'waypoint-api-judge-'));
const ORIGIN = 'https://waypoint.example';
Object.assign(process.env, {
  WAYPOINT_DATA_DIR: dir,
  WAYPOINT_URL: ORIGIN,
  LOG_LEVEL: 'silent',
  WAYPOINT_CLIENT_IP_HEADER: 'x-real-ip',
  TWILIO_ACCOUNT_SID: 'ACtest',
  TWILIO_AUTH_TOKEN: 'twilio-auth-token',
  TWILIO_SMS_FROM: '+15550001111',
  // Never used to call out: the models below stand in. It makes "AI YES" something to offer.
  ANTHROPIC_API_KEY: 'test-key-never-sent',
});
for (const k of [
  'DATABASE_URL',
  'TRUSTED_PROXIES',
  'TYPESAFE_API_KEY',
  'AI_JUDGE_MODEL',
  'AI_JUDGE_LOCALES',
  'OPENAI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'OLLAMA_BASE_URL',
  'SMTP_URL',
  'RESEND_API_KEY',
])
  delete process.env[k];

vi.setConfig({ testTimeout: 30_000 });

let app: ReturnType<typeof import('../src').createApp>;
let db: typeof import('@waypoint/db');
let ai: typeof import('@waypoint/ai');
let providers: typeof import('../src/channels/providers');
let service: typeof import('../src/channels/service');

const sent: string[] = [];
const network: typeof fetch = async (_input, init) => {
  sent.push(
    init?.body instanceof URLSearchParams
      ? (init.body.get('Body') ?? '')
      : (new URLSearchParams(String(init?.body ?? '')).get('Body') ?? ''),
  );
  return Response.json({ id: 'msg_1' }, { status: 201 });
};

beforeAll(async () => {
  db = await import('@waypoint/db');
  await db.dbReady();
  ai = await import('@waypoint/ai');
  providers = await import('../src/channels/providers');
  service = await import('../src/channels/service');
  providers.setOutboundFetch(network);
  app = (await import('../src')).createApp();
}, 120_000);

afterAll(async () => {
  await service.dispatchSettled();
  providers.setOutboundFetch(null);
  ai.overrideJudgeForTests(null);
  ai.overrideModelsForTests(null);
  await db.closeDb();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  sent.length = 0;
  ai.overrideJudgeForTests(null);
  // No language model unless a test gives one.
  ai.overrideModelsForTests([]);
  ai.resetProvidersForTests();
});

let visitor = 0;
const newIp = () => `198.51.100.${1 + (visitor++ % 250)}`;

function req(path: string, init: { cookie?: string; json?: unknown; ip?: string } = {}) {
  const headers = new Headers({ origin: ORIGIN, 'content-type': 'application/json' });
  if (init.cookie) headers.set('cookie', init.cookie);
  if (init.ip) headers.set('x-real-ip', init.ip);
  return app.request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(init.json ?? {}),
  });
}

async function guest(ip: string): Promise<string> {
  const res = await req('/api/auth/sign-in/anonymous', { ip });
  expect(res.status).toBe(200);
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

/** A stand-in judge: says yes (at the probability given) to the questions named, no to the rest. */
function judge(says: Record<string, number> = {}) {
  const asked: Array<import('@waypoint/ai').JevRequest> = [];
  ai.overrideJudgeForTests(async (request) => {
    asked.push(request);
    return {
      model: 'jev-1.13.0',
      answers: Object.fromEntries(
        Object.keys(request.questions).map((id) => [id, { type: 'noul', noul: says[id] ?? 0.02 }]),
      ),
      usage: { input_tokens: 400, output_tokens: 40 },
    };
  });
  return asked;
}

async function textModel(answer: string) {
  const { MockLanguageModelV4 } = await import('ai/test');
  const model = new MockLanguageModelV4({
    provider: 'mock',
    modelId: 'mock-small',
    doGenerate: async () => ({
      content: [{ type: 'text', text: answer }],
      finishReason: { unified: 'stop' as const, raw: 'stop' },
      usage: {
        inputTokens: { total: 50, noCache: 50, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 10, text: 10, reasoning: 0 },
      },
      warnings: [],
    }),
  });
  ai.overrideModelsForTests([
    { provider: 'anthropic', modelId: 'mock-small', model, local: false },
  ]);
  return model;
}

interface Check {
  id: string;
  result: {
    level: string;
    score: number;
    signals: Array<{ id: string; title: string }>;
    advice: string[];
    engine: { ai?: { model: string; level: string; agreed: boolean } };
  };
  ai: { used: boolean; reason: string; model?: string; raised?: boolean };
}

describe('Scam Shield with the judge', () => {
  const OFFER = 'Hello, we saw your profile. We have a role for you. Reply to hear more.';
  const SCAM =
    'Congratulations! You are selected for a work from home job. Pay a registration fee of Rs 999 to confirm your seat.';

  async function check(text: string, json: Record<string, unknown> = { aiConsent: true }) {
    const ip = newIp();
    const res = await req('/api/shield/check', {
      cookie: await guest(ip),
      ip,
      json: { text, country: 'KE', ...json },
    });
    expect(res.status).toBe(200);
    return (await res.json()) as Check;
  }
  const stored = async (id: string) =>
    (
      await db
        .getDb()
        .execute(
          db.sql`select level, ai_model, ai_level, signal_ids from shield_checks where id = ${id}`,
        )
    ).rows[0] as { level: string; ai_model: string | null; ai_level: string | null };

  it('raises a message the rules had nothing on, says why in words Waypoint wrote, and records which model answered', async () => {
    const before = await check(OFFER);
    expect(before.result.level).toBe('low');
    expect(before.ai).toEqual({ used: false, reason: 'unavailable' });

    const asked = judge({ payToWork: 0.95 });
    const out = await check(OFFER);
    expect(asked).toHaveLength(1);
    expect(out.result.level).toBe('high');
    // "raised" is what a page should go by when it says the second check found more.
    expect(out.ai).toEqual({ used: true, reason: 'used', model: 'jev-1.13.0', raised: true });
    expect(out.result.engine.ai).toEqual({ model: 'jev-1.13.0', level: 'high', agreed: false });
    expect(out.result.signals.map((s) => s.title)).toContain('Asks you to pay before you can work');
    expect(out.result.advice.join(' ')).toContain('Real employers never ask you to pay');
    expect(await stored(out.id)).toMatchObject({
      level: 'high',
      ai_model: 'jev-1.13.0',
      ai_level: 'high',
    });
  });

  it('does not repeat a reason the rules already gave', async () => {
    judge({ pressure: 0.95, threatens: 0.95 });
    const out = await check('Your parcel is waiting. Act now, this offer ends in 1 hour!');
    const titles = out.result.signals.map((s) => s.title);
    expect(titles.filter((t) => t === 'Rushes you')).toHaveLength(1);
    expect(titles).toContain('Threatens you with a penalty or cut-off');
  });

  it('cannot lower what the rules said: a judge that sees nothing changes nothing', async () => {
    const RUSHED = 'Act now. This offer ends today, do not wait.';
    const rulesOnly = await check(RUSHED);
    expect(rulesOnly.result.level).toBe('unclear');
    const asked = judge();
    const out = await check(RUSHED);
    expect(asked).toHaveLength(1);
    // It was asked, but "nothing found" is not a second opinion: the page must neither say one
    // raised the level nor that "the AI check agreed".
    expect(out.ai).toEqual({ used: false, reason: 'unavailable' });
    expect(out.result.engine.ai).toBeUndefined();
    expect(out.result).toEqual(rulesOnly.result);
    expect(await stored(out.id)).toMatchObject({
      level: 'unclear',
      ai_model: null,
      ai_level: null,
    });
  });

  it('does not stop the language model from being asked, whatever the judge says', async () => {
    const model = await textModel(
      JSON.stringify({ level: 'high', categories: ['job'], reasons: ['Asks for money up front'] }),
    );
    const asked = judge();
    const out = await check(OFFER);
    expect(asked).toHaveLength(1);
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(out.result.level).toBe('high');
    expect(out.ai).toEqual({ used: true, reason: 'used', model: 'mock-small', raised: true });
  });

  it('is not sent a message the rules already call high: it could add nothing', async () => {
    const rulesOnly = await check(SCAM);
    expect(rulesOnly.result.level).toBe('high');
    const asked = judge({ payToWork: 0.95 });
    const out = await check(SCAM);
    expect(asked).toHaveLength(0);
    expect(out.result).toEqual(rulesOnly.result);
    expect(out.ai).toEqual(rulesOnly.ai);
  });

  it('gives exactly the rules’ own result when the judge fails or is too slow', async () => {
    const rulesOnly = await check(OFFER);
    for (const error of [
      new ai.JudgeError('provider', 'Jev did not answer within 2500 ms', { timedOut: true }),
      new ai.JudgeError('provider', 'Jev answered HTTP 529', { status: 529 }),
      new TypeError('fetch failed'),
    ]) {
      ai.resetProvidersForTests();
      ai.overrideJudgeForTests(async () => {
        throw error;
      });
      const out = await check(OFFER);
      expect(out.result).toEqual(rulesOnly.result);
      expect(out.ai).toEqual(rulesOnly.ai);
      expect(await stored(out.id)).toMatchObject({ level: 'low', ai_model: null, ai_level: null });
    }
  });

  it('is not asked when the rules are already certain', async () => {
    const asked = judge({ payToWork: 0.95 });
    const out = await check(
      'You are under digital arrest. Do not tell anyone. Stay on the video call and transfer the money to the safe account now.',
    );
    expect(out.result.level).toBe('very-high');
    expect(out.ai).toEqual({ used: false, reason: 'skipped-certain' });
    expect(asked).toHaveLength(0);
  });

  it('is not asked without consent, or without a session', async () => {
    const asked = judge({ payToWork: 0.95 });
    const noTick = await check(OFFER, {});
    expect(noTick.result.level).toBe('low');
    expect(noTick.ai).toEqual({ used: false, reason: 'no-consent' });
    const anonymous = await req('/api/shield/check', {
      ip: newIp(),
      json: { text: OFFER, aiConsent: true },
    });
    expect(((await anonymous.json()) as Check).ai.used).toBe(false);
    expect(asked).toHaveLength(0);
  });

  it('is not asked in a language that is not switched on', async () => {
    const asked = judge({ payToWork: 0.95 });
    const out = await check('Habari, tumeona wasifu wako. Tuna nafasi kwa ajili yako.', {
      aiConsent: true,
      locale: 'sw',
    });
    expect(out.result.level).toBe('low');
    expect(asked).toHaveLength(0);
  });
});

describe('answers by text message with the judge', () => {
  const GUIDED = /I can help with: HELP/;
  let n = 0;

  /** Someone who texted AI YES asks a question; returns what they are sent back later. */
  async function ask(question: string): Promise<string[]> {
    const from = `+1555888${String(1000 + n++)}`;
    const base = { channel: 'sms' as const, provider: 'twilio' as const, from };
    await service.handleText(db.getDb(), { ...base, text: 'hello' });
    await service.handleText(db.getDb(), { ...base, text: 'AI YES' });
    sent.length = 0;
    const result = await service.handleText(db.getDb(), { ...base, text: question });
    expect(result.later).toBeTruthy();
    await result.later?.();
    await service.dispatchSettled();
    return [...sent];
  }

  it('sends the AI’s answer as before when there is no judge', async () => {
    const model = await textModel('Start with your local job centre. They help for free.');
    const out = await ask('How do I find work after being laid off?');
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(out).toEqual(['AI: Start with your local job centre. They help for free.']);
  });

  it('sends the AI’s answer when the judge finds nothing wrong with it, and shows it only the answer', async () => {
    await textModel('Start with your local job centre. They help for free.');
    const asked = judge();
    const out = await ask('How do I find work after being laid off? My number is +1 555 010 9999');
    expect(out).toEqual(['AI: Start with your local job centre. They help for free.']);
    expect(asked).toHaveLength(1);
    expect(asked[0]?.state).toEqual({
      reply: 'Start with your local job centre. They help for free.',
    });
  });

  it('sends Waypoint’s own guided text instead of an answer the judge flags', async () => {
    await textModel('It is an infection. Take 500 mg of amoxicillin three times a day.');
    judge({ diagnosisOrDose: 0.92 });
    const out = await ask('I have a fever and a sore throat, what is it?');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(GUIDED);
    expect(out[0]).not.toMatch(/amoxicillin|AI:/);
  });

  it('sends the AI’s answer as before when the judge fails', async () => {
    await textModel('Start with your local job centre. They help for free.');
    ai.overrideJudgeForTests(async () => {
      throw new ai.JudgeError('provider', 'Jev answered HTTP 529', { status: 529 });
    });
    const out = await ask('How do I find work after being laid off?');
    expect(out).toEqual(['AI: Start with your local job centre. They help for free.']);
  });
});
