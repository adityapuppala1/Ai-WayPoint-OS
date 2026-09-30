/**
 * Saving a drafted plan, shared by the Path API and Ask's `draft_plan` tool so both follow the
 * same rules: one active plan at a time (earlier ones are paused, never deleted), and planner
 * text is stored with how it was made so it can be shown in whatever language the person reads.
 */
import type { PlanDraft } from '@waypoint/core';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../client';
import { planSteps, plans } from '../schema';

export async function savePlan(
  db: Database,
  input: {
    userId: string;
    draft: PlanDraft;
    horizonWeeks: number;
    hoursPerWeek: number;
    /** The language the draft's text is written in. */
    locale: string;
  },
): Promise<string> {
  const { draft } = input;
  // AI-reworded text can't be rebuilt from templates, so its references are dropped.
  const keepText = draft.generatedBy === 'template';
  return db.transaction(async (tx) => {
    await tx
      .update(plans)
      .set({ status: 'paused', updatedAt: new Date() })
      .where(and(eq(plans.userId, input.userId), eq(plans.status, 'active')));
    const [p] = await tx
      .insert(plans)
      .values({
        userId: input.userId,
        title: draft.title,
        summary: draft.summary,
        targetRoleId: draft.targetRoleId ?? null,
        horizonWeeks: input.horizonWeeks,
        hoursPerWeek: input.hoursPerWeek,
        generatedBy: draft.generatedBy,
        gaps: draft.gaps,
        locale: input.locale,
        text: keepText ? (draft.text ?? null) : null,
      })
      .returning({ id: plans.id });
    if (!p) throw new Error('Could not save the plan');
    const rows = draft.weeks.flatMap((w) =>
      w.steps.map((s, i) => ({
        planId: p.id,
        week: w.week,
        position: i,
        kind: s.kind,
        title: s.title,
        detail: s.detail,
        minutes: s.minutes,
        resourceId: s.resourceId ?? null,
        skillIds: s.skillIds,
        href: s.href ?? null,
        text: keepText ? (s.text ?? null) : null,
      })),
    );
    if (rows.length) await tx.insert(planSteps).values(rows);
    return p.id;
  });
}
