/**
 * The wire client for TypeSafe's Jev (`POST /v1/systemone`), the model behind the judge.
 *
 * Jev is not a language model: it is sent a `state` and typed questions about it, and answers
 * each with probabilities: a noul (yes/no), a choice (one of N options) or a score (ordered
 * levels). This file knows the HTTP contract and nothing about Waypoint: what may be sent, and
 * for whom, is decided in `judge.ts`.
 *
 * Three things it guarantees whatever the service does:
 *  - a request outside the documented limits is never sent;
 *  - a reply is only ever returned after it has been checked against the questions asked: a
 *    choice that was not offered, or a probability outside 0 to 1, is a failure, never a value;
 *  - an error never carries the API key or the text that was sent.
 */
import { z } from 'zod';

export const JEV_URL = 'https://api.typesafe.ai/v1/systemone';

/** How usage, spending and the circuit breaker name this service. */
export const JUDGE_PROVIDER = 'typesafe';

export const JUDGE_LIMITS = {
  /** Options in one choice (the API's own maximum). */
  options: 255,
  /** Levels in one score: the API accepts 2 to 10. */
  minLevels: 2,
  maxLevels: 10,
  /**
   * Characters of state, as JSON. Jev allows 32k tokens for the state plus the longest question;
   * this stays far below that in any script, and accuracy falls as the state grows anyway.
   */
  stateChars: 24_000,
  /** Characters of one question, as JSON (255 described options fit). */
  questionChars: 24_000,
} as const;

/**
 * How long to wait, and how often to try again. Someone waiting for a page gets one short
 * try (the caller carries on without an answer); background work follows TypeSafe's own
 * defaults: 10 seconds a try and two retries.
 */
export const JUDGE_PACE = {
  interactive: { timeoutMs: 2500, maxRetries: 0 },
  background: { timeoutMs: 10_000, maxRetries: 2 },
} as const;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
/** Text, or text arranged in an object or a list: what `state`, instructions and criteria may be. */
export type Structured = string | { [key: string]: JsonValue } | JsonValue[];

export type JevQuestion =
  | {
      type: 'noul';
      instructions: Structured;
      criteria?: { true?: Structured; false?: Structured };
    }
  /** Each option with what it means; null means "no description". */
  | { type: 'choice'; instructions: Structured; criteria: Record<string, Structured | null> }
  /** Levels from lowest to highest; the position is the level's number, from 0. */
  | { type: 'score'; instructions: Structured; criteria: Structured[] };

export interface JevRequest {
  state: Structured;
  model: string;
  questions: Record<string, JevQuestion>;
}

export type JevAnswer =
  | { type: 'noul'; noul: number }
  | { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: 'score'; score: number; probabilities: Record<string, number>; confidence: number };

export interface JevResponse {
  /** The exact version that answered, e.g. "jev-1.13.0". */
  model: string;
  answers: Record<string, JevAnswer>;
  usage: { input_tokens: number; output_tokens: number };
}

export type JudgeErrorKind =
  /** Refused here, before anything was sent: outside the documented limits. */
  | 'request'
  /** The key was refused (401 or 403). Never retried. */
  | 'auth'
  /** The service said the request was wrong (400, 404, 422…). Never retried. */
  | 'rejected'
  /** The service is slow, busy or unreachable: 408, 429, 5xx, a network failure, a timeout. */
  | 'provider'
  /** It answered, but not in the shape that was asked for. */
  | 'invalid-response'
  /** The caller stopped waiting. */
  | 'aborted';

export class JudgeError extends Error {
  override readonly name = 'JudgeError';
  readonly kind: JudgeErrorKind;
  readonly status?: number;
  /** TypeSafe's id for the request (`x-typesafe-request-id`), to quote when asking them. */
  readonly requestId: string | null;
  readonly errorType?: string;
  readonly timedOut: boolean;

