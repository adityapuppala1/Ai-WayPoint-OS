/**
 * The attention governor. Waypoint is built to be useful, not sticky: every proactive
 * message competes for a small daily budget the person sets (0–3), quiet hours are
 * respected, duplicates merge, and nothing is sent just to bring someone back.
 * Only safety-critical messages (a scam alert on something they shared, a check-in they
 * asked for after a crisis) may bypass the budget.
 */
import type { AttentionPrefs, DeliveryPlan, Nudge, NudgePriority } from '../types';

const PRIORITY_RANK: Record<NudgePriority, number> = { critical: 0, high: 1, normal: 2, low: 3 };

export const DEFAULT_ATTENTION: AttentionPrefs = {
  budgetPerDay: 1,
  quietHours: { start: '21:00', end: '08:00' },
  timezone: 'UTC',
};

function safeTimeZone(tz: string | undefined): string {
  if (!tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

function parseHm(value: string): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Minutes past local midnight in the person's time zone. */
export function localMinutes(now: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: safeTimeZone(timezone),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return (h % 24) * 60 + m;
}

/** The person's local calendar day, `YYYY-MM-DD`, used to count today's deliveries. */
export function localDayKey(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimeZone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isQuietTime(
  now: Date,
  prefs: Pick<AttentionPrefs, 'quietHours' | 'timezone'>,
): boolean {
  if (!prefs.quietHours) return false;
  const start = parseHm(prefs.quietHours.start);
  const end = parseHm(prefs.quietHours.end);
  if (start === null || end === null || start === end) return false;
  const t = localMinutes(now, prefs.timezone);
  return start < end ? t >= start && t < end : t >= start || t < end;
}

/** When quiet hours end (or `now` if it is not quiet time). */
export function quietHoursEnd(
  now: Date,
  prefs: Pick<AttentionPrefs, 'quietHours' | 'timezone'>,
): Date {
  if (!isQuietTime(now, prefs) || !prefs.quietHours) return now;
  const end = parseHm(prefs.quietHours.end) ?? 0;
  const t = localMinutes(now, prefs.timezone);
  const wait = (end - t + 1440) % 1440;
  const at = new Date(now.getTime() + wait * 60_000);
  at.setUTCSeconds(0, 0);
  return at;
}

function byPriorityThenNewest(a: Nudge, b: Nudge): number {
  return (
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    b.createdAt.getTime() - a.createdAt.getTime()
  );
}

/**
 * Decide which pending nudges to deliver now, which to hold for later, and which to drop.
 *
 * @param deliveredToday proactive messages already delivered in the person's local day
 *                       (critical ones don't count against the budget).
 */
export function planDelivery(
  nudges: Nudge[],
  prefs: AttentionPrefs,
  opts: { now: Date; deliveredToday: number },
): DeliveryPlan {
  const { now } = opts;
  const drop: Nudge[] = [];
  const live: Nudge[] = [];

  for (const n of nudges) {
    if (n.expiresAt && n.expiresAt.getTime() <= now.getTime()) drop.push(n);
    else live.push(n);
  }

  // Merge duplicates: the newest nudge with a given key wins.
  const byKey = new Map<string, Nudge>();
  const unique: Nudge[] = [];
  for (const n of live) {
    if (!n.dedupeKey) {
      unique.push(n);
      continue;
    }
    const prev = byKey.get(n.dedupeKey);
    if (!prev) byKey.set(n.dedupeKey, n);
    else if (n.createdAt.getTime() > prev.createdAt.getTime()) {
      drop.push(prev);
      byKey.set(n.dedupeKey, n);
    } else drop.push(n);
  }
  unique.push(...byKey.values());

  if (unique.length === 0) return { deliverNow: [], defer: [], drop, reason: 'nothing-to-send' };

  const critical = unique.filter((n) => n.priority === 'critical').sort(byPriorityThenNewest);
  const rest = unique.filter((n) => n.priority !== 'critical').sort(byPriorityThenNewest);

  if (isQuietTime(now, prefs)) {
    return { deliverNow: critical, defer: rest, drop, reason: 'quiet-hours' };
  }

  const remaining = Math.max(0, prefs.budgetPerDay - Math.max(0, opts.deliveredToday));
  const now_ = rest.slice(0, remaining);
  const over = rest.slice(remaining);
  // Low-priority items that don't fit today are dropped rather than piling up.
  const defer = over.filter((n) => n.priority !== 'low');
  drop.push(...over.filter((n) => n.priority === 'low'));

  const reason: DeliveryPlan['reason'] =
    over.length > 0 && now_.length === 0 ? 'budget-exhausted' : 'within-budget';
  return { deliverNow: [...critical, ...now_], defer, drop, reason };
}
