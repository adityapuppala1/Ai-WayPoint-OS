/**
 * Platform: organisations, AI usage and cost, messaging channels (SMS/USSD/WhatsApp),
 * the outbox, background jobs, audit log, data requests and feedback.
 */
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, pk, updatedAt } from './_shared';
import { organizations, users } from './auth';

// ───────────────────────────── Organisations ─────────────────────────────

export const orgProfiles = pgTable('org_profiles', {
  organizationId: text()
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  /** employer | school | ngo | government | community */
  kind: text().notNull(),
  country: text(),
  sizeBand: text(),
  /** Minimum group size before any aggregate is shown (never below 20). */
  kAnonMin: smallint().notNull().default(50),
  /** free | pro | enterprise */
  plan: text().notNull().default('free'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** A programme an organisation runs, e.g. a reskilling cohort or a school leavers’ programme. */
export const orgProgrammes = pgTable(
  'org_programmes',
  {
    id: pk(),
    organizationId: text()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    description: text(),
    /** Roles from the Path catalogue the programme prepares people for (shown to participants). */
    targetRoleIds: text().array().notNull().default([]),
    /** What people type or scan to join (see @waypoint/core/org). A new code retires the old one. */
    joinCode: text().notNull(),
    startsOn: date({ mode: 'string' }),
    endsOn: date({ mode: 'string' }),
    /** Closed programmes stop accepting people; totals stay available. */
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('org_programmes_org_idx').on(t.organizationId),
    uniqueIndex('org_programmes_join_code_idx').on(t.joinCode),
  ],
);

/**
 * Membership of a programme. The organisation never sees this table: it only sees totals of
 * at least k people, counting only enrolments where the person chose to be counted in this
 * programme (`counted`) and still allows organisations to count them at all (consent
 * `org_aggregates`). Leaving deletes the row.
 */
export const orgEnrolments = pgTable(
  'org_enrolments',
  {
    programmeId: uuid()
      .notNull()
      .references(() => orgProgrammes.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The person chose to be counted in this programme's totals (off unless they tick it). */
    counted: boolean().notNull().default(false),
    /** When they chose it: they count from a week after this (null while not counted). */
    countedSince: timestamp({ withTimezone: true }),
    enrolledAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.programmeId, t.userId] }),
    index('org_enrolments_user_idx').on(t.userId),
  ],
);

/**
 * A programme's raw totals, taken once a week (the first time anyone looks that week). An
 * organisation sees the same numbers all week, so it cannot watch them move as one person
 * joins, leaves or changes their mind.
 */
export const orgInsightSnapshots = pgTable(
  'org_insight_snapshots',
  {
    programmeId: uuid()
      .notNull()
      .references(() => orgProgrammes.id, { onDelete: 'cascade' }),
    /** Monday (UTC) of the week the totals belong to. */
    week: date({ mode: 'string' }).notNull(),
    counts: jsonb().$type<Record<string, unknown>>().notNull(),
    takenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.programmeId, t.week] })],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: pk(),
    /** user | organization */
    ownerType: text().notNull(),
    ownerId: text().notNull(),
    plan: text().notNull(),
    /** active | past_due | cancelled | trialing */
    status: text().notNull(),
    provider: text().notNull().default('manual'),
    providerRef: text(),
    currentPeriodEnd: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('subscriptions_owner_idx').on(t.ownerType, t.ownerId)],
);

// ───────────────────────────── AI usage ─────────────────────────────

export const aiUsage = pgTable(
  'ai_usage',
  {
    id: pk(),
    userId: text().references(() => users.id, { onDelete: 'set null' }),
    organizationId: text(),
    /** ask | shield | plan | signal-summary | forecast | moderation | embedding */
    feature: text().notNull(),
    provider: text().notNull(),
    model: text().notNull(),
    inputTokens: integer().notNull().default(0),
    outputTokens: integer().notNull().default(0),
    costUsd: numeric({ precision: 12, scale: 6, mode: 'number' }).notNull().default(0),
    latencyMs: integer(),
    /** ok | error | fallback | blocked | offline */
    status: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('ai_usage_created_idx').on(t.createdAt),
    index('ai_usage_user_idx').on(t.userId, t.createdAt),
  ],
);

