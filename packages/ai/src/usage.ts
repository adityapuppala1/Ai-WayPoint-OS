/**
 * AI cost control. Every model call is recorded (tokens, estimated cost, latency, outcome).
 * When the monthly budget is used up, Waypoint keeps working in offline mode — rules-based
 * Shield, template plans and guided answers — rather than failing.
 */
import { getEnv } from '@waypoint/core/env';
import { aiUsage, and, type Database, eq, gte, notInArray, sql } from '@waypoint/db';
import { JUDGE_PROVIDER } from './judge-client';

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

/**
 * TypeSafe's Jev, whichever version is pinned: $0.042 per million tokens sent, answers free.
 * Priced by provider, not by model name, so a newer pinned version is never costed as an
 * unknown model ($3 and $15 per million: about seventy times too much).
 */
const JUDGE_PRICING: [number, number] = [0.042, 0];

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
  const [inP, outP] =
    priceTable()[modelId] ?? (provider === JUDGE_PROVIDER ? JUDGE_PRICING : [3, 15]);
  return (inputTokens * inP + outputTokens * outP) / 1_000_000;
}

/**
 * What the judge's calls are recorded under, one name for each thing it checks: a message in
 * Scam Shield, the wording of a rewritten plan, an answer about to be sent by text. They are
 * checks, not answers, so they never count towards a person's daily allowance (checkBudget).
 */
export const JUDGE_FEATURES = ['judge-shield', 'judge-plan', 'judge-reply'] as const;
export type JudgeFeature = (typeof JUDGE_FEATURES)[number];

export type AiFeature =
  | 'ask'
  | 'shield'
  | 'plan'
  | 'signal-summary'
  | 'moderation'
  | 'embedding'
  | 'eval'
  | JudgeFeature;
export type AiStatus =
  | 'ok'
  | 'error'
  | 'fallback'
  | 'blocked'
  | 'offline'
  /** Counted before the call was made, at its estimated cost; settled when the call ends. */
  | 'reserved'
  /** The person left before the answer finished: the estimate stands. */
  | 'aborted';

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

function monthStart(): Date {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

/**
 * The share of the monthly budget guests can use. A guest session costs nothing to create, so
 * without this a few scripts could spend the whole budget and leave everyone in guided mode;
 * the rest is kept for people with accounts.
 */
export const GUEST_BUDGET_SHARE = 0.7;

function monthlyLimit(isGuest?: boolean): number {
  const budget = getEnv().AI_MONTHLY_BUDGET_USD;
  return isGuest ? budget * GUEST_BUDGET_SHARE : budget;
}

/** Any fixed number: every reservation takes the same lock, so they are made one at a time. */
const BUDGET_LOCK = 7_291_055;

export interface UsageEstimate {
  userId?: string | null;
  isGuest?: boolean;
  feature: AiFeature;
  provider: string;
  model: string;
  /** What the call is expected to use at most (prompt size, output limit). */
  inputTokens: number;
  outputTokens: number;
}

/**
 * Count a model call before it is made, at its estimated cost. Checking the budget first and
 * recording afterwards let a burst of requests all pass the check before any of them was
 * counted, and an answer that was cut off was never counted at all. Near the limit the check
 * and the reservation happen under one lock, so the budget cannot be overshot; the row is
 * settled at the real cost when the call ends, and stands as it is if it never does.
 */
export async function reserveUsage(
  db: Database,
  r: UsageEstimate,
): Promise<{ ok: true; id: string } | { ok: false; reason: 'monthly-budget' }> {
  const cost = estimateCostUsd(r.provider, r.model, r.inputTokens, r.outputTokens);
  const values = {
    userId: r.userId ?? null,
    feature: r.feature,
    provider: r.provider,
    model: r.model,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    costUsd: cost,
    status: 'reserved' satisfies AiStatus,
  };
  const budget = getEnv().AI_MONTHLY_BUDGET_USD;
  const limit = monthlyLimit(r.isGuest);
  // Far from the limit (or nothing to pay, or no budget set) there is nothing to guard.
  if (budget <= 0 || cost === 0 || (await monthSpendUsd(db)) + cost < limit * 0.9) {
    const [row] = await db.insert(aiUsage).values(values).returning({ id: aiUsage.id });
    if (!row) throw new Error('Could not record AI usage');
    spendCache = undefined;
    return { ok: true, id: row.id };
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${BUDGET_LOCK})`);
    const [spent] = await tx
      .select({ total: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)::float8` })
      .from(aiUsage)
      .where(gte(aiUsage.createdAt, monthStart()));
    if (Number(spent?.total ?? 0) + cost > limit)
      return { ok: false as const, reason: 'monthly-budget' as const };
    const [row] = await tx.insert(aiUsage).values(values).returning({ id: aiUsage.id });
    if (!row) throw new Error('Could not record AI usage');
    spendCache = undefined;
    return { ok: true as const, id: row.id };
  });
}

