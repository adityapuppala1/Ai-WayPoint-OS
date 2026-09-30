/**
 * The person's data key, for services that live outside the API package (the AI tools, the
 * worker). Throws if the person has no profile yet; the API creates one on first use.
 */
import { openDek } from '@waypoint/core/privacy';
import { eq } from 'drizzle-orm';
import type { Database } from '../client';
import { profiles } from '../schema';

export async function dataKeyFor(db: Pick<Database, 'select'>, userId: string): Promise<Buffer> {
  const [row] = await db
    .select({ dek: profiles.dekWrapped })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!row?.dek) throw new Error('No data key for this person');
  return openDek(row.dek);
}
