/**
 * Database client.
 *
 * - No DATABASE_URL → embedded Postgres (PGlite, Postgres 18 in WebAssembly) stored in
 *   WAYPOINT_DATA_DIR/pglite. Zero install, migrates itself on start. For one person or a
 *   small pilot on one machine.
 * - DATABASE_URL set → a real Postgres 16+ server with pgvector (production). Migrations run
 *   as a separate step (`pnpm db:migrate`) unless WAYPOINT_AUTO_MIGRATE=true.
 *
 * Only ONE process may open the embedded database at a time — a second process can corrupt it.
 * A lock file enforces this, so stop `pnpm dev` before running `pnpm db:seed` (or use Postgres).
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { vector } from '@electric-sql/pglite-pgvector';
import { getEnv } from '@waypoint/core/env';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import pg from 'pg';
import * as schema from './schema';

export type Schema = typeof schema;

/**
 * Both drivers (node-postgres and PGlite) return `{ rows }` from raw queries, so the shared
 * Database type exposes exactly that for `db.execute()`.
 */
export interface RowsResult<T> {
  rows: T[];
}
export interface RowsQueryResultHKT extends PgQueryResultHKT {
  type: RowsResult<
    this['row'] extends Record<string, unknown> ? this['row'] : Record<string, unknown>
  >;
}
export type Database = PgDatabase<RowsQueryResultHKT, Schema>;

interface DbState {
  kind: 'embedded' | 'postgres';
  db: Database;
  /** Resolves once the database is reachable and (when enabled) migrated. */
  ready: Promise<void>;
  close: () => Promise<void>;
}

const GLOBAL_KEY = Symbol.for('waypoint.db');
type GlobalWithDb = typeof globalThis & { [GLOBAL_KEY]?: DbState };

export function migrationsFolder(): string {
  const env = getEnv();
  return env.WAYPOINT_MIGRATIONS_DIR ?? join(env.repoRoot, 'packages', 'db', 'drizzle');
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** Prevents two processes opening the same embedded database directory. */
function acquireLock(dataDir: string): () => void {
  mkdirSync(dataDir, { recursive: true });
  const lockPath = join(dataDir, 'pglite.lock');
  if (existsSync(lockPath)) {
    const pid = Number(readFileSync(lockPath, 'utf8').trim());
    if (pid && pid !== process.pid && isAlive(pid)) {
      throw new Error(
        `The embedded database in ${dataDir} is already open in another process (pid ${pid}). ` +
          'Stop that process first (for example stop `pnpm dev` before `pnpm db:seed`), ' +
          'or set DATABASE_URL to use a Postgres server.',
      );
    }
  }
  writeFileSync(lockPath, String(process.pid));
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    try {
      if (readFileSync(lockPath, 'utf8').trim() === String(process.pid)) unlinkSync(lockPath);
    } catch {
      // already gone
    }
  };
  process.once('exit', release);
  return release;
}

/** Reference data every install needs (idempotent), plus optional example data in development. */
async function autoSeed(db: Database, base: boolean): Promise<void> {
  const env = getEnv();
  if (!base && !env.WAYPOINT_SEED_DEMO) return;
  const { seedBase, seedDemo } = await import('./seed');
  if (base) await seedBase(db);
  if (env.WAYPOINT_SEED_DEMO && !env.isProd) await seedDemo(db);
}

function createEmbedded(): DbState {
  const env = getEnv();
  const release = acquireLock(env.dataDir);
  const client = new PGlite(join(env.dataDir, 'pglite'), { extensions: { vector, pg_trgm } });
  const db = drizzlePglite({ client, schema, casing: 'snake_case' }) as unknown as Database;
  const ready = (async () => {
    await client.waitReady;
    await migratePglite(db as never, { migrationsFolder: migrationsFolder() });
    await autoSeed(db, env.WAYPOINT_AUTO_SEED ?? true);
  })();
  // Avoid unhandled rejections; callers see the error when they await `ready`.
  ready.catch(() => undefined);
  return {
    kind: 'embedded',
    db,
    ready,
    close: async () => {
      await client.close();
      release();
    },
  };
}

function createPostgres(url: string): DbState {
  const env = getEnv();
  const pool = new pg.Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    application_name: 'waypoint',
  });
  const db = drizzlePg({ client: pool, schema, casing: 'snake_case' }) as unknown as Database;
  const ready = (async () => {
    const c = await pool.connect();
    c.release();
    if (env.WAYPOINT_AUTO_MIGRATE) {
      await migratePg(db as never, { migrationsFolder: migrationsFolder() });
      await autoSeed(db, env.WAYPOINT_AUTO_SEED ?? false);
    }
  })();
  ready.catch(() => undefined);
  return { kind: 'postgres', db, ready, close: () => pool.end() };
}

function state(): DbState {
  const g = globalThis as GlobalWithDb;
  if (!g[GLOBAL_KEY]) {
    const env = getEnv();
    g[GLOBAL_KEY] = env.DATABASE_URL ? createPostgres(env.DATABASE_URL) : createEmbedded();
  }
  return g[GLOBAL_KEY];
}

/** The shared database handle for this process. */
export function getDb(): Database {
  return state().db;
}

/** Await before the first query in a process (cheap afterwards). */
export function dbReady(): Promise<void> {
  return state().ready;
}

export function dbKind(): 'embedded' | 'postgres' {
  return state().kind;
}

/** Run migrations now (used by the CLI and deploy jobs). */
export async function runMigrations(): Promise<void> {
  const s = state();
  if (s.kind === 'embedded') {
    await s.ready;
    return;
  }
  await s.ready;
  await migratePg(s.db as never, { migrationsFolder: migrationsFolder() });
}

export async function closeDb(): Promise<void> {
  const g = globalThis as GlobalWithDb;
  const s = g[GLOBAL_KEY];
  if (!s) return;
  g[GLOBAL_KEY] = undefined;
  await s.close();
}
