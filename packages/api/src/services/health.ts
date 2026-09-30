/**
 * Health: everyday routines, private reminders and where to get care. Waypoint never diagnoses.
 * Notes and reminder titles can be health information, so they are encrypted with the person's
 * data key; notes are screened for signs of danger like everything else people write.
 */
import { z } from '@hono/zod-openapi';
import { getEmergency, getHealthLines, getSupportResources } from '@waypoint/content';
import {
  addDays,
  clampMetric,
  formatSchedule,
  HEALTH_METRICS,
  type HealthMetric,
  healthWeek,
  localDate,
  nextOccurrence,
  parseSchedule,
  REMINDER_REPEATS,
} from '@waypoint/core';
import { newId } from '@waypoint/core/ids';
import { openFor, SEALED, sealFor } from '@waypoint/core/privacy';
import {
  and,
  asc,
  type Database,
  eq,
  gte,
  healthLogs,
  inArray,
  lte,
  reminders,
} from '@waypoint/db';
import { oneAtATime } from '../lib/locks';
import { ApiError, notFound } from '../lib/problem';
import type { Profile } from './me';
import { helpCountry, userDek } from './me';
import { type Screening, screenWriting } from './safety';

const MAX_REMINDERS = 30;
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const HealthDaySchema = z
  .object({
    date: z.string(),
    sleep: z.number().nullable(),
    activity: z.number().nullable(),
    water: z.number().nullable(),
    note: z.string().nullable(),
  })
  .openapi('HealthDay');

export const HealthDayInputSchema = z
  .object({
    /** Defaults to today in the person's time zone; the last 7 days can be filled in. */
    date: IsoDate.optional(),
    sleep: z.number().min(0).max(24).nullable().optional(),
    activity: z.number().min(0).max(1440).nullable().optional(),
    water: z.number().min(0).max(60).nullable().optional(),
    note: z.string().trim().max(2000).nullable().optional(),
  })
  .openapi('HealthDayInput');

export const ReminderSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    repeat: z.enum(REMINDER_REPEATS),
    date: z.string(),
    time: z.string(),
    nextAt: z.string().nullable(),
    enabled: z.boolean(),
    createdAt: z.string(),
  })
  .openapi('HealthReminder');

export const ReminderInputSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    repeat: z.enum(REMINDER_REPEATS),
    date: IsoDate,
    time: Time,
  })
  .openapi('HealthReminderInput');

export const ReminderPatchSchema = z
  .object({
    title: z.string().trim().min(2).max(120).optional(),
    repeat: z.enum(REMINDER_REPEATS).optional(),
    date: IsoDate.optional(),
    time: Time.optional(),
    enabled: z.boolean().optional(),
  })
  .openapi('HealthReminderPatch');

const SourceSchema = z.object({ url: z.string(), title: z.string(), checkedAt: z.string() });

export const HealthLineSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    phone: z.string().optional(),
    url: z.string().optional(),
    hours: z.string().optional(),
    free: z.boolean().optional(),
    languages: z.array(z.string()).optional(),
    audience: z.string(),
    notes: z.string().optional(),
    sources: z.array(SourceSchema),
  })
  .openapi('HealthLine');

export const HealthViewSchema = z
  .object({
    today: HealthDaySchema,
    week: z.object({
      days: z.array(
        z.object({
          date: z.string(),
          sleep: z.number().nullable(),
          activity: z.number().nullable(),
          water: z.number().nullable(),
        }),
      ),
      activityTotal: z.number(),
      sleepAverage: z.number().nullable(),
      loggedDays: z.number().int(),
    }),
    reminders: z.array(ReminderSchema),
    care: z.object({
      country: z.string().nullable(),
      emergencyNumber: z.string().nullable(),
      ambulanceNumber: z.string().nullable(),
      lines: z.array(HealthLineSchema),
      poison: z
        .object({ name: z.string(), phone: z.string().optional(), url: z.string().optional() })
        .nullable(),
    }),
  })
  .openapi('Health');

export type HealthDay = z.infer<typeof HealthDaySchema>;
export type HealthReminder = z.infer<typeof ReminderSchema>;
export type HealthView = z.infer<typeof HealthViewSchema>;
export type HealthLineView = z.infer<typeof HealthLineSchema>;

type ReminderRow = typeof reminders.$inferSelect;

function reminderView(dek: Buffer, userId: string, r: ReminderRow): HealthReminder {
  const schedule = parseSchedule(r.rrule) ?? { repeat: 'once' as const, date: '', time: '09:00' };
  return {
    id: r.id,
    title: openFor(dek, r.titleCt, SEALED.reminder, userId, r.id),
    repeat: schedule.repeat,
    date: schedule.date,
    time: schedule.time,
    nextAt: r.nextAt ? r.nextAt.toISOString() : null,
    enabled: r.enabled,
    createdAt: r.createdAt.toISOString(),
  };
}

