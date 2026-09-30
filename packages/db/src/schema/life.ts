/**
 * Everyday life modules: Money, Mind, Health, Civic, Surroundings, Goals and Today.
 * Anything personal and sensitive is stored encrypted (`…Ct` columns).
 */
import {
  boolean,
  date,
  index,
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
import { users } from './auth';

// ───────────────────────────── Money ─────────────────────────────

/** The person's money snapshot, encrypted as one JSON document (RunwayInput + income samples). */
export const moneySnapshots = pgTable('money_snapshots', {
  userId: text()
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  currency: text().notNull(),
  dataCt: text().notNull(),
  updatedAt: updatedAt(),
});

// ───────────────────────────── Mind ─────────────────────────────

export const moodCheckins = pgTable(
  'mood_checkins',
  {
    id: pk(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 1 (very low) … 5 (very good) */
    mood: smallint().notNull(),
    energy: smallint(),
    tags: text().array().notNull().default([]),
    noteCt: text(),
    createdAt: createdAt(),
  },
  (t) => [index('mood_checkins_user_idx').on(t.userId, t.createdAt)],
);

export const journalEntries = pgTable(
  'journal_entries',
  {
    id: pk(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    promptId: text(),
    bodyCt: text().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('journal_entries_user_idx').on(t.userId, t.createdAt)],
);

// ───────────────────────────── Health (non-diagnostic) ─────────────────────────────

export const healthLogs = pgTable(
  'health_logs',
  {
    id: pk(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** sleep | activity | water | note — one row per kind per day */
    kind: text().notNull(),
    value: numeric({ precision: 10, scale: 2, mode: 'number' }),
    unit: text(),
    /** The day's private note (kind = note), encrypted with the person's data key. */
    noteCt: text(),
    loggedFor: date().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('health_logs_day_idx').on(t.userId, t.kind, t.loggedFor)],
);

export const reminders = pgTable(
  'reminders',
  {
    id: pk(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    module: text().notNull(),
    /** What to remember, encrypted with the person's data key (it can be health information). */
    titleCt: text().notNull(),
    /** e.g. DTSTART=20261001T0900;REPEAT=monthly (see @waypoint/core/health) */
    rrule: text().notNull(),
    nextAt: timestamp({ withTimezone: true }),
    enabled: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('reminders_next_idx').on(t.enabled, t.nextAt)],
);

// ───────────────────────────── Civic ─────────────────────────────

export const userChecklists = pgTable(
  'user_checklists',
  {
    id: pk(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    event: text().notNull(),
    country: text().notNull(),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp({ withTimezone: true }),
  },
  (t) => [uniqueIndex('user_checklists_unique_idx').on(t.userId, t.event, t.country)],
);

export const userChecklistItems = pgTable(
  'user_checklist_items',
  {
    checklistId: uuid()
      .notNull()
      .references(() => userChecklists.id, { onDelete: 'cascade' }),
    itemId: text().notNull(),
    /** todo | done | skipped | not-applicable */
    status: text().notNull().default('todo'),
    note: text(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.checklistId, t.itemId] })],
);

// ───────────────────────────── Surroundings ─────────────────────────────

/** Places the person saved. Coordinates are rounded to ~1 km unless they choose otherwise. */
export const places = pgTable(
  'places',
  {
    id: pk(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text().notNull(),
    latitude: numeric({ precision: 8, scale: 5, mode: 'number' }).notNull(),
    longitude: numeric({ precision: 8, scale: 5, mode: 'number' }).notNull(),
    country: text(),
    isPrimary: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('places_user_idx').on(t.userId)],
);

/** Shared cache of weather and air data per ~10 km grid cell. Contains no personal data. */
export const environmentCache = pgTable('environment_cache', {
  cell: text().primaryKey(),
  weather: jsonb().$type<Record<string, unknown>>(),
  air: jsonb().$type<Record<string, unknown>>(),
  fetchedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
});

// ───────────────────────────── Goals ─────────────────────────────

export const goals = pgTable(
  'goals',
  {
    id: pk(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Encrypted with the person's data key (goals can be very personal). */
    titleCt: text().notNull(),
    whyCt: text(),
    /** The module the goal belongs to, e.g. path, money, mind */
    area: text().notNull(),
    targetDate: date(),
    /** active | done | paused | dropped */
    status: text().notNull().default('active'),
    progress: smallint().notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('goals_user_idx').on(t.userId, t.status)],
);

export const weeklyReviews = pgTable(
  'weekly_reviews',
  {
    id: pk(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    weekStart: date().notNull(),
    /** Encrypted JSON: { wentWell, gotInTheWay, nextChange }. */
    bodyCt: text().notNull(),
    mood: smallint(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('weekly_reviews_week_idx').on(t.userId, t.weekStart)],
);

// ───────────────────────────── Today: nudges and delivery ─────────────────────────────

export const nudges = pgTable(
  'nudges',
  {
    id: pk(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    module: text().notNull(),
    /** critical | high | normal | low */
    priority: text().notNull(),
    title: text().notNull(),
    body: text(),
    href: text(),
    dedupeKey: text(),
    /** pending | delivered | deferred | dropped | read | acted */
    status: text().notNull().default('pending'),
    /** in-app | push | sms | whatsapp | email */
    channel: text().notNull().default('in-app'),
    deliverAfter: timestamp({ withTimezone: true }),
    deliveredAt: timestamp({ withTimezone: true }),
    readAt: timestamp({ withTimezone: true }),
    expiresAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('nudges_user_status_idx').on(t.userId, t.status, t.createdAt),
    index('nudges_due_idx').on(t.status, t.deliverAfter),
  ],
);

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: pk(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text().notNull(),
    p256dh: text().notNull(),
    auth: text().notNull(),
    userAgent: text(),
    createdAt: createdAt(),
    lastUsedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex('push_subscriptions_endpoint_idx').on(t.endpoint),
    index('push_subscriptions_user_idx').on(t.userId),
  ],
);
