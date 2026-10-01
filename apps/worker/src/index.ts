/**
 * Waypoint background worker for Postgres deployments (the embedded database runs this work
 * inside the web server instead). Safe to run several copies: every task claims work with
 * row locks or is idempotent.
 *
 *   pnpm worker          run continuously
 *   pnpm worker --once   run each task once and exit (cron-style)
 */
import { writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { integrations, jobs } from '@waypoint/api';
import { getEnv } from '@waypoint/core/env';
import { closeDb, dbReady, getDb } from '@waypoint/db';

const env = getEnv();
const once = process.argv.includes('--once');
const workerId = `${hostname()}-${process.pid}`;
const INTERVAL_MS = jobs.workerIntervalMs(process.env.WORKER_INTERVAL_MS);
const RETENTION_EVERY = Math.max(1, Math.round((6 * 3_600_000) / INTERVAL_MS));

/**
 * Touched at the start and end of every round, when the deployment names a file for it
 * (WORKER_HEARTBEAT_FILE in infra/k8s/base/worker-deployment.yaml and
 * infra/docker/compose.yml). Their liveness check reads it: a worker that has not touched it
 * for five minutes is stuck and gets restarted. The path is the deployment's own private
 * folder, never a guessable name in a temp folder shared with other programs.
 */
const HEARTBEAT_FILE = process.env.WORKER_HEARTBEAT_FILE;
const beat = () => {
  if (!HEARTBEAT_FILE) return;
  try {
    writeFileSync(HEARTBEAT_FILE, String(Date.now()), { mode: 0o600 });
  } catch {
    // Not writable: the worker still works, it just cannot be watched this way.
  }
};

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
// Keys and options an admin set in the console (texting, email, AI), kept in step.
await integrations.startSettingsSync(getDb());
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

let wake: (() => void) | undefined;
let running: Promise<void> = Promise.resolve();

const loop = async () => {
  while (!stopping) {
    const started = Date.now();
    beat();
    // Errors are logged without what a failed statement contained, addresses or numbers.
    running = tick().catch((err: unknown) => {
      log('tick failed', jobs.errorFields(err));
    });
    await running;
    beat();
    if (stopping) break;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, Math.max(1_000, INTERVAL_MS - (Date.now() - started)));
      wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }
};

/** How long a round in progress may take to finish before the process leaves anyway. */
const DRAIN_MS = 25_000;

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, async () => {
    if (stopping) return;
    stopping = true;
    log('stopping', { signal: sig });
    wake?.();
    // Let the round in progress finish: leaving mid-send would send the same messages again
    // ten minutes later, when their claim runs out.
    await Promise.race([running, new Promise((r) => setTimeout(r, DRAIN_MS))]);
    await closeDb().catch(() => undefined);
    process.exit(0);
  });
}

void loop();
