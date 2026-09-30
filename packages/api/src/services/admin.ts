/**
 * Platform administration: the moderation queue for Circles, scam reports waiting for review,
 * AI spend against the budget, message delivery, conversations by SMS, WhatsApp and USSD
 * (counts only), and how recently the lifeline data (crisis lines, emergency numbers, health
 * lines) was checked against its sources.
 *
 * Every action is written to the audit log. Posts held because the writer may be in danger are
 * never shown to moderators — only counted; the writer was offered support when they posted.
 */
import { z } from '@hono/zod-openapi';
import { configuredProviders, monthSpendUsd } from '@waypoint/ai';
import {
  CIVIC_CHECKLISTS,
  EMERGENCY_NUMBERS,
  GOV_PORTALS,
  HEALTH_LINES,
  LEARNING_RESOURCES,
  ROLES,
  SCAM_PATTERNS,
  SCAM_REPORT_CHANNELS,
  type SourceRef,
  SUPPORT_RESOURCES,
} from '@waypoint/content';
import { REPORT_REASONS } from '@waypoint/core';
import { getEnv } from '@waypoint/core/env';
import { redactPII } from '@waypoint/core/privacy';
import {
  aiUsage,
  and,
  asc,
  auditLog,
  channelIdentities,
  channelStats,
  circlePosts,
  circleReports,
  circles,
  count,
  crisisEvents,
  type Database,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  jobs,
  lt,
  nudges,
  or,
  organizations,
  orgEnrolments,
  orgProgrammes,
  outbox,
  profiles,
  scamReports,
  sessions,
  sql,
  users,
} from '@waypoint/db';
import { channelsReady } from '../channels/providers';
import { emailReady } from '../email/send';
import { type Actor, audit } from '../lib/audit';
import { ApiError, notFound } from '../lib/problem';
import { SCAM_CATEGORIES } from './shield';

// ─────────────────────────────── Overview ───────────────────────────────

const Freshness = z.object({
  collection: z.string(),
  total: z.number().int(),
  stale: z.number().int(),
  /** Entries with no source: fine for general guidance, never for a lifeline (counted stale). */
  unsourced: z.number().int(),
  /** Days after which an entry needs checking again. */
  maxAgeDays: z.number().int(),
  oldest: z.string().nullable(),
});

const StaleItem = z.object({
  collection: z.string(),
  id: z.string(),
  name: z.string(),
  country: z.string().nullable(),
  checkedAt: z.string(),
  url: z.string().nullable(),
});

const TEXT_CHANNELS = ['sms', 'whatsapp', 'ussd'] as const;
/** What people texted about, grouped for reading at a glance. */
const CHANNEL_KINDS = ['safety', 'help', 'check', 'questions', 'settings', 'other'] as const;
type ChannelKind = (typeof CHANNEL_KINDS)[number];
const KIND_OF_INTENT: Record<string, ChannelKind> = {
  crisis: 'safety',
  help: 'help',
  check: 'check',
  ask: 'questions',
  guided: 'questions',
  menu: 'settings',
  language: 'settings',
  country: 'settings',
  ai: 'settings',
  stop: 'settings',
  start: 'settings',
};

export const AdminOverviewSchema = z
  .object({
    generatedAt: z.string(),
    people: z.object({
      accounts: z.number().int(),
      guests: z.number().int(),
      newAccounts7d: z.number().int(),
      newGuests7d: z.number().int(),
      active7d: z.number().int(),
    }),
    safety: z.object({
      /** Crisis responses shown in the last 7 days, by tier (counts only). */
      crisis7d: z.object({
        total: z.number().int(),
        tier1: z.number().int(),
        tier2: z.number().int(),
        tier3: z.number().int(),
      }),
      followUpsDue: z.number().int(),
      heldForSafety: z.number().int(),
      heldAsScam: z.number().int(),
      hiddenByReports: z.number().int(),
      openReports: z.number().int(),
      scamReportsNew: z.number().int(),
    }),
    organisations: z.object({
      organisations: z.number().int(),
      programmes: z.number().int(),
      enrolments: z.number().int(),
    }),
    ai: z.object({
      providers: z.array(z.string()),
      monthSpendUsd: z.number(),
      budgetUsd: z.number(),
      calls30d: z.number().int(),
      byStatus: z.record(z.string(), z.number().int()),
      byFeature: z.array(
        z.object({ feature: z.string(), calls: z.number().int(), costUsd: z.number() }),
      ),
      daily: z.array(z.object({ date: z.string(), calls: z.number().int(), costUsd: z.number() })),
    }),
    delivery: z.object({
      queued: z.number().int(),
      failed: z.number().int(),
      lastError: z.string().nullable(),
      jobsFailed: z.number().int(),
    }),
    /** Conversations by text over the last 30 days: counts only, never numbers or words. */
    channels: z.object({
      ready: z.object({
        sms: z.boolean(),
        whatsapp: z.boolean(),
        ussd: z.boolean(),
        email: z.boolean(),
      }),
      numbers30d: z.number().int(),
      byChannel: z.array(
        z.object({
          channel: z.enum(TEXT_CHANNELS),
          in: z.number().int(),
          out: z.number().int(),
        }),
      ),
      byKind: z.object(
        Object.fromEntries(CHANNEL_KINDS.map((k) => [k, z.number().int()])) as Record<
          ChannelKind,
          z.ZodNumber
        >,
      ),
      aiAnswers: z.number().int(),
      codes: z.number().int(),
    }),
    content: z.object({
      collections: z.array(Freshness),
      staleLifelines: z.array(StaleItem),
    }),
  })
  .openapi('AdminOverview');

