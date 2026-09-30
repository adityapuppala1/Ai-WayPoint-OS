/**
 * The judge's client: what is sent to TypeSafe's Jev, what is accepted back, and what happens
 * when it fails. Nothing here touches the network: a stand-in `fetch` plays the service.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  callJev,
  checkJevRequest,
  JEV_URL,
  type JevRequest,
  JUDGE_LIMITS,
  JUDGE_PACE,
  JudgeError,
  parseJevResponse,
} from '../src/judge-client';
import {
  CHOICE_REQUEST,
  CHOICE_RESPONSE,
  QUICKSTART_REQUEST,
  QUICKSTART_RESPONSE,
} from './fixtures/jev';

const KEY = 'ts_test_key_0123456789abcdef';
const REQUEST_ID = 'req_0123456789abcdef0123456789abcdef';

type Step = (() => Response) | Error | 'hang';

const answer =
  (status: number, body: unknown, headers: Record<string, string> = {}) =>
  () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'x-typesafe-request-id': REQUEST_ID, ...headers },
    });

/** A stand-in for fetch: plays each step in turn, repeating the last one. */
function service(...steps: Step[]) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchFn = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(url), init: init ?? {} });
    const step = steps[Math.min(calls.length - 1, steps.length - 1)]!;
    if (step === 'hang')
      return new Promise((_, reject) => {
        const signal = init?.signal;
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    if (step instanceof Error) throw step;
    return step();
  };
  return { calls, fetchFn: fetchFn as typeof fetch };
}

const request = CHOICE_REQUEST as unknown as JevRequest;
const once = { apiKey: KEY, ...JUDGE_PACE.interactive };
const patient = { apiKey: KEY, ...JUDGE_PACE.background };

/** The error a call ends with (the test fails if it succeeds). */
async function errorOf(promise: Promise<unknown>): Promise<JudgeError> {
  const settled = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(settled).toBeInstanceOf(JudgeError);
  return settled as JudgeError;
}

