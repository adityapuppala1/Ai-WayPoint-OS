/**
 * Signals: what is changing, and why it matters to this person. Every item carries the
 * reasons it was shown, so "Why am I seeing this?" always has a truthful answer.
 *
 * Signals come from the seed and from staff, who add them by hand with the source they read.
 * Nothing here is generated: a signal without a source cannot be published.
 */
import { createHash } from 'node:crypto';
import { z } from '@hono/zod-openapi';
import {
  type LifeStage,
  LOCALES,
  type RelevanceReason,
  relevance,
  type Situation,
} from '@waypoint/core';
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
import { type Actor, audit } from '../lib/audit';
import { ApiError, notFound } from '../lib/problem';
import { HttpsAddress, Region } from './forecasts';
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

/** Who is looking, and how much of what they told us may be used to rank signals. */
export interface SignalReader {
  userId: string | null;
  profile: Profile | null;
  skillIds: string[];
  /** Consent `foresight_matching`: without it only the person's country is used. */
  matching: boolean;
}

function relevanceProfile(who: SignalReader) {
  const p = who.profile;
  const m = who.matching;
  return {
    country: p?.country ?? undefined,
    region: m ? (p?.region ?? undefined) : undefined,
    lifeStage: (m ? (p?.lifeStage ?? undefined) : undefined) as LifeStage | undefined,
    situation: (m ? (p?.situation ?? undefined) : undefined) as Situation | undefined,
    sectors: m ? (p?.sectors ?? []) : [],
    skills: m ? who.skillIds : [],
    roles: m && p?.currentRole ? [p.currentRole] : [],
  };
}

/** Signals ranked for this person: relevance, importance and freshness. */
export async function relevantSignals(
  db: Database,
  who: SignalReader,
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

  const profile = relevanceProfile(who);
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

/**
 * What this person saved, the one saved last first. Saving is how someone keeps a signal, so
 * this list does not look back a limited time the way `relevantSignals` does, and an item
 * stays on it even if it would no longer be ranked for them (they moved country, say).
 */
export async function savedSignals(db: Database, who: SignalReader): Promise<SignalView[]> {
  if (!who.userId) return [];
  const rows = await db
    .select({ signal: signals })
    .from(signalStates)
    .innerJoin(signals, eq(signals.id, signalStates.signalId))
    .where(
      and(
        eq(signalStates.userId, who.userId),
        eq(signalStates.saved, true),
        eq(signals.isDemo, false),
      ),
    )
    .orderBy(desc(signalStates.updatedAt))
    .limit(200);
  const profile = relevanceProfile(who);
  return rows.map((r) => view(r.signal, relevance(profile, r.signal), true));
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

// ─────────────────────────────── Staff: add and withdraw ───────────────────────────────

/** What kind of place a signal was read in. Staff choose; it is never guessed. */
export const SIGNAL_SOURCE_KINDS = ['official', 'news', 'labour-market', 'community'] as const;

/** The Signals page looks back this far, so a signal dated earlier would never be seen. */
export const SIGNAL_WINDOW_DAYS = 365;

const DAY = 86_400_000;

export const SignalInputSchema = z
  .object({
    title: z.string().trim().min(12).max(200),
    /** What changed, in the staff member's own words: a summary of the source, not a copy. */
    summary: z.string().trim().min(40).max(800),
    source: z.enum(SIGNAL_SOURCE_KINDS).default('official'),
    /** Where it was read. A signal is never published without a source people can open. */
    sourceName: z.string().trim().min(2).max(120),
    sourceUrl: HttpsAddress,
    /** The day the source published it (YYYY-MM-DD): today or earlier. */
    publishedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    language: z.enum(LOCALES).default('en'),
    /** ISO country codes; leave empty for "everywhere". */
    regions: z.array(Region).max(30).default([]),
    sectors: z
      .array(
        z
          .string()
          .trim()
          .min(2)
          .max(40)
          .transform((v) => v.toLowerCase()),
      )
      .max(10)
      .default([]),
    /** 1 (minor) to 5 (major). */
    importance: z.number().int().min(1).max(5).default(2),
  })
  .openapi('SignalInput');

export const AdminSignalSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  source: z.string(),
  sourceName: z.string(),
  sourceUrl: z.string(),
  language: z.string(),
  publishedAt: z.string(),
  regions: z.array(z.string()),
  sectors: z.array(z.string()),
  importance: z.number().int(),
  /** When it was added to Waypoint. */
  createdAt: z.string(),
  /** Whether people can see it now: it is inside the time the Signals page looks back. */
  shown: z.boolean(),
});