export function careFor(country: string | null): HealthView['care'] {
  const emergency = getEmergency(country);
  const poison = country
    ? getSupportResources(country, { kinds: ['poison'], includeGlobal: false }).find(
        (r) => r.kind === 'poison',
      )
    : undefined;
  return {
    country,
    emergencyNumber: emergency?.general ?? emergency?.ambulance ?? null,
    ambulanceNumber: emergency?.ambulance ?? null,
    lines: getHealthLines(country).map((l) => ({
      id: l.id,
      name: l.name,
      phone: l.phone,
      url: l.url,
      hours: l.hours,
      free: l.free,
      languages: l.languages,
      audience: l.audience,
      notes: l.notes,
      sources: l.sources,
    })),
    poison: poison ? { name: poison.name, phone: poison.phone, url: poison.url } : null,
  };
}

async function dayLogs(db: Database, userId: string, from: string, to: string) {
  return db
    .select()
    .from(healthLogs)
    .where(
      and(
        eq(healthLogs.userId, userId),
        gte(healthLogs.loggedFor, from),
        lte(healthLogs.loggedFor, to),
      ),
    );
}

export async function healthOverview(
  db: Database,
  userId: string,
  profile: Profile,
): Promise<HealthView> {
  const today = localDate(new Date(), profile.timezone);
  const [logs, reminderRows] = await Promise.all([
    dayLogs(db, userId, addDays(today, -6), today),
    db
      .select()
      .from(reminders)
      .where(and(eq(reminders.userId, userId), eq(reminders.module, 'health')))
      .orderBy(asc(reminders.createdAt)),
  ]);
  const todayNote = logs.find((l) => l.kind === 'note' && l.loggedFor === today);
  const dek = reminderRows.length || todayNote?.noteCt ? await userDek(db, userId) : null;
  const week = healthWeek(
    logs.map((l) => ({ kind: l.kind, value: l.value, date: l.loggedFor })),
    today,
  );
  const todayLog = week.days.at(-1);
  return {
    today: {
      date: today,
      sleep: todayLog?.sleep ?? null,
      activity: todayLog?.activity ?? null,
      water: todayLog?.water ?? null,
      note:
        todayNote?.noteCt && dek
          ? openFor(dek, todayNote.noteCt, SEALED.health, userId, todayNote.id)
          : null,
    },
    week,
    reminders: dek
      ? reminderRows
          .map((r) => reminderView(dek, userId, r))
          .sort((a, b) => (a.nextAt ?? '9999').localeCompare(b.nextAt ?? '9999'))
      : [],
    care: careFor(helpCountry(profile)),
  };
}

/** Save a day's routines. `null` clears a value; leaving a field out keeps it. */
export async function saveDay(
  db: Database,
  userId: string,
  profile: Profile,
  input: z.infer<typeof HealthDayInputSchema>,
): Promise<{ day: HealthDay; screening: Screening }> {
  const today = localDate(new Date(), profile.timezone);
  const date = input.date ?? today;
  if (date > today || date < addDays(today, -6)) {
    throw new ApiError(422, 'date-range', 'You can fill in today and the six days before it.');
  }

  const note = input.note === undefined ? undefined : input.note?.trim() || null;
  const dek = note ? await userDek(db, userId) : null;

  await db.transaction(async (tx) => {
    for (const metric of HEALTH_METRICS) {
      const value = input[metric];
      if (value === undefined) continue;
      if (value === null) {
        await tx
          .delete(healthLogs)
          .where(
            and(
              eq(healthLogs.userId, userId),
              eq(healthLogs.kind, metric),
              eq(healthLogs.loggedFor, date),
            ),
          );
        continue;
      }
      const clamped = clampMetric(metric as HealthMetric, value);
      await tx
        .insert(healthLogs)
        .values({ userId, kind: metric, value: clamped, loggedFor: date })
        .onConflictDoUpdate({
          target: [healthLogs.userId, healthLogs.kind, healthLogs.loggedFor],
          set: { value: clamped },
        });
    }

    if (note !== undefined) {
      const [existing] = await tx
        .select({ id: healthLogs.id })
        .from(healthLogs)
        .where(
          and(
            eq(healthLogs.userId, userId),
            eq(healthLogs.kind, 'note'),
            eq(healthLogs.loggedFor, date),
          ),
        )
        .limit(1);
      if (!note || !dek) {
        if (existing) await tx.delete(healthLogs).where(eq(healthLogs.id, existing.id));
      } else {
        const id = existing?.id ?? newId();
        const noteCt = sealFor(dek, note, SEALED.health, userId, id);
        if (existing) await tx.update(healthLogs).set({ noteCt }).where(eq(healthLogs.id, id));
        else
          await tx.insert(healthLogs).values({ id, userId, kind: 'note', noteCt, loggedFor: date });
      }
    }
  });

  const screening = note
    ? await screenWriting(db, note, {
        userId,
        country: helpCountry(profile),
        locale: profile.locale,
      })
    : { tier: 0, plan: null };

  const logs = await dayLogs(db, userId, date, date);
  const noteRow = logs.find((l) => l.kind === 'note');
  const metricOf = (k: HealthMetric) => logs.find((l) => l.kind === k)?.value ?? null;
  const key = noteRow?.noteCt ? (dek ?? (await userDek(db, userId))) : null;
  return {
    day: {
      date,
      sleep: metricOf('sleep'),
      activity: metricOf('activity'),
      water: metricOf('water'),
      note:
        noteRow?.noteCt && key
          ? openFor(key, noteRow.noteCt, SEALED.health, userId, noteRow.id)
          : null,
    },
    screening,
  };
}

