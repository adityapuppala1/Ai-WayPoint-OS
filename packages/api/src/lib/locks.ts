/**
 * "At most N of these" rules are a count followed by an insert. With a pool of database
 * connections, requests arriving together all see the same count and all insert: twenty goals
 * where twelve are allowed, or one person's three reports counted as three people's. Running
 * the count and the insert one at a time per key closes that gap.
 */
import { type Database, sql } from '@waypoint/db';

export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Run `work` in a transaction that holds a lock for `key` until it ends: anything else using
 * the same key waits its turn. The lock is Postgres's advisory lock, so it holds across every
 * server instance and is released by itself when the transaction finishes or fails.
 */
export function oneAtATime<T>(
  db: Database,
  key: string,
  work: (tx: Database) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
    // A transaction offers the same query interface as the database it belongs to.
    return work(tx as unknown as Database);
  });
}