export const AdminSignalListSchema = z
  .object({ items: z.array(AdminSignalSchema), total: z.number().int() })
  .openapi('AdminSignalList');

export type AdminSignalList = z.infer<typeof AdminSignalListSchema>;

/** Every real signal, the one added last first, so staff can see and withdraw what is shown. */
export async function adminSignals(db: Database, now = new Date()): Promise<AdminSignalList> {
  const rows = await db
    .select()
    .from(signals)
    .where(eq(signals.isDemo, false))
    .orderBy(desc(signals.createdAt), desc(signals.id))
    .limit(200);
  const [total] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(signals)
    .where(eq(signals.isDemo, false));
  const since = now.getTime() - SIGNAL_WINDOW_DAYS * DAY;
  return {
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      source: r.source,
      sourceName: r.sourceName,
      sourceUrl: r.sourceUrl,
      language: r.language,
      publishedAt: r.publishedAt.toISOString(),
      regions: r.regions,
      sectors: r.sectors,
      importance: r.importance,
      createdAt: r.createdAt.toISOString(),
      shown: r.publishedAt.getTime() >= since,
    })),
    total: Number(total?.n ?? 0),
  };
}

/**
 * Publish a signal staff read somewhere: what changed, where it says so, and who it is about.
 * It is shown straight away to the people it is about, with its source.
 */
export async function publishSignal(
  db: Database,
  actor: Actor,
  input: z.infer<typeof SignalInputSchema>,
  now = new Date(),
): Promise<{ id: string }> {
  const publishedAt = new Date(`${input.publishedOn}T00:00:00Z`);
  // 30 February is not a day: refuse it rather than let it become 2 March.
  if (
    Number.isNaN(publishedAt.getTime()) ||
    publishedAt.toISOString().slice(0, 10) !== input.publishedOn
  )
    throw new ApiError(422, 'date-invalid', 'That day does not exist.');
  // A day's grace: "today" for staff east of Greenwich is still tomorrow in UTC for a while.
  if (publishedAt.getTime() > now.getTime() + DAY)
    throw new ApiError(422, 'date-future', 'A signal is something that has already happened.');
  if (publishedAt.getTime() < now.getTime() - SIGNAL_WINDOW_DAYS * DAY)
    throw new ApiError(
      422,
      'date-old',
      'Signals older than a year are not shown to anyone. Choose something more recent.',
    );
  // The same fingerprint the seed uses, so a seeded signal cannot be added a second time.
  const contentHash = createHash('sha256')
    .update(`${input.sourceUrl}|${input.title}`)
    .digest('hex');
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(signals)
      .values({
        source: input.source,
        sourceName: input.sourceName,
        sourceUrl: input.sourceUrl,
        title: input.title,
        summary: input.summary,
        language: input.language,
        publishedAt,
        fetchedAt: now,
        regions: [...new Set(input.regions)],
        sectors: [...new Set(input.sectors)],
        importance: input.importance,
        contentHash,
      })
      .onConflictDoNothing({ target: signals.contentHash })
      .returning({ id: signals.id });
    if (!row)
      throw new ApiError(409, 'duplicate', 'This signal is already published, from this source.');
    await audit(tx, actor, {
      action: 'signal.published',
      targetType: 'signal',
      targetId: row.id,
      meta: { sourceUrl: input.sourceUrl, regions: input.regions, importance: input.importance },
    });
    return { id: row.id };
  });
}

/**
 * Take a signal down for everyone (it was wrong, or its source has gone). It also leaves the
 * lists of people who saved it: a withdrawn signal is one Waypoint no longer stands behind.
 * What it said and where it came from stay in the audit log.
 */
export async function withdrawSignal(db: Database, actor: Actor, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(signals)
      .where(and(eq(signals.id, id), eq(signals.isDemo, false)))
      .returning({ title: signals.title, sourceUrl: signals.sourceUrl });
    if (!row) throw notFound('Signal');
    await audit(tx, actor, {
      action: 'signal.withdrawn',
      targetType: 'signal',
      targetId: id,
      meta: { title: row.title, sourceUrl: row.sourceUrl },
    });
  });
}
