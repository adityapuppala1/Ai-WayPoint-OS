/**
 * System health, for the console's admins: the API (requests, failures and response times by
 * hour and by route, and recent server errors), the database (kind, version, size, the largest
 * tables, connections, migrations), background work (jobs and messages waiting, failed, and
 * whether the worker is running) and this server itself. Nothing here names a person: routes
 * are counted as written in the code, messages are counted by channel, and errors are kept
 * with personal details and tokens removed. Retrying or cancelling a job or a message is
 * audited.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from '@hono/zod-openapi';
import { configWarnings, getEnv } from '@waypoint/core/env';
import { scrubLogText } from '@waypoint/core/privacy';
import {
  and,
  apiErrors,
  apiMetrics,
  type Database,
  dbKind,
  desc,
  eq,
  gte,
  jobs,
  outbox,
  schemaCurrent,
  sql,
} from '@waypoint/db';
import { type Actor, audit } from '../lib/audit';
import { flushMetrics, LATENCY_BINS } from '../lib/metrics';
import { conflict, notFound } from '../lib/problem';

const HOUR = 3_600_000;
const num = (v: unknown) => Number(v ?? 0);
const STARTED_AT = new Date();

/** The version this server runs: the repository's own (package.json at its root). */
function version(): string | null {
  try {
    const root = getEnv().repoRoot;
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

/**
 * A percentile from the response-time histogram: the upper edge of the bin it falls in (the
 * slowest bin is open, so its answer is the slowest time seen).
 */
export function percentileOf(h: readonly number[], p: number, maxMs: number): number | null {
  const total = h.reduce((a, b) => a + b, 0);
  if (!total) return null;
  const want = total * p;
  let seen = 0;
  for (let i = 0; i < h.length; i++) {
    seen += h[i] ?? 0;
    if (seen >= want) return i < LATENCY_BINS.length ? LATENCY_BINS[i]! : maxMs;
  }
  return maxMs;
}

const histogramCols = sql`
  coalesce(sum(h0), 0)::int as h0, coalesce(sum(h1), 0)::int as h1,
  coalesce(sum(h2), 0)::int as h2, coalesce(sum(h3), 0)::int as h3,
  coalesce(sum(h4), 0)::int as h4, coalesce(sum(h5), 0)::int as h5,
  coalesce(sum(h6), 0)::int as h6, coalesce(sum(h7), 0)::int as h7`;

type HistRow = Record<`h${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}`, number>;
const hist = (r: HistRow) => [r.h0, r.h1, r.h2, r.h3, r.h4, r.h5, r.h6, r.h7].map(num);

export const SystemSchema = z
  .object({
    api: z.object({
      /** Last 48 hours, oldest first. */
      hourly: z.array(
        z.object({
          hour: z.string(),
          requests: z.number().int(),
          clientErrors: z.number().int(),
          serverErrors: z.number().int(),
          p95Ms: z.number().nullable(),
        }),
      ),
      day: z.object({
        requests: z.number().int(),
        clientErrors: z.number().int(),
        serverErrors: z.number().int(),
        p50Ms: z.number().nullable(),
        p95Ms: z.number().nullable(),
        maxMs: z.number().int(),
      }),
      /** The 24 hours before that, to compare with. */
      previousDay: z.object({ requests: z.number().int(), serverErrors: z.number().int() }),
      routes: z.array(
        z.object({
          method: z.string(),
          route: z.string(),
          requests: z.number().int(),
          clientErrors: z.number().int(),
          serverErrors: z.number().int(),
          avgMs: z.number(),
          p95Ms: z.number().nullable(),
        }),
      ),
      errors: z.array(
        z.object({
          id: z.string(),
          at: z.string(),
          method: z.string(),
          route: z.string(),
          status: z.number().int(),
          code: z.string().nullable(),
          message: z.string(),
          requestId: z.string().nullable(),
        }),
      ),
    }),
    database: z.object({
      kind: z.enum(['embedded', 'postgres']),
      version: z.string().nullable(),
      sizeBytes: z.number().nullable(),
      connections: z.number().int().nullable(),
      cacheHitRatio: z.number().nullable(),
      migrationsApplied: z.number().int().nullable(),
      lastMigrationAt: z.string().nullable(),
      schemaCurrent: z.boolean(),
      tables: z.array(z.object({ name: z.string(), rows: z.number(), bytes: z.number() })),
    }),
    jobs: z.object({
      byStatus: z.record(z.string(), z.number().int()),
      waitingByKind: z.array(z.object({ kind: z.string(), n: z.number().int() })),
      oldestWaitingAt: z.string().nullable(),
      lastFinishedAt: z.string().nullable(),
      failed: z.array(
        z.object({
          id: z.string(),
          kind: z.string(),
          attempts: z.number().int(),
          error: z.string().nullable(),
          at: z.string(),
        }),
      ),
    }),
    outbox: z.object({
      byChannel: z.array(
        z.object({ channel: z.string(), status: z.string(), n: z.number().int() }),
      ),
      failed: z.array(
        z.object({
          id: z.string(),
          channel: z.string(),
          template: z.string().nullable(),
          attempts: z.number().int(),
          error: z.string().nullable(),
          at: z.string(),
        }),
      ),
    }),
    server: z.object({
      version: z.string().nullable(),
      commit: z.string().nullable(),
      node: z.string(),
      platform: z.string(),
      environment: z.string(),
      startedAt: z.string(),
      uptimeSeconds: z.number().int(),
      memory: z.object({
        rssBytes: z.number(),
        heapUsedBytes: z.number(),
        heapTotalBytes: z.number(),
      }),
      /** Background work runs in this process (embedded database) or in a separate worker. */
      worker: z.enum(['in-process', 'separate']),
      warnings: z.array(z.string()),
    }),
  })
  .openapi('System');

export type System = z.infer<typeof SystemSchema>;

async function safely<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch {
    return fallback;
  }
}

async function apiHealth(db: Database, now: Date): Promise<System['api']> {
  const twoDays = new Date(now.getTime() - 47 * HOUR);
  twoDays.setUTCMinutes(0, 0, 0);
  const dayAgo = new Date(now.getTime() - 24 * HOUR);
  const twoDaysAgo = new Date(now.getTime() - 48 * HOUR);
  const [hourlyRows, dayRows, previous, routeRows, errorRows] = await Promise.all([
    db.execute<{ bucket: string; status_class: number; n: number; max: number } & HistRow>(sql`
      select bucket::text, status_class, coalesce(sum(n), 0)::int as n,
             coalesce(max(max_ms), 0)::int as max, ${histogramCols}
      from api_metrics where bucket >= ${twoDays.toISOString()}::timestamptz
      group by bucket, status_class`),
    db.execute<{ status_class: number; n: number; max: number } & HistRow>(sql`
      select status_class, coalesce(sum(n), 0)::int as n, coalesce(max(max_ms), 0)::int as max,
             ${histogramCols}
      from api_metrics where bucket >= ${dayAgo.toISOString()}::timestamptz
      group by status_class`),
    db.execute<{ n: number; server: number }>(sql`
      select coalesce(sum(n), 0)::int as n,
             coalesce(sum(n) filter (where status_class = 5), 0)::int as server
      from api_metrics
      where bucket >= ${twoDaysAgo.toISOString()}::timestamptz
        and bucket < ${dayAgo.toISOString()}::timestamptz`),
    db.execute<
      {
        method: string;
        route: string;
        n: number;
        client: number;
        server: number;
        sum: number;
        max: number;
      } & HistRow
    >(sql`
      select method, route, coalesce(sum(n), 0)::int as n,
             coalesce(sum(n) filter (where status_class = 4), 0)::int as client,
             coalesce(sum(n) filter (where status_class = 5), 0)::int as server,
             coalesce(sum(sum_ms), 0)::float8 as sum, coalesce(max(max_ms), 0)::int as max,
             ${histogramCols}
      from api_metrics where bucket >= ${dayAgo.toISOString()}::timestamptz
      group by method, route order by n desc limit 40`),
    db
      .select()
      .from(apiErrors)
      .where(gte(apiErrors.createdAt, new Date(now.getTime() - 7 * 24 * HOUR)))
      .orderBy(desc(apiErrors.createdAt))
      .limit(50),
  ]);

  const hours: System['api']['hourly'] = [];
  for (let i = 47; i >= 0; i--) {
    const hour = new Date(now.getTime() - i * HOUR);
    hour.setUTCMinutes(0, 0, 0);
    const rows = hourlyRows.rows.filter((r) => new Date(r.bucket).getTime() === hour.getTime());
    const of = (c: number) => num(rows.find((r) => num(r.status_class) === c)?.n);
    const h = rows.reduce((acc, r) => acc.map((v, j) => v + (hist(r)[j] ?? 0)), Array(8).fill(0));
    hours.push({
      hour: hour.toISOString(),
      requests: rows.reduce((n, r) => n + num(r.n), 0),
      clientErrors: of(4),
      serverErrors: of(5),
      p95Ms: percentileOf(h, 0.95, Math.max(0, ...rows.map((r) => num(r.max)))),
    });
  }

  const dayHist = dayRows.rows.reduce(
    (acc, r) => acc.map((v, j) => v + (hist(r)[j] ?? 0)),
    Array(8).fill(0),
  );
  const dayMax = Math.max(0, ...dayRows.rows.map((r) => num(r.max)));
  const dayOf = (c: number) => num(dayRows.rows.find((r) => num(r.status_class) === c)?.n);

  return {
    hourly: hours,
    day: {
      requests: dayRows.rows.reduce((n, r) => n + num(r.n), 0),
      clientErrors: dayOf(4),
      serverErrors: dayOf(5),
      p50Ms: percentileOf(dayHist, 0.5, dayMax),
      p95Ms: percentileOf(dayHist, 0.95, dayMax),
      maxMs: dayMax,
    },
    previousDay: {
      requests: num(previous.rows[0]?.n),
      serverErrors: num(previous.rows[0]?.server),
    },
    routes: routeRows.rows.map((r) => ({
      method: r.method,
      route: r.route,
      requests: num(r.n),
      clientErrors: num(r.client),
      serverErrors: num(r.server),
      avgMs: num(r.n) ? Math.round(num(r.sum) / num(r.n)) : 0,
      p95Ms: percentileOf(hist(r), 0.95, num(r.max)),
    })),
    errors: errorRows.map((e) => ({
      id: e.id,
      at: e.createdAt.toISOString(),
      method: e.method,
      route: e.route,
      status: e.status,
      code: e.code,
      message: e.message,
      requestId: e.requestId,
    })),
  };
}

async function databaseHealth(db: Database): Promise<System['database']> {
  const kind = dbKind();
  const [version, size, connections, cache, migrations, tables, current] = await Promise.all([
    safely(async () => {
      const r = await db.execute<{ v: string }>(sql`select current_setting('server_version') as v`);
      return r.rows[0]?.v ?? null;
    }, null),
    safely(async () => {
      const r = await db.execute<{ n: number }>(
        sql`select pg_database_size(current_database())::float8 as n`,
      );
      return num(r.rows[0]?.n);
    }, null),
    kind === 'postgres'
      ? safely(async () => {
          const r = await db.execute<{ n: number }>(
            sql`select count(*)::int as n from pg_stat_activity where datname = current_database()`,
          );
          return num(r.rows[0]?.n);
        }, null)
      : Promise.resolve(null),
    safely(async () => {
      const r = await db.execute<{ hit: number; read: number }>(sql`
        select coalesce(blks_hit, 0)::float8 as hit, coalesce(blks_read, 0)::float8 as read
        from pg_stat_database where datname = current_database()`);
      const hit = num(r.rows[0]?.hit);
      const read = num(r.rows[0]?.read);
      return hit + read > 0 ? hit / (hit + read) : null;
    }, null),
    safely(async () => {
      const r = await db.execute<{ n: number; last: string | number | null }>(
        sql`select count(*)::int as n, max(created_at) as last from drizzle.__drizzle_migrations`,
      );
      const last = r.rows[0]?.last;
      return { n: num(r.rows[0]?.n), last: last ? new Date(Number(last)).toISOString() : null };
    }, null),
    safely(async () => {
      const r = await db.execute<{ name: string; rows: number; bytes: number }>(sql`
        select c.relname as name, greatest(c.reltuples, 0)::float8 as rows,
               pg_total_relation_size(c.oid)::float8 as bytes
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by pg_total_relation_size(c.oid) desc limit 20`);
      return r.rows.map((t) => ({
        name: t.name,
        rows: Math.round(num(t.rows)),
        bytes: num(t.bytes),
      }));
    }, []),
    safely(() => schemaCurrent(db), false),
  ]);
  return {
    kind,
    version,
    sizeBytes: size,
    connections,
    cacheHitRatio: cache,
    migrationsApplied: migrations?.n ?? null,
    lastMigrationAt: migrations?.last ?? null,
    schemaCurrent: current,
    tables,
  };
}

async function backgroundWork(db: Database): Promise<Pick<System, 'jobs' | 'outbox'>> {
  const [statusRows, waitingRows, [oldest], [lastDone], failedJobs, outboxRows, failedMessages] =
    await Promise.all([
      db
        .select({ status: jobs.status, n: sql<number>`count(*)::int` })
        .from(jobs)
        .groupBy(jobs.status),
      db
        .select({ kind: jobs.kind, n: sql<number>`count(*)::int` })
        .from(jobs)
        .where(eq(jobs.status, 'queued'))
        .groupBy(jobs.kind)
        .orderBy(desc(sql`count(*)`)),
      db
        .select({ at: sql<string | null>`min(${jobs.runAt})::text` })
        .from(jobs)
        .where(and(eq(jobs.status, 'queued'), sql`${jobs.runAt} <= now()`)),
      db.select({ at: sql<string | null>`max(${jobs.finishedAt})::text` }).from(jobs),
      db
        .select({
          id: jobs.id,
          kind: jobs.kind,
          attempts: jobs.attempts,
          error: jobs.lastError,
          at: jobs.createdAt,
        })
        .from(jobs)
        .where(eq(jobs.status, 'failed'))
        .orderBy(desc(jobs.createdAt))
        .limit(20),
      db
        .select({ channel: outbox.channel, status: outbox.status, n: sql<number>`count(*)::int` })
        .from(outbox)
        .where(gte(outbox.createdAt, new Date(Date.now() - 30 * 24 * HOUR)))
        .groupBy(outbox.channel, outbox.status),
      db
        .select({
          id: outbox.id,
          channel: outbox.channel,
          template: sql<string | null>`${outbox.payload}->>'template'`,
          attempts: outbox.attempts,
          error: outbox.lastError,
          at: outbox.createdAt,
        })
        .from(outbox)
        .where(eq(outbox.status, 'failed'))
        .orderBy(desc(outbox.createdAt))
        .limit(20),
    ]);
  const iso = (v: string | null | undefined) => (v ? new Date(v).toISOString() : null);
  return {
    jobs: {
      byStatus: Object.fromEntries(statusRows.map((r) => [r.status, num(r.n)])),
      waitingByKind: waitingRows.map((r) => ({ kind: r.kind, n: num(r.n) })),
      oldestWaitingAt: iso(oldest?.at),
      lastFinishedAt: iso(lastDone?.at),
      failed: failedJobs.map((j) => ({
        id: j.id,
        kind: j.kind,
        attempts: j.attempts,
        error: j.error ? scrubLogText(j.error, 300) : null,
        at: j.at.toISOString(),
      })),
    },
    outbox: {
      byChannel: outboxRows.map((r) => ({ channel: r.channel, status: r.status, n: num(r.n) })),
      failed: failedMessages.map((m) => ({
        id: m.id,
        channel: m.channel,
        template: m.template,
        attempts: m.attempts,
        error: m.error ? scrubLogText(m.error, 300) : null,
        at: m.at.toISOString(),
      })),
    },
  };
}

function serverInfo(): System['server'] {
  const env = getEnv();
  const memory = process.memoryUsage();
  const inProcess = process.env.WAYPOINT_INPROCESS_WORKER ?? (env.embeddedDb ? 'true' : 'false');
  return {
    version: version(),
    commit: process.env.WAYPOINT_COMMIT ?? process.env.GIT_COMMIT ?? null,
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    environment: env.NODE_ENV,
    startedAt: STARTED_AT.toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
    },
    worker: inProcess === 'true' ? 'in-process' : 'separate',
    warnings: configWarnings(env),
  };
}

