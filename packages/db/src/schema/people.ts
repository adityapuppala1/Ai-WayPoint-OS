/**
 * People: profile, consent, trusted contacts, and the safety records that must never hold
 * raw personal text. Sensitive fields end in `Ct` and hold AES-256-GCM ciphertext encrypted
 * with the person's data key (see @waypoint/core/privacy); deleting `dekWrapped` shreds them.
 */
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { createdAt, pk, updatedAt } from './_shared';
import { users } from './auth';

export const profiles = pgTable('profiles', {
  userId: text()
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: text(),
  locale: text().notNull().default('en'),
  /** ISO 3166-1 alpha-2. */
  country: text(),
  /** Free-text region or city the person chose to share (never precise location). */
  region: text(),
  timezone: text().notNull().default('UTC'),
  lifeStage: text(),
  situation: text(),
  workType: text(),
  languages: text().array().notNull().default([]),
  interests: text().array().notNull().default([]),
  sectors: text().array().notNull().default([]),
  currentRole: text(),
  hoursPerWeek: smallint().notNull().default(5),
  learningBudget: text().notNull().default('free'),
  /** Proactive messages per day, 0–3 (0 = safety-critical only). */
  attentionBudget: smallint().notNull().default(1),
  quietStart: text().default('21:00'),
  quietEnd: text().default('08:00'),
  liteMode: boolean().notNull().default(false),
  theme: text().notNull().default('system'),
  /** Days to keep conversations; null = until deleted. */
  conversationRetentionDays: integer().default(90),
  /** The person's data key, wrapped by the server key-encryption key (kekId:v1.iv.tag.ct). */
  dekWrapped: text(),
  /**
   * The guest session this account was created from, until its first sign-in. What that guest
   * did moves into this account then, and only then: signing in to any other account from a
   * shared device never pulls someone else's guest activity into it.
   */
  guestOrigin: text(),
  onboardedAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Current consent per purpose. Nothing optional is on by default. */
export const consents = pgTable(
  'consents',
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: text().notNull(),
    granted: boolean().notNull(),
    policyVersion: text().notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.purpose] })],
);

/** Append-only history of consent changes, for accountability. */
export const consentEvents = pgTable(
  'consent_events',
  {
    id: pk(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: text().notNull(),
    granted: boolean().notNull(),
    policyVersion: text().notNull(),
    source: text().notNull().default('settings'),
    createdAt: createdAt(),
  },
  (t) => [index('consent_events_user_idx').on(t.userId, t.createdAt)],
);

export const trustedContacts = pgTable(
  'trusted_contacts',
  {
    id: pk(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    nameCt: text().notNull(),
    phoneCt: text(),
    emailCt: text(),
    relation: text(),
    createdAt: createdAt(),
  },
  (t) => [index('trusted_contacts_user_idx').on(t.userId)],
);

/**
 * A record that a crisis response was shown — never the words that triggered it.
 * Used for gentle follow-ups (if the person agreed) and anonymous safety metrics.
 */
export const crisisEvents = pgTable(
  'crisis_events',
  {
    id: pk(),
    userId: text().references(() => users.id, { onDelete: 'cascade' }),
    channel: text().notNull(),
    tier: smallint().notNull(),
    categories: text().array().notNull().default([]),
    ruleIds: text().array().notNull().default([]),
    rulesVersion: text().notNull(),
    language: text(),
    country: text(),
    aboutOther: boolean().notNull().default(false),
    actionKinds: text().array().notNull().default([]),
    followUpAt: timestamp({ withTimezone: true }),
    followUpStatus: text(),
    createdAt: createdAt(),
  },
  (t) => [
    index('crisis_events_user_idx').on(t.userId, t.createdAt),
    index('crisis_events_follow_up_idx').on(t.followUpStatus, t.followUpAt),
  ],
);
