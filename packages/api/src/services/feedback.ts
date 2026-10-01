/**
 * Feedback, as the team works through it: what people told us, where the team is with each
 * one (new, planned, done, or not something we will do), a note for the rest of the team,
 * and a reply by email to anyone who asked for one. Everything the team does is recorded.
 *
 * Nobody is named here except someone who asked for a reply, and then only by the address
 * to write back to; a guest cannot be identified at all.
 */
import { z } from '@hono/zod-openapi';
import { getEnv } from '@waypoint/core/env';
import { redactPII, sealWithKek } from '@waypoint/core/privacy';
import {
  and,
  count,
  type Database,
  desc,
  enqueueMessage,
  eq,
  feedback,
  gte,
  lt,
  profiles,
  type SQL,
  sql,
  users,
} from '@waypoint/db';
import { alias } from 'drizzle-orm/pg-core';
import { type Actor, audit } from '../lib/audit';
import { ApiError, notFound } from '../lib/problem';
import { rateLimit } from '../lib/request';

export const FEEDBACK_STATUSES = ['new', 'planned', 'done', 'wont'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

const num = (v: unknown) => Number(v ?? 0);

/** An address that reaches someone: phone accounts carry a placeholder that reaches nobody. */
const realAddress = (email: string | null, isGuest: boolean | null) =>
  email && !isGuest && !email.endsWith('.invalid') ? email : null;

export const FeedbackItemSchema = z.object({
  id: z.string(),
  /** The part of Waypoint it is about. */
  module: z.string(),
  page: z.string().nullable(),
  /** 1 (did not work) to 5 (worked well), when the person gave one. */
  rating: z.number().int().nullable(),
  /** What they wrote. Personal details were removed before it was stored. */
  message: z.string().nullable(),
  /**
   * Where to write back, only when the person asked for a reply and has an account with an
   * address. Everyone else, and every guest, stays unnamed: nothing here says who they are.
   */
  replyTo: z.string().nullable(),
  status: z.enum(FEEDBACK_STATUSES),
  note: z.string().nullable(),
  /** Who on the team last changed it, and when. */
  handledBy: z.string().nullable(),
  handledAt: z.string().nullable(),
  repliedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const FeedbackQuerySchema = z.object({
  status: z.enum(['all', ...FEEDBACK_STATUSES]).default('new'),
  module: z
    .string()
    .regex(/^[a-z-]{1,40}$/)
    .optional(),
  /** low: 1–2, high: 4–5. */
  rating: z.enum(['any', 'low', 'high']).default('any'),
  /** Only those whose sender asked for a reply. */
  wantsReply: z.enum(['true', 'false']).optional(),
  before: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type FeedbackQuery = z.input<typeof FeedbackQuerySchema>;

export const FeedbackListSchema = z
  .object({
    items: z.array(FeedbackItemSchema),
    /** Matching the filters, across every page. */
    total: z.number().int(),
    next: z.string().nullable(),
    /** How many are in each state (with the other filters applied). */
    byStatus: z.record(z.string(), z.number().int()),
    /** The parts of Waypoint people wrote about, most first, with their average rating. */
    modules: z.array(
      z.object({ module: z.string(), n: z.number().int(), avgRating: z.number().nullable() }),
    ),
    /** The last 30 days, to see how people feel. */
    month: z.object({
      n: z.number().int(),
      avgRating: z.number().nullable(),
      waitingReply: z.number().int(),
    }),
  })
  .openapi('FeedbackList');

export type FeedbackList = z.infer<typeof FeedbackListSchema>;

/** What people told us, newest first, a page at a time, filtered. */
export async function feedbackList(db: Database, query: FeedbackQuery = {}): Promise<FeedbackList> {
  const q = FeedbackQuerySchema.parse(query);
  const handler = alias(users, 'handler');
  const shared: SQL[] = [];
  if (q.module) shared.push(eq(feedback.module, q.module));
  if (q.rating === 'low') shared.push(sql`${feedback.rating} <= 2`);
  if (q.rating === 'high') shared.push(sql`${feedback.rating} >= 4`);
  if (q.wantsReply === 'true') shared.push(eq(feedback.wantsReply, true));
  const where = [...shared];
  if (q.status !== 'all') where.push(eq(feedback.status, q.status));
  const page = [...where];
  if (q.before) page.push(lt(feedback.createdAt, new Date(q.before)));

  const monthAgo = new Date(Date.now() - 30 * 86_400_000);
  const [rows, [total], statusRows, moduleRows, [month]] = await Promise.all([
    db
      .select({
        entry: feedback,
        // Read only to decide whether there is an address to reply to.
        email: users.email,
        isGuest: users.isAnonymous,
        handler: handler.name,
      })
      .from(feedback)
      .leftJoin(users, eq(users.id, feedback.userId))
      .leftJoin(handler, eq(handler.id, feedback.handledBy))
      .where(page.length ? and(...page) : undefined)
      .orderBy(desc(feedback.createdAt), desc(feedback.id))
      .limit(q.limit + 1),
    db
      .select({ n: count() })
      .from(feedback)
      .where(where.length ? and(...where) : undefined),
    db
      .select({ status: feedback.status, n: count() })
      .from(feedback)
      .where(shared.length ? and(...shared) : undefined)
      .groupBy(feedback.status),
    db
      .select({
        module: feedback.module,
        n: count(),
        avg: sql<string | null>`avg(${feedback.rating})`,
      })
      .from(feedback)
      .groupBy(feedback.module)
      .orderBy(desc(count())),
    db
      .select({
        n: count(),
        avg: sql<string | null>`avg(${feedback.rating})`,
        waiting: sql<number>`count(*) filter (where ${feedback.wantsReply} and ${feedback.repliedAt} is null and ${feedback.status} <> 'wont')`,
      })
      .from(feedback)
      .where(gte(feedback.createdAt, monthAgo)),
  ]);
  const shown = rows.slice(0, q.limit);
  return {
    items: shown.map((r) => ({
      id: r.entry.id,
      module: r.entry.module,
      page: r.entry.page,
      rating: r.entry.rating,
      message: r.entry.message,
      replyTo: r.entry.wantsReply ? realAddress(r.email, r.isGuest) : null,
      status: (FEEDBACK_STATUSES as readonly string[]).includes(r.entry.status)
        ? (r.entry.status as FeedbackStatus)
        : 'new',
      note: r.entry.note,
      handledBy: r.entry.handledBy ? (r.handler ?? null) : null,
      handledAt: r.entry.handledAt?.toISOString() ?? null,
      repliedAt: r.entry.repliedAt?.toISOString() ?? null,
      createdAt: r.entry.createdAt.toISOString(),
    })),
    total: num(total?.n),
    next: rows.length > q.limit ? (shown.at(-1)?.entry.createdAt.toISOString() ?? null) : null,
    byStatus: Object.fromEntries(
      FEEDBACK_STATUSES.map((s) => [s, num(statusRows.find((r) => r.status === s)?.n)]),
    ),
    modules: moduleRows.map((r) => ({
      module: r.module,
      n: num(r.n),
      avgRating: r.avg === null ? null : Number(r.avg),
    })),
    month: {
      n: num(month?.n),
      avgRating: month?.avg == null ? null : Number(month.avg),
      waitingReply: num(month?.waiting),
    },
  };
}

export const FeedbackUpdateSchema = z
  .object({
    status: z.enum(FEEDBACK_STATUSES).optional(),
    /** The team's own note; empty clears it. */
    note: z.string().max(2000).optional(),
  })
  .refine((v) => v.status !== undefined || v.note !== undefined, {
    message: 'Change the state, the note, or both.',
  })
  .openapi('FeedbackUpdate');

/** Moves feedback to another state, or changes the team's note on it. */
export async function updateFeedback(
  db: Database,
  actor: Actor,
  id: string,
  input: z.infer<typeof FeedbackUpdateSchema>,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [entry] = await tx
      .select({ status: feedback.status })
      .from(feedback)
      .where(eq(feedback.id, id));
    if (!entry) throw notFound();
    await tx
      .update(feedback)
      .set({
        ...(input.status ? { status: input.status } : {}),
        // Notes are for the team, but people still write names into them: keep them out.
        ...(input.note !== undefined ? { note: redactPII(input.note.trim()).text || null } : {}),
        handledBy: actor.userId,
        handledAt: new Date(),
      })
      .where(eq(feedback.id, id));
    await audit(tx, actor, {
      action: 'feedback.update',
      targetType: 'feedback',
      targetId: id,
      meta: {
        ...(input.status ? { from: entry.status, to: input.status } : {}),
        ...(input.note !== undefined ? { note: true } : {}),
      },
    });
  });
}

export const FeedbackReplySchema = z
  .object({ message: z.string().trim().min(2).max(4000) })
  .openapi('FeedbackReply');

/**
 * Writes back by email to someone who asked for a reply. The words go into the outbox
 * sealed, and are not kept anywhere else: the activity log records that a reply was sent,
 * not what it said.
 */
export async function replyToFeedback(
  db: Database,
  actor: Actor,
  id: string,
  input: z.infer<typeof FeedbackReplySchema>,
): Promise<void> {
  await rateLimit(db, `feedback-replies:${actor.userId}`, { windowSeconds: 3600, max: 60 });
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        wantsReply: feedback.wantsReply,
        email: users.email,
        isGuest: users.isAnonymous,
        locale: profiles.locale,
        name: users.name,
      })
      .from(feedback)
      .leftJoin(users, eq(users.id, feedback.userId))
      .leftJoin(profiles, eq(profiles.userId, feedback.userId))
      .where(eq(feedback.id, id));
    if (!row) throw notFound();
    const address = row.wantsReply ? realAddress(row.email, row.isGuest) : null;
    if (!address)
      throw new ApiError(
        409,
        'no-reply-address',
        'This person did not ask for a reply, or there is no address to write to.',
      );
    await enqueueMessage(tx, {
      channel: 'email',
      recipientRef: sealWithKek(address, 'outbox'),
      payload: { template: 'feedback-reply', locale: row.locale ?? 'en' },
      secret: { url: getEnv().WAYPOINT_URL, reply: input.message, name: row.name ?? '' },
    });
    await tx
      .update(feedback)
      .set({ repliedAt: new Date(), handledBy: actor.userId, handledAt: new Date() })
      .where(eq(feedback.id, id));
    await audit(tx, actor, { action: 'feedback.reply', targetType: 'feedback', targetId: id });
  });
}