export async function systemView(db: Database, now = new Date()): Promise<System> {
  // This server's counts since its last half-minute flush, so the page is up to the moment.
  await flushMetrics(db);
  const [api, database, work] = await Promise.all([
    apiHealth(db, now),
    databaseHealth(db),
    backgroundWork(db),
  ]);
  return { api, database, ...work, server: serverInfo() };
}

// ──────────────────────────── Retrying and cancelling ────────────────────────────

export const WorkActionSchema = z
  .object({ action: z.enum(['retry', 'cancel']) })
  .openapi('WorkAction');

/** Puts a failed job back in the queue (from its first attempt), or cancels it. */
export async function actOnJob(
  db: Database,
  actor: Actor,
  id: string,
  action: 'retry' | 'cancel',
): Promise<void> {
  await db.transaction(async (tx) => {
    const [job] = await tx
      .select({ status: jobs.status, kind: jobs.kind })
      .from(jobs)
      .where(eq(jobs.id, id));
    if (!job) throw notFound();
    if (job.status !== 'failed' && !(action === 'cancel' && job.status === 'queued'))
      throw conflict('Only a failed job can be retried, or a waiting one cancelled.');
    await tx
      .update(jobs)
      .set(
        action === 'retry'
          ? { status: 'queued', attempts: 0, runAt: new Date(), lockedBy: null, lockedAt: null }
          : { status: 'cancelled', finishedAt: new Date() },
      )
      .where(eq(jobs.id, id));
    await audit(tx, actor, {
      action: `job.${action}`,
      targetType: 'job',
      targetId: id,
      meta: { kind: job.kind },
    });
  });
}

/** Sends a failed message again (from its first attempt), or cancels it. */
export async function actOnMessage(
  db: Database,
  actor: Actor,
  id: string,
  action: 'retry' | 'cancel',
): Promise<void> {
  await db.transaction(async (tx) => {
    const [message] = await tx
      .select({ status: outbox.status, channel: outbox.channel })
      .from(outbox)
      .where(eq(outbox.id, id));
    if (!message) throw notFound();
    if (message.status !== 'failed' && !(action === 'cancel' && message.status === 'queued'))
      throw conflict('Only a failed message can be sent again, or a waiting one cancelled.');
    await tx
      .update(outbox)
      .set(
        action === 'retry'
          ? { status: 'queued', attempts: 0, nextAttemptAt: new Date() }
          : { status: 'cancelled' },
      )
      .where(eq(outbox.id, id));
    await audit(tx, actor, {
      action: `message.${action}`,
      targetType: 'outbox',
      targetId: id,
      meta: { channel: message.channel },
    });
  });
}
