/**
 * Option lists for forms. Mirrors the domain types in @waypoint/core (type-only imports keep
 * the client bundle free of server data).
 */
import type { ConsentPurpose, LifeStage, Situation, WorkType } from '@waypoint/core';

export const SITUATION_OPTIONS = [
  'lost-job',
  'first-job',
  'changing-career',
  'new-country',
  'studying',
  'gig-work',
  'running-business',
  'caring',
  'health-change',
  'retiring',
  'steady',
] as const satisfies readonly Situation[];

export const LIFE_STAGE_OPTIONS = [
  'teen',
  'student',
  'early-career',
  'mid-career',
  'late-career',
  'retired',
  'prefer-not',
] as const satisfies readonly LifeStage[];

export const WORK_TYPE_OPTIONS = [
  'salaried',
  'gig',
  'freelance',
  'business-owner',
  'unemployed',
  'caregiver',
  'student',
  'retired',
] as const satisfies readonly WorkType[];

/** Consents asked for during onboarding, in order. The rest live in Privacy settings. */
export const ONBOARDING_CONSENTS = [
  'personalization',
  'foresight_matching',
  'memory',
  'ai_external',
] as const satisfies readonly ConsentPurpose[];

/**
 * The choices offered in Privacy settings. `research_aggregates` ("include me in anonymised
 * public trend reports") is left out on purpose: no such report exists and nothing reads the
 * answer, and a switch that changes nothing is not a choice. Answers already given stay
 * stored and in the export; offer it again only together with the report (and ask afresh).
 */
export const OFFERED_CONSENTS = [
  'personalization',
  'foresight_matching',
  'memory',
  'ai_external',
  'circle_matching',
  'trusted_contact',
  'org_aggregates',
] as const satisfies readonly ConsentPurpose[];

/** Skills most people can claim at some level — shown first when adding skills. */
export const COMMON_SKILLS = [
  'digital-basics',
  'office-docs',
  'spreadsheets',
  'customer-service',
  'writing-clearly',
  'teamwork',
  'time-management',
  'problem-solving',
  'caregiving',
  'professional-driving',
  'sales',
  'english-workplace',
];
