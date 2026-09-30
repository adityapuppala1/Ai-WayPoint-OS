/**
 * Small, dependable queues on Postgres:
 *  - outbox: messages to send (email, SMS, WhatsApp, push), written in the same transaction as
 *    the change that caused them, so nothing is sent for a change that rolled back.
 *  - jobs: background work claimed with FOR UPDATE SKIP LOCKED, safe with several workers.
 */
import { openWithKek, redactPII, sealWithKek } from '@waypoint/core/privacy';
import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import type { Database } from '../client';
import { jobs, outbox } from '../schema';

type Executor = Pick<Database, 'insert' | 'execute' | 'select' | 'update'>;

export type OutboxChannel = 'email' | 'sms' | 'whatsapp' | 'push';

/**
 * Errors are kept to help staff, who must never see who a message was for: provider errors
 * often repeat the address or number, so those are removed before anything is stored.
 */
export function safeError(error: string, max = 500): string {
  return redactPII(error.slice(0, 4000)).text.slice(0, max);
}

// One list per process: bundlers (Next.js) can load this module more than once, and the
// worker listening and the request queueing a message must share it.
const LISTENERS = Symbol.for('waypoint.outbox.listeners');
const shared = globalThis as { [LISTENERS]?: Set<() => void> };
shared[LISTENERS] ??= new Set<() => void>();
const enqueueListeners = shared[LISTENERS];

/**
 * Be told when a message is queued (the in-process worker uses this to send at once instead
 * of on its next round). Returns a function that stops listening.
 */
export function onMessageQueued(listener: () => void): () => void {
  enqueueListeners.add(listener);
  return () => enqueueListeners.delete(listener);
}

/**
 * Queue a message. `secret` holds what must not sit readable in the database while the
 * message waits — a sign-in link, a code, the words of a reply — sealed with the server key
 * and opened only by the sender. Once a message is sent, cancelled or given up on, only the
 * name of its template is kept.
 */
export async function enqueueMessage(
  db: Executor,
  msg: {
    channel: OutboxChannel;
    recipientRef: string;
    payload: Record<string, unknown>;
    secret?: Record<string, string>;
    sendAfter?: Date;
  },
): Promise<string> {
  const payload = msg.secret
    ? { ...msg.payload, secret: sealWithKek(JSON.stringify(msg.secret), 'outbox-secret') }
    : msg.payload;
  const [row] = await db
    .insert(outbox)
    .values({
      channel: msg.channel,
      recipientRef: msg.recipientRef,
      payload,
      nextAttemptAt: msg.sendAfter ?? new Date(),
    })
    .returning({ id: outbox.id });
  if (!row) throw new Error('Failed to enqueue message');
  for (const listener of enqueueListeners) listener();
  return row.id;
}

/** The sealed part of a queued message, merged back into its payload for the sender. */
export function openOutboxPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const { secret, ...rest } = payload;
  if (typeof secret !== 'string') return rest;
  const opened = JSON.parse(openWithKek(secret, 'outbox-secret')) as unknown;
  if (!opened || typeof opened !== 'object' || Array.isArray(opened))
    throw new Error('Unreadable message secret');
  return { ...rest, ...(opened as Record<string, unknown>) };
}

/** What stays of a message once it is done with: the kind of message, nothing more. */
const DONE_PAYLOAD = sql`jsonb_build_object('template', ${outbox.payload}->'template')`;

export async function enqueueJob(
  db: Executor,
  job: {
    kind: string;
    payload?: Record<string, unknown>;
    runAt?: Date;
    uniqueKey?: string;
    maxAttempts?: number;
  },
): Promise<string | null> {
  if (job.uniqueKey) {
    const existing = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.uniqueKey, job.uniqueKey), inArray(jobs.status, ['queued', 'running'])))
      .limit(1);
    if (existing.length) return null;
  }
  const [row] = await db
    .insert(jobs)
    .values({
      kind: job.kind,
      payload: job.payload ?? {},
      runAt: job.runAt ?? new Date(),
      uniqueKey: job.uniqueKey,
      maxAttempts: job.maxAttempts ?? 5,
    })
    .returning({ id: jobs.id });
  return row?.id ?? null;
}

export interface ClaimedJob {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
}

