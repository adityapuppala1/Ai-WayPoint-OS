/**
 * The judge: typed decisions from TypeSafe's Jev.
 *
 * Jev is not a language model. It is sent a state and questions about it, and answers each one
 * with probabilities: yes or no, one of N options, a level on a scale. It cannot write a word,
 * so it can never invent a fact, a phone number or a reason. Waypoint uses it for second
 * opinions: a caller asks, and code decides what an answer is allowed to change.
 *
 * It is optional. With no TYPESAFE_API_KEY nothing here ever calls out and every caller gets
 * "no-provider", which is exactly what happens today.
 *
 * It is deliberately NOT one of the providers in providers.ts. That list is the models that
 * can write an answer: it decides what Ask streams from, whether "AI YES" is offered by text
 * and whether "AI is set up" is true. A Jev key alone must change none of that.
 *
 * What `runJudge` guarantees, whoever calls it:
 *  - never without the person's consent: Jev is an outside service (hosted in the United
 *    States), so "this model runs on our own servers" never applies to it;
 *  - only in the languages switched on (AI_JUDGE_LOCALES, English unless set): TypeSafe says
 *    Jev is weaker in other languages, so each is enabled only after it has been measured;
 *  - personal details are removed from everything sent, and what a person wrote travels only
 *    in the state, never in a question (judge-questions.ts);
 *  - the monthly budget holds, every call is counted before it is made, and a check never
 *    uses up a person's daily allowance of answers (usage.ts);
 *  - a failure of any kind is an absence, never a value: the caller carries on as if the
 *    judge did not exist.
 *
 * What callers must keep to (nothing here can enforce it): an answer may add caution, never
 * remove it. Text written to steer Jev "can move the answer" by TypeSafe's own account, so no
 * answer may lower a crisis tier or a Shield level, and none decides anything on its own.
 * Callers also check the person's own words with `judgeBarredByCrisis` (nothing goes to the
 * judge in immediate danger) and the text with `judgeReads` (the language it is written in).
 *
 * Where it is asked: Scam Shield's second opinion, an AI answer about to be sent by text and a
 * plan's rewritten wording (features.ts), and what a question in guided mode is about
 * (offline.ts). Nowhere else: see docs/AI.md for what it is never used for, and why.
 */
import { assessCrisis } from '@waypoint/core';
import { getEnv } from '@waypoint/core/env';
import type { CallerContext } from './features';
import {
  callJev,
  type JevRequest,
  JUDGE_PACE,
  JUDGE_PROVIDER,
  JudgeError,
  parseJevResponse,
} from './judge-client';
import { judgeTextLanguage } from './judge-language';
import {
  type JudgeAnswers,
  type JudgeQuestion,
  type JudgeState,
  prepareJudgeRequest,
  type QuestionSet,
} from './judge-questions';
import { providerHealthy, reportProviderFailure, reportProviderSuccess } from './providers';
import {
  abandonUsage,
  estimateTokens,
  failUsage,
  type JudgeFeature,
  monthlyBudgetSpent,
  reserveUsage,
  settleUsage,
} from './usage';

/**
 * Who is asking, and for whom. There is no `gate` here (a visitor's allowance of AI answers):
 * a check by the judge is not an answer, so it is never drawn on.
 */
export interface JudgeContext extends Omit<CallerContext, 'gate'> {
  /** The person's language: the judge is asked only in languages it has been switched on for. */
  locale: string;
  /** What is being checked, for the spending breakdown. */
  feature: JudgeFeature;
  /**
   * `interactive` (the default): someone is waiting, so one try of about 2.5 seconds.
   * `background`: 10 seconds a try and two retries.
   */
  pace?: keyof typeof JUDGE_PACE;
  /** The person left: stop waiting. What was reserved for the call stands. */
  signal?: AbortSignal;
}

