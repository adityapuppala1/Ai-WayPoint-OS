/**
 * AI cost control. Every model call is recorded (tokens, estimated cost, latency, outcome).
 * When the monthly budget is used up, Waypoint keeps working in offline mode — rules-based
 * Shield, template plans and guided answers — rather than failing.
 */
import { getEnv } from '@waypoint/core/env';
import { aiUsage, and, type Database, eq, gte, sql } from '@waypoint/db';

/** Estimated USD per million tokens (input, output). Override with AI_PRICING_JSON. */
const DEFAULT_PRICING: Record<string, [number, number]> = {
  'claude-haiku-4-5': [1, 5],
  'claude-sonnet-5-5': [3, 15],
  'gpt-5.4-mini': [0.25, 2],
  'gpt-5.5': [1.25, 10],
  'gemini-3.5-flash-lite': [0.1, 0.4],
  'gemini-2.5-pro': [1.25, 10],
  'text-embedding-3-small': [0.02, 0],
  'gemini-embedding-001': [0.15, 0],
};

let pricing: Record<string, [number, number]> | undefined;

function priceTable(): Record<string, [number, number]> {
  if (pricing) return pricing;
  pricing = { ...DEFAULT_PRICING };
  const raw = process.env.AI_PRICING_JSON;
  if (raw) {
    try {
      Object.assign(pricing, JSON.parse(raw) as Record<string, [number, number]>);
    } catch {
      // ignore malformed overrides
    }
  }
  return pricing;
}

export function estimateCostUsd(
  provider: string,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  if (provider === 'ollama') return 0;
  const [inP, outP] = priceTable()[modelId] ?? [3, 15];
  return (inputTokens * inP + outputTokens * outP) / 1_000_000;
}

export type AiFeature =
  | 'ask'
  | 'shield'
  | 'plan'
  | 'signal-summary'
  | 'forecast'
  | 'moderation'
  | 'embedding'
  | 'eval';
export type AiStatus = 'ok' | 'error' | 'fallback' | 'blocked' | 'offline';

export async function recordUsage(
  db: Database,
  u: {
    userId?: string | null;
    organizationId?: string | null;
    feature: AiFeature;
    provider: string;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
    status: AiStatus;
  },
): Promise<void> {
  const inputTokens = u.inputTokens ?? 0;
  const outputTokens = u.outputTokens ?? 0;
  await db.insert(aiUsage).values({
    userId: u.userId ?? null,
    organizationId: u.organizationId ?? null,
    feature: u.feature,
    provider: u.provider,
    model: u.model,
    inputTokens,
    outputTokens,
    costUsd: estimateCostUsd(u.provider, u.model, inputTokens, outputTokens),
    latencyMs: u.latencyMs,
    status: u.status,
  });
  spendCache = undefined;
}

let spendCache: { at: number; value: number } | undefined;

export async function monthSpendUsd(db: Database): Promise<number> {
  if (spendCache && Date.now() - spendCache.at < 60_000) return spendCache.value;
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)::float8` })
    .from(aiUsage)
    .where(gte(aiUsage.createdAt, start));
  const value = Number(row?.total ?? 0);
  spendCache = { at: Date.now(), value };
  return value;
}

export interface BudgetDecision {
  ok: boolean;
  reason?: 'monthly-budget' | 'daily-limit';
}

/** Daily AI calls allowed per person. Guests get fewer to discourage abuse. */
export const DAILY_LIMITS = { guest: 20, member: 200 } as const;

export async function checkBudget(
  db: Database,
  who: { userId?: string | null; isGuest?: boolean },
): Promise<BudgetDecision> {
  const env = getEnv();
  if (env.AI_MONTHLY_BUDGET_USD > 0 && (await monthSpendUsd(db)) >= env.AI_MONTHLY_BUDGET_USD) {
    return { ok: false, reason: 'monthly-budget' };
  }
  if (who.userId) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(aiUsage)
      .where(and(eq(aiUsage.userId, who.userId), gte(aiUsage.createdAt, since)));
    const limit = who.isGuest ? DAILY_LIMITS.guest : DAILY_LIMITS.member;
    if ((row?.n ?? 0) >= limit) return { ok: false, reason: 'daily-limit' };
  }
  return { ok: true };
}
