/**
 * Seed data.
 *
 * `seedBase` is safe for every environment: starter circles (empty, hosted by Waypoint) and a
 * few real, sourced signals so a new install is not blank. It is idempotent.
 *
 * `seedDemo` is ONLY for local demos and screenshots. Every row it writes is flagged
 * `isDemo = true` and the UI labels it "Example data". Never enable it in production.
 */
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Database } from '../client';
import { circles, forecastPredictions, forecasts, signals } from '../schema';
import { STARTER_CIRCLES } from './circles';
import { DEMO_FORECASTS } from './demo';
import { SEED_SIGNALS } from './signals';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');

export async function seedBase(db: Database): Promise<{ circles: number; signals: number }> {
  let circleCount = 0;
  for (const c of STARTER_CIRCLES) {
    const res = await db
      .insert(circles)
      .values({ ...c, visibility: 'public', maxMembers: 12 })
      .onConflictDoNothing({ target: circles.slug })
      .returning({ id: circles.id });
    circleCount += res.length;
  }

  let signalCount = 0;
  for (const s of SEED_SIGNALS) {
    const res = await db
      .insert(signals)
      .values({ ...s, contentHash: hash(`${s.sourceUrl}|${s.title}`) })
      .onConflictDoNothing({ target: signals.contentHash })
      .returning({ id: signals.id });
    signalCount += res.length;
  }
  return { circles: circleCount, signals: signalCount };
}

export async function seedDemo(db: Database): Promise<{ forecasts: number }> {
  const existing = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(forecasts)
    .where(sql`${forecasts.isDemo}`);
  if ((existing[0]?.n ?? 0) > 0) return { forecasts: 0 };
  let n = 0;
  for (const f of DEMO_FORECASTS) {
    const [row] = await db
      .insert(forecasts)
      .values({ ...f.forecast, isDemo: true })
      .returning({ id: forecasts.id });
    if (!row) continue;
    n++;
    for (const p of f.predictions) {
      await db.insert(forecastPredictions).values({ forecastId: row.id, ...p });
    }
  }
  return { forecasts: n };
}

export { DEMO_FORECASTS, SEED_SIGNALS, STARTER_CIRCLES };