// ───────────────────────────── Channels ─────────────────────────────

/**
 * A phone number that has texted Waypoint (SMS, WhatsApp or USSD): looked up by a keyed hash,
 * the number itself sealed. Nothing anyone texts is stored — only their language, country and
 * choices. Forgotten after 180 days without a message.
 */
export const channelIdentities = pgTable(
  'channel_identities',
  {
    id: pk(),
    userId: text().references(() => users.id, { onDelete: 'cascade' }),
    /** sms | whatsapp | ussd */
    channel: text().notNull(),
    addressHash: text().notNull(),
    addressCt: text().notNull(),
    locale: text(),
    country: text(),
    verifiedAt: timestamp({ withTimezone: true }),
    optedOutAt: timestamp({ withTimezone: true }),
    /** They allowed their (redacted) messages to go to an external AI provider, and when. */
    aiAllowedAt: timestamp({ withTimezone: true }),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('channel_identities_address_idx').on(t.channel, t.addressHash),
    index('channel_identities_seen_idx').on(t.lastSeenAt),
  ],
);

/** Messages by channel, day and kind — counts only, for the admin console. */
export const channelStats = pgTable(
  'channel_stats',
  {
    day: date({ mode: 'string' }).notNull(),
    /** sms | whatsapp | ussd */
    channel: text().notNull(),
    /** in | out */
    direction: text().notNull(),
    /** Incoming: help | check | crisis | ask | … (see ChannelIntent). Outgoing: reply | ai | otp */
    intent: text().notNull(),
    n: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.channel, t.direction, t.intent] })],
);

