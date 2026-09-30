import { defineConfig } from 'drizzle-kit';

/**
 * Migrations are generated from the schema with `pnpm db:generate` and committed.
 * `0000_extensions.sql` is hand-written and must stay first (pgvector, pg_trgm).
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  strict: true,
  verbose: true,
});