export type JudgeOutcome<S> =
  | {
      ok: true;
      answers: JudgeAnswers<S>;
      /** The exact version that answered, to store next to any decision it informed. */
      model: string;
      /** TypeSafe's id for the request, when there is one. */
      requestId: string | null;
    }
  | { ok: false; reason: JudgeRefusal; error?: JudgeError };

/** Why there is no answer. Whatever the reason, the caller carries on without one. */
export type JudgeRefusal =
  /** No key, or no consent. */
  | 'no-provider'
  /** The person's language is not switched on for the judge. */
  | 'language'
  /** A mistake in the calling code: nothing was sent. */
  | 'invalid-request'
  /** It failed three times or more in a row and is being left alone for a while. */
  | 'paused'
  | 'monthly-budget'
  /** It was asked and gave no usable answer, or the call could not be counted or finished. */
  | 'failed';

/** A stand-in for the service: given the request, returns the reply body (or throws). */
export type JudgeStandIn = (
  request: JevRequest,
  opts: { timeoutMs: number; maxRetries: number; signal?: AbortSignal },
) => unknown;

let standIn: JudgeStandIn | null = null;

/**
 * Test helper: answer in place of the service (null to reset). The reply is checked exactly
 * as a real one is, so a stand-in cannot hand back something Jev could not.
 */
export function overrideJudgeForTests(fn: JudgeStandIn | null): void {
  standIn = fn;
}

/** A key is set. The privacy notice names TypeSafe when, and only when, this is true. */
export function judgeConfigured(): boolean {
  return Boolean(getEnv().TYPESAFE_API_KEY);
}

export function judgeAvailable(): boolean {
  return standIn !== null || judgeConfigured();
}

/** Whether the judge may be asked about text in this language ("en-GB" counts as "en"). */
export function judgeLanguageEnabled(locale: string): boolean {
  const language = locale.trim().toLowerCase().split(/[-_]/)[0] ?? '';
  return getEnv().AI_JUDGE_LOCALES.includes(language);
}

/**
 * Whether the judge may be asked about this text: the language it is written in must be
 * switched on, as well as the reader's. Someone reading in English can paste a message in
 * Swahili, and it is the text Jev is weaker on, not the person. The text's language must be
 * clear (`judgeTextLanguage`): text in a script Waypoint has no words for, or with too few
 * common words of any one language, is not sent.
 */
export function judgeReads(text: string, locale: string): boolean {
  return judgeLanguageEnabled(locale) && judgeLanguageEnabled(judgeTextLanguage(text));
}

/**
 * Imminent danger (crisis tier 3): nothing about that moment goes to the judge, as nothing
 * goes to a model. The check is Waypoint's own rules, on the person's own words.
 */
export function judgeBarredByCrisis(personsWords: string | null | undefined): boolean {
  return Boolean(personsWords) && assessCrisis(personsWords ?? '').tier >= 3;
}

/**
 * Jev's smallest documented calls report about 300 tokens for a one-sentence state, and its
 * documentation does not say whether the state is billed once or once per question. So the
 * reservation assumes the dearer reading; it is settled at what Jev reports.
 */
const BASE_TOKENS = 300;
const ANSWER_TOKENS = 25;

function estimate(request: JevRequest): { inputTokens: number; outputTokens: number } {
  const stateTokens = estimateTokens(JSON.stringify(request.state));
  const questions = Object.values(request.questions);
  return {
    inputTokens: questions.reduce(
      (sum, q) => sum + stateTokens + estimateTokens(JSON.stringify(q)),
      BASE_TOKENS,
    ),
    outputTokens: questions.length * ANSWER_TOKENS,
  };
}

/** Failures that say something about the service, as opposed to about one request. */
function serviceFailed(err: JudgeError): boolean {
  return err.kind === 'auth' || err.kind === 'provider' || err.kind === 'invalid-response';
}

/**
 * Ask the judge. The one way in: every feature that wants a typed second opinion calls this.
 * It never throws: whatever goes wrong, the caller gets a reason and carries on without.
 *
 * `questions` is a constant made with `defineQuestions`; `state` holds one value for each
 * field those questions read, and is where anything a person typed or pasted goes.
 */
