/**
 * Standalone API server — the same Hono app the web app mounts at /api, for deployments
 * that scale the API separately (and for the mobile app in production).
 */
import { serve } from '@hono/node-server';
import { handleRequest } from '@waypoint/api';
import { configWarnings, getEnv } from '@waypoint/core/env';
import { closeDb, dbReady } from '@waypoint/db';

const env = getEnv();
const port = Number(process.env.PORT ?? 4000);
const hostname = process.env.HOST ?? '0.0.0.0';

await dbReady();
for (const warning of configWarnings(env))
  process.stderr.write(
    `${JSON.stringify({ time: new Date().toISOString(), level: 'warn', msg: warning })}\n`,
  );

const server = serve({ fetch: handleRequest, port, hostname }, (info) => {
  process.stdout.write(
    `${JSON.stringify({ time: new Date().toISOString(), level: 'info', msg: 'api listening', port: info.port, database: env.embeddedDb ? 'embedded' : 'postgres' })}\n`,
  );
});

let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  process.stdout.write(
    `${JSON.stringify({ time: new Date().toISOString(), level: 'info', msg: 'shutting down', signal })}\n`,
  );
  // Stop taking new requests and let the ones in progress finish (up to 15 seconds) before
  // the database goes away underneath them.
  await Promise.race([
    new Promise<void>((resolve) => server.close(() => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 15_000)),
  ]);
  await closeDb().catch(() => undefined);
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
