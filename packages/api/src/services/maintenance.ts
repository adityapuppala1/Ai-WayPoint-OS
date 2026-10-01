/**
 * Maintenance in the console: switching the platform into maintenance (with a message and a
 * window), an announcement on every page, backups, and housekeeping an admin can run now.
 * The switches are kept in platform_state and held in memory by every server, refreshed with
 * the console's settings (startSettingsSync). Every change and every action is audited.
 */
import { z } from '@hono/zod-openapi';
import {
  ANNOUNCEMENT_OFF,
  type AnnouncementState,
  announcementActive,
  type BackupNote,
  MAINTENANCE_OFF,
  type MaintenanceState,
  maintenanceActive,
} from '@waypoint/core/console';
import {
  backupEmbedded,
  type Database,
  dbKind,
  platformState,
  rateLimits,
  sql,
} from '@waypoint/db';
import { retention, rewrapKeys } from '../jobs';
import { type Actor, audit } from '../lib/audit';
import { badRequest } from '../lib/problem';

interface Held {
  maintenance: MaintenanceState;
  announcement: AnnouncementState;
  backup: BackupNote | null;
}

const KEY = Symbol.for('waypoint.platformState');

function held(): Held {
  const g = globalThis as { [KEY]?: Held };
  g[KEY] ??= { maintenance: MAINTENANCE_OFF, announcement: ANNOUNCEMENT_OFF, backup: null };
  return g[KEY];
}

/** The platform's switches as this server holds them now. */
export function platformSwitches(): Readonly<Held> {
  return held();
}

const MaintenanceSchema = z.object({
  on: z.boolean(),
  message: z.string().trim().max(600),
  until: z.iso.datetime({ offset: true }).nullable(),
  startsAt: z.iso.datetime({ offset: true }).nullable(),
});

const AnnouncementSchema = z.object({
  on: z.boolean(),
  message: z.string().trim().max(400),
  tone: z.enum(['info', 'caution']),
  until: z.iso.datetime({ offset: true }).nullable(),
});

const BackupNoteSchema = z.object({
  at: z.iso.datetime({ offset: true }),
  note: z.string().trim().min(2).max(300),
});

/** Reads the switches from the database and starts using them. */
export async function loadPlatformState(db: Database): Promise<void> {
  const rows = await db.select().from(platformState);
  const next: Held = { maintenance: MAINTENANCE_OFF, announcement: ANNOUNCEMENT_OFF, backup: null };
  for (const row of rows) {
    // A value written by an older or newer version that no longer fits is left as off.
    if (row.key === 'maintenance') {
      const parsed = MaintenanceSchema.safeParse(row.value);
      if (parsed.success) next.maintenance = parsed.data;
    } else if (row.key === 'announcement') {
      const parsed = AnnouncementSchema.safeParse(row.value);
      if (parsed.success) next.announcement = parsed.data;
    } else if (row.key === 'backup') {
      const parsed = BackupNoteSchema.safeParse(row.value);
      if (parsed.success) next.backup = parsed.data;
    }
  }
  const g = globalThis as { [KEY]?: Held };
  g[KEY] = next;
}

/** What everyone (people, the phone app) may know about the platform's state. */
export const PlatformNoticeSchema = z
  .object({
    maintenance: z.object({
      active: z.boolean(),
      message: z.string(),
      until: z.string().nullable(),
    }),
    announcement: z.object({
      active: z.boolean(),
      message: z.string(),
      tone: z.enum(['info', 'caution']),
    }),
  })
  .openapi('PlatformNotice');

export function platformNotice(now = new Date()): z.infer<typeof PlatformNoticeSchema> {
  const { maintenance, announcement } = held();
  const active = maintenanceActive(maintenance, now);
  return {
    maintenance: {
      active,
      message: active ? maintenance.message : '',
      until: active ? maintenance.until : null,
    },
    announcement: {
      active: announcementActive(announcement, now),
      message: announcementActive(announcement, now) ? announcement.message : '',
      tone: announcement.tone,
    },
  };
}

// ─────────────────────────────── The console ───────────────────────────────

export const MaintenanceViewSchema = z
  .object({
    maintenance: MaintenanceSchema.extend({ active: z.boolean() }),
    announcement: AnnouncementSchema.extend({ active: z.boolean() }),
    backup: BackupNoteSchema.nullable(),
    database: z.enum(['embedded', 'postgres']),
    /** A backup can be downloaded here (the embedded database only). */
    canDownloadBackup: z.boolean(),
    /** Request and sign-in limits being counted, and how many were used in the last hour. */
    rateLimits: z.object({ counted: z.number().int(), lastHour: z.number().int() }),
  })
  .openapi('MaintenanceView');

