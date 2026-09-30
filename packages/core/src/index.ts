/**
 * @waypoint/core — pure, isomorphic domain logic (safe to import from client components).
 *
 * Server-only modules are deliberately NOT re-exported here because they use Node APIs:
 *   @waypoint/core/credentials  (Ed25519 signing)
 *   @waypoint/core/privacy      (encryption, hashing)
 *   @waypoint/core/env          (environment loading)
 */

export {
  AUTO_HIDE_REPORTS,
  type HoldReason,
  type Moderation,
  moderatePost,
  POST_KINDS,
  type PostKind,
  REACTIONS,
  REPORT_REASONS,
  type Reaction,
  type ReportReason,
} from './community';
export {
  assessCrisis,
  CRISIS_RULES_VERSION,
  type CrisisContext,
  planCrisisResponse,
} from './crisis';
export {
  brierScore,
  brierSkillScore,
  calibrationBuckets,
  clampForecast,
  FORECAST_BOUNDS,
  forecastScore,
  formatPercent,
  type JudgedForecast,
  meanBrier,
  type PublishedChance,
  probabilityWords,
  type RelevanceReason,
  relevance,
  SCOREBOARD,
  type Scoreboard,
  scoreboard,
} from './foresight';
export {
  DEFAULT_ATTENTION,
  isQuietTime,
  localDayKey,
  localMinutes,
  planDelivery,
  quietHoursEnd,
} from './governor';
export { KEEP_GUEST_HEADER } from './headers';
export {
  clampMetric,
  type DayLog,
  formatSchedule,
  HEALTH_METRICS,
  type HealthMetric,
  type HealthWeek,
  healthWeek,
  METRIC_BOUNDS,
  nextOccurrence,
  parseSchedule,
  REMINDER_IDEAS,
  REMINDER_REPEATS,
  type ReminderIdea,
  type ReminderRepeat,
  type ReminderSchedule,
  zonedTime,
} from './health';
export { isUuid, newId } from './ids';
export {
  LEGAL_UPDATED,
  MINIMUM_AGE,
  PRIVACY_POLICY_VERSION,
  UNCONFIRMED_ACCOUNT_DAYS,
} from './legal';
export {
  addDays,
  JOURNAL_PROMPTS,
  type JournalPrompt,
  localDate,
  MOOD_TAGS,
  type MoodPoint,
  type MoodSummary,
  type MoodTag,
  moodSummary,
  weekStartOf,
} from './mind';
export {
  conservativeIncome,
  formatMoney,
  MONEY_SUGGESTIONS,
  type MoneySuggestionId,
  type Period,
  runway,
  toMonthly,
} from './money';
export {
  COUNT_AFTER_DAYS,
  type CountMargin,
  type CountNoise,
  canManage,
  effectiveK,
  formatJoinCode,
  type InsightOptions,
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  K_ANON_CEILING,
  K_ANON_FLOOR,
  laplaceNoise,
  MARGIN_MAX,
  marginFrom,
  newJoinCode,
  normalizeJoinCode,
  ORG_KINDS,
  ORG_ROLES,
  ORG_SIZE_BANDS,
  type OrgKind,
  type OrgRole,
  type OrgSizeBand,
  orgSlug,
  type ProgrammeCounts,
  type ProgrammeInsights,
  participantCount,
  programmeInsights,
  roundDownCount,
  type SafeCount,
  sameTargets,
} from './org';
export {
  draftPlan,
  hoursToClose,
  type PathData,
  PLAN_TEMPLATES_EN,
  type PlanNames,
  type PlanTemplates,
  pickResource,
  type RoleReason,
  renderPlanText,
  suggestRoles,
} from './path';
export { isInternalPath, safeExternalHref, safeNextPath } from './paths';
export {
  type AiOpinion,
  adviceFor,
  analyzeUrl,
  checkMessage,
  extractUrls,
  LEVEL_ORDER,
  levelFromScore,
  localizeShieldResult,
  mergeAiOpinion,
  SHIELD_RULES_VERSION,
} from './shield';
export {
  type Advice,
  type AdviceId,
  type Air,
  type AqiLevel,
  advise,
  airUrl,
  aqiLevel,
  forecastUrl,
  geocodeUrl,
  type HeatLevel,
  heatLevel,
  OPEN_METEO,
  type Place,
  parseAir,
  parseForecast,
  parseGeocoding,
  roundCoord,
  toFahrenheit,
  toMph,
  type UvLevel,
  upcomingHours,
  usesFahrenheit,
  uvLevel,
  type Weather,
  type WeatherKind,
  weatherKind,
} from './surroundings';
export { detectLanguage, detectScript, foldText, normalizeText, unleet } from './text/normalize';
export * from './types';