/** Claim up to `limit` due jobs for this worker. */
export async function claimJobs(db: Executor, workerId: string, limit = 5): Promise<ClaimedJob[]> {
  const res = await db.execute<{
    id: string;
    kind: string;
    payload: Record<string, unknown>;
    attempts: number;
    max_attempts: number;
  }>(sql`
    update ${jobs} set status = 'running', locked_by = ${workerId}, locked_at = now(), attempts = attempts + 1
    where id in (
      select id from ${jobs}
      where status = 'queued' and run_at <= now()
      order by run_at
      limit ${limit}
      for update skip locked
    )
    returning id, kind, payload, attempts, max_attempts`);
  return res.rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    payload: r.payload,
    attempts: r.attempts,
    maxAttempts: r.max_attempts,
  }));
}

export async function completeJob(db: Executor, id: string): Promise<void> {
  await db
    .update(jobs)
    .set({ status: 'done', finishedAt: new Date(), lockedBy: null })
    .where(eq(jobs.id, id));
}

/** Retry with exponential backoff (30 s, 2 min, 8 min…) until maxAttempts, then mark failed. */
export async function failJob(db: Executor, job: ClaimedJob, error: string): Promise<void> {
  const finalAttempt = job.attempts >= job.maxAttempts;
  await db
    .update(jobs)
    .set(
      finalAttempt
        ? {
            status: 'failed',
            lastError: safeError(error, 2000),
            finishedAt: new Date(),
            lockedBy: null,
          }
        : {
            status: 'queued',
            lastError: safeError(error, 2000),
            runAt: new Date(Date.now() + 30_000 * 4 ** (job.attempts - 1)),
            lockedBy: null,
          },
    )
    .where(eq(jobs.id, job.id));
}

/** Put jobs back in the queue if a worker died while running them. */
export async function releaseStaleJobs(db: Executor, olderThanMs = 15 * 60_000): Promise<number> {
  const res = await db
    .update(jobs)
    .set({ status: 'queued', lockedBy: null })
    .where(and(eq(jobs.status, 'running'), lte(jobs.lockedAt, new Date(Date.now() - olderThanMs))))
    .returning({ id: jobs.id });
  return res.length;
}

export interface ClaimedMessage {
  id: string;
  channel: OutboxChannel;
  recipientRef: string;
  payload: Record<string, unknown>;
  attempts: number;
  createdAt: Date;
}

export async function claimOutbox(db: Executor, limit = 20): Promise<ClaimedMessage[]> {
  const res = await db.execute<{
    id: string;
    channel: OutboxChannel;
    recipient_ref: string;
    payload: Record<string, unknown>;
    attempts: number;
    created_at: string | Date;
  }>(sql`
    update ${outbox} set attempts = attempts + 1, next_attempt_at = now() + interval '10 minutes'
    where id in (
      select id from ${outbox}
      where status = 'queued' and next_attempt_at <= now()
      order by next_attempt_at
      limit ${limit}
      for update skip locked
    )
    returning id, channel, recipient_ref, payload, attempts, created_at`);
  return res.rows.map((r) => ({
    id: r.id,
    channel: r.channel,
    recipientRef: r.recipient_ref,
    payload: r.payload,
    attempts: r.attempts,
    createdAt: new Date(r.created_at),
  }));
}

/** Tries before a message is given up on (backing off 2, 4, 8… minutes). */
export const OUTBOX_MAX_ATTEMPTS = 6;

export async function markOutbox(
  db: Executor,
  id: string,
  result: { ok: true } | { ok: false; error: string; attempts: number },
) {
  if (result.ok) {
    await db
      .update(outbox)
      .set({ status: 'sent', sentAt: new Date(), payload: DONE_PAYLOAD })
      .where(eq(outbox.id, id));
    return;
  }
  const giveUp = result.attempts >= OUTBOX_MAX_ATTEMPTS;
  await db
    .update(outbox)
    .set({
      status: giveUp ? 'failed' : 'queued',
      lastError: safeError(result.error),
      nextAttemptAt: new Date(Date.now() + 60_000 * 2 ** result.attempts),
      ...(giveUp ? { payload: DONE_PAYLOAD } : {}),
    })
    .where(eq(outbox.id, id));
}

/** Not sent, on purpose: too old to be useful, or the person asked for no more messages. */
export async function cancelOutbox(db: Executor, id: string, reason: string): Promise<void> {
  await db
    .update(outbox)
    .set({ status: 'cancelled', lastError: safeError(reason), payload: DONE_PAYLOAD })
    .where(eq(outbox.id, id));
}
