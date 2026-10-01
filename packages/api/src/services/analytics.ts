/**
 * The console's analytics: how many people use Waypoint, how they find their way in, whether
 * they come back, which parts they use and when — in totals only.
 *
 * Two sources are read (see lib/usage.ts): the days each person used Waypoint, and anonymous
 * counts of pages opened. Accounts, profiles, plans and feedback add who joined, from where,
 * in which language and situation. No group smaller than MIN_GROUP people is ever shown: it
 * is folded into "small groups", or hidden when even that is too small.
 */
import { z } from '@hono/zod-openapi';
import { LOCALES } from '@waypoint/core';
import { type Database, type SQL, sql } from '@waypoint/db';
import { flushUsage, PLATFORM_BIT } from '../lib/usage';

/** The smallest number of people a figure may describe. */
export const MIN_GROUP = 5;

export const RANGES = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 } as const;

export const AnalyticsQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d', '365d']).default('30d'),
  platform: z.enum(['all', 'web', 'phone', 'text']).default('all'),
  audience: z.enum(['all', 'accounts', 'guests']).default('all'),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  locale: z.enum(LOCALES).optional(),
});
export type AnalyticsQuery = z.input<typeof AnalyticsQuerySchema>;

const Count = z.number().int();
const Share = z.object({ id: z.string(), n: Count });

export const AnalyticsSchema = z
  .object({
    range: z.object({ start: z.string(), end: z.string(), days: Count }),
    /** The filters narrow it to fewer people than may be shown: nothing else is filled in. */
    tooFew: z.boolean(),
    people: z.object({
      /** Different people active in the period, and in the one before. */
      active: Count,
      activeBefore: Count,
      /** Average a day over the period. */
      dailyAverage: z.number(),
      /** The last 7 and 30 days of the period. */
      weekly: Count,
      monthly: Count,
      /** Daily average over the last 30 days, as a share of the monthly figure. */
      stickiness: z.number().nullable(),
      newGuests: Count,
      newAccounts: Count,
      newBefore: Count,
    }),
    daily: z.array(
      z.object({
        day: z.string(),
        accounts: Count,
        guests: Count,
        newAccounts: Count,
        newGuests: Count,
        views: Count,
      }),
    ),
    funnel: z.array(z.object({ id: z.string(), n: Count })),
    /** Weekly groups of people who joined, and the share of each active in the weeks after. */
    cohorts: z.array(
      z.object({ week: z.string(), size: Count, returned: z.array(z.number().nullable()) }),
    ),
    views: z.object({
      total: Count,
      totalBefore: Count,
      byModule: z.array(z.object({ id: z.string(), n: Count, before: Count })),
      /** Day of the week (1 Monday … 7 Sunday) by hour (UTC). */
      byHour: z.array(z.object({ dow: Count, hour: Count, n: Count })),
      byAudience: z.array(Share),
    }),
    platforms: z.array(Share),
    countries: z.array(Share),
    languages: z.array(Share),
    situations: z.array(Share),
    /** People counted in groups too small to show on their own. */
    smallGroups: z.object({ countries: Count, languages: Count, situations: Count }),
    feedback: z.array(z.object({ id: z.string(), n: Count, avgRating: z.number().nullable() })),
  })
  .openapi('Analytics');

export type Analytics = z.infer<typeof AnalyticsSchema>;

const DAY = 86_400_000;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const num = (v: unknown) => Number(v ?? 0);

/** Rows of a breakdown, with every group under MIN_GROUP folded away. */
function fold(rows: Array<{ id: string | null; n: unknown }>, unknown = 'unknown') {
  const shown: Array<{ id: string; n: number }> = [];
  let small = 0;
  for (const r of rows) {
    const n = num(r.n);
    if (n < MIN_GROUP) small += n;
    else shown.push({ id: r.id ?? unknown, n });
  }
  shown.sort((a, b) => b.n - a.n);
  return { shown, small: small >= MIN_GROUP ? small : 0 };
}

