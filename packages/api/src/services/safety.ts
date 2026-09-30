/**
 * Safety screening for anything a person writes (Ask, Mind check-ins and journal, Circles).
 * Deterministic and multilingual (@waypoint/core/crisis). We keep a record that something was
 * flagged — tier, categories and rule ids — but never the words themselves.
 */
import {
  assessCrisis,
  CRISIS_RULES_VERSION,
  type CrisisAssessment,
  type CrisisResponsePlan,
  planCrisisResponse,
} from '@waypoint/core';
import { crisisEvents, type Database } from '@waypoint/db';

export type Channel = 'web' | 'sms' | 'whatsapp' | 'ussd' | 'api';

export async function recordCrisis(
  db: Database,
  input: {
    userId: string;
    channel: Channel;
    country: string | null;
    assessment: CrisisAssessment;
    plan: CrisisResponsePlan;
  },
): Promise<void> {
  const { assessment, plan } = input;
  const followUpAt = plan.followUpHours
    ? new Date(Date.now() + plan.followUpHours * 3_600_000)
    : null;
  await db.insert(crisisEvents).values({
    userId: input.userId,
    channel: input.channel,
    tier: assessment.tier,
    categories: assessment.categories,
    ruleIds: assessment.matched,
    rulesVersion: CRISIS_RULES_VERSION,
    language: assessment.language,
    country: input.country,
    aboutOther: assessment.aboutOther,
    actionKinds: plan.actions.map((a) => a.kind),
    followUpAt,
    followUpStatus: followUpAt ? 'scheduled' : null,
  });
}

export interface Screening {
  /** 0 none · 1 distress · 2 risk · 3 imminent danger */
  tier: number;
  /** Shown to the person straight away when tier ≥ 2. */
  plan: CrisisResponsePlan | null;
}

/**
 * Screen private writing. Tier 2+ shows the crisis card and is recorded (so a gentle follow-up
 * can be offered); tier 1 only lets the UI mention that support is there.
 */
export async function screenWriting(
  db: Database,
  text: string,
  ctx: { userId: string; country: string | null; locale: string; channel?: Channel },
): Promise<Screening> {
  if (!text.trim()) return { tier: 0, plan: null };
  const assessment = assessCrisis(text);
  if (assessment.tier < 2) return { tier: assessment.tier, plan: null };
  const plan = planCrisisResponse(assessment, { country: ctx.country, locale: ctx.locale });
  await recordCrisis(db, {
    userId: ctx.userId,
    channel: ctx.channel ?? 'web',
    country: ctx.country,
    assessment,
    plan,
  });
  return { tier: assessment.tier, plan };
}
