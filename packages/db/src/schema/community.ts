/**
 * Shield (scam checks and community reports) and Circles (small peer groups).
 * Shield never stores what people pasted — only a hash, the verdict and the rule ids.
 */
import {
  boolean,
  index,
  integer,
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

// ───────────────────────────── Shield ─────────────────────────────

export const shieldChecks = pgTable(
  'shield_checks',
  {
    id: pk(),
    userId: text().references(() => users.id, { onDelete: 'cascade' }),
    /** web | sms | whatsapp | ussd | api */
    channel: text().notNull(),
    /** message | url | phone | email */
    kind: text().notNull().default('message'),
    /** SHA-256 of the normalised input, to spot repeated scams without storing them. */
    inputHash: text().notNull(),
    country: text(),
    level: text().notNull(),
    score: smallint().notNull(),
    categories: text().array().notNull().default([]),
    signalIds: text().array().notNull().default([]),
    urlHosts: text().array().notNull().default([]),
    rulesVersion: text().notNull(),
    aiModel: text(),
    aiLevel: text(),
    createdAt: createdAt(),
  },
  (t) => [
    index('shield_checks_user_idx').on(t.userId, t.createdAt),
    index('shield_checks_hash_idx').on(t.inputHash),
    index('shield_checks_created_idx').on(t.createdAt),
  ],
);

/** A scam someone chose to report so others can be warned. Text is redacted before storage. */
export const scamReports = pgTable(
  'scam_reports',
  {
    id: pk(),
    userId: text().references(() => users.id, { onDelete: 'set null' }),
    country: text(),
    category: text().notNull(),
    descriptionRedacted: text(),
    urlHosts: text().array().notNull().default([]),
    /** Salted hashes of phone numbers or payment ids involved. */
    identifierHashes: text().array().notNull().default([]),
    amountLost: numeric({ precision: 14, scale: 2 }),
    currency: text(),
    reportedTo: text().array().notNull().default([]),
    /** new | reviewed | published | rejected */
    status: text().notNull().default('new'),
    createdAt: createdAt(),
  },
  (t) => [
    index('scam_reports_country_idx').on(t.country, t.category, t.createdAt),
    index('scam_reports_status_idx').on(t.status),
  ],
);

// ───────────────────────────── Circles ─────────────────────────────

export const circles = pgTable(
  'circles',
  {
    id: pk(),
    slug: text().notNull(),
    name: text().notNull(),
    description: text().notNull(),
    /** A situation or goal, e.g. lost-job, first-job, new-country, caring, data-analyst */
    topic: text().notNull(),
    country: text(),
    language: text().notNull().default('en'),
    /** public | private */
    visibility: text().notNull().default('public'),
    maxMembers: integer().notNull().default(12),
    memberCount: integer().notNull().default(0),
    createdBy: text().references(() => users.id, { onDelete: 'set null' }),
    isDemo: boolean().notNull().default(false),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('circles_slug_idx').on(t.slug),
    index('circles_topic_idx').on(t.topic, t.language, t.country),
  ],
);

export const circleMembers = pgTable(
  'circle_members',
  {
    circleId: uuid()
      .notNull()
      .references(() => circles.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** member | host | moderator */
    role: text().notNull().default('member'),
    /** The name others see in this circle (never the account name unless the person chose it). */
    alias: text(),
    /** When the person agreed to the circle guidelines. */
    guidelinesAcceptedAt: timestamp({ withTimezone: true }),
    joinedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    mutedUntil: timestamp({ withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.circleId, t.userId] }),
    index('circle_members_user_idx').on(t.userId),
  ],
);

export const circlePosts = pgTable(
  'circle_posts',
  {
    id: pk(),
    circleId: uuid()
      .notNull()
      .references(() => circles.id, { onDelete: 'cascade' }),
    authorId: text().references(() => users.id, { onDelete: 'set null' }),
    parentId: uuid(),
    /** post | win | question | checkin */
    kind: text().notNull().default('post'),
    body: text().notNull(),
    /** Crisis tier from the classifier; tier ≥ 2 posts are held and the author is offered support. */
    crisisTier: smallint().notNull().default(0),
    hiddenAt: timestamp({ withTimezone: true }),
    hiddenReason: text(),
    editedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('circle_posts_circle_idx').on(t.circleId, t.createdAt),
    index('circle_posts_parent_idx').on(t.parentId),
  ],
);

export const circleReactions = pgTable(
  'circle_reactions',
  {
    postId: uuid()
      .notNull()
      .references(() => circlePosts.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** support | helpful | celebrate */
    kind: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId, t.kind] })],
);

export const circleReports = pgTable(
  'circle_reports',
  {
    id: pk(),
    postId: uuid()
      .notNull()
      .references(() => circlePosts.id, { onDelete: 'cascade' }),
    reporterId: text().references(() => users.id, { onDelete: 'set null' }),
    reason: text().notNull(),
    resolvedAt: timestamp({ withTimezone: true }),
    resolution: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('circle_reports_open_idx').on(t.resolvedAt),
    // One report per person per post: three reports must be three people.
    uniqueIndex('circle_reports_once_idx').on(t.postId, t.reporterId),
  ],
);