export async function analyticsView(
  db: Database,
  query: AnalyticsQuery = {},
  now = new Date(),
): Promise<Analytics> {
  const q = AnalyticsQuerySchema.parse(query);
  // This server's counts since its last half-minute flush, so the page is up to the moment.
  await flushUsage(db);
  const days = RANGES[q.range];
  const endT = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startT = endT - (days - 1) * DAY;
  const end = isoDay(endT);
  const start = isoDay(startT);
  const prevStart = isoDay(startT - days * DAY);
  const prevEnd = isoDay(startT - DAY);
  const weekStart = isoDay(endT - 6 * DAY);
  const monthStart = isoDay(endT - 29 * DAY);

  // ── Who is counted: the same filters everywhere ──
  const person = (opts: { platform?: boolean; country?: boolean; locale?: boolean } = {}) => {
    const parts: SQL[] = [sql`(u.role is null or u.role not in ('admin', 'staff'))`];
    if (q.audience === 'accounts') parts.push(sql`coalesce(u.is_anonymous, false) = false`);
    if (q.audience === 'guests') parts.push(sql`u.is_anonymous = true`);
    if (q.country && opts.country !== false) parts.push(sql`p.country = ${q.country}`);
    if (q.locale && opts.locale !== false) parts.push(sql`p.locale = ${q.locale}`);
    if (q.platform !== 'all' && opts.platform)
      parts.push(sql`(a.platforms & ${PLATFORM_BIT[q.platform]}) <> 0`);
    return sql.join(parts, sql` and `);
  };
  const activity = (from: string, to: string, opts: Parameters<typeof person>[0] = {}) => sql`
    from activity_days a
    join users u on u.id = a.user_id
    left join profiles p on p.user_id = a.user_id
    where a.day between ${from}::date and ${to}::date and ${person({ platform: true, ...opts })}`;
  const viewFilter = (opts: { country?: boolean } = {}) => {
    const parts: SQL[] = [sql`true`];
    if (q.platform !== 'all') parts.push(sql`v.platform = ${q.platform}`);
    if (q.audience !== 'all')
      parts.push(sql`v.audience = ${q.audience === 'accounts' ? 'account' : 'guest'}`);
    if (q.country && opts.country !== false) parts.push(sql`v.country = ${q.country}`);
    if (q.locale) parts.push(sql`v.locale = ${q.locale}`);
    return sql.join(parts, sql` and `);
  };
  const joined = (from: string, to: string) => sql`
    from users u
    left join profiles p on p.user_id = u.id
    where u.created_at >= ${from}::date and u.created_at < ${to}::date + 1 and ${person()}`;

  const one = async <T extends Record<string, unknown>>(q: SQL) =>
    ((await db.execute<T>(q)).rows[0] ?? {}) as Partial<T>;
  const many = async <T extends Record<string, unknown>>(q: SQL) => (await db.execute<T>(q)).rows;

  const [totals, before, newNow, newBefore] = await Promise.all([
    one<{ active: number; weekly: number }>(sql`
      select count(distinct a.user_id) as active,
        count(distinct a.user_id) filter (where a.day >= ${weekStart}::date) as weekly
      ${activity(start, end)}`),
    one<{ n: number }>(sql`select count(distinct a.user_id) as n ${activity(prevStart, prevEnd)}`),
    one<{ guests: number; accounts: number }>(sql`
      select count(*) filter (where u.is_anonymous) as guests,
        count(*) filter (where not coalesce(u.is_anonymous, false)) as accounts
      ${joined(start, end)}`),
    one<{ n: number }>(sql`select count(*) as n ${joined(prevStart, prevEnd)}`),
  ]);

  const active = num(totals.active);
  const narrowed = Boolean(q.country || q.locale);
  const empty: Analytics = {
    range: { start, end, days },
    tooFew: true,
    people: {
      active: 0,
      activeBefore: 0,
      dailyAverage: 0,
      weekly: 0,
      monthly: 0,
      stickiness: null,
      newGuests: 0,
      newAccounts: 0,
      newBefore: 0,
    },
    daily: [],
    funnel: [],
    cohorts: [],
    views: { total: 0, totalBefore: 0, byModule: [], byHour: [], byAudience: [] },
    platforms: [],
    countries: [],
    languages: [],
    situations: [],
    smallGroups: { countries: 0, languages: 0, situations: 0 },
    feedback: [],
  };
  // A country or a language with only a handful of people could point at one of them.
  const joinedCount = num(newNow.guests) + num(newNow.accounts);
  if (narrowed && active < MIN_GROUP && joinedCount < MIN_GROUP) return empty;

  const cohortStart = isoDay(
    // Monday of the week seven weeks before this one.
    endT - (((new Date(endT).getUTCDay() + 6) % 7) + 7 * 7) * DAY,
  );

  const [
    month,
    dailyActive,
    dailyNew,
    dailyViews,
    funnel,
    cohortSizes,
    cohortActivity,
    modules,
    hours,
    audiences,
    viewTotals,
    platforms,
    countries,
    languages,
    situations,
    feedbackRows,
  ] = await Promise.all([
    one<{ monthly: number; daily: number }>(sql`
      select count(distinct a.user_id) as monthly, count(*)::float / 30 as daily
      ${activity(monthStart, end)}`),
    many<{ day: string; accounts: number; guests: number }>(sql`
      select a.day::text as day,
        count(*) filter (where not coalesce(u.is_anonymous, false)) as accounts,
        count(*) filter (where u.is_anonymous) as guests
      ${activity(start, end)}
      group by a.day`),
    many<{ day: string; accounts: number; guests: number }>(sql`
      select (u.created_at at time zone 'UTC')::date::text as day,
        count(*) filter (where not coalesce(u.is_anonymous, false)) as accounts,
        count(*) filter (where u.is_anonymous) as guests
      ${joined(start, end)}
      group by 1`),
    many<{ day: string; n: number }>(sql`
      select v.day::text as day, sum(v.n) as n from usage_views v
      where v.day between ${start}::date and ${end}::date and ${viewFilter()}
      group by v.day`),
    one<{ joined: number; setUp: number; planned: number; returned: number; recent: number }>(sql`
      with c as (
        select u.id, (u.created_at at time zone 'UTC')::date as d,
          p.onboarded_at is not null as set_up,
          exists (select 1 from plans pl where pl.user_id = u.id) as planned,
          exists (select 1 from activity_days a2 where a2.user_id = u.id
            and a2.day > (u.created_at at time zone 'UTC')::date) as returned,
          exists (select 1 from activity_days a3 where a3.user_id = u.id
            and a3.day >= ${weekStart}::date) as recent
        ${joined(start, end)}
      )
      select count(*) as joined,
        count(*) filter (where set_up) as "setUp",
        count(*) filter (where set_up and planned) as planned,
        count(*) filter (where set_up and planned and returned) as returned,
        count(*) filter (where set_up and planned and returned and recent) as recent
      from c`),
    many<{ week: string; size: number }>(sql`
      select date_trunc('week', u.created_at at time zone 'UTC')::date::text as week,
        count(*) as size
      ${joined(cohortStart, end)}
      group by 1`),
    many<{ week: string; w: number; n: number }>(sql`
      with c as (
        select u.id, date_trunc('week', u.created_at at time zone 'UTC')::date as week
        ${joined(cohortStart, end)}
      )
      select c.week::text as week, ((a.day - c.week) / 7)::int as w,
        count(distinct a.user_id) as n
      from c join activity_days a on a.user_id = c.id and a.day >= c.week + 7
      group by 1, 2`),
    many<{ id: string; n: number; before: number }>(sql`
      select v.module as id,
        sum(v.n) filter (where v.day >= ${start}::date) as n,
        sum(v.n) filter (where v.day < ${start}::date) as before
      from usage_views v
      where v.day between ${prevStart}::date and ${end}::date and ${viewFilter()}
      group by v.module`),
    many<{ dow: number; hour: number; n: number }>(sql`
      select extract(isodow from v.day)::int as dow, v.hour::int as hour, sum(v.n) as n
      from usage_views v
      where v.day between ${start}::date and ${end}::date and ${viewFilter()}
      group by 1, 2`),
    many<{ id: string; n: number }>(sql`
      select v.audience as id, sum(v.n) as n from usage_views v
      where v.day between ${start}::date and ${end}::date and ${viewFilter()}
      group by 1`),
    one<{ now: number; before: number }>(sql`
      select coalesce(sum(v.n) filter (where v.day >= ${start}::date), 0) as now,
        coalesce(sum(v.n) filter (where v.day < ${start}::date), 0) as before
      from usage_views v
      where v.day between ${prevStart}::date and ${end}::date and ${viewFilter()}`),
    one<{ web: number; phone: number; text: number }>(sql`
      select
        count(distinct a.user_id) filter (where (a.platforms & 1) <> 0) as web,
        count(distinct a.user_id) filter (where (a.platforms & 2) <> 0) as phone,
        count(distinct a.user_id) filter (where (a.platforms & 4) <> 0) as text
      from activity_days a
      join users u on u.id = a.user_id
      left join profiles p on p.user_id = a.user_id
      where a.day between ${start}::date and ${end}::date and ${person()}`),
    many<{ id: string | null; n: number }>(sql`
      select p.country as id, count(distinct a.user_id) as n
      ${activity(start, end, { country: false })}
      group by 1`),
    many<{ id: string | null; n: number }>(sql`
      select p.locale as id, count(distinct a.user_id) as n
      ${activity(start, end, { locale: false })}
      group by 1`),
    many<{ id: string | null; n: number }>(sql`
      select p.situation as id, count(distinct a.user_id) as n
      ${activity(start, end)}
      group by 1`),
    many<{ id: string; n: number; avg: string | null }>(sql`
      select f.module as id, count(*) as n, avg(f.rating) as avg
      from feedback f
      left join users u on u.id = f.user_id
      left join profiles p on p.user_id = f.user_id
      where f.created_at >= ${start}::date and f.created_at < ${end}::date + 1
        and (f.user_id is null or ${person()})
      group by 1
      order by 2 desc`),
  ]);

  // ── Days in order, with nothing left out ──
  const byDay = new Map<string, Analytics['daily'][number]>();
  for (let t = startT; t <= endT; t += DAY) {
    const day = isoDay(t);
    byDay.set(day, { day, accounts: 0, guests: 0, newAccounts: 0, newGuests: 0, views: 0 });
  }
  for (const r of dailyActive) {
    const d = byDay.get(r.day);
    if (d) Object.assign(d, { accounts: num(r.accounts), guests: num(r.guests) });
  }
  for (const r of dailyNew) {
    const d = byDay.get(r.day);
    if (d) Object.assign(d, { newAccounts: num(r.accounts), newGuests: num(r.guests) });
  }
  for (const r of dailyViews) {
    const d = byDay.get(r.day);
    if (d) d.views = num(r.n);
  }
  const daily = [...byDay.values()];

  // ── Cohorts: a week's share only once that week has fully passed ──
  const activityByCohort = new Map<string, Map<number, number>>();
  for (const r of cohortActivity) {
    const m = activityByCohort.get(r.week) ?? new Map<number, number>();
    m.set(num(r.w), num(r.n));
    activityByCohort.set(r.week, m);
  }
  const cohorts = cohortSizes
    .map((c) => ({ week: c.week, size: num(c.size) }))
    .filter((c) => c.size >= MIN_GROUP)
    .sort((a, b) => a.week.localeCompare(b.week))
    .map((c) => {
      const weekT = Date.parse(`${c.week}T00:00:00Z`);
      const returned: Array<number | null> = [];
      for (let w = 1; w <= 7; w++) {
        const over = weekT + (7 * w + 6) * DAY <= endT;
        const n = activityByCohort.get(c.week)?.get(w) ?? 0;
        returned.push(over ? n / c.size : null);
      }
      return { ...c, returned };
    });

  const countryRows = fold(countries);
  const languageRows = fold(languages);
  const situationRows = fold(situations, 'unsaid');
  const monthly = num(month.monthly);
  const dailyAverage = daily.reduce((s, d) => s + d.accounts + d.guests, 0) / days;

  return {
    range: { start, end, days },
    tooFew: false,
    people: {
      active,
      activeBefore: num(before.n),
      dailyAverage,
      weekly: num(totals.weekly),
      monthly,
      stickiness: monthly >= MIN_GROUP ? num(month.daily) / monthly : null,
      newGuests: num(newNow.guests),
      newAccounts: num(newNow.accounts),
      newBefore: num(newBefore.n),
    },
    daily,
    funnel: [
      { id: 'joined', n: num(funnel.joined) },
      { id: 'setUp', n: num(funnel.setUp) },
      { id: 'planned', n: num(funnel.planned) },
      { id: 'returned', n: num(funnel.returned) },
      { id: 'recent', n: num(funnel.recent) },
    ],
    cohorts,
    views: {
      total: num(viewTotals.now),
      totalBefore: num(viewTotals.before),
      byModule: modules
        .map((m) => ({ id: m.id, n: num(m.n), before: num(m.before) }))
        .filter((m) => m.n > 0 || m.before > 0)
        .sort((a, b) => b.n - a.n),
      byHour: hours.map((h) => ({ dow: num(h.dow), hour: num(h.hour), n: num(h.n) })),
      byAudience: audiences.map((a) => ({ id: a.id, n: num(a.n) })),
    },
    platforms: fold([
      { id: 'web', n: platforms.web },
      { id: 'phone', n: platforms.phone },
      { id: 'text', n: platforms.text },
    ]).shown,
    countries: countryRows.shown,
    languages: languageRows.shown,
    situations: situationRows.shown,
    smallGroups: {
      countries: countryRows.small,
      languages: languageRows.small,
      situations: situationRows.small,
    },
    feedback: feedbackRows
      .filter((f) => num(f.n) >= MIN_GROUP)
      .map((f) => ({ id: f.id, n: num(f.n), avgRating: f.avg === null ? null : Number(f.avg) })),
  };
}