export async function maintenanceView(
  db: Database,
  now = new Date(),
): Promise<z.infer<typeof MaintenanceViewSchema>> {
  // Read fresh, not from memory: the admin wants what is saved, not what this server holds.
  await loadPlatformState(db);
  const { maintenance, announcement, backup } = held();
  const [limits] = await db
    .select({
      counted: sql<number>`count(*)::int`,
      lastHour: sql<number>`count(*) filter (where ${rateLimits.lastRequest} > ${Date.now() - 3_600_000})::int`,
    })
    .from(rateLimits);
  const kind = dbKind();
  return {
    maintenance: { ...maintenance, active: maintenanceActive(maintenance, now) },
    announcement: { ...announcement, active: announcementActive(announcement, now) },
    backup,
    database: kind,
    canDownloadBackup: kind === 'embedded',
    rateLimits: { counted: Number(limits?.counted ?? 0), lastHour: Number(limits?.lastHour ?? 0) },
  };
}

export const MaintenanceUpdateSchema = z
  .object({
    maintenance: MaintenanceSchema.optional(),
    announcement: AnnouncementSchema.optional(),
    backup: BackupNoteSchema.optional(),
  })
  .openapi('MaintenanceUpdate');

async function put(db: Database, actor: Actor, key: string, value: Record<string, unknown>) {
  await db.transaction(async (tx) => {
    const row = { key, value, updatedBy: actor.userId, updatedAt: new Date() };
    await tx
      .insert(platformState)
      .values(row)
      .onConflictDoUpdate({ target: platformState.key, set: row });
    await audit(tx, actor, {
      action: `platform.${key}`,
      targetType: 'platform',
      targetId: key,
      meta: key === 'backup' ? { at: value.at } : { on: value.on },
    });
  });
}

/** Saves an admin's change to maintenance, the announcement or the backup note. */
export async function saveMaintenance(
  db: Database,
  actor: Actor,
  input: z.infer<typeof MaintenanceUpdateSchema>,
): Promise<void> {
  if (input.maintenance?.on && !input.maintenance.message)
    throw badRequest('Say what people will see.', {
      issues: [{ path: 'maintenance.message', message: 'Say what people will see.' }],
    });
  if (input.announcement?.on && !input.announcement.message)
    throw badRequest('Write the announcement.', {
      issues: [{ path: 'announcement.message', message: 'Write the announcement.' }],
    });
  const m = input.maintenance;
  if (m?.until && m.startsAt && new Date(m.until) <= new Date(m.startsAt))
    throw badRequest('It must end after it starts.', {
      issues: [{ path: 'maintenance.until', message: 'It must end after it starts.' }],
    });
  if (input.maintenance) await put(db, actor, 'maintenance', input.maintenance);
  if (input.announcement) await put(db, actor, 'announcement', input.announcement);
  if (input.backup) await put(db, actor, 'backup', input.backup);
  await loadPlatformState(db);
}

/** A backup of the embedded database, for an admin to download; null with Postgres. */
export async function downloadBackup(db: Database, actor: Actor): Promise<Blob | null> {
  const blob = await backupEmbedded();
  if (!blob) return null;
  await audit(db, actor, {
    action: 'platform.backup-download',
    targetType: 'platform',
    targetId: 'backup',
    meta: { bytes: blob.size },
  });
  return blob;
}

export const HousekeepingSchema = z
  .object({ task: z.enum(['retention', 'rate-limits', 'keys']) })
  .openapi('Housekeeping');

export const HousekeepingResultSchema = z
  .object({ task: z.string(), done: z.record(z.string(), z.number()) })
  .openapi('HousekeepingResult');

/**
 * Runs a piece of housekeeping now, rather than at its usual time: the daily clean-up of
 * what is past its keeping time, clearing every sign-in and request limit (for when real
 * people were held back by a mistake or an attack has passed), or re-sealing what is still
 * under an older server key after a rotation.
 */
export async function housekeeping(
  db: Database,
  actor: Actor,
  task: z.infer<typeof HousekeepingSchema>['task'],
): Promise<z.infer<typeof HousekeepingResultSchema>> {
  let done: Record<string, number>;
  if (task === 'retention') {
    const { keys, ...counts } = await retention(db);
    done = { ...counts, keysRemaining: keys.remaining };
  } else if (task === 'rate-limits') {
    const cleared = await db.delete(rateLimits).returning({ key: rateLimits.key });
    done = { cleared: cleared.length };
  } else {
    const keys = await rewrapKeys(db);
    done = { ...keys };
  }
  await audit(db, actor, {
    action: `platform.${task}`,
    targetType: 'platform',
    targetId: task,
    meta: done,
  });
  return { task, done };
}