export async function runJudge<F extends string, Q extends Record<string, JudgeQuestion>>(
  ctx: JudgeContext,
  state: JudgeState<NoInfer<F>>,
  questions: QuestionSet<F, Q>,
): Promise<JudgeOutcome<QuestionSet<F, Q>>> {
  // Never local: without consent there is nobody to ask (the same answer as having no key).
  if (!judgeAvailable() || !ctx.allowExternal) return { ok: false, reason: 'no-provider' };
  if (!judgeLanguageEnabled(ctx.locale)) return { ok: false, reason: 'language' };
  const env = getEnv();
  const prepared = prepareJudgeRequest(questions, state, env.AI_JUDGE_MODEL);
  if (!prepared.ok)
    return {
      ok: false,
      reason: 'invalid-request',
      error: new JudgeError('request', `Not sent to Jev: ${prepared.problem}`),
    };
  const { request } = prepared;
  if (ctx.signal?.aborted)
    return {
      ok: false,
      reason: 'failed',
      error: new JudgeError('aborted', 'The caller stopped waiting'),
    };
  if (!providerHealthy(JUDGE_PROVIDER)) return { ok: false, reason: 'paused' };
  // The monthly budget only. A check is not an answer, so the person's daily allowance is
  // neither consulted nor drawn on.
  let reserved: Awaited<ReturnType<typeof reserveUsage>>;
  try {
    if (await monthlyBudgetSpent(ctx.db, ctx.isGuest))
      return { ok: false, reason: 'monthly-budget' };
    reserved = await reserveUsage(ctx.db, {
      userId: ctx.userId,
      isGuest: ctx.isGuest,
      feature: ctx.feature,
      provider: JUDGE_PROVIDER,
      model: request.model,
      ...estimate(request),
    });
  } catch {
    // Every call is counted before it is made: one that cannot be counted is not made.
    return {
      ok: false,
      reason: 'failed',
      error: new JudgeError('request', 'Not sent to Jev: the call could not be counted'),
    };
  }
  if (!reserved.ok) return { ok: false, reason: reserved.reason };

  const started = Date.now();
  const opts = { ...JUDGE_PACE[ctx.pace ?? 'interactive'], signal: ctx.signal };
  try {
    const { data, requestId } = standIn
      ? { data: parseJevResponse(request, await standIn(request, opts)), requestId: null }
      : await callJev(request, { ...opts, apiKey: env.TYPESAFE_API_KEY ?? '' });
    reportProviderSuccess(JUDGE_PROVIDER);
    await settleUsage(ctx.db, reserved.id, {
      provider: JUDGE_PROVIDER,
      // The version that really answered, as Jev reports it.
      model: data.model,
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
      latencyMs: Date.now() - started,
      status: 'ok',
    }).catch(() => undefined);
    return {
      ok: true,
      answers: data.answers as JudgeAnswers<QuestionSet<F, Q>>,
      model: data.model,
      requestId,
    };
  } catch (err) {
    const latencyMs = Date.now() - started;
    // Anything unexpected is reported by its name only: a message could quote what was sent.
    const error =
      err instanceof JudgeError
        ? err
        : new JudgeError(
            ctx.signal?.aborted ? 'aborted' : 'provider',
            `The judge could not be asked (${err instanceof Error ? err.name : 'error'})`,
          );
    if (ctx.signal?.aborted || error.kind === 'aborted') {
      // Cut off part-way: what was sent may well have been used, so the reservation stands.
      await abandonUsage(ctx.db, reserved.id, latencyMs).catch(() => undefined);
      return { ok: false, reason: 'failed', error };
    }
    if (serviceFailed(error)) reportProviderFailure(JUDGE_PROVIDER);
    await failUsage(ctx.db, reserved.id, {
      provider: JUDGE_PROVIDER,
      model: request.model,
      latencyMs,
    }).catch(() => undefined);
    return { ok: false, reason: 'failed', error };
  }
}
