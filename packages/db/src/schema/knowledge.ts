/**
 * Ask (conversations and consented memory) and Signals (news and official signals,
 * forecasts, and the public accuracy record).
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
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
  vector,
} from 'drizzle-orm/pg-core';
import { createdAt, EMBEDDING_DIMENSIONS, pk, tsvector, updatedAt } from './_shared';
import { users } from './auth';

// ───────────────────────────── Ask ─────────────────────────────

export const conversations = pgTable(
  'conversations',
  {
    id: pk(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text(),
    /** The module the conversation started from, for context. */
    module: text().notNull().default('ask'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('conversations_user_idx').on(t.userId, t.updatedAt)],
);

export const messages = pgTable(
  'messages',
  {
    id: pk(),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    /** user | assistant | system */
    role: text().notNull(),
    /** AI SDK UI message parts. */
    parts: jsonb().$type<unknown[]>().notNull(),
    crisisTier: smallint().notNull().default(0),
    model: text(),
    inputTokens: integer(),
    outputTokens: integer(),
    createdAt: createdAt(),
  },
  (t) => [index('messages_conversation_idx').on(t.conversationId, t.createdAt)],
);

/** Facts the person agreed Waypoint may remember (consent: memory). */
export const memories = pgTable(
  'memories',
  {
    id: pk(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** fact | preference | goal | context */
    kind: text().notNull(),
    content: text(),
    /** Ciphertext instead of `content` when the memory is sensitive. */
    contentCt: text(),
    sensitive: boolean().notNull().default(false),
    embedding: vector({ dimensions: EMBEDDING_DIMENSIONS }),
    sourceMessageId: uuid(),
    expiresAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('memories_user_idx').on(t.userId),
    index('memories_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
  ],
);

// ───────────────────────────── Signals & foresight ─────────────────────────────

export const signals = pgTable(
  'signals',
  {
    id: pk(),
    /** news | official | labour-market | weather | community */
    source: text().notNull(),
    sourceName: text().notNull(),
    sourceUrl: text().notNull(),
    title: text().notNull(),
    summary: text().notNull(),
    language: text().notNull().default('en'),
    publishedAt: timestamp({ withTimezone: true }).notNull(),
    fetchedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    regions: text().array().notNull().default([]),
    sectors: text().array().notNull().default([]),
    skills: text().array().notNull().default([]),
    lifeStages: text().array().notNull().default([]),
    situations: text().array().notNull().default([]),
    topics: text().array().notNull().default([]),
    /** 1 (minor) … 5 (major) */
    importance: smallint().notNull().default(2),
    contentHash: text().notNull(),
    embedding: vector({ dimensions: EMBEDDING_DIMENSIONS }),
    search: tsvector().generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, ''))`,
    ),
    isDemo: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('signals_content_hash_idx').on(t.contentHash),
    index('signals_published_idx').on(t.publishedAt),
    index('signals_regions_idx').using('gin', t.regions),
    index('signals_sectors_idx').using('gin', t.sectors),
    index('signals_search_idx').using('gin', t.search),
    index('signals_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
  ],
);

/** Per-person state for a signal: seen, saved, dismissed, feedback. */
export const signalStates = pgTable(
  'signal_states',
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    signalId: uuid()
      .notNull()
      .references(() => signals.id, { onDelete: 'cascade' }),
    seenAt: timestamp({ withTimezone: true }),
    saved: boolean().notNull().default(false),
    dismissed: boolean().notNull().default(false),
    /** useful | not-relevant | wrong */
    feedback: text(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.signalId] })],
);

/** A question with a checkable yes/no outcome and a resolution date. */
export const forecasts = pgTable(
  'forecasts',
  {
    id: pk(),
    question: text().notNull(),
    description: text().notNull(),
    resolutionCriteria: text().notNull(),
    category: text().notNull(),
    regions: text().array().notNull().default([]),
    sectors: text().array().notNull().default([]),
    relatedSignalIds: uuid().array().notNull().default([]),
    /** system | ai | editor */
    createdBy: text().notNull().default('editor'),
    opensAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    closesAt: timestamp({ withTimezone: true }).notNull(),
    resolvesAt: timestamp({ withTimezone: true }).notNull(),
    /** open | closed | resolved | annulled */
    status: text().notNull().default('open'),
    outcome: smallint(),
    resolvedAt: timestamp({ withTimezone: true }),
    resolutionNote: text(),
    resolutionSourceUrl: text(),
    isDemo: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index('forecasts_status_idx').on(t.status, t.resolvesAt),
    index('forecasts_regions_idx').using('gin', t.regions),
  ],
);

/** Every probability Waypoint (or a person) gave, so it can be scored when the question resolves. */
export const forecastPredictions = pgTable(
  'forecast_predictions',
  {
    id: pk(),
    forecastId: uuid()
      .notNull()
      .references(() => forecasts.id, { onDelete: 'cascade' }),
    /** waypoint | ai:<model> | crowd | person */
    predictor: text().notNull(),
    userId: text().references(() => users.id, { onDelete: 'cascade' }),
    probability: numeric({ precision: 5, scale: 4, mode: 'number' }).notNull(),
    rationale: text(),
    createdAt: createdAt(),
  },
  (t) => [
    index('forecast_predictions_forecast_idx').on(t.forecastId, t.predictor, t.createdAt),
    index('forecast_predictions_user_idx').on(t.userId),
  ],
);