export type AdminOverview = z.infer<typeof AdminOverviewSchema>;

const DAY = 86_400_000;
const num = (v: unknown) => Number(v ?? 0);

const latestCheck = (sources: SourceRef[] | undefined): string | null =>
  (sources ?? [])
    .map((s) => s.checkedAt)
    .sort()
    .at(-1) ?? null;

interface ContentEntry {
  id: string;
  name: string;
  country: string | null;
  checkedAt: string | null;
  url: string | null;
}

function contentCollections(): Array<{
  collection: string;
  maxAgeDays: number;
  lifeline: boolean;
  entries: ContentEntry[];
}> {
  const src = (sources: SourceRef[]) => sources[0]?.url ?? null;
  return [
    {
      collection: 'emergency',
      maxAgeDays: 180,
      lifeline: true,
      entries: EMERGENCY_NUMBERS.map((e) => ({
        id: e.country,
        name: e.general ?? e.police ?? e.ambulance ?? e.country,
        country: e.country,
        checkedAt: latestCheck(e.sources),
        url: src(e.sources),
      })),
    },
    {
      collection: 'support',
      maxAgeDays: 180,
      lifeline: true,
      entries: SUPPORT_RESOURCES.map((r) => ({
        id: r.id,
        name: r.name,
        country: r.country,
        checkedAt: latestCheck(r.sources),
        url: src(r.sources),
      })),
    },
    {
      collection: 'health',
      maxAgeDays: 180,
      lifeline: true,
      entries: HEALTH_LINES.map((h) => ({
        id: h.id,
        name: h.name,
        country: h.country,
        checkedAt: latestCheck(h.sources),
        url: src(h.sources),
      })),
    },
    {
      collection: 'reportChannels',
      maxAgeDays: 180,
      lifeline: true,
      entries: SCAM_REPORT_CHANNELS.map((r) => ({
        id: `${r.country}:${r.name}`,
        name: r.name,
        country: r.country,
        checkedAt: latestCheck(r.sources),
        url: src(r.sources),
      })),
    },
    {
      collection: 'scamPatterns',
      maxAgeDays: 365,
      lifeline: false,
      entries: SCAM_PATTERNS.map((p) => ({
        id: p.id,
        name: p.title,
        country: null,
        checkedAt: latestCheck(p.sources),
        url: src(p.sources),
      })),
    },
    {
      collection: 'civic',
      maxAgeDays: 365,
      lifeline: false,
      entries: CIVIC_CHECKLISTS.map((c) => ({
        id: `${c.event}:${c.country}`,
        name: c.title,
        country: c.country,
        checkedAt: latestCheck(c.sources),
        url: src(c.sources),
      })),
    },
    {
      collection: 'portals',
      maxAgeDays: 365,
      lifeline: false,
      entries: GOV_PORTALS.map((p) => ({
        id: `${p.country}:${p.name}`,
        name: p.name,
        country: p.country,
        checkedAt: latestCheck(p.sources),
        url: src(p.sources),
      })),
    },
    {
      collection: 'roles',
      maxAgeDays: 365,
      lifeline: false,
      entries: ROLES.map((r) => ({
        id: r.id,
        name: r.title,
        country: null,
        checkedAt: latestCheck(r.sources),
        url: src(r.sources),
      })),
    },
    {
      collection: 'resources',
      maxAgeDays: 365,
      lifeline: false,
      entries: LEARNING_RESOURCES.map((r) => ({
        id: r.id,
        name: r.title,
        country: null,
        checkedAt: r.checkedAt,
        url: r.url,
      })),
    },
  ];
}

