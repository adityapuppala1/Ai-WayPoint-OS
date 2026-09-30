/**
 * Waypoint background worker for Postgres deployments (the embedded database runs this work
 * inside the web server instead). Safe to run several copies: every task claims work with
 * row locks or is idempotent.
 *
 *   pnpm worker          run continuously
 *   pnpm worker --once   run each task once and exit (cron-style)
 */
import { hostname } from 'node:os';
import { jobs } from '@waypoint/api';
import { getEnv } from '@waypoint/core/env';
import { closeDb, dbReady, getDb } from '@waypoint/db';

const env = getEnv();
const once = process.argv.includes('--once');
const workerId = `${hostname()}-${process.pid}`;
const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? 30_000);
const RETENTION_EVERY = Math.max(1, Math.round((6 * 3_600_000) / INTERVAL_MS));

const log = (msg: string, fields: Record<string, unknown> = {}) =>
  process.stdout.write(
    `${JSON.stringify({ time: new Date().toISOString(), level: 'info', msg, workerId, ...fields })}\n`,
  );

if (env.embeddedDb && !once) {
  log(
    'embedded database: background work already runs inside the web server; this worker will only run with --once while the web server is stopped',
  );
  process.exit(0);
}

await dbReady();
log('worker started', { once, intervalMs: INTERVAL_MS });

let stopping = false;
let ticks = 0;
async function tick() {
  const db = getDb();
  await jobs.runDueWork(db, workerId);
  if (once || ticks % RETENTION_EVERY === 0) log('retention', await jobs.retention(db));
  ticks += 1;
}

if (once) {
  await tick();
  await closeDb();
  process.exit(0);
}

const loop = async () => {
  while (!stopping) {
    const started = Date.now();
    await tick().catch((err: Error) => log('tick failed', { error: err.message }));
    await new Promise((r) => setTimeout(r, Math.max(1_000, INTERVAL_MS - (Date.now() - started))));
  }
};

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, async () => {
    stopping = true;
    log('stopping', { signal: sig });
    await closeDb().catch(() => undefined);
    process.exit(0);
  });
}

void loop();
