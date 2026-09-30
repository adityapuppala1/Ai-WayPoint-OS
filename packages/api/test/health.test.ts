/**
 * Liveness and readiness when the database is not there. A server that starts during a
 * database outage must stay alive (liveness answers without the database), say it is not
 * ready (503, not an error page), and become ready by itself once the database is back —
 * not stay broken until someone restarts it.
 */
import { createServer } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ORIGIN = 'http://localhost:3000';

/** A port nothing listens on: taken from the system, then released. */
async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

let app: ReturnType<typeof import('../src').createApp>;
let db: typeof import('@waypoint/db');

beforeAll(async () => {
  Object.assign(process.env, {
    DATABASE_URL: `postgres://waypoint:none@127.0.0.1:${await closedPort()}/waypoint`,
    WAYPOINT_URL: ORIGIN,
    LOG_LEVEL: 'silent',
  });
  db = await import('@waypoint/db');
  app = (await import('../src')).createApp();
}, 120_000);

afterAll(async () => {
  await db.closeDb().catch(() => undefined);
});

describe('with the database unreachable', () => {
  it('liveness still answers: the process is up', async () => {
    const res = await app.request(`${ORIGIN}/api/health`);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('ok');
  });

  it('readiness says "unavailable" with a 503, not a server error', async () => {
    const res = await app.request(`${ORIGIN}/api/ready`);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'unavailable' });
  });

  it('tries the database again instead of remembering the first failure for ever', async () => {
    const first = db.dbReady();
    await expect(first).rejects.toBeTruthy();
    // A later caller gets a fresh attempt (not the same rejected promise).
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const second = db.dbReady();
    expect(second).not.toBe(first);
    await expect(second).rejects.toBeTruthy();
  });
});
