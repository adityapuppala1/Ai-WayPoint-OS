/**
 * Database CLI:
 *   pnpm db:migrate   apply migrations
 *   pnpm db:seed      starter circles + sourced signals (and example data if WAYPOINT_SEED_DEMO=true)
 *   pnpm db:reset     DELETE all data and start fresh (asks for confirmation; embedded or Postgres)
 */
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { getEnv } from '@waypoint/core/env';
import { sql } from 'drizzle-orm';
import { closeDb, dbKind, dbReady, getDb, runMigrations } from './client';
import { seedBase, seedDemo } from './seed';

async function confirm(question: string): Promise<boolean> {
  if (process.argv.includes('--yes')) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} Type "reset" to continue: `);
  rl.close();
  return answer.trim() === 'reset';
}

async function main() {
  const cmd = process.argv[2];
  const env = getEnv();
  switch (cmd) {
    case 'migrate': {
      await runMigrations();
      console.log(`✓ Migrations applied (${dbKind()} database).`);
      break;
    }
    case 'seed': {
      await dbReady();
      const base = await seedBase(getDb());
      console.log(`✓ Seeded ${base.circles} new circles and ${base.signals} new signals.`);
      if (env.WAYPOINT_SEED_DEMO || process.argv.includes('--demo')) {
        if (env.isProd) throw new Error('Refusing to seed example data in production.');
        const demo = await seedDemo(getDb());
        console.log(`✓ Added ${demo.forecasts} example forecasts (labelled "Example data").`);
      }
      break;
    }
    case 'reset': {
      if (env.isProd) throw new Error('Refusing to reset a production database.');
      if (!(await confirm('This deletes ALL Waypoint data in this database.'))) {
        console.log('Cancelled.');
        return;
      }
      if (!env.DATABASE_URL) {
        rmSync(join(env.dataDir, 'pglite'), { recursive: true, force: true });
        console.log(
          `✓ Deleted the embedded database in ${env.dataDir}. It will be recreated on next start.`,
        );
        return;
      }
      await dbReady();
      await getDb().execute(
        sql`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;`,
      );
      await runMigrations();
      console.log('✓ Database reset and migrated.');
      break;
    }
    default:
      console.log('Usage: tsx src/cli.ts <migrate|seed|reset> [--demo] [--yes]');
      process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