  constructor(
    kind: JudgeErrorKind,
    message: string,
    info: {
      status?: number;
      requestId?: string | null;
      errorType?: string;
      timedOut?: boolean;
    } = {},
  ) {
    super(message);
    this.kind = kind;
    this.status = info.status;
    this.requestId = info.requestId ?? null;
    this.errorType = info.errorType;
    this.timedOut = info.timedOut ?? false;
  }
}

// ───────────────────────────── Before sending ─────────────────────────────

/** Where an empty value (null) sits inside a value, or null when there is none. */
function findNull(value: unknown, path: string): string | null {
  if (value === null || value === undefined) return path;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = findNull(value[i], `${path}[${i}]`);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      const found = findNull(inner, `${path}.${key}`);
      if (found) return found;
    }
  }
  return null;
}

/** Text, an object or a list, with no empty value anywhere inside. */
function structuredProblem(value: unknown, path: string): string | null {
  const empty = findNull(value, path);
  if (empty) return `${empty} is empty (null): only a choice's description may be`;
  if (typeof value === 'string') return value.trim() ? null : `${path} is empty`;
  if (typeof value !== 'object') return `${path} must be text, an object or a list`;
  return null;
}

/**
 * What is wrong with a request, in words, or null when it may be sent. These are the limits
 * TypeSafe documents, checked here so a mistake costs nothing and says what it is.
 */
export function checkJevRequest(request: JevRequest): string | null {
  const state = structuredProblem(request.state, 'state');
  if (state) return state;
  const stateSize = JSON.stringify(request.state).length;
  if (stateSize > JUDGE_LIMITS.stateChars)
    return `state is too large (${stateSize} characters; the limit is ${JUDGE_LIMITS.stateChars})`;
  if (typeof request.model !== 'string' || !request.model.trim()) return 'model is not set';
  const questions = Object.entries(request.questions ?? {});
  if (!questions.length) return 'there is no question to answer';
  for (const [id, q] of questions) {
    const at = `question "${id}"`;
    if (!q || !['noul', 'choice', 'score'].includes(q.type))
      return `${at} is a kind of question Jev does not have`;
    const instructions = structuredProblem(q.instructions, `${at} instructions`);
    if (instructions) return instructions;
    if (q.type === 'noul') {
      for (const [side, criterion] of Object.entries(q.criteria ?? {})) {
        if (side !== 'true' && side !== 'false')
          return `${at} criteria may only describe true and false`;
        const problem = structuredProblem(criterion, `${at} criteria.${side}`);
        if (problem) return problem;
      }
    } else if (q.type === 'choice') {
      const options = Object.entries(q.criteria ?? {});
      if (options.length < 2) return `${at} needs at least two options to choose between`;
      if (options.length > JUDGE_LIMITS.options)
        return `${at} has ${options.length} options; the limit is ${JUDGE_LIMITS.options}`;
      for (const [option, description] of options) {
        // The one place an empty value is allowed: an option with no description.
        if (description === null) continue;
        const problem = structuredProblem(description, `${at} option "${option}"`);
        if (problem) return problem;
      }
    } else {
      const levels = Array.isArray(q.criteria) ? q.criteria : [];
      if (levels.length < JUDGE_LIMITS.minLevels || levels.length > JUDGE_LIMITS.maxLevels)
        return `${at} has ${levels.length} levels; a score takes 2 to 10`;
      for (const [i, level] of levels.entries()) {
        const problem = structuredProblem(level, `${at} level ${i}`);
        if (problem) return problem;
      }
    }
    const size = JSON.stringify(q).length;
    if (size > JUDGE_LIMITS.questionChars)
      return `${at} is too large (${size} characters; the limit is ${JUDGE_LIMITS.questionChars})`;
  }
  return null;
}

// ───────────────────────────── After receiving ─────────────────────────────

const probability = z.number().min(0).max(1);

/** Probabilities for some of `keys` and nothing else, each between 0 and 1. */
const probabilitiesOver = (keys: readonly string[]) =>
  z
    .record(z.string(), probability)
    .refine(
      (p) => Object.keys(p).every((key) => keys.includes(key)),
      'a probability for an option that was not offered',
    );

