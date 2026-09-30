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
import { type AiFeature, checkBudget, recordUsage } from './usage';

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
  let lastError: unknown;
  for (const choice of candidates) {
    const started = Date.now();
    try {
      const { value, usage } = await call(choice);
      reportProviderSuccess(choice.provider);
      await recordUsage(opts.db, {
        userId: opts.userId,
        feature: opts.feature,
        provider: choice.provider,
        model: choice.modelId,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        latencyMs: Date.now() - started,
        status: 'ok',
      }).catch(() => undefined);
      return { ok: true, value, choice };
    } catch (err) {
      lastError = err;
      if (isAbort(err)) break;
      const providerProblem =
        APICallError.isInstance(err) ||
        (err instanceof Error && /fetch|network|ECONN|ETIMEDOUT/i.test(err.message));
      if (providerProblem) reportProviderFailure(choice.provider);
      await recordUsage(opts.db, {
        userId: opts.userId,
        feature: opts.feature,
        provider: choice.provider,
        model: choice.modelId,
        latencyMs: Date.now() - started,
        status: 'error',
      }).catch(() => undefined);
    }
  }
  return { ok: false, reason: 'all-failed', error: lastError };
}
