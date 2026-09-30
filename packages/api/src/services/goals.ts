/**
 * Goals and the weekly review. Goals are few and personal, so their words are encrypted with the
 * person's data key; the area, dates and progress stay in the clear so Today can use them.
 * No streaks and no guilt: progress is a simple percentage the person sets themselves.
 */
import { z } from '@hono/zod-openapi';
import { weekStartOf } from '@waypoint/core';
import { newId } from '@waypoint/core/ids';
import { openFor, SEALED, sealFor } from '@waypoint/core/privacy';
import { and, asc, type Database, desc, eq, goals, weeklyReviews } from '@waypoint/db';
import { ApiError, notFound } from '../lib/problem';
import { userDek } from './me';

export const GOAL_AREAS = ['path', 'money', 'mind', 'health', 'civic', 'circles', 'goals'] as const;
export const GOAL_STATUSES = ['active', 'paused', 'done', 'dropped'] as const;
const MAX_OPEN_GOALS = 12;

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const GoalSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    why: z.string().nullable(),
    area: z.enum(GOAL_AREAS),
    targetDate: z.string().nullable(),
    status: z.enum(GOAL_STATUSES),
    progress: z.number().int().min(0).max(100),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Goal');

export const GoalInputSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    why: z.string().trim().max(500).optional(),
    area: z.enum(GOAL_AREAS).default('goals'),
    targetDate: IsoDate.optional(),
  })
  .openapi('GoalInput');

export const GoalPatchSchema = z
  .object({
    title: z.string().trim().min(2).max(120).optional(),
    why: z.string().trim().max(500).nullable().optional(),
    area: z.enum(GOAL_AREAS).optional(),
    targetDate: IsoDate.nullable().optional(),
    status: z.enum(GOAL_STATUSES).optional(),
    progress: z.number().int().min(0).max(100).optional(),
  })
  .openapi('GoalPatch');

export const ReviewSchema = z
  .object({
    id: z.string(),
    weekStart: z.string(),
    wentWell: z.string().nullable(),
    gotInTheWay: z.string().nullable(),
    nextChange: z.string().nullable(),
    mood: z.number().int().min(1).max(5).nullable(),
    createdAt: z.string(),
  })
  .openapi('WeeklyReview');

export const ReviewInputSchema = z
  .object({
    wentWell: z.string().trim().max(1000).optional(),
    gotInTheWay: z.string().trim().max(1000).optional(),
    nextChange: z.string().trim().max(1000).optional(),
    mood: z.number().int().min(1).max(5).optional(),
  })
  .openapi('WeeklyReviewInput');

export const GoalsViewSchema = z
  .object({
    goals: z.array(GoalSchema),
    weekStart: z.string(),
    thisWeek: ReviewSchema.nullable(),
    recentReviews: z.array(ReviewSchema),
  })
  .openapi('Goals');

export type Goal = z.infer<typeof GoalSchema>;
export type WeeklyReview = z.infer<typeof ReviewSchema>;
export type GoalsView = z.infer<typeof GoalsViewSchema>;

type GoalRow = typeof goals.$inferSelect;
type ReviewRow = typeof weeklyReviews.$inferSelect;

const STATUS_ORDER: Record<string, number> = { active: 0, paused: 1, done: 2, dropped: 3 };

function goalView(dek: Buffer, userId: string, g: GoalRow): Goal {
  return {
    id: g.id,
    title: openFor(dek, g.titleCt, SEALED.goal, userId, g.id),
    why: g.whyCt ? openFor(dek, g.whyCt, SEALED.goal, userId, g.id) : null,
    area: (GOAL_AREAS as readonly string[]).includes(g.area) ? (g.area as Goal['area']) : 'goals',
    targetDate: g.targetDate ?? null,
    status: (GOAL_STATUSES as readonly string[]).includes(g.status)
      ? (g.status as Goal['status'])
      : 'active',
    progress: g.progress,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  };
}

