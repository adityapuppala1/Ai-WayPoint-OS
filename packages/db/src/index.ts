export {
  closeDb,
  type Database,
  dbKind,
  dbReady,
  getDb,
  migrationsFolder,
  runMigrations,
  type Schema,
} from './client';
export * from './schema';
/** Any Drizzle Postgres table (used by generic helpers such as guest-account merging). */
export type AnyUserTable = import('drizzle-orm/pg-core').PgTable;
/** Re-exported so every package uses the same drizzle-orm instance. */
export {
  and,
  arrayContains,
  arrayOverlaps,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  not,
  notInArray,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
export * from './ops/keys';
export * from './ops/plans';
export * from './ops/queue';