function answerSchema(q: JevQuestion) {
  if (q.type === 'noul') return z.object({ type: z.literal('noul'), noul: probability });
  if (q.type === 'choice') {
    const options = Object.keys(q.criteria);
    return z
      .object({
        type: z.literal('choice'),
        choice: z.string().refine((c) => options.includes(c), 'not one of the options'),
        probabilities: probabilitiesOver(options),
        confidence: probability,
      })
      .refine((a) => a.choice in a.probabilities, 'the choice has no probability');
  }
  const levels = q.criteria.map((_, i) => String(i));
  return z.object({
    type: z.literal('score'),
    // The expected level: between the lowest level (0) and the highest.
    score: z
      .number()
      .min(0)
      .max(levels.length - 1),
    probabilities: probabilitiesOver(levels),
    confidence: probability,
  });
}

/**
 * Check a reply against the questions that were asked, and return only what was asked for.
 * Every question must be answered, as its own kind, inside its own options or levels.
 */
export function parseJevResponse(request: JevRequest, body: unknown): JevResponse {
  const schema = z.object({
    model: z.string().min(1).max(100),
    answers: z.object(
      Object.fromEntries(Object.entries(request.questions).map(([id, q]) => [id, answerSchema(q)])),
    ),
    usage: z.object({
      input_tokens: z.number().int().min(0),
      output_tokens: z.number().int().min(0),
    }),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // Where and why, never the values: a reply can repeat what was sent.
    const issue = parsed.error.issues[0];
    const where = issue?.path.join('.') || 'reply';
    throw new JudgeError(
      'invalid-response',
      `Jev's reply was not what was asked for (${where}: ${issue?.code ?? 'invalid'})`,
    );
  }
  return parsed.data as JevResponse;
}

// ───────────────────────────── The call ─────────────────────────────

export interface JevCallOptions {
  apiKey: string;
  /** How long one try may take. */
  timeoutMs: number;
  /** Tries after the first, for failures that may pass (see JUDGE_PACE). */
  maxRetries: number;
  /** The caller stops waiting: nothing more is sent. */
  signal?: AbortSignal;
  /** A stand-in for fetch, for tests. */
  fetch?: typeof fetch;
}

const retryable = (status: number) =>
  status === 408 || status === 429 || (status >= 500 && status <= 599);

/** How long the service asked us to wait, in milliseconds, when it said. */
function retryAfterMs(headers: Headers): number | undefined {
  const exact = headers.get('retry-after-ms');
  if (exact !== null) {
    const ms = Number(exact);
    if (exact.trim() && Number.isFinite(ms) && ms >= 0) return ms;
  }
  const raw = headers.get('retry-after');
  if (raw === null || !raw.trim()) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return seconds >= 0 ? seconds * 1000 : undefined;
  const date = Date.parse(raw);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

/** Every piece of text inside a value (the words a person wrote are among them). */
function textsIn(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const inner of value) textsIn(inner, out);
  else if (value && typeof value === 'object')
    for (const inner of Object.values(value)) textsIn(inner, out);
  return out;
}

/**
 * The error schema is not documented, so every shape TypeSafe's own SDK accepts is read:
 * `error` (text or `{message}`), `message`, `detail` (text, `{message}` or a list of
 * `{loc, msg}`). Only these fields are read: a validation error can also echo what was sent.
 */
function readError(body: unknown): { message?: string; errorType?: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const b = body as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
  const inner = (v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
  const detail = b.detail;
  const listed = Array.isArray(detail)
    ? detail
        .map((d) => {
          const row = inner(d);
          const msg = text(row?.msg);
          if (!msg) return null;
          const loc = Array.isArray(row?.loc) ? row.loc.map(String).join('.') : '';
          return loc ? `${loc}: ${msg}` : msg;
        })
        .filter(Boolean)
        .join('; ')
    : undefined;
  const errorType = text(inner(detail)?.error_type);
  return {
    message:
      text(b.error) ??
      text(inner(b.error)?.message) ??
      text(b.message) ??
      text(detail) ??
      text(inner(detail)?.message) ??
      text(listed),
    errorType: errorType && /^[\w.-]{1,60}$/.test(errorType) ? errorType : undefined,
  };
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    const stop = () => {
      clearTimeout(timer);
      reject(new JudgeError('aborted', 'The caller stopped waiting'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', stop);
      resolve();
    }, ms);
    signal?.addEventListener('abort', stop, { once: true });
  });
}

/**
 * Ask Jev. Returns a checked reply, or throws a JudgeError that says which kind of failure it
 * was. Failures that may pass (408, 429, 5xx, the network, a timeout) are tried again up to
 * `maxRetries` times; a refused key or a refused request never is.
 */
export async function callJev(
  request: JevRequest,
  opts: JevCallOptions,
): Promise<{ data: JevResponse; requestId: string | null }> {
  const problem = checkJevRequest(request);
  if (problem) throw new JudgeError('request', `Not sent to Jev: ${problem}`);
  const send = opts.fetch ?? fetch;
  // What the service says goes into errors that may be logged: never with the key in it, nor
  // with anything that was in the state.
  const sent = textsIn(request.state).filter((t) => t.length >= 8);
  const clean = (text: string) => {
    let out = text.split(opts.apiKey).join('[key]');
    for (const piece of sent) out = out.split(piece).join('[text]');
    return out.replace(/\s+/g, ' ').trim().slice(0, 300);
  };
  const payload = JSON.stringify(request);

  for (let attempt = 0; ; attempt++) {
    if (opts.signal?.aborted) throw new JudgeError('aborted', 'The caller stopped waiting');
    const last = attempt >= opts.maxRetries;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, opts.timeoutMs);
    const stop = () => controller.abort();
    opts.signal?.addEventListener('abort', stop, { once: true });

    let res: Response | undefined;
    let text = '';
    try {
      res = await send(JEV_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: payload,
        // The key and the state go to this address only, never on to another.
        redirect: 'error',
        signal: controller.signal,
      });
      // Reading the body is part of the try: a reply cut off half-way is tried again too.
      text = await res.text();
    } catch (err) {
      if (opts.signal?.aborted) throw new JudgeError('aborted', 'The caller stopped waiting');
      if (last) {
        // The failure's own message can quote the request, so only its name is kept.
        const name = err instanceof Error ? err.name : 'error';
        throw new JudgeError(
          'provider',
          timedOut
            ? `Jev did not answer within ${opts.timeoutMs} ms`
            : `Jev could not be reached (${name})`,
          { timedOut },
        );
      }
      res = undefined;
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', stop);
    }

    let asked: number | undefined;
    if (res) {
      const requestId = res.headers.get('x-typesafe-request-id');
      let body: unknown;
      try {
        body = text ? JSON.parse(text) : undefined;
      } catch {
        body = undefined;
      }
      if (res.ok) {
        try {
          return { data: parseJevResponse(request, body), requestId };
        } catch (err) {
          if (err instanceof JudgeError)
            throw new JudgeError(err.kind, err.message, { status: res.status, requestId });
          throw err;
        }
      }
      const { message, errorType } = readError(body);
      const said = `Jev answered HTTP ${res.status}${message ? `: ${clean(message)}` : ''}`;
      const info = { status: res.status, requestId, errorType };
      // The documentation says 401 for a bad key; the service answers 403 for a missing one.
      if (res.status === 401 || res.status === 403) throw new JudgeError('auth', said, info);
      if (!retryable(res.status)) throw new JudgeError('rejected', said, info);
      if (last) throw new JudgeError('provider', said, info);
      asked = retryAfterMs(res.headers);
    }

    // The service's own wait when it names one (up to a minute); otherwise 500 ms, 1 s, 2 s…
    // capped at 5 s, shortened by up to a quarter so retries do not arrive together.
    const backoff = Math.round(Math.min(500 * 2 ** attempt, 5000) * (1 - Math.random() * 0.25));
    await sleep(asked !== undefined && asked <= 60_000 ? asked : backoff, opts.signal);
  }
}