function reviewView(dek: Buffer, userId: string, r: ReviewRow): WeeklyReview {
  let body: { wentWell?: string; gotInTheWay?: string; nextChange?: string } = {};
  try {
    body = JSON.parse(openFor(dek, r.bodyCt, SEALED.weeklyReview, userId, r.id));
  } catch {
    body = {};
  }
  return {
    id: r.id,
    weekStart: r.weekStart,
    wentWell: body.wentWell || null,
    gotInTheWay: body.gotInTheWay || null,
    nextChange: body.nextChange || null,
    mood: r.mood ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listGoals(db: Database, userId: string): Promise<Goal[]> {
  const rows = await db
    .select()
    .from(goals)
    .where(eq(goals.userId, userId))
    .orderBy(asc(goals.createdAt));
  if (!rows.length) return [];
  const dek = await userDek(db, userId);
  return rows
    .map((g) => goalView(dek, userId, g))
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
}

export async function goalsOverview(
  db: Database,
  userId: string,
  timeZone: string,
): Promise<GoalsView> {
  const weekStart = weekStartOf(new Date(), timeZone);
  const [list, reviewRows] = await Promise.all([
    listGoals(db, userId),
    db
      .select()
      .from(weeklyReviews)
      .where(eq(weeklyReviews.userId, userId))
      .orderBy(desc(weeklyReviews.weekStart))
      .limit(8),
  ]);
  const dek = reviewRows.length ? await userDek(db, userId) : null;
  const reviews = dek ? reviewRows.map((r) => reviewView(dek, userId, r)) : [];
  return {
    goals: list,
    weekStart,
    thisWeek: reviews.find((r) => r.weekStart === weekStart) ?? null,
    recentReviews: reviews.filter((r) => r.weekStart !== weekStart),
  };
}

export async function createGoal(
  db: Database,
  userId: string,
  input: z.infer<typeof GoalInputSchema>,
): Promise<Goal> {
  const open = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.status, 'active')));
  if (open.length >= MAX_OPEN_GOALS) {
    throw new ApiError(
      409,
      'limit',
      'You already have 12 active goals. Finish, pause or drop one before adding another.',
    );
  }
  const dek = await userDek(db, userId);
  const id = newId();
  const [row] = await db
    .insert(goals)
    .values({
      id,
      userId,
      titleCt: sealFor(dek, input.title, SEALED.goal, userId, id),
      whyCt: input.why ? sealFor(dek, input.why, SEALED.goal, userId, id) : null,
      area: input.area,
      targetDate: input.targetDate ?? null,
    })
    .returning();
  if (!row) throw new Error('Could not save the goal');
  return goalView(dek, userId, row);
}

export async function updateGoal(
  db: Database,
  userId: string,
  goalId: string,
  patch: z.infer<typeof GoalPatchSchema>,
): Promise<Goal> {
  const dek = await userDek(db, userId);
  const set: Partial<typeof goals.$inferInsert> = { updatedAt: new Date() };
  if (patch.title !== undefined)
    set.titleCt = sealFor(dek, patch.title, SEALED.goal, userId, goalId);
  if (patch.why !== undefined)
    set.whyCt = patch.why ? sealFor(dek, patch.why, SEALED.goal, userId, goalId) : null;
  if (patch.area !== undefined) set.area = patch.area;
  if (patch.targetDate !== undefined) set.targetDate = patch.targetDate;
  if (patch.progress !== undefined) set.progress = patch.progress;
  if (patch.status !== undefined) {
    set.status = patch.status;
    if (patch.status === 'done') set.progress = 100;
  }
  const [row] = await db
    .update(goals)
    .set(set)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .returning();
  if (!row) throw notFound('Goal');
  return goalView(dek, userId, row);
}

export async function deleteGoal(db: Database, userId: string, goalId: string): Promise<void> {
  const res = await db
    .delete(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .returning({ id: goals.id });
  if (!res.length) throw notFound('Goal');
}

/** Save this week's review (one per week; saving again updates it). */
export async function saveReview(
  db: Database,
  userId: string,
  timeZone: string,
  input: z.infer<typeof ReviewInputSchema>,
): Promise<WeeklyReview> {
  const dek = await userDek(db, userId);
  const weekStart = weekStartOf(new Date(), timeZone);
  const [existing] = await db
    .select({ id: weeklyReviews.id })
    .from(weeklyReviews)
    .where(and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.weekStart, weekStart)))
    .limit(1);
  const id = existing?.id ?? newId();
  const bodyCt = sealFor(
    dek,
    JSON.stringify({
      wentWell: input.wentWell ?? '',
      gotInTheWay: input.gotInTheWay ?? '',
      nextChange: input.nextChange ?? '',
    }),
    SEALED.weeklyReview,
    userId,
    id,
  );
  const [row] = existing
    ? await db
        .update(weeklyReviews)
        .set({ bodyCt, mood: input.mood ?? null })
        .where(eq(weeklyReviews.id, id))
        .returning()
    : await db
        .insert(weeklyReviews)
        .values({ id, userId, weekStart, bodyCt, mood: input.mood ?? null })
        .returning();
  if (!row) throw new Error('Could not save the review');
  return reviewView(dek, userId, row);
}