/** Short-lived state for USSD and SMS menus. */
export const channelSessions = pgTable('channel_sessions', {
  id: text().primaryKey(),
  channel: text().notNull(),
  state: jsonb().$type<Record<string, unknown>>().notNull(),
  updatedAt: updatedAt(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
});

/** Transactional outbox: messages are written with the change that caused them, then sent. */
export const outbox = pgTable(
  'outbox',
  {
    id: pk(),
    /** push | sms | whatsapp | email */
    channel: text().notNull(),
    recipientRef: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    /** queued | sent | failed | cancelled */
    status: text().notNull().default('queued'),
    attempts: smallint().notNull().default(0),
    nextAttemptAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastError: text(),
    createdAt: createdAt(),
    sentAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('outbox_due_idx').on(t.status, t.nextAttemptAt)],
);

// ───────────────────────────── Jobs ─────────────────────────────

/** A small Postgres job queue (claimed with FOR UPDATE SKIP LOCKED). */
export const jobs = pgTable(
  'jobs',
  {
    id: pk(),
    kind: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    /** Jobs with the same key are not queued twice while one is pending. */
    uniqueKey: text(),
    runAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** queued | running | done | failed */
    status: text().notNull().default('queued'),
    attempts: smallint().notNull().default(0),
    maxAttempts: smallint().notNull().default(5),
    lockedBy: text(),
    lockedAt: timestamp({ withTimezone: true }),
    lastError: text(),
    createdAt: createdAt(),
    finishedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index('jobs_due_idx').on(t.status, t.runAt),
    index('jobs_unique_key_idx').on(t.uniqueKey, t.status),
  ],
);

// ───────────────────────────── Accountability ─────────────────────────────

export const auditLog = pgTable(
  'audit_log',
  {
    id: pk(),
    actorUserId: text(),
    actorOrganizationId: text(),
    action: text().notNull(),
    targetType: text(),
    targetId: text(),
    meta: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    ipHash: text(),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_log_actor_idx').on(t.actorUserId, t.createdAt),
    index('audit_log_action_idx').on(t.action, t.createdAt),
  ],
);

export const dataRequests = pgTable(
  'data_requests',
  {
    id: pk(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** export | delete */
    kind: text().notNull(),
    /** pending | processing | ready | done | failed */
    status: text().notNull().default('pending'),
    resultRef: text(),
    requestedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('data_requests_user_idx').on(t.userId)],
);

export const feedback = pgTable('feedback', {
  id: pk(),
  userId: text().references(() => users.id, { onDelete: 'set null' }),
  module: text().notNull(),
  page: text(),
  rating: smallint(),
  message: text(),
  wantsReply: boolean().notNull().default(false),
  createdAt: createdAt(),
});

// ───────────────────────────── Outside services (the console) ─────────────────────────────

/**
 * Keys and options for outside services that an admin set in the platform console
 * (@waypoint/core/console lists which). Every value is sealed with the KEK; `hint` is what the
 * console may show again: a secret's last four characters, or an ordinary value in full.
 * A value in the server's environment always wins over one here.
 */
export const integrationSettings = pgTable('integration_settings', {
  key: text().primaryKey(),
  valueCt: text().notNull(),
  hint: text().notNull(),
  updatedBy: text().references(() => users.id, { onDelete: 'set null' }),
  updatedAt: updatedAt(),
});

/** The last time each outside service was checked from the console, and what it answered. */
export const integrationChecks = pgTable('integration_checks', {
  provider: text().primaryKey(),
  ok: boolean().notNull(),
  /** A short account of the answer, never a key: "Account active", "401: key refused". */
  detail: text().notNull(),
  latencyMs: integer(),
  /** Models the service offers, when it lists them (to choose from in the console). */
  models: jsonb().$type<string[]>(),
  checkedBy: text().references(() => users.id, { onDelete: 'set null' }),
  checkedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// ───────────────────────────── The API's own health ─────────────────────────────

/**
 * Requests per hour, route and kind of answer: counted in memory and added here every half
 * minute (never a row per request). Response times are kept as a histogram, so medians and
 * the slowest 5% can be worked out without keeping each request. Kept 90 days.
 */
export const apiMetrics = pgTable(
  'api_metrics',
  {
    bucket: timestamp({ withTimezone: true }).notNull(),
    method: text().notNull(),
    /** The route as written in the code ("/api/admin/integrations/:id"), never a real path. */
    route: text().notNull(),
    /** 2, 3, 4 or 5: the hundreds of the status code. */
    statusClass: smallint().notNull(),
    n: integer().notNull().default(0),
    sumMs: integer().notNull().default(0),
    maxMs: integer().notNull().default(0),
    /** How many took under 50, 100, 250, 500, 1000, 2500, 5000 ms, and longer. */
    h0: integer().notNull().default(0),
    h1: integer().notNull().default(0),
    h2: integer().notNull().default(0),
    h3: integer().notNull().default(0),
    h4: integer().notNull().default(0),
    h5: integer().notNull().default(0),
    h6: integer().notNull().default(0),
    h7: integer().notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.bucket, t.method, t.route, t.statusClass] }),
    index('api_metrics_bucket_idx').on(t.bucket),
  ],
);

/**
 * Server errors (5xx), for the console: when, where and what went wrong, in words with
 * personal details and tokens taken out, and the request id to find it in the logs. Kept 30
 * days.
 */
export const apiErrors = pgTable(
  'api_errors',
  {
    id: pk(),
    method: text().notNull(),
    route: text().notNull(),
    status: smallint().notNull(),
    code: text(),
    message: text().notNull(),
    requestId: text(),
    createdAt: createdAt(),
  },
  (t) => [index('api_errors_created_idx').on(t.createdAt)],
);

/**
 * The platform's own switches, set by an admin in the console: maintenance (with its message
 * and window), an announcement shown on every page, and the last backup someone recorded.
 * One row per switch; every change is audited.
 */
export const platformState = pgTable('platform_state', {
  key: text().primaryKey(),
  value: jsonb().$type<Record<string, unknown>>().notNull(),
  updatedBy: text().references(() => users.id, { onDelete: 'set null' }),
  updatedAt: updatedAt(),
});

/**
 * Invitations to join the platform's staff, sent by an admin to an email address. Only someone
 * signed in with that address (confirmed) can answer; an invitation lasts 7 days.
 */
export const staffInvitations = pgTable(
  'staff_invitations',
  {
    id: text().primaryKey(),
    /** Lower case. */
    email: text().notNull(),
    /** admin | staff */
    role: text().notNull(),
    /** pending | accepted | declined | revoked */
    status: text().notNull().default('pending'),
    inviterId: text().references(() => users.id, { onDelete: 'set null' }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    answeredAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('staff_invitations_email_idx').on(t.email, t.status)],
);