// ───────────────────────────── Reminders ─────────────────────────────

export async function createReminder(
  db: Database,
  userId: string,
  profile: Profile,
  input: z.infer<typeof ReminderInputSchema>,
): Promise<HealthReminder> {
  // Counted and saved one at a time per person, so the limit holds when requests arrive together.
  return oneAtATime(db, `reminders:${userId}`, (tx) =>
    createReminderUnlocked(tx, userId, profile, input),
  );
}

async function createReminderUnlocked(
  db: Database,
  userId: string,
  profile: Profile,
  input: z.infer<typeof ReminderInputSchema>,
): Promise<HealthReminder> {
  const existing = await db
    .select({ id: reminders.id })
    .from(reminders)
    .where(and(eq(reminders.userId, userId), eq(reminders.module, 'health')));
  if (existing.length >= MAX_REMINDERS) {
    throw new ApiError(409, 'limit', 'You have 30 reminders. Delete one before adding another.');
  }
  const schedule = { repeat: input.repeat, date: input.date, time: input.time };
  const nextAt = nextOccurrence(schedule, new Date(), profile.timezone);
  if (!nextAt) {
    throw new ApiError(422, 'in-the-past', 'Choose a date and time that hasn’t passed yet.');
  }
  const dek = await userDek(db, userId);
  const id = newId();
  const [row] = await db
    .insert(reminders)
    .values({
      id,
      userId,
      module: 'health',
      titleCt: sealFor(dek, input.title, SEALED.reminder, userId, id),
      rrule: formatSchedule(schedule),
      nextAt,
    })
    .returning();
  if (!row) throw new Error('Could not save the reminder');
  return reminderView(dek, userId, row);
}

export async function updateReminder(
  db: Database,
  userId: string,
  profile: Profile,
  id: string,
  patch: z.infer<typeof ReminderPatchSchema>,
): Promise<HealthReminder> {
  const [current] = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.id, id), eq(reminders.userId, userId)))
    .limit(1);
  if (!current) throw notFound('Reminder');
  const dek = await userDek(db, userId);
  const was = parseSchedule(current.rrule) ?? { repeat: 'once' as const, date: '', time: '09:00' };
  const schedule = {
    repeat: patch.repeat ?? was.repeat,
    date: patch.date ?? was.date,
    time: patch.time ?? was.time,
  };
  const scheduleChanged =
    patch.repeat !== undefined || patch.date !== undefined || patch.time !== undefined;
  let enabled = patch.enabled ?? current.enabled;
  let nextAt: Date | null = null;
  if (enabled) {
    const recompute = scheduleChanged || patch.enabled === true || !current.nextAt;
    nextAt = recompute ? nextOccurrence(schedule, new Date(), profile.timezone) : current.nextAt;
    if (!nextAt) {
      // Asking for a time that has passed is a mistake; a finished one-off simply stays off.
      if (scheduleChanged || patch.enabled === true) {
        throw new ApiError(422, 'in-the-past', 'Choose a date and time that hasn’t passed yet.');
      }
      enabled = false;
    }
  }
  const [row] = await db
    .update(reminders)
    .set({
      titleCt:
        patch.title !== undefined
          ? sealFor(dek, patch.title, SEALED.reminder, userId, id)
          : current.titleCt,
      rrule: formatSchedule(schedule),
      enabled,
      nextAt,
    })
    .where(and(eq(reminders.id, id), eq(reminders.userId, userId)))
    .returning();
  if (!row) throw notFound('Reminder');
  return reminderView(dek, userId, row);
}

export async function deleteReminder(db: Database, userId: string, id: string): Promise<void> {
  const res = await db
    .delete(reminders)
    .where(and(eq(reminders.id, id), eq(reminders.userId, userId)))
    .returning({ id: reminders.id });
  if (!res.length) throw notFound('Reminder');
}

/** Decrypted titles for reminders, so a due-reminder note on Today can say what it's about. */
export async function reminderTitles(
  db: Database,
  userId: string,
  ids: string[],
): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.userId, userId), inArray(reminders.id, ids)));
  if (!rows.length) return new Map();
  const dek = await userDek(db, userId);
  return new Map(rows.map((r) => [r.id, openFor(dek, r.titleCt, SEALED.reminder, userId, r.id)]));
}
