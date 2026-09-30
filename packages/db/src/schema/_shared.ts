/**
 * Column helpers shared by every table. Column names come from property names via
 * `casing: 'snake_case'` (set on both the client and drizzle-kit).
 */
import { newId } from '@waypoint/core/ids';
import { customType, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** App-owned primary key: time-ordered UUIDv7 generated in the app. */
export const pk = () =>
  uuid()
    .primaryKey()
    .$defaultFn(() => newId());

export const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

export const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/** Better Auth ids are text (they hold UUIDv7 strings), so references to users/orgs are text. */
export const userRef = () => text();

/** Full-text search vector, kept in sync by Postgres as a generated column. */
export const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

/** Embedding size used everywhere (768 works for OpenAI text-embedding-3 at reduced size, Gemini and nomic-embed). */
export const EMBEDDING_DIMENSIONS = 768;
