/**
 * The API's own health, for the console: how many requests each route answers, how fast, and
 * how many fail. Counted in memory and added to the database every half minute, so a request
 * never waits on it; server errors are kept one by one, with personal details and tokens
 * removed, so the console can show what went wrong and the request id to look it up by.
 *
 * Kept on globalThis: Next.js can load this module more than once in one process (the API's
 * route handler and the server's start-up), and both must share one count.
 */
import { scrubLogText } from '@waypoint/core/privacy';
import { apiErrors, apiMetrics, type Database, sql } from '@waypoint/db';

/** Upper edges of the response-time histogram, in milliseconds; the last bin is open. */
export const LATENCY_BINS = [50, 100, 250, 500, 1000, 2500, 5000] as const;

/** Liveness and readiness probes: asked every few seconds by the platform, not by people. */
const UNCOUNTED = new Set(['/api/health', '/api/ready']);

interface Tally {
  bucket: string;
  method: string;
  route: string;
  statusClass: number;
  n: number;
  sumMs: number;
  maxMs: number;
  h: number[];
}

interface ErrorEntry {
  method: string;
  route: string;
  status: number;
  code: string | null;
  message: string;
  requestId: string | null;
  createdAt: Date;
}

interface MetricsState {
  tallies: Map<string, Tally>;
  errors: ErrorEntry[];
  timer?: ReturnType<typeof setInterval>;
}

const KEY = Symbol.for('waypoint.apiMetrics');

function state(): MetricsState {
  const g = globalThis as { [KEY]?: MetricsState };
  g[KEY] ??= { tallies: new Map(), errors: [] };
  return g[KEY];
}

/** The start of the hour, as an ISO string. */
const hourOf = (at: Date) => {
  const d = new Date(at);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
};

export function binOf(ms: number): number {
  const i = LATENCY_BINS.findIndex((edge) => ms < edge);
  return i === -1 ? LATENCY_BINS.length : i;
}

/** Counts one answered request. */
export function recordRequest(r: {
  method: string;
  route: string;
  status: number;
  ms: number;
  at?: Date;
}): void {
  if (UNCOUNTED.has(r.route)) return;
  const bucket = hourOf(r.at ?? new Date());
  const statusClass = Math.min(5, Math.max(1, Math.floor(r.status / 100)));
  const key = `${bucket}|${r.method}|${r.route}|${statusClass}`;
  const tallies = state().tallies;
  let t = tallies.get(key);
  if (!t) {
    t = {
      bucket,
      method: r.method,
      route: r.route,
      statusClass,
      n: 0,
      sumMs: 0,
      maxMs: 0,
      h: Array(8).fill(0),
    };
    tallies.set(key, t);
  }
  const ms = Math.max(0, Math.round(r.ms));
  t.n += 1;
  t.sumMs += ms;
  t.maxMs = Math.max(t.maxMs, ms);
  t.h[binOf(ms)]! += 1;
}

/** Keeps one server error, in words safe to show to staff. */
export function recordError(e: {
  method: string;
  route: string;
  status: number;
  code?: string | null;
  message: string;
  requestId?: string | null;
}): void {
  const errors = state().errors;
  // A storm of errors is kept as its first few hundred: the rest are counted in the totals.
  if (errors.length >= 500) return;
  errors.push({
    method: e.method,
    route: e.route,
    status: e.status,
    code: e.code ?? null,
    message: scrubLogText(e.message, 300) || `Status ${e.status}`,
    requestId: e.requestId ?? null,
    createdAt: new Date(),
  });
}

/** Adds what was counted since last time to the database. */
export async function flushMetrics(db: Database): Promise<void> {
  const s = state();
  const tallies = [...s.tallies.values()];
  const errors = s.errors;
  s.tallies = new Map();
  s.errors = [];
  try {
    for (const t of tallies) {
      const row = {
        bucket: new Date(t.bucket),
        method: t.method,
        route: t.route,
        statusClass: t.statusClass,
        n: t.n,
        sumMs: t.sumMs,
        maxMs: t.maxMs,
        h0: t.h[0]!,
        h1: t.h[1]!,
        h2: t.h[2]!,
        h3: t.h[3]!,
        h4: t.h[4]!,
        h5: t.h[5]!,
        h6: t.h[6]!,
        h7: t.h[7]!,
      };
      // Several servers add to the same hour: each adds its own counts.
      await db
        .insert(apiMetrics)
        .values(row)
        .onConflictDoUpdate({
          target: [apiMetrics.bucket, apiMetrics.method, apiMetrics.route, apiMetrics.statusClass],
          set: {
            n: sql`${apiMetrics.n} + excluded.n`,
            sumMs: sql`${apiMetrics.sumMs} + excluded.sum_ms`,
            maxMs: sql`greatest(${apiMetrics.maxMs}, excluded.max_ms)`,
            h0: sql`${apiMetrics.h0} + excluded.h0`,
            h1: sql`${apiMetrics.h1} + excluded.h1`,
            h2: sql`${apiMetrics.h2} + excluded.h2`,
            h3: sql`${apiMetrics.h3} + excluded.h3`,
            h4: sql`${apiMetrics.h4} + excluded.h4`,
            h5: sql`${apiMetrics.h5} + excluded.h5`,
            h6: sql`${apiMetrics.h6} + excluded.h6`,
            h7: sql`${apiMetrics.h7} + excluded.h7`,
          },
        });
    }
    if (errors.length) await db.insert(apiErrors).values(errors);
  } catch {
    // The database is unavailable: put the counts back to be added next time.
    for (const t of tallies) {
      const key = `${t.bucket}|${t.method}|${t.route}|${t.statusClass}`;
      const now = s.tallies.get(key);
      if (!now) s.tallies.set(key, t);
      else {
        now.n += t.n;
        now.sumMs += t.sumMs;
        now.maxMs = Math.max(now.maxMs, t.maxMs);
        now.h = now.h.map((v, i) => v + (t.h[i] ?? 0));
      }
    }
    s.errors = [...errors, ...s.errors].slice(0, 500);
  }
}

/** Adds the counts to the database every half minute from now on. Safe to call twice. */
export function startMetricsFlush(db: Database, everyMs = 30_000): void {
  const s = state();
  if (s.timer) return;
  s.timer = setInterval(() => void flushMetrics(db), everyMs);
  s.timer.unref?.();
}

/** Test helper: forget anything counted and not yet added. */
export function resetMetricsForTests(): void {
  const s = state();
  s.tallies = new Map();
  s.errors = [];
}
