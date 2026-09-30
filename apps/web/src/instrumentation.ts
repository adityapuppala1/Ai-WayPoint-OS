/**
 * Runs once when the Next.js server starts (Node.js runtime only).
 * With the embedded database there is exactly one process, so background work (follow-ups,
 * reminders, retention) runs here. With Postgres, run `pnpm worker` instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { configWarnings, getEnv } = await import('@waypoint/core/env');
  const env = getEnv();
  for (const warning of configWarnings(env)) console.warn(`[waypoint] ${warning}`);
  const { dbReady, getDb } = await import('@waypoint/db');
  try {
    await dbReady();
  } catch (err) {
    console.error('[waypoint] database failed to start:', (err as Error).message);
    return;
  }
  if (env.WAYPOINT_ADMIN_EMAIL) {
    const { ensureAdmin } = await import('@waypoint/auth');
    await ensureAdmin()
      .then((r) => {
        if (r === 'unverified')
          console.warn(
            '[waypoint] admin account: not promoted. An account with WAYPOINT_ADMIN_EMAIL exists but has not confirmed its address; confirm it (Settings → Account), then restart.',
          );
        else if (r !== 'exists') console.info(`[waypoint] admin account: ${r}`);
      })
      .catch((err: Error) => console.error('[waypoint] admin account:', err.message));
  }
  const inProcess = process.env.WAYPOINT_INPROCESS_WORKER ?? (env.embeddedDb ? 'true' : 'false');
  if (inProcess === 'true') {
    const { jobs } = await import('@waypoint/api');
    jobs.startInProcessWorker(getDb);
  }
}