/** Replace a reservation's estimate with what the call really used. */
export async function settleUsage(
  db: Database,
  id: string,
  actual: {
    provider: string;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
    status: AiStatus;
  },
): Promise<void> {
  const inputTokens = actual.inputTokens ?? 0;
  const outputTokens = actual.outputTokens ?? 0;
  await db
    .update(aiUsage)
    .set({
      inputTokens,
      outputTokens,
      costUsd: estimateCostUsd(actual.provider, actual.model, inputTokens, outputTokens),
      latencyMs: actual.latencyMs,
      status: actual.status,
    })
    .where(eq(aiUsage.id, id));
  spendCache = undefined;
}

/**
 * The call failed. The prompt was sent and may well be billed, so the estimate for the input
 * stands; nothing came back, so nothing is counted for output.
 */
export async function failUsage(
  db: Database,
  id: string,
  call: { provider: string; model: string; latencyMs?: number },
): Promise<void> {
  const [row] = await db
    .select({ inputTokens: aiUsage.inputTokens })
    .from(aiUsage)
    .where(eq(aiUsage.id, id))
    .limit(1);
  await settleUsage(db, id, {
    ...call,
    inputTokens: row?.inputTokens ?? 0,
    outputTokens: 0,
    status: 'error',
  });
}

/** The person left mid-answer: keep the estimate (what was generated was paid for). */
export async function abandonUsage(db: Database, id: string, latencyMs: number): Promise<void> {
  await db
    .update(aiUsage)
    .set({ status: 'aborted' satisfies AiStatus, latencyMs })
    .where(and(eq(aiUsage.id, id), eq(aiUsage.status, 'reserved')));
}

/** A rough token count for a prompt: about three characters to a token, rounded up. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

/** Test helper: forget the cached monthly total. */
export function resetSpendCacheForTests(): void {
  spendCache = undefined;
}

export async function monthSpendUsd(db: Database): Promise<number> {
  if (spendCache && Date.now() - spendCache.at < 60_000) return spendCache.value;
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)::float8` })
    .from(aiUsage)
    .where(gte(aiUsage.createdAt, monthStart()));
  const value = Number(row?.total ?? 0);
  spendCache = { at: Date.now(), value };
  return value;
}

export interface BudgetDecision {
  ok: boolean;
  reason?: 'monthly-budget' | 'daily-limit';
}

/** Daily AI answers allowed per person. Guests get fewer to discourage abuse. */
export const DAILY_LIMITS = { guest: 20, member: 200 } as const;

/** True when this month's budget (a guest's share of it, for a guest) is already spent. */
export async function monthlyBudgetSpent(db: Database, isGuest?: boolean): Promise<boolean> {
  return getEnv().AI_MONTHLY_BUDGET_USD > 0 && (await monthSpendUsd(db)) >= monthlyLimit(isGuest);
}

export async function checkBudget(
  db: Database,
  who: { userId?: string | null; isGuest?: boolean },
): Promise<BudgetDecision> {
  if (await monthlyBudgetSpent(db, who.isGuest)) return { ok: false, reason: 'monthly-budget' };
  if (who.userId) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(aiUsage)
      .where(
        and(
          eq(aiUsage.userId, who.userId),
          gte(aiUsage.createdAt, since),
          // The allowance is of answers. A check by the judge is not one: counting it would
          // quietly halve what a person can ask in a day.
          notInArray(aiUsage.feature, [...JUDGE_FEATURES]),
        ),
      );
    const limit = who.isGuest ? DAILY_LIMITS.guest : DAILY_LIMITS.member;
    if ((row?.n ?? 0) >= limit) return { ok: false, reason: 'daily-limit' };
  }
  return { ok: true };
}
