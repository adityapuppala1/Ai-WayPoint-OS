/**
 * Call a model with automatic fallback across configured providers, budget checks and usage
 * recording. Returns null when no model could answer, so callers fall back to offline logic.
 */
import type { Database } from '@waypoint/db';
import { APICallError, type LanguageModelUsage } from 'ai';
import {
  type ModelChoice,
  modelCandidates,
  reportProviderFailure,
  reportProviderSuccess,
  type Tier,
} from './providers';
import {
  type AiFeature,
  checkBudget,
  failUsage,
  recordUsage,
  reserveUsage,
  settleUsage,
} from './usage';

export interface RunOptions {
  db: Database;
  tier: Tier;
  feature: AiFeature;
  userId?: string | null;
  isGuest?: boolean;
  /** Only use self-hosted models (no consent to external AI). */
  localOnly?: boolean;
  /** Skip the budget check (e.g. internal evals). */
  skipBudget?: boolean;
  /** Asked once before a model is used; false means "not now" (the caller falls back). */
  gate?: () => Promise<boolean>;
  /** What one call is expected to use at most, to reserve its cost before it is made. */
  estimate?: { inputTokens: number; outputTokens: number };
}

export type RunOutcome<T> =
  | { ok: true; value: T; choice: ModelChoice }
  | {
      ok: false;
      reason: 'no-provider' | 'monthly-budget' | 'daily-limit' | 'all-failed';
      error?: unknown;
    };

function isAbort(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
}

export async function runModel<T>(
  opts: RunOptions,
  call: (choice: ModelChoice) => Promise<{ value: T; usage?: LanguageModelUsage }>,
): Promise<RunOutcome<T>> {
  const candidates = modelCandidates(opts.tier, { localOnly: opts.localOnly });
  if (!candidates.length) return { ok: false, reason: 'no-provider' };
  if (!opts.skipBudget) {
    const budget = await checkBudget(opts.db, { userId: opts.userId, isGuest: opts.isGuest });
    if (!budget.ok) return { ok: false, reason: budget.reason ?? 'monthly-budget' };
  }
  if (opts.gate && !(await opts.gate())) return { ok: false, reason: 'daily-limit' };
  const estimate = opts.estimate ?? { inputTokens: 1500, outputTokens: 500 };
  let lastError: unknown;
  for (const choice of candidates) {
    const started = Date.now();
    // Counted before the call, at what it could cost (see reserveUsage); settled afterwards.
    let reservation: string | null = null;
    if (!opts.skipBudget) {
      const reserved = await reserveUsage(opts.db, {
        userId: opts.userId,
        isGuest: opts.isGuest,
        feature: opts.feature,
        provider: choice.provider,
        model: choice.modelId,
        ...estimate,
      });
      if (!reserved.ok) return { ok: false, reason: reserved.reason };
      reservation = reserved.id;
    }
    const record = (status: 'ok' | 'error', tokens: { input?: number; output?: number } = {}) => {
      const actual = {
        provider: choice.provider,
        model: choice.modelId,
        inputTokens: tokens.input ?? 0,
        outputTokens: tokens.output ?? 0,
        latencyMs: Date.now() - started,
        status,
      };
      return (
        reservation
          ? status === 'error'
            ? failUsage(opts.db, reservation, actual)
            : settleUsage(opts.db, reservation, actual)
          : recordUsage(opts.db, { userId: opts.userId, feature: opts.feature, ...actual })
      ).catch(() => undefined);
    };
    try {
      const { value, usage } = await call(choice);
      reportProviderSuccess(choice.provider);
      await record('ok', { input: usage?.inputTokens, output: usage?.outputTokens });
      return { ok: true, value, choice };
    } catch (err) {
      lastError = err;
      // Cut off part-way: the reservation stands as the estimate of what was used.
      if (isAbort(err)) break;
      const providerProblem =
        APICallError.isInstance(err) ||
        (err instanceof Error && /fetch|network|ECONN|ETIMEDOUT/i.test(err.message));
      if (providerProblem) reportProviderFailure(choice.provider);
      await record('error');
    }
  }
  return { ok: false, reason: 'all-failed', error: lastError };
}
