/**
 * Signals: what is changing, and why it matters to this person. Every item carries the
 * reasons it was shown, so "Why am I seeing this?" always has a truthful answer.
 */
import { z } from '@hono/zod-openapi';
import { type LifeStage, type RelevanceReason, relevance, type Situation } from '@waypoint/core';
import {
  and,
  type Database,
  desc,
  eq,
  gte,
  inArray,
  signalStates,
  signals,
  sql,
} from '@waypoint/db';
import { notFound } from '../lib/problem';
import type { Profile } from './me';

export const SignalSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    summary: z.string(),
    source: z.string(),
    sourceName: z.string(),
    sourceUrl: z.string(),
    language: z.string(),
    publishedAt: z.string(),
    importance: z.number().int(),
    topics: z.array(z.string()),
    regions: z.array(z.string()),
    isDemo: z.boolean(),
    relevance: z.number(),
    reasons: z.array(z.string()),
    saved: z.boolean(),
  })
  .openapi('Signal');

export type SignalView = z.infer<typeof SignalSchema>;

type SignalRow = typeof signals.$inferSelect;

function view(
  row: SignalRow,
  rel: { score: number; reasons: RelevanceReason[] },
  saved: boolean,
): SignalView {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    source: row.source,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    language: row.language,
    publishedAt: row.publishedAt.toISOString(),
    importance: row.importance,
    topics: row.topics,
    regions: row.regions,
    isDemo: row.isDemo,
    relevance: rel.score,
    reasons: rel.reasons,
    saved,
  };
}

/** Signals ranked for this person: relevance, importance and freshness. */
export async function relevantSignals(
  db: Database,
  who: {
    userId: string | null;
    profile: Profile | null;
    skillIds: string[];
    /** Consent `foresight_matching`: without it only the person's country is used. */
    matching: boolean;
  },
  opts: { limit?: number; days?: number; query?: string; topic?: string } = {},
): Promise<SignalView[]> {
  const since = new Date(Date.now() - (opts.days ?? 180) * 86_400_000);
  const where = [gte(signals.publishedAt, since), eq(signals.isDemo, false)];
  if (opts.query?.trim()) {
    where.push(sql`${signals.search} @@ websearch_to_tsquery('simple', ${opts.query.trim()})`);
  }
  if (opts.topic) where.push(sql`${opts.topic} = any(${signals.topics})`);
  const rows = await db
    .select()
    .from(signals)
    .where(and(...where))
    .orderBy(desc(signals.publishedAt))
    .limit(200);

  const states =
    who.userId && rows.length
      ? await db
          .select()
          .from(signalStates)
          .where(
            and(
              eq(signalStates.userId, who.userId),
              inArray(
                signalStates.signalId,
                rows.map((r) => r.id),
              ),
            ),
          )
      : [];
  const stateOf = new Map(states.map((s) => [s.signalId, s]));

  const p = who.profile;
  const m = who.matching;
  const profile = {
    country: p?.country ?? undefined,
    region: m ? (p?.region ?? undefined) : undefined,
    lifeStage: (m ? (p?.lifeStage ?? undefined) : undefined) as LifeStage | undefined,
    situation: (m ? (p?.situation ?? undefined) : undefined) as Situation | undefined,
    sectors: m ? (p?.sectors ?? []) : [],
    skills: m ? who.skillIds : [],
    roles: m && p?.currentRole ? [p.currentRole] : [],
  };
  const now = Date.now();
  return rows
    .filter((r) => !stateOf.get(r.id)?.dismissed)
    .map((r) => {
      const rel = relevance(profile, r);
      const ageDays = (now - r.publishedAt.getTime()) / 86_400_000;
      const freshness = 1 / (1 + ageDays / 45);
      const rank = rel.score * 0.6 + (r.importance / 5) * 0.25 + freshness * 0.15;
      return { r, rel, rank };
    })
    .filter((x) => x.rel.reasons.length > 0)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, opts.limit ?? 20)
    .map((x) => view(x.r, x.rel, stateOf.get(x.r.id)?.saved ?? false));
}

export const SignalStateInputSchema = z
  .object({
    saved: z.boolean().optional(),
    dismissed: z.boolean().optional(),
    feedback: z.enum(['useful', 'not-relevant', 'wrong']).optional(),
  })
  .openapi('SignalStateInput');

export async function setSignalState(
  db: Database,
  userId: string,
  signalId: string,
  input: z.infer<typeof SignalStateInputSchema>,
): Promise<void> {
  const [exists] = await db
    .select({ id: signals.id })
    .from(signals)
    .where(eq(signals.id, signalId))
    .limit(1);
  if (!exists) throw notFound('Signal');
  const set = {
    ...(input.saved !== undefined ? { saved: input.saved } : {}),
    ...(input.dismissed !== undefined ? { dismissed: input.dismissed } : {}),
    ...(input.feedback !== undefined ? { feedback: input.feedback } : {}),
    seenAt: new Date(),
    updatedAt: new Date(),
  };
  await db
    .insert(signalStates)
    .values({ userId, signalId, ...set })
    .onConflictDoUpdate({ target: [signalStates.userId, signalStates.signalId], set });
}
