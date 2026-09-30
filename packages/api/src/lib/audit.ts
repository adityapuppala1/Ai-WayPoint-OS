/**
 * The audit log: who did what to shared things (organisations, programmes, moderation,
 * scam reports). It records staff and organisation actions, never what people do for
 * themselves — joining a programme or writing in a journal is not audited.
 */
import { auditLog, type Database } from '@waypoint/db';

type Executor = Pick<Database, 'insert'>;

export interface Actor {
  userId: string;
  /** Keyed hash of the client IP (never the address itself). */
  ipHash?: string | null;
}

export async function audit(
  db: Executor,
  actor: Actor | null,
  entry: {
    action: string;
    organizationId?: string | null;
    targetType?: string;
    targetId?: string;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  await db.insert(auditLog).values({
    actorUserId: actor?.userId ?? null,
    actorOrganizationId: entry.organizationId ?? null,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    meta: entry.meta ?? {},
    ipHash: actor?.ipHash ?? null,
  });
}