describe('the examples in TypeSafe’s documentation', () => {
  it('sends the quickstart request as documented and reads its three kinds of answer', async () => {
    const { calls, fetchFn } = service(answer(200, QUICKSTART_RESPONSE));
    const out = await callJev(QUICKSTART_REQUEST as unknown as JevRequest, {
      ...once,
      fetch: fetchFn,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(calls[0]?.url).toBe(JEV_URL);
    expect(calls[0]?.init.method).toBe('POST');
    // The key and the text are never passed on to wherever a redirect points.
    expect(calls[0]?.init.redirect).toBe('error');
    const headers = new Headers(calls[0]?.init.headers);
    expect(headers.get('authorization')).toBe(`Bearer ${KEY}`);
    expect(headers.get('content-type')).toBe('application/json');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual(QUICKSTART_REQUEST);

    expect(out.requestId).toBe(REQUEST_ID);
    expect(out.data.model).toBe('jev-1.13.0');
    expect(out.data.usage).toEqual({ input_tokens: 392, output_tokens: 65 });
    expect(out.data.answers.department).toEqual({
      type: 'choice',
      choice: 'technical',
      confidence: 0.78,
      probabilities: { technical: 0.85, sales: 0, billing: 0.15 },
    });
    expect(out.data.answers.frustration).toMatchObject({
      type: 'score',
      score: 1,
      confidence: 1,
      probabilities: { '0': 0, '1': 1, '2': 0 },
    });
    expect(out.data.answers.is_urgent).toEqual({ type: 'noul', noul: 1 });
  });

  it('sends the Choice example from the API reference and reads its answer', async () => {
    const { calls, fetchFn } = service(answer(200, CHOICE_RESPONSE));
    const out = await callJev(request, { ...once, fetch: fetchFn });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual(CHOICE_REQUEST);
    expect(out.data.answers.department).toEqual({
      type: 'choice',
      choice: 'billing',
      probabilities: { billing: 0.88, technical: 0.12, sales: 0 },
      confidence: 0.81,
    });
    expect(out.data.usage.input_tokens).toBe(318);
  });
});

describe('an answer is checked before anything uses it', () => {
  const quickstart = QUICKSTART_REQUEST as unknown as JevRequest;
  /** The documented response with one thing changed. */
  const changed = (path: string[], value: unknown) => {
    const body = structuredClone(QUICKSTART_RESPONSE) as unknown as Record<string, unknown>;
    let node = body;
    for (const part of path.slice(0, -1)) node = node[part] as Record<string, unknown>;
    const leaf = path.at(-1)!;
    if (value === undefined) delete node[leaf];
    else node[leaf] = value;
    return body;
  };
  const refused = (body: unknown) => {
    let thrown: unknown;
    try {
      parseJevResponse(quickstart, body);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(JudgeError);
    expect((thrown as JudgeError).kind).toBe('invalid-response');
  };

  it('accepts the documented response', () => {
    expect(parseJevResponse(quickstart, QUICKSTART_RESPONSE).answers.is_urgent).toEqual({
      type: 'noul',
      noul: 1,
    });
  });

  it('refuses a choice that was not one of the options', () => {
    refused(changed(['answers', 'department', 'choice'], 'legal'));
    // …and a probability for an option nobody offered.
    refused(changed(['answers', 'department', 'probabilities'], { technical: 0.5, refunds: 0.5 }));
  });

  it('refuses a probability outside 0 to 1', () => {
    refused(changed(['answers', 'is_urgent', 'noul'], 1.2));
    refused(changed(['answers', 'is_urgent', 'noul'], -0.01));
    refused(
      changed(['answers', 'department', 'probabilities'], {
        technical: 1.85,
        sales: 0,
        billing: 0.15,
      }),
    );
    refused(changed(['answers', 'frustration', 'probabilities'], { '0': 0, '1': -1, '2': 0 }));
    refused(changed(['answers', 'department', 'confidence'], 7));
  });

  it('refuses a score outside its levels', () => {
    // Three levels: 0, 1 and 2.
    refused(changed(['answers', 'frustration', 'score'], 2.4));
    refused(changed(['answers', 'frustration', 'score'], -1));
    refused(changed(['answers', 'frustration', 'probabilities'], { '0': 0, '3': 1 }));
  });

  it('refuses a question left unanswered, or answered as another kind', () => {
    refused(changed(['answers', 'is_urgent'], undefined));
    refused(changed(['answers', 'is_urgent'], { type: 'choice', choice: 'yes' }));
    refused(changed(['answers', 'is_urgent', 'noul'], 'yes'));
    refused(changed(['answers', 'frustration'], { type: 'noul', noul: 0.4 }));
  });

  it('refuses anything that is not the documented shape at all', () => {
    refused(null);
    refused('ok');
    refused([]);
    refused({ answers: QUICKSTART_RESPONSE.answers });
    refused(changed(['usage'], undefined));
    refused(changed(['usage', 'input_tokens'], -5));
    refused(changed(['model'], ''));
  });

  it('never returns a value from a reply that fails the check, even with a 200', async () => {
    const wrong = changed(['answers', 'department', 'choice'], 'legal');
    const { fetchFn } = service(answer(200, wrong));
    const err = await errorOf(callJev(quickstart, { ...once, fetch: fetchFn }));
    expect(err.kind).toBe('invalid-response');
    expect(err.requestId).toBe(REQUEST_ID);
    const { fetchFn: notJson } = service(answer(200, '<html>gateway</html>'));
    expect((await errorOf(callJev(quickstart, { ...once, fetch: notJson }))).kind).toBe(
      'invalid-response',
    );
  });
});

describe('when the service refuses or fails', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // No random shortening of waits, so the tests can count milliseconds.
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('treats 401 and 403 alike as a bad key, and never tries again', async () => {
    for (const status of [401, 403]) {
      const { calls, fetchFn } = service(
        answer(status, {
          detail: {
            error_type: 'authentication_error',
            message: 'Must supply an API key! Check your request and try again.',
          },
        }),
      );
      const err = await errorOf(callJev(request, { ...patient, fetch: fetchFn }));
      expect(err.kind).toBe('auth');
      expect(err.status).toBe(status);
      expect(err.requestId).toBe(REQUEST_ID);
      expect(err.message).toContain('Must supply an API key');
      expect(calls).toHaveLength(1);
    }
  });

  it('does not retry a request the service says is wrong (400, 404, 422)', async () => {
    for (const status of [400, 404, 422]) {
      const { calls, fetchFn } = service(
        answer(status, {
          detail: [{ loc: ['body', 'questions', 'a', 'criteria'], msg: 'Too many' }],
        }),
      );
      const err = await errorOf(callJev(request, { ...patient, fetch: fetchFn }));
      expect(err.kind).toBe('rejected');
      expect(err.status).toBe(status);
      expect(err.message).toContain('body.questions.a.criteria: Too many');
      expect(calls).toHaveLength(1);
    }
  });

  it('retries 408, 429 and any 5xx (529 included), then answers when the service does', async () => {
    for (const status of [408, 429, 500, 503, 529]) {
      const { calls, fetchFn } = service(
        answer(status, { message: 'busy' }),
        answer(200, CHOICE_RESPONSE),
      );
      const pending = callJev(request, { ...patient, fetch: fetchFn });
      await vi.advanceTimersByTimeAsync(500);
      const out = await pending;
      expect(out.data.answers.department).toMatchObject({ choice: 'billing' });
      expect(calls).toHaveLength(2);
    }
  });

  it('gives up after two retries, as a problem with the service', async () => {
    const { calls, fetchFn } = service(
      answer(529, { error: 'TypeSafe is temporarily overloaded.' }),
    );
    const pending = errorOf(callJev(request, { ...patient, fetch: fetchFn }));
    await vi.advanceTimersByTimeAsync(10_000);
    const err = await pending;
    expect(err.kind).toBe('provider');
    expect(err.status).toBe(529);
    expect(err.message).toContain('temporarily overloaded');
    expect(err.requestId).toBe(REQUEST_ID);
    expect(calls).toHaveLength(3);
  });

  it('asks once only when someone is waiting: no retry, whatever the failure', async () => {
    const { calls, fetchFn } = service(answer(503, {}), answer(200, CHOICE_RESPONSE));
    const err = await errorOf(callJev(request, { ...once, fetch: fetchFn }));
    expect(err.kind).toBe('provider');
    expect(calls).toHaveLength(1);
  });

  it('waits 500 ms, then 1000 ms, between tries', async () => {
    const { calls, fetchFn } = service(
      answer(500, {}),
      answer(500, {}),
      answer(200, CHOICE_RESPONSE),
    );
    const pending = callJev(request, { ...patient, fetch: fetchFn });
    await vi.advanceTimersByTimeAsync(499);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(999);
    expect(calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(3);
    expect((await pending).data.model).toBe('jev-1.13.0');
  });

  it('shortens a wait by up to a quarter at random, so retries do not arrive together', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const { calls, fetchFn } = service(answer(500, {}), answer(200, CHOICE_RESPONSE));
    const pending = callJev(request, { ...patient, fetch: fetchFn });
    await vi.advanceTimersByTimeAsync(374);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(2);
    await pending;
  });

  it('waits as long as the service asks (retry-after-ms, then Retry-After)', async () => {
    const inMs = service(
      answer(429, {}, { 'retry-after-ms': '1200', 'retry-after': '30' }),
      answer(200, CHOICE_RESPONSE),
    );
    const first = callJev(request, { ...patient, fetch: inMs.fetchFn });
    await vi.advanceTimersByTimeAsync(1199);
    expect(inMs.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(inMs.calls).toHaveLength(2);
    await first;

    const inSeconds = service(
      answer(429, {}, { 'retry-after': '2' }),
      answer(200, CHOICE_RESPONSE),
    );
    const second = callJev(request, { ...patient, fetch: inSeconds.fetchFn });
    await vi.advanceTimersByTimeAsync(1999);
    expect(inSeconds.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(inSeconds.calls).toHaveLength(2);
    await second;

    const asDate = service(
      answer(503, {}, { 'retry-after': new Date(Date.now() + 3000).toUTCString() }),
      answer(200, CHOICE_RESPONSE),
    );
    const third = callJev(request, { ...patient, fetch: asDate.fetchFn });
    await vi.advanceTimersByTimeAsync(1999);
    expect(asDate.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1001);
    expect(asDate.calls).toHaveLength(2);
    await third;
  });

  it('ignores a wait of more than a minute and uses its own', async () => {
    const { calls, fetchFn } = service(
      answer(429, {}, { 'retry-after': '3600' }),
      answer(200, CHOICE_RESPONSE),
    );
    const pending = callJev(request, { ...patient, fetch: fetchFn });
    await vi.advanceTimersByTimeAsync(500);
    expect(calls).toHaveLength(2);
    await pending;
  });

  it('retries when the network fails, and reports the service when it keeps failing', async () => {
    const recovering = service(new TypeError('fetch failed'), answer(200, CHOICE_RESPONSE));
    const ok = callJev(request, { ...patient, fetch: recovering.fetchFn });
    await vi.advanceTimersByTimeAsync(500);
    expect((await ok).data.answers.department).toMatchObject({ choice: 'billing' });

    const down = service(new TypeError('fetch failed'));
    const pending = errorOf(callJev(request, { ...patient, fetch: down.fetchFn }));
    await vi.advanceTimersByTimeAsync(10_000);
    const err = await pending;
    expect(err.kind).toBe('provider');
    expect(err.status).toBeUndefined();
    expect(down.calls).toHaveLength(3);
  });

  it('stops waiting after 2.5 seconds when someone is waiting, and does not try again', async () => {
    const { calls, fetchFn } = service('hang');
    const pending = errorOf(callJev(request, { ...once, fetch: fetchFn }));
    await vi.advanceTimersByTimeAsync(2499);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    const err = await pending;
    expect(err.kind).toBe('provider');
    expect(err.timedOut).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('gives background work 10 seconds a try, three tries', async () => {
    expect(JUDGE_PACE.background).toEqual({ timeoutMs: 10_000, maxRetries: 2 });
    expect(JUDGE_PACE.interactive).toEqual({ timeoutMs: 2500, maxRetries: 0 });
    const { calls, fetchFn } = service('hang');
    const pending = errorOf(callJev(request, { ...patient, fetch: fetchFn }));
    await vi.advanceTimersByTimeAsync(9999);
    expect(calls).toHaveLength(1);
    // 10 s, a 500 ms wait, 10 s, a 1000 ms wait, 10 s.
    await vi.advanceTimersByTimeAsync(31_501);
    const err = await pending;
    expect(err.kind).toBe('provider');
    expect(err.timedOut).toBe(true);
    expect(calls).toHaveLength(3);
  });

  it('stops at once when the caller gives up, and says so', async () => {
    const { calls, fetchFn } = service('hang');
    const leaving = new AbortController();
    const pending = errorOf(
      callJev(request, { ...patient, fetch: fetchFn, signal: leaving.signal }),
    );
    await vi.advanceTimersByTimeAsync(100);
    leaving.abort();
    const err = await pending;
    expect(err.kind).toBe('aborted');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls).toHaveLength(1);

    // …also while it is waiting to try again.
    const between = service(answer(500, {}), answer(200, CHOICE_RESPONSE));
    const gone = new AbortController();
    const waiting = errorOf(
      callJev(request, { ...patient, fetch: between.fetchFn, signal: gone.signal }),
    );
    await vi.advanceTimersByTimeAsync(200);
    gone.abort();
    expect((await waiting).kind).toBe('aborted');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(between.calls).toHaveLength(1);
  });

  it('reads an error message wherever the service puts it', async () => {
    const bodies: Array<[unknown, string]> = [
      [{ error: 'plain error' }, 'plain error'],
      [{ error: { message: 'nested error' } }, 'nested error'],
      [{ message: 'top message' }, 'top message'],
      [{ detail: 'detail text' }, 'detail text'],
      [{ detail: { error_type: 'validation_error', message: 'detail message' } }, 'detail message'],
      [
        { detail: [{ loc: ['body', 'state'], msg: 'Field required' }] },
        'body.state: Field required',
      ],
      ['<html>Bad gateway</html>', 'HTTP 400'],
      ['', 'HTTP 400'],
      [{ unexpected: true }, 'HTTP 400'],
    ];
    for (const [body, expected] of bodies) {
      const { fetchFn } = service(answer(400, body));
      const err = await errorOf(callJev(request, { ...once, fetch: fetchFn }));
      expect(err.message).toContain(expected);
    }
    const typed = service(
      answer(422, { detail: { error_type: 'validation_error', message: 'x' } }),
    );
    expect((await errorOf(callJev(request, { ...once, fetch: typed.fetchFn }))).errorType).toBe(
      'validation_error',
    );
  });

  it('never repeats the key, or what the person wrote, in an error', async () => {
    const secretText = 'my landlord Amina said she will change the locks on Friday';
    const { fetchFn } = service(
      answer(422, {
        detail: [
          {
            loc: ['body', 'state'],
            msg: `Bad value near ${KEY}`,
            input: secretText,
          },
        ],
        message: `Rejected key ${KEY}`,
      }),
    );
    const err = await errorOf(
      callJev({ ...request, state: { message: secretText } }, { ...once, fetch: fetchFn }),
    );
    const everything = `${err.message} ${err.stack} ${JSON.stringify(err)} ${JSON.stringify(
      Object.entries(err),
    )}`;
    expect(everything).not.toContain(KEY);
    expect(everything).not.toContain('Amina');
    expect(err.message).toContain('[key]');

    // A validation error lists what was wrong and echoes what was sent: only the first is read,
    // and a message that quotes the text has it taken out.
    const echo = service(
      answer(422, {
        detail: [
          { loc: ['body', 'state', 'message'], msg: 'Too long', input: 'Amina, reworded' },
          { loc: ['body', 'state'], msg: `Cannot judge "${secretText}"` },
        ],
      }),
    );
    const quoted = await errorOf(
      callJev({ ...request, state: { message: secretText } }, { ...once, fetch: echo.fetchFn }),
    );
    expect(quoted.message).toContain('body.state.message: Too long');
    expect(quoted.message).toContain('[text]');
    expect(`${quoted.message} ${JSON.stringify(quoted)}`).not.toContain('Amina');

    // A network failure whose message quotes the request is not passed on either.
    const leaky = service(new TypeError(`fetch failed for Bearer ${KEY}`));
    const net = await errorOf(callJev(request, { ...once, fetch: leaky.fetchFn }));
    expect(`${net.message} ${net.stack} ${JSON.stringify(net)}`).not.toContain(KEY);
  });
});

describe('limits checked before anything is sent', () => {
  const noul = { type: 'noul', instructions: 'The text in `message` asks for a code' } as const;
  const base = (over: Partial<JevRequest>): JevRequest => ({
    state: { message: 'hello' },
    model: 'jev-1.13.0',
    questions: { a: noul },
    ...over,
  });
  const options = (n: number) =>
    Object.fromEntries(Array.from({ length: n }, (_, i) => [`option${i}`, `Option ${i}`]));
  const levels = (n: number) => Array.from({ length: n }, (_, i) => `Level ${i}`);

  it('accepts what the documentation allows', () => {
    expect(checkJevRequest(QUICKSTART_REQUEST as unknown as JevRequest)).toBeNull();
    expect(
      checkJevRequest(
        base({
          questions: {
            a: { type: 'choice', instructions: 'Which', criteria: options(JUDGE_LIMITS.options) },
            b: { type: 'score', instructions: 'How much', criteria: levels(2) },
            c: { type: 'score', instructions: 'How much', criteria: levels(10) },
            // No description for an option: the one place an empty value is allowed.
            d: { type: 'choice', instructions: 'Which', criteria: { yes: 'Yes', other: null } },
          },
        }),
      ),
    ).toBeNull();
  });

  it('refuses more than 255 options, and fewer than two', () => {
    expect(JUDGE_LIMITS.options).toBe(255);
    const many = base({
      questions: { a: { type: 'choice', instructions: 'Which', criteria: options(256) } },
    });
    expect(checkJevRequest(many)).toMatch(/255/);
    const one = base({
      questions: { a: { type: 'choice', instructions: 'Which', criteria: options(1) } },
    });
    expect(checkJevRequest(one)).toMatch(/option/);
  });

  it('refuses fewer than 2 or more than 10 levels', () => {
    for (const n of [0, 1, 11]) {
      const bad = base({
        questions: { a: { type: 'score', instructions: 'How much', criteria: levels(n) } },
      });
      expect(checkJevRequest(bad)).toMatch(/2 to 10/);
    }
  });

  it('refuses a state too large to be judged well', () => {
    const big = base({ state: { message: 'x'.repeat(JUDGE_LIMITS.stateChars + 1) } });
    expect(checkJevRequest(big)).toMatch(/state/);
    const fits = base({ state: { message: 'x'.repeat(JUDGE_LIMITS.stateChars - 100) } });
    expect(checkJevRequest(fits)).toBeNull();
  });

  it('refuses an empty value anywhere but a choice’s description', () => {
    const bad: Array<Partial<JevRequest>> = [
      { state: null as never },
      { state: { message: null } },
      { state: { notes: ['one', null] } },
      { questions: { a: { type: 'noul', instructions: null as never } } },
      {
        questions: {
          a: { type: 'noul', instructions: 'Asks for a code', criteria: { true: null as never } },
        },
      },
      {
        questions: {
          a: { type: 'score', instructions: 'How much', criteria: ['none', null as never] },
        },
      },
      {
        questions: {
          a: {
            type: 'choice',
            instructions: 'Which',
            criteria: { yes: { what: null }, no: 'No' } as never,
          },
        },
      },
    ];
    for (const over of bad) expect(checkJevRequest(base(over))).toMatch(/empty|null/i);
  });

  it('refuses a request with no questions, no model, or a kind of question Jev does not have', () => {
    expect(checkJevRequest(base({ questions: {} }))).toMatch(/question/);
    expect(checkJevRequest(base({ model: '' }))).toMatch(/model/);
    expect(
      checkJevRequest(
        base({ questions: { a: { type: 'essay', instructions: 'Write' } as never } }),
      ),
    ).toMatch(/kind/);
  });

  it('sends nothing when a limit is broken', async () => {
    const { calls, fetchFn } = service(answer(200, CHOICE_RESPONSE));
    const err = await errorOf(
      callJev(
        base({
          questions: { a: { type: 'choice', instructions: 'Which', criteria: options(300) } },
        }),
        { ...once, fetch: fetchFn },
      ),
    );
    expect(err.kind).toBe('request');
    expect(calls).toHaveLength(0);
  });
});
