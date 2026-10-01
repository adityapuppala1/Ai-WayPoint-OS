/**
 * What the console's analytics count. Two things, both kept in memory and added to the
 * database every half minute with the API's own counts (lib/metrics.ts):
 *
 * - that someone used Waypoint on a day, and on which platform (activity_days) — never what
 *   they did or which parts they opened;
 * - pages and screens opened, counted with nobody attached (usage_views): per hour, part of
 *   Waypoint, platform, kind of visitor, country and language.
 *
 * Staff are not counted, and neither is anyone whose browser asks not to be tracked.
 */
import { MODULE_IDS } from '@waypoint/core';
import { activityDays, type Database, sql, usageViews } from '@waypoint/db';

export const PLATFORMS = ['web', 'phone', 'text'] as const;
export type UsagePlatform = (typeof PLATFORMS)[number];
export const PLATFORM_BIT: Record<UsagePlatform, number> = { web: 1, phone: 2, text: 4 };

export const AUDIENCES = ['account', 'guest', 'visitor'] as const;
export type Audience = (typeof AUDIENCES)[number];

/** Parts of Waypoint a page can belong to, beyond the modules themselves. */
export const USAGE_MODULES = [...MODULE_IDS, 'support', 'settings', 'start', 'other'] as const;
export type UsageModule = (typeof USAGE_MODULES)[number];

/** Pages that are not part of using Waypoint: the console, the design pages, the API. */
const NOT_COUNTED = new Set(['admin', 'api', 'design', 'poster', 'staff-invite', '_next']);
/** First path segments that name a part of Waypoint by another word. */
const ALIASES: Record<string, UsageModule> = {
  '': 'today',
  welcome: 'start',
  start: 'start',
  'sign-in': 'start',
  'sign-up': 'start',
  join: 'start',
  explore: 'start',
  services: 'civic',
  privacy: 'other',
  terms: 'other',
  text: 'other',
};

/** The part of Waypoint a page or screen belongs to, or null when it is not counted. */
export function moduleOfPath(path: string): UsageModule | null {
  const clean = path.split(/[?#]/)[0] ?? '';
  // Expo Router groups, such as /(tabs)/money, are not part of the address people see.
  const segments = clean.split('/').filter((s) => s && !/^\(.*\)$/.test(s));
  const first = (segments[0] ?? '').toLowerCase();
  if (NOT_COUNTED.has(first)) return null;
  if (first in ALIASES) return ALIASES[first] ?? 'other';
  return (USAGE_MODULES as readonly string[]).includes(first) ? (first as UsageModule) : 'other';
}

interface ViewTally {
  day: string;
  hour: number;
  module: string;
  platform: string;
  audience: string;
  country: string;
  locale: string;
  n: number;
}

interface UsageState {
  views: Map<string, ViewTally>;
  /** user id and day → platform bits. */
  presence: Map<string, number>;
}

const KEY = Symbol.for('waypoint.usage');
function state(): UsageState {
  const g = globalThis as unknown as Record<symbol, UsageState | undefined>;
  g[KEY] ??= { views: new Map(), presence: new Map() };
  return g[KEY];
}

/** Someone used Waypoint (a page, a screen, or a text): count it. */
export function recordUse(use: {
  userId: string | null;
  platform: UsagePlatform;
  /** Present for a page or screen opened; absent for, say, a text message. */
  view?: { module: UsageModule; audience: Audience; country: string | null; locale: string | null };
  at?: Date;
}): void {
  const at = use.at ?? new Date();
  const day = at.toISOString().slice(0, 10);
  const s = state();
  if (use.userId) {
    const key = `${use.userId}|${day}`;
    s.presence.set(key, (s.presence.get(key) ?? 0) | PLATFORM_BIT[use.platform]);
  }
  if (use.view) {
    const v = {
      day,
      hour: at.getUTCHours(),
      module: use.view.module,
      platform: use.platform,
      audience: use.view.audience,
      country: (use.view.country ?? '').toUpperCase().slice(0, 2),
      locale: (use.view.locale ?? '').slice(0, 5),
    };
    const key = `${v.day}|${v.hour}|${v.module}|${v.platform}|${v.audience}|${v.country}|${v.locale}`;
    const tally = s.views.get(key);
    if (tally) tally.n++;
    else s.views.set(key, { ...v, n: 1 });
  }
}

/** Adds what was counted since last time to the database. */
export async function flushUsage(db: Database): Promise<void> {
  const s = state();
  const views = [...s.views.values()];
  const presence = [...s.presence.entries()];
  s.views = new Map();
  s.presence = new Map();
  try {
    // All or nothing, so counts put back after a failure are never added twice.
    await db.transaction(async (tx) => {
      if (presence.length) {
        const rows = sql.join(
          presence.map(([key, bits]) => {
            const [userId, day] = key.split('|');
            return sql`(${userId}, ${day}::date, ${bits}::smallint)`;
          }),
          sql`, `,
        );
        // An account deleted since it was counted is simply left out.
        await tx.execute(sql`
        insert into ${activityDays} (user_id, day, platforms)
        select v.user_id, v.day, v.platforms
        from (values ${rows}) as v(user_id, day, platforms)
        where exists (select 1 from users u where u.id = v.user_id)
        on conflict (user_id, day)
        do update set platforms = ${activityDays.platforms} | excluded.platforms`);
      }
      for (let i = 0; i < views.length; i += 200) {
        await tx
          .insert(usageViews)
          .values(views.slice(i, i + 200))
          .onConflictDoUpdate({
            target: [
              usageViews.day,
              usageViews.hour,
              usageViews.module,
              usageViews.platform,
              usageViews.audience,
              usageViews.country,
              usageViews.locale,
            ],
            set: { n: sql`${usageViews.n} + excluded.n` },
          });
      }
    });
  } catch {
    // The database is unavailable: keep the counts for next time.
    for (const [key, bits] of presence) s.presence.set(key, (s.presence.get(key) ?? 0) | bits);
    for (const v of views) {
      const key = `${v.day}|${v.hour}|${v.module}|${v.platform}|${v.audience}|${v.country}|${v.locale}`;
      const now = s.views.get(key);
      if (now) now.n += v.n;
      else s.views.set(key, v);
    }
  }
}

/** Test helper: forget anything counted and not yet added. */
export function resetUsageForTests(): void {
  const s = state();
  s.views = new Map();
  s.presence = new Map();
}
