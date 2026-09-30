/**
 * Mind: mood check-ins and a private journal. Notes and entries are encrypted with the person's
 * data key and screened for signs of danger as they are saved — the words are never stored in
 * the clear and never leave the server, and screening doesn't depend on any AI.
 */
import { z } from '@hono/zod-openapi';
import { JOURNAL_PROMPTS, MOOD_TAGS, moodSummary } from '@waypoint/core';
import { newId } from '@waypoint/core/ids';
import { openFor, SEALED, sealFor } from '@waypoint/core/privacy';
import { and, type Database, desc, eq, gte, journalEntries, moodCheckins } from '@waypoint/db';
import { notFound } from '../lib/problem';
import type { Profile } from './me';
import { helpCountry, userDek } from './me';
import { type Screening, screenWriting } from './safety';

export const MoodCheckinInputSchema = z
  .object({
    mood: z.number().int().min(1).max(5),
    energy: z.number().int().min(1).max(5).optional(),
    tags: z.array(z.enum(MOOD_TAGS)).max(MOOD_TAGS.length).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .openapi('MoodCheckinInput');

export const MoodCheckinSchema = z
  .object({
    id: z.string(),
    mood: z.number().int(),
    energy: z.number().int().nullable(),
    tags: z.array(z.string()),
    note: z.string().nullable(),
    createdAt: z.string(),
  })
  .openapi('MoodCheckin');

export const JournalInputSchema = z
  .object({
    promptId: z.enum(JOURNAL_PROMPTS).optional(),
    body: z.string().trim().min(1).max(20_000),
  })
  .openapi('JournalInput');

export const JournalEntrySchema = z
  .object({
    id: z.string(),
    promptId: z.string().nullable(),
    body: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('JournalEntry');

export const ScreeningSchema = z
  .object({
    tier: z.number().int(),
    /** Present at tier 2+: the same support card Ask shows. */
    plan: z
      .object({
        tier: z.number().int(),
        headline: z.string(),
        message: z.string(),
        actions: z.array(
          z.object({ kind: z.string(), label: z.string(), href: z.string().optional() }),
        ),
        emergencyNumber: z.string().optional(),
      })
      .passthrough()
      .nullable(),
  })
  .openapi('Screening');

export const MoodSummarySchema = z
  .object({
    days: z.array(z.object({ date: z.string(), mood: z.number().int().nullable() })),
    average7: z.number().nullable(),
    lowDays7: z.number().int(),
    lowStreak: z.number().int(),
    suggestSupport: z.boolean(),
  })
  .openapi('MoodSummary');

export const MindViewSchema = z
  .object({
    summary: MoodSummarySchema,
    checkins: z.array(MoodCheckinSchema),
    journal: z.array(JournalEntrySchema),
  })
  .openapi('Mind');

export type MoodCheckin = z.infer<typeof MoodCheckinSchema>;
export type JournalEntry = z.infer<typeof JournalEntrySchema>;
export type MindView = z.infer<typeof MindViewSchema>;

type CheckinRow = typeof moodCheckins.$inferSelect;
type EntryRow = typeof journalEntries.$inferSelect;

const checkinView = (dek: Buffer | null, userId: string, r: CheckinRow): MoodCheckin => ({
  id: r.id,
  mood: r.mood,
  energy: r.energy ?? null,
  tags: r.tags,
  note: r.noteCt && dek ? openFor(dek, r.noteCt, SEALED.mood, userId, r.id) : null,
  createdAt: r.createdAt.toISOString(),
});

const entryView = (dek: Buffer, userId: string, r: EntryRow): JournalEntry => ({
  id: r.id,
  promptId: r.promptId ?? null,
  body: openFor(dek, r.bodyCt, SEALED.journal, userId, r.id),
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

export async function mindOverview(
  db: Database,
  userId: string,
  profile: Profile,
): Promise<MindView> {
  const since = new Date(Date.now() - 15 * 86_400_000);
  const [checkins, entries] = await Promise.all([
    db
      .select()
      .from(moodCheckins)
      .where(and(eq(moodCheckins.userId, userId), gte(moodCheckins.createdAt, since)))
      .orderBy(desc(moodCheckins.createdAt))
      .limit(60),
    db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.userId, userId))
      .orderBy(desc(journalEntries.createdAt))
      .limit(30),
  ]);
  const needsKey = entries.length > 0 || checkins.some((c) => c.noteCt);
  const dek = needsKey ? await userDek(db, userId) : null;
  return {
    summary: moodSummary(
      checkins.map((c) => ({ mood: c.mood, at: c.createdAt })),
      new Date(),
      profile.timezone,
    ),
    checkins: checkins.slice(0, 14).map((c) => checkinView(dek, userId, c)),
    journal: dek ? entries.map((e) => entryView(dek, userId, e)) : [],
  };
}

export async function addCheckin(
  db: Database,
  userId: string,
  profile: Profile,
  input: z.infer<typeof MoodCheckinInputSchema>,
): Promise<{ checkin: MoodCheckin; screening: Screening }> {
  const id = newId();
  const note = input.note?.trim() || null;
  const dek = note ? await userDek(db, userId) : null;
  const [row] = await db
    .insert(moodCheckins)
    .values({
      id,
      userId,
      mood: input.mood,
      energy: input.energy ?? null,
      tags: [...new Set(input.tags ?? [])],
      noteCt: note && dek ? sealFor(dek, note, SEALED.mood, userId, id) : null,
    })
    .returning();
  if (!row) throw new Error('Could not save the check-in');
  const screening = await screenWriting(db, note ?? '', {
    userId,
    country: helpCountry(profile),
    locale: profile.locale,
  });
  return { checkin: checkinView(dek, userId, row), screening };
}

export async function deleteCheckin(db: Database, userId: string, id: string): Promise<void> {
  const res = await db
    .delete(moodCheckins)
    .where(and(eq(moodCheckins.id, id), eq(moodCheckins.userId, userId)))
    .returning({ id: moodCheckins.id });
  if (!res.length) throw notFound('Check-in');
}

export async function addEntry(
  db: Database,
  userId: string,
  profile: Profile,
  input: z.infer<typeof JournalInputSchema>,
): Promise<{ entry: JournalEntry; screening: Screening }> {
  const dek = await userDek(db, userId);
  const id = newId();
  const [row] = await db
    .insert(journalEntries)
    .values({
      id,
      userId,
      promptId: input.promptId && input.promptId !== 'free' ? input.promptId : null,
      bodyCt: sealFor(dek, input.body, SEALED.journal, userId, id),
    })
    .returning();
  if (!row) throw new Error('Could not save the entry');
  const screening = await screenWriting(db, input.body, {
    userId,
    country: helpCountry(profile),
    locale: profile.locale,
  });
  return { entry: entryView(dek, userId, row), screening };
}

export async function updateEntry(
  db: Database,
  userId: string,
  profile: Profile,
  id: string,
  body: string,
): Promise<{ entry: JournalEntry; screening: Screening }> {
  const dek = await userDek(db, userId);
  const [row] = await db
    .update(journalEntries)
    .set({ bodyCt: sealFor(dek, body, SEALED.journal, userId, id), updatedAt: new Date() })
    .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)))
    .returning();
  if (!row) throw notFound('Entry');
  const screening = await screenWriting(db, body, {
    userId,
    country: helpCountry(profile),
    locale: profile.locale,
  });
  return { entry: entryView(dek, userId, row), screening };
}

export async function deleteEntry(db: Database, userId: string, id: string): Promise<void> {
  const res = await db
    .delete(journalEntries)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)))
    .returning({ id: journalEntries.id });
  if (!res.length) throw notFound('Entry');
}