/** How recently each kind of reference data was checked, and which lifelines are overdue. */
export function contentFreshness(today = new Date()): AdminOverview['content'] {
  const collections: AdminOverview['content']['collections'] = [];
  const staleLifelines: AdminOverview['content']['staleLifelines'] = [];
  for (const c of contentCollections()) {
    const cutoff = new Date(today.getTime() - c.maxAgeDays * DAY).toISOString().slice(0, 10);
    const dates = c.entries
      .map((e) => e.checkedAt)
      .filter((d): d is string => Boolean(d))
      .sort();
    const stale = c.entries.filter((e) => (e.checkedAt ? e.checkedAt < cutoff : c.lifeline));
    collections.push({
      collection: c.collection,
      total: c.entries.length,
      stale: stale.length,
      unsourced: c.entries.filter((e) => !e.checkedAt).length,
      maxAgeDays: c.maxAgeDays,
      oldest: dates[0] ?? null,
    });
    if (c.lifeline)
      for (const e of stale)
        staleLifelines.push({
          collection: c.collection,
          id: e.id,
          name: e.name,
          country: e.country,
          checkedAt: e.checkedAt ?? '',
          url: e.url,
        });
  }
  staleLifelines.sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));
  return { collections, staleLifelines };
}

export async function adminOverview(db: Database, now = new Date()): Promise<AdminOverview> {
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const monthAgo = new Date(now.getTime() - 30 * DAY);
  const fortnightAgo = new Date(now.getTime() - 13 * DAY);
  fortnightAgo.setUTCHours(0, 0, 0, 0);
  const guestFlag = sql`coalesce(${users.isAnonymous}, false)`;

  const [
    [people],
    [active],
    crisisRows,
    [followUps],
    heldRows,
    [openReports],
    [scamNew],
    [orgs],
    [programmes],
    [enrolments],
    statusRows,
    featureRows,
    dailyRows,
    outboxRows,
    [lastFailure],
    [jobsFailed],
    channelRows,
    [texters],
  ] = await Promise.all([
    db
      .select({
        accounts: sql<number>`count(*) filter (where not ${guestFlag})::int`,
        guests: sql<number>`count(*) filter (where ${guestFlag})::int`,
        newAccounts: sql<number>`count(*) filter (where not ${guestFlag} and ${users.createdAt} >= ${weekAgo.toISOString()}::timestamptz)::int`,
        newGuests: sql<number>`count(*) filter (where ${guestFlag} and ${users.createdAt} >= ${weekAgo.toISOString()}::timestamptz)::int`,
      })
      .from(users),
    db
      .select({ n: sql<number>`count(distinct ${sessions.userId})::int` })
      .from(sessions)
      .where(gte(sessions.updatedAt, weekAgo)),
    db
      .select({ tier: crisisEvents.tier, n: count() })
      .from(crisisEvents)
      .where(gte(crisisEvents.createdAt, weekAgo))
      .groupBy(crisisEvents.tier),
    db
      .select({ n: count() })
      .from(crisisEvents)
      .where(and(eq(crisisEvents.followUpStatus, 'scheduled'), lt(crisisEvents.followUpAt, now))),
    db
      .select({ reason: circlePosts.hiddenReason, n: count() })
      .from(circlePosts)
      .where(sql`${circlePosts.hiddenAt} is not null`)
      .groupBy(circlePosts.hiddenReason),
    db.select({ n: count() }).from(circleReports).where(isNull(circleReports.resolvedAt)),
    db.select({ n: count() }).from(scamReports).where(eq(scamReports.status, 'new')),
    db.select({ n: count() }).from(organizations),
    db.select({ n: count() }).from(orgProgrammes),
    db.select({ n: count() }).from(orgEnrolments),
    db
      .select({ status: aiUsage.status, n: count() })
      .from(aiUsage)
      .where(gte(aiUsage.createdAt, monthAgo))
      .groupBy(aiUsage.status),
    db
      .select({
        feature: aiUsage.feature,
        n: count(),
        cost: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)::float8`,
      })
      .from(aiUsage)
      .where(gte(aiUsage.createdAt, monthAgo))
      .groupBy(aiUsage.feature)
      .orderBy(desc(count())),
    db
      .select({
        day: sql<string>`to_char(${aiUsage.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        n: count(),
        cost: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)::float8`,
      })
      .from(aiUsage)
      .where(gte(aiUsage.createdAt, fortnightAgo))
      .groupBy(sql`1`),
    db.select({ status: outbox.status, n: count() }).from(outbox).groupBy(outbox.status),
    db
      .select({ error: outbox.lastError })
      .from(outbox)
      .where(eq(outbox.status, 'failed'))
      .orderBy(desc(outbox.createdAt))
      .limit(1),
    db.select({ n: count() }).from(jobs).where(eq(jobs.status, 'failed')),
    db
      .select({
        channel: channelStats.channel,
        direction: channelStats.direction,
        intent: channelStats.intent,
        n: sql<number>`sum(${channelStats.n})::int`,
      })
      .from(channelStats)
      .where(gte(channelStats.day, monthAgo.toISOString().slice(0, 10)))
      .groupBy(channelStats.channel, channelStats.direction, channelStats.intent),
    db
      .select({ n: count() })
      .from(channelIdentities)
      .where(gte(channelIdentities.lastSeenAt, monthAgo)),
  ]);

  const tiers = new Map(crisisRows.map((r) => [r.tier, num(r.n)]));
  const held = new Map(heldRows.map((r) => [r.reason ?? 'reports', num(r.n)]));
  const byStatus: Record<string, number> = {};
  for (const r of statusRows) byStatus[r.status] = num(r.n);
  const daily = new Map(dailyRows.map((r) => [r.day, r]));
  const days: AdminOverview['ai']['daily'] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY).toISOString().slice(0, 10);
    const row = daily.get(d);
    days.push({ date: d, calls: num(row?.n), costUsd: Math.round(num(row?.cost) * 100) / 100 });
  }
  const box = new Map(outboxRows.map((r) => [r.status, num(r.n)]));
  const env = getEnv();

  const perChannel = new Map(TEXT_CHANNELS.map((c) => [c, { channel: c, in: 0, out: 0 }]));
  const byKind = Object.fromEntries(CHANNEL_KINDS.map((k) => [k, 0])) as Record<
    ChannelKind,
    number
  >;
  let aiAnswers = 0;
  let codes = 0;
  for (const r of channelRows) {
    const n = num(r.n);
    const row = perChannel.get(r.channel as (typeof TEXT_CHANNELS)[number]);
    if (!row) continue;
    if (r.direction === 'in') {
      row.in += n;
      byKind[KIND_OF_INTENT[r.intent] ?? 'other'] += n;
    } else {
      row.out += n;
      if (r.intent === 'ai') aiAnswers += n;
      if (r.intent === 'otp') codes += n;
    }
  }

  return {
    generatedAt: now.toISOString(),
    people: {
      accounts: num(people?.accounts),
      guests: num(people?.guests),
      newAccounts7d: num(people?.newAccounts),
      newGuests7d: num(people?.newGuests),
      active7d: num(active?.n),
    },
    safety: {
      crisis7d: {
        total: [...tiers.values()].reduce((a, b) => a + b, 0),
        tier1: tiers.get(1) ?? 0,
        tier2: tiers.get(2) ?? 0,
        tier3: tiers.get(3) ?? 0,
      },
      followUpsDue: num(followUps?.n),
      heldForSafety: held.get('crisis') ?? 0,
      heldAsScam: held.get('scam') ?? 0,
      hiddenByReports: held.get('reports') ?? 0,
      openReports: num(openReports?.n),
      scamReportsNew: num(scamNew?.n),
    },
    organisations: {
      organisations: num(orgs?.n),
      programmes: num(programmes?.n),
      enrolments: num(enrolments?.n),
    },
    ai: {
      providers: configuredProviders().map((p) => p.id),
      monthSpendUsd: Math.round((await monthSpendUsd(db)) * 100) / 100,
      budgetUsd: env.AI_MONTHLY_BUDGET_USD,
      calls30d: Object.values(byStatus).reduce((a, b) => a + b, 0),
      byStatus,
      byFeature: featureRows.map((r) => ({
        feature: r.feature,
        calls: num(r.n),
        costUsd: Math.round(num(r.cost) * 100) / 100,
      })),
      daily: days,
    },
    delivery: {
      queued: box.get('queued') ?? 0,
      failed: box.get('failed') ?? 0,
      // Provider errors can echo an address or number: never show one.
      lastError: lastFailure?.error ? redactPII(lastFailure.error).text.slice(0, 300) : null,
      jobsFailed: num(jobsFailed?.n),
    },
    channels: {
      ready: { ...channelsReady(), email: emailReady() },
      numbers30d: num(texters?.n),
      byChannel: [...perChannel.values()],
      byKind,
      aiAnswers,
      codes,
    },
    content: contentFreshness(now),
  };
}

/** What is waiting for staff: shown as counts in the admin navigation. */
export async function adminCounts(db: Database): Promise<{ moderation: number; reports: number }> {
  const [posts, [reports]] = await Promise.all([
    db.execute<{ n: number }>(sql`
      select count(*)::int as n from circle_posts p
      where p.hidden_reason in ('scam', 'reports')
        or (p.hidden_reason is distinct from 'crisis' and exists (
          select 1 from circle_reports r where r.post_id = p.id and r.resolved_at is null))`),
    db.select({ n: count() }).from(scamReports).where(eq(scamReports.status, 'new')),
  ]);
  return { moderation: num(posts.rows[0]?.n), reports: num(reports?.n) };
}

// ─────────────────────────────── Moderation ───────────────────────────────

export const ModerationItemSchema = z.object({
  postId: z.string(),
  circle: z.object({
    id: z.string(),
    name: z.string(),
    language: z.string(),
    country: z.string().nullable(),
  }),
  kind: z.string(),
  /** The post as members would see it (personal details were masked when it was written). */
  body: z.string(),
  isReply: z.boolean(),
  createdAt: z.string(),
  /** Why it is hidden: `scam` (held on posting) or `reports`; null while still visible. */
  held: z.enum(['scam', 'reports']).nullable(),
  reports: z.array(z.object({ reason: z.enum(REPORT_REASONS), n: z.number().int() })),
  firstReportedAt: z.string().nullable(),
});

export const ModerationQueueSchema = z
  .object({
    items: z.array(ModerationItemSchema),
    /** Posts held because the writer may be in danger: counted, never shown. */
    heldForSafety: z.number().int(),
  })
  .openapi('ModerationQueue');

export const ModerationInputSchema = z
  .object({ action: z.enum(['restore', 'remove']) })
  .openapi('ModerationInput');

export type ModerationQueue = z.infer<typeof ModerationQueueSchema>;

export async function moderationQueue(db: Database): Promise<ModerationQueue> {
  const openReports = await db
    .select({
      postId: circleReports.postId,
      reason: circleReports.reason,
      n: count(),
      first: sql<string>`min(${circleReports.createdAt})`,
    })
    .from(circleReports)
    .where(isNull(circleReports.resolvedAt))
    .groupBy(circleReports.postId, circleReports.reason);
  const reportedIds = [...new Set(openReports.map((r) => r.postId))];
  const posts = await db
    .select({ post: circlePosts, circle: circles })
    .from(circlePosts)
    .innerJoin(circles, eq(circles.id, circlePosts.circleId))
    .where(
      and(
        or(
          inArray(circlePosts.hiddenReason, ['scam', 'reports']),
          reportedIds.length ? inArray(circlePosts.id, reportedIds) : sql`false`,
        ),
        // A crisis hold is never shown to moderators, even if it was also reported.
        sql`${circlePosts.hiddenReason} is distinct from 'crisis'`,
      ),
    )
    .orderBy(asc(circlePosts.createdAt))
    .limit(200);
  const [safety] = await db
    .select({ n: count() })
    .from(circlePosts)
    .where(eq(circlePosts.hiddenReason, 'crisis'));

  const reasons = (postId: string) =>
    openReports
      .filter(
        (r) => r.postId === postId && (REPORT_REASONS as readonly string[]).includes(r.reason),
      )
      .map((r) => ({ reason: r.reason as (typeof REPORT_REASONS)[number], n: num(r.n) }))
      .sort((a, b) => b.n - a.n);

  const items = posts
    // Belt and braces: the query above already leaves crisis holds out.
    .filter(({ post }) => post.hiddenReason !== 'crisis')
    .map(({ post, circle }) => {
      const firsts = openReports.filter((r) => r.postId === post.id).map((r) => String(r.first));
      const first = firsts.sort()[0];
      return {
        postId: post.id,
        circle: {
          id: circle.id,
          name: circle.name,
          language: circle.language,
          country: circle.country,
        },
        kind: post.kind,
        body: post.body,
        isReply: Boolean(post.parentId),
        createdAt: post.createdAt.toISOString(),
        held: post.hiddenAt
          ? post.hiddenReason === 'scam'
            ? ('scam' as const)
            : ('reports' as const)
          : null,
        reports: reasons(post.id),
        firstReportedAt: first ? new Date(first).toISOString() : null,
      };
    })
    .sort((a, b) => {
      const weight = (i: typeof a) => (i.held ? 1000 : 0) + i.reports.reduce((s, r) => s + r.n, 0);
      return weight(b) - weight(a) || a.createdAt.localeCompare(b.createdAt);
    });
  return { items, heldForSafety: num(safety?.n) };
}

/** What the writer is told (in their language) when a moderator acts on their post. */
const MODERATION_NOTE: Record<
  string,
  { removed: { title: string; body: string }; restored: { title: string; body: string } }
> = {
  en: {
    removed: {
      title: 'A post of yours was removed',
      body: 'A moderator removed a post you wrote in a circle because it didn’t follow the circle guidelines — for example selling something, asking for money or sharing contact details. You’re still welcome in the circle.',
    },
    restored: {
      title: 'Your post is visible again',
      body: 'A moderator checked a post you wrote in a circle and it’s now visible to members. Thanks for your patience.',
    },
  },
  hi: {
    removed: {
      title: 'आपकी एक पोस्ट हटा दी गई',
      body: 'एक मॉडरेटर ने मंडली में लिखी आपकी एक पोस्ट हटा दी, क्योंकि वह मंडली के नियमों के अनुसार नहीं थी — जैसे कुछ बेचना, पैसे माँगना या संपर्क जानकारी साझा करना। मंडली में आपका अब भी स्वागत है।',
    },
    restored: {
      title: 'आपकी पोस्ट फिर से दिख रही है',
      body: 'एक मॉडरेटर ने मंडली में लिखी आपकी पोस्ट की जाँच की और अब वह सदस्यों को दिख रही है। धैर्य रखने के लिए धन्यवाद।',
    },
  },
  es: {
    removed: {
      title: 'Se ha retirado una de tus publicaciones',
      body: 'Un moderador retiró una publicación que escribiste en un círculo porque no seguía las normas del círculo; por ejemplo, vender algo, pedir dinero o compartir datos de contacto. El círculo te sigue dando la bienvenida.',
    },
    restored: {
      title: 'Tu publicación vuelve a estar visible',
      body: 'Un moderador revisó una publicación que escribiste en un círculo y ya pueden verla los miembros. Gracias por tu paciencia.',
    },
  },
  fr: {
    removed: {
      title: 'Une de vos publications a été retirée',
      body: 'Un modérateur a retiré une publication que vous aviez écrite dans un cercle, car elle ne respectait pas les règles du cercle — par exemple vendre quelque chose, demander de l’argent ou partager des coordonnées. Le cercle vous reste ouvert.',
    },
    restored: {
      title: 'Votre publication est de nouveau visible',
      body: 'Un modérateur a vérifié une publication que vous aviez écrite dans un cercle, et elle est de nouveau visible pour les membres. Merci de votre patience.',
    },
  },
  pt: {
    removed: {
      title: 'Uma publicação sua foi removida',
      body: 'Um moderador removeu uma publicação que você escreveu em um círculo porque ela não seguia as regras do círculo — por exemplo, vender algo, pedir dinheiro ou compartilhar dados de contato. O círculo continua aberto para você.',
    },
    restored: {
      title: 'Sua publicação está visível de novo',
      body: 'Um moderador verificou uma publicação que você escreveu em um círculo e agora ela está visível para os membros. Obrigado pela paciência.',
    },
  },
  ar: {
    removed: {
      title: 'أُزيل أحد منشوراتك',
      body: 'أزال أحد المشرفين منشورًا كتبته في حلقة لأنه لم يلتزم بإرشادات الحلقة، مثل بيع شيء أو طلب المال أو مشاركة بيانات التواصل. ما زال مرحّبًا بك في الحلقة.',
    },
    restored: {
      title: 'منشورك ظاهر من جديد',
      body: 'راجع أحد المشرفين منشورًا كتبته في حلقة، وأصبح الآن ظاهرًا للأعضاء. شكرًا على صبرك.',
    },
  },
  sw: {
    removed: {
      title: 'Chapisho lako moja limeondolewa',
      body: 'Msimamizi ameondoa chapisho uliloandika katika kikundi kwa sababu halikufuata miongozo ya kikundi — kwa mfano kuuza kitu, kuomba pesa au kushiriki maelezo ya mawasiliano. Bado unakaribishwa katika kikundi.',
    },
    restored: {
      title: 'Chapisho lako linaonekana tena',
      body: 'Msimamizi amekagua chapisho uliloandika katika kikundi na sasa linaonekana kwa wanachama. Asante kwa uvumilivu wako.',
    },
  },
};

export async function moderatePost(
  db: Database,
  actor: Actor,
  postId: string,
  action: 'restore' | 'remove',
): Promise<void> {
  const [post] = await db.select().from(circlePosts).where(eq(circlePosts.id, postId)).limit(1);
  // Crisis holds are handled by the safety protocol, not moderation.
  if (!post || post.hiddenReason === 'crisis') throw notFound('Post');
  const reasons = await db
    .select({ reason: circleReports.reason, n: count() })
    .from(circleReports)
    .where(and(eq(circleReports.postId, postId), isNull(circleReports.resolvedAt)))
    .groupBy(circleReports.reason);
  if (action === 'restore' && !post.hiddenAt && !reasons.length)
    throw new ApiError(409, 'nothing-to-review', 'This post is not waiting for review.');

  const locale = post.authorId
    ? ((
        await db
          .select({ locale: profiles.locale })
          .from(profiles)
          .where(eq(profiles.userId, post.authorId))
          .limit(1)
      )[0]?.locale ?? 'en')
    : 'en';
  const copy = MODERATION_NOTE[locale] ?? MODERATION_NOTE.en!;
  const note = action === 'remove' ? copy.removed : copy.restored;

  await db.transaction(async (tx) => {
    if (action === 'remove') {
      // A reply held because its writer may be in danger is theirs alone to see, and no
      // moderator ever reads it: it is set loose from the post being removed rather than
      // deleted with it, so the writer still finds their words and the support card.
      await tx
        .update(circlePosts)
        .set({ parentId: null })
        .where(and(eq(circlePosts.parentId, postId), eq(circlePosts.hiddenReason, 'crisis')));
      await tx
        .delete(circlePosts)
        .where(or(eq(circlePosts.id, postId), eq(circlePosts.parentId, postId)));
    } else {
      await tx
        .update(circlePosts)
        .set({ hiddenAt: null, hiddenReason: null })
        .where(eq(circlePosts.id, postId));
      await tx
        .update(circleReports)
        .set({ resolvedAt: new Date(), resolution: 'kept' })
        .where(and(eq(circleReports.postId, postId), isNull(circleReports.resolvedAt)));
    }
    // Tell the writer what happened (a restore only matters if they saw it held).
    if (post.authorId && (action === 'remove' || post.hiddenAt)) {
      await tx.insert(nudges).values({
        userId: post.authorId,
        module: 'circles',
        priority: 'normal',
        title: note.title,
        body: note.body,
        href: `/circles/${post.circleId}`,
        dedupeKey: `moderation:${postId}`,
        expiresAt: new Date(Date.now() + 14 * DAY),
      });
    }
    await audit(tx, actor, {
      action: action === 'remove' ? 'moderation.removed' : 'moderation.restored',
      targetType: 'circle-post',
      targetId: postId,
      meta: {
        circleId: post.circleId,
        held: post.hiddenReason,
        reports: Object.fromEntries(reasons.map((r) => [r.reason, num(r.n)])),
      },
    });
  });
}

// ─────────────────────────────── Scam reports ───────────────────────────────

export const SCAM_REPORT_STATUSES = ['new', 'reviewed', 'published', 'rejected'] as const;

export const ScamReportItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  country: z.string().nullable(),
  /** Personal details were removed before this was stored. */
  description: z.string().nullable(),
  urlHosts: z.array(z.string()),
  amountLost: z.number().nullable(),
  currency: z.string().nullable(),
  reportedTo: z.array(z.string()),
  status: z.enum(SCAM_REPORT_STATUSES),
  createdAt: z.string(),
  /** Other reports that share a website or a (hashed) phone number or payment id. */
  related: z.number().int(),
});

export const ScamReportListSchema = z
  .object({
    items: z.array(ScamReportItemSchema),
    counts: z.record(z.string(), z.number().int()),
  })
  .openapi('ScamReportList');

export const ScamReviewInputSchema = z
  .object({ status: z.enum(['reviewed', 'published', 'rejected']) })
  .openapi('ScamReviewInput');

export type ScamReportList = z.infer<typeof ScamReportListSchema>;

export async function scamReportList(
  db: Database,
  status: (typeof SCAM_REPORT_STATUSES)[number] = 'new',
): Promise<ScamReportList> {
  const rows = await db
    .select()
    .from(scamReports)
    .where(eq(scamReports.status, status))
    .orderBy(status === 'new' ? asc(scamReports.createdAt) : desc(scamReports.createdAt))
    .limit(100);
  const tallies = await db
    .select({ status: scamReports.status, n: count() })
    .from(scamReports)
    .groupBy(scamReports.status);
  const related = new Map<string, number>();
  if (rows.length) {
    const res = await db.execute<{ id: string; n: number }>(sql`
      select r.id, count(distinct o.id)::int as n
      from scam_reports r
      join scam_reports o on o.id <> r.id
        and (o.url_hosts && r.url_hosts or o.identifier_hashes && r.identifier_hashes)
      where r.id in (${sql.join(
        rows.map((r) => sql`${r.id}`),
        sql`, `,
      )})
      group by r.id`);
    for (const r of res.rows) related.set(r.id, num(r.n));
  }
  const counts: Record<string, number> = { new: 0, reviewed: 0, published: 0, rejected: 0 };
  for (const t of tallies) counts[t.status] = num(t.n);
  return {
    items: rows.map((r) => ({
      id: r.id,
      category: r.category,
      country: r.country,
      description: r.descriptionRedacted,
      urlHosts: r.urlHosts,
      amountLost: r.amountLost === null ? null : Number(r.amountLost),
      currency: r.currency,
      reportedTo: r.reportedTo,
      status: (SCAM_REPORT_STATUSES as readonly string[]).includes(r.status)
        ? (r.status as (typeof SCAM_REPORT_STATUSES)[number])
        : 'new',
      createdAt: r.createdAt.toISOString(),
      related: related.get(r.id) ?? 0,
    })),
    counts,
  };
}

export async function reviewScamReport(
  db: Database,
  actor: Actor,
  id: string,
  status: 'reviewed' | 'published' | 'rejected',
): Promise<void> {
  const [row] = await db
    .select({ status: scamReports.status })
    .from(scamReports)
    .where(eq(scamReports.id, id))
    .limit(1);
  if (!row) throw notFound('Report');
  await db.transaction(async (tx) => {
    await tx.update(scamReports).set({ status }).where(eq(scamReports.id, id));
    await audit(tx, actor, {
      action: `scam-report.${status}`,
      targetType: 'scam-report',
      targetId: id,
      meta: { from: row.status },
    });
  });
}

/** Published reports for a country (last 90 days): what people there are being targeted with. */
export const ReportedScamsSchema = z
  .object({
    country: z.string().nullable(),
    days: z.number().int(),
    total: z.number().int(),
    categories: z.array(
      z.object({
        category: z.enum(SCAM_CATEGORIES),
        reports: z.number().int(),
        /** Websites named in reports (checked by a moderator before publishing). */
        hosts: z.array(z.string()),
        latest: z.string(),
      }),
    ),
  })
  .openapi('ReportedScams');

export type ReportedScams = z.infer<typeof ReportedScamsSchema>;

export async function reportedScams(
  db: Database,
  country: string | null,
  now = new Date(),
): Promise<ReportedScams> {
  const days = 90;
  const since = new Date(now.getTime() - days * DAY);
  const rows = await db
    .select({
      category: scamReports.category,
      urlHosts: scamReports.urlHosts,
      createdAt: scamReports.createdAt,
    })
    .from(scamReports)
    .where(
      and(
        eq(scamReports.status, 'published'),
        gte(scamReports.createdAt, since),
        country ? eq(scamReports.country, country) : sql`true`,
      ),
    )
    .orderBy(desc(scamReports.createdAt))
    .limit(1000);
  const byCategory = new Map<
    string,
    { reports: number; hosts: Map<string, number>; latest: Date }
  >();
  for (const r of rows) {
    if (!(SCAM_CATEGORIES as readonly string[]).includes(r.category)) continue;
    const entry = byCategory.get(r.category) ?? {
      reports: 0,
      hosts: new Map<string, number>(),
      latest: r.createdAt,
    };
    entry.reports++;
    for (const h of r.urlHosts) entry.hosts.set(h, (entry.hosts.get(h) ?? 0) + 1);
    if (r.createdAt > entry.latest) entry.latest = r.createdAt;
    byCategory.set(r.category, entry);
  }
  return {
    country,
    days,
    total: rows.length,
    categories: [...byCategory]
      .map(([category, e]) => ({
        category: category as (typeof SCAM_CATEGORIES)[number],
        reports: e.reports,
        hosts: [...e.hosts]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, 5)
          .map(([h]) => h),
        latest: e.latest.toISOString().slice(0, 10),
      }))
      .sort((a, b) => b.reports - a.reports || b.latest.localeCompare(a.latest)),
  };
}

// ─────────────────────────────── Audit trail ───────────────────────────────

export const AuditEntrySchema = z.object({
  id: z.string(),
  action: z.string(),
  actor: z.object({ name: z.string(), email: z.string() }).nullable(),
  organisation: z.string().nullable(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  meta: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});

export const AuditTrailSchema = z
  .object({ items: z.array(AuditEntrySchema), next: z.string().nullable() })
  .openapi('AuditTrail');

export type AuditTrail = z.infer<typeof AuditTrailSchema>;

export async function auditTrail(
  db: Database,
  opts: { before?: string | null; limit?: number } = {},
): Promise<AuditTrail> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const before = opts.before ? new Date(opts.before) : null;
  const rows = await db
    .select({
      entry: auditLog,
      name: users.name,
      email: users.email,
      organisation: organizations.name,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .leftJoin(organizations, eq(organizations.id, auditLog.actorOrganizationId))
    .where(
      and(
        // Staff and organisation actions only: what people do for themselves (such as
        // downloading their data) stays out of the admin view.
        sql`(${auditLog.action} like 'org.%' or ${auditLog.action} like 'moderation.%' or ${auditLog.action} like 'scam-report.%')`,
        before && !Number.isNaN(before.getTime()) ? lt(auditLog.createdAt, before) : sql`true`,
      ),
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  return {
    items: page.map((r) => ({
      id: r.entry.id,
      action: r.entry.action,
      actor: r.name && r.email ? { name: r.name, email: r.email } : null,
      organisation: r.organisation ?? null,
      targetType: r.entry.targetType,
      targetId: r.entry.targetId,
      meta: r.entry.meta ?? {},
      createdAt: r.entry.createdAt.toISOString(),
    })),
    next: rows.length > limit ? (page.at(-1)?.entry.createdAt.toISOString() ?? null) : null,
  };
}
