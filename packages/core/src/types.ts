/**
 * Core domain contracts shared by the API, AI gateway, web and mobile apps.
 * Pure types only — no runtime imports here.
 */
import type {
  CountryCode,
  LanguageTag,
  ScamCategory,
  ScamReportChannel,
  SupportResource,
} from '@waypoint/content/types';

// ─────────────────────────────── Modules ───────────────────────────────

export const MODULE_IDS = [
  'today',
  'path', // Earn + Learn: career compass, plans, skills, projects, work passport
  'shield', // Safety & security: Scam Shield, safety resources
  'circles', // Social & belonging
  'ask', // Conversational guide
  'signals', // Foresight: signals, forecasts, accuracy scoreboard
  'money', // Wealth
  'mind', // Peace & purpose
  'health', // Health (non-diagnostic)
  'civic', // Government services & life events
  'surroundings', // Weather, air, local conditions
  'goals', // Purpose & goals, weekly review
  'org', // Organisation console
] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export const LOCALES = ['en', 'hi', 'es', 'fr', 'pt', 'ar', 'sw'] as const;
export type Locale = (typeof LOCALES)[number];

// ─────────────────────────── People & situations ───────────────────────────

export const LIFE_STAGES = [
  'teen',
  'student',
  'early-career',
  'mid-career',
  'late-career',
  'retired',
  'prefer-not',
] as const;
export type LifeStage = (typeof LIFE_STAGES)[number];

export const SITUATIONS = [
  'first-job', // looking for a first job
  'lost-job', // recently lost work
  'changing-career',
  'studying',
  'running-business',
  'gig-work',
  'caring', // caring for someone
  'new-country',
  'retiring',
  'health-change',
  'steady', // nothing major, want to grow
] as const;
export type Situation = (typeof SITUATIONS)[number];

export const WORK_TYPES = [
  'salaried',
  'gig',
  'freelance',
  'business-owner',
  'unemployed',
  'caregiver',
  'student',
  'retired',
] as const;
export type WorkType = (typeof WORK_TYPES)[number];

// ─────────────────────────────── Consent ───────────────────────────────

/** Purpose-specific, revocable consents. Nothing optional is on by default. */
export const CONSENT_PURPOSES = [
  'personalization', // use my profile to tailor plans and Today
  'memory', // remember facts I share in conversations
  'ai_external', // send redacted text to external AI providers
  'foresight_matching', // match signals and forecasts to my situation
  'circle_matching', // suggest peer circles based on my situation
  'org_aggregates', // count me in my organisation's anonymous aggregate stats
  'research_aggregates', // include me in anonymised public trend reports
  'trusted_contact', // alert my trusted contact if I appear to be in danger
] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

// ─────────────────────────────── Crisis ───────────────────────────────

/** 0 none · 1 distress · 2 self-harm/suicidal thoughts · 3 imminent danger */
export type CrisisTier = 0 | 1 | 2 | 3;

export type CrisisCategory =
  | 'distress'
  | 'self-harm'
  | 'suicidal-ideation'
  | 'suicidal-plan'
  | 'violence-risk'
  | 'abuse'
  | 'medical-emergency';

export interface CrisisAssessment {
  tier: CrisisTier;
  categories: CrisisCategory[];
  /** Rule ids that fired. Never raw user text. */
  matched: string[];
  /** Detected language subtag of the input (best effort). */
  language: string;
  /** Heuristic confidence 0..1. */
  confidence: number;
  /** True when the person is worried about someone else ("my friend wants to die"). */
  aboutOther: boolean;
}

export type CrisisActionKind =
  | 'emergency'
  | 'call'
  | 'text'
  | 'chat'
  | 'web'
  | 'trusted-contact'
  | 'grounding'
  | 'circle'
  | 'stay';

export interface CrisisAction {
  kind: CrisisActionKind;
  label: string;
  /** tel:, sms: or https: link when applicable. */
  href?: string;
  resourceId?: string;
}

export interface CrisisResponsePlan {
  tier: CrisisTier;
  categories: CrisisCategory[];
  locale: Locale;
  headline: string;
  message: string;
  actions: CrisisAction[];
  resources: SupportResource[];
  emergencyNumber?: string;
  /** Hours until a gentle follow-up check-in, or null for none. */
  followUpHours: number | null;
  /** When true the AI must switch to the safest model/prompt and keep turns short. */
  safeMode: boolean;
  /** When true, do not continue generating an open-ended AI reply this turn. */
  suppressAiReply: boolean;
}

// ─────────────────────────────── Scam Shield ───────────────────────────────

export type RiskLevel = 'low' | 'unclear' | 'high' | 'very-high';

export type UrlFlag =
  | 'shortener'
  | 'ip-host'
  | 'punycode'
  | 'lookalike'
  | 'suspicious-tld'
  | 'insecure-http'
  | 'many-subdomains'
  | 'at-sign'
  | 'very-long'
  | 'data-uri'
  | 'messaging-redirect'
  | 'file-download'
  | 'free-hosting';

export interface UrlFinding {
  url: string;
  host: string;
  flags: UrlFlag[];
  /** The legitimate brand/domain the host imitates, when detected. */
  lookalikeOf?: string;
}

export type ShieldSignalKind =
  | 'pressure'
  | 'payment'
  | 'credentials'
  | 'link'
  | 'sender'
  | 'too-good'
  | 'secrecy'
  | 'authority'
  | 'channel-switch'
  | 'category';

export interface ShieldSignal {
  id: string;
  kind: ShieldSignalKind;
  category?: ScamCategory;
  weight: number;
  /** Short, plain-language title, e.g. `Asks you to pay before you can work`. */
  title: string;
  /** One sentence on why this is a warning sign. */
  explanation: string;
}

export interface ShieldResult {
  level: RiskLevel;
  /** 0–100, higher = more likely a scam. */
  score: number;
  signals: ShieldSignal[];
  categories: ScamCategory[];
  urls: UrlFinding[];
  /** Ordered next steps for the person. */
  advice: string[];
  report: ScamReportChannel[];
  engine: { rules: string; ai?: { model: string; level: RiskLevel; agreed: boolean } };
}

export interface ShieldInput {
  text: string;
  kind?: 'message' | 'url' | 'phone' | 'email';
  country?: CountryCode;
  locale?: Locale;
}

// ─────────────────────────────── Foresight ───────────────────────────────

export interface ResolvedForecast {
  p: number; // predicted probability 0..1
  outcome: 0 | 1;
}

export interface CalibrationBucket {
  from: number;
  to: number;
  n: number;
  meanPredicted: number;
  observed: number;
}

export type ProbabilityWord =
  | 'remote'
  | 'very-unlikely'
  | 'unlikely'
  | 'about-even'
  | 'likely'
  | 'very-likely'
  | 'almost-certain';

export interface RelevanceProfile {
  country?: CountryCode;
  region?: string;
  lifeStage?: LifeStage;
  situation?: Situation;
  sectors: string[];
  skills: string[];
  roles: string[];
}

export interface TaggedItem {
  regions: string[]; // country codes, region ids or 'ZZ'
  sectors: string[];
  skills: string[];
  lifeStages: string[];
  situations: string[];
}

// ─────────────────────────────── Governor ───────────────────────────────

export type NudgePriority = 'critical' | 'high' | 'normal' | 'low';

export interface Nudge {
  id: string;
  module: ModuleId;
  priority: NudgePriority;
  title: string;
  body?: string;
  href?: string;
  createdAt: Date;
  expiresAt?: Date;
  /** Nudges with the same key are merged; the newest wins. */
  dedupeKey?: string;
}

export interface AttentionPrefs {
  /** Proactive messages per day. 0 = only safety-critical. */
  budgetPerDay: 0 | 1 | 2 | 3;
  quietHours?: { start: string; end: string }; // 'HH:MM' local
  timezone: string; // IANA
}

export interface DeliveryPlan {
  deliverNow: Nudge[];
  defer: Nudge[];
  drop: Nudge[];
  reason: 'within-budget' | 'budget-exhausted' | 'quiet-hours' | 'nothing-to-send';
}

// ─────────────────────────────── Money ───────────────────────────────

export interface RunwayInput {
  currency: string;
  monthlyIncome: number;
  essentialExpenses: number;
  otherExpenses: number;
  savings: number;
  debtMonthly: number;
}

export type MoneyStress = 'stable' | 'watch' | 'tight' | 'critical';

export interface RunwayResult {
  /** Months savings last at the current gap; null = not drawing down savings. */
  monthsOfRunway: number | null;
  /** Income minus all outgoings (negative = shortfall). */
  monthlyGap: number;
  /** Months of essential spending covered by savings alone. */
  essentialsCoverMonths: number | null;
  debtToIncome: number | null;
  stress: MoneyStress;
  suggestions: Array<{ id: string; title: string; detail: string }>;
}

// ─────────────────────────────── Path ───────────────────────────────

export type SkillLevel = 0 | 1 | 2 | 3 | 4; // none · aware · basic · working · strong

export type StepKind = 'learn' | 'build' | 'connect' | 'apply' | 'reflect';

export interface PathInput {
  currentRole?: string;
  targetRoleId?: string;
  skills: Array<{ skillId: string; level: SkillLevel }>;
  interests: string[]; // skill categories or role families
  hoursPerWeek: number;
  horizonWeeks: 4 | 8 | 12;
  situation: Situation;
  country?: CountryCode;
  languages: LanguageTag[];
  budget: 'free' | 'low' | 'any';
}

export interface RoleSuggestion {
  roleId: string;
  fit: number; // 0..1
  reasons: string[];
  missingSkills: string[];
}

/**
 * A value inside planner text. Ids (not names) are kept so the text can be written again in
 * whichever language the person reads it in later.
 */
export type PlanTextVar =
  | string
  | number
  | { skill: string }
  | { role: string }
  /** A list of skill ids, joined in the reader's language; `fallback` when the list is empty. */
  | { skills: string[]; fallback?: 'titleGeneral' }
  | { template: 'titleGeneral' };

/** Planner text as a template key plus variables, so it can be rendered in any language. */
export interface PlanText {
  key: string;
  vars?: Record<string, PlanTextVar>;
}

export interface PlanStepDraft {
  kind: StepKind;
  title: string;
  detail: string;
  minutes: number;
  resourceId?: string;
  skillIds: string[];
  /** In-app link for the step, e.g. `/circles` or `/civic/job-loss`. */
  href?: string;
  /** How the planner wrote `title` and `detail` (absent once AI has reworded them). */
  text?: { title: PlanText; detail: PlanText };
}

export interface PlanDraft {
  title: string;
  summary: string;
  targetRoleId?: string;
  weeks: Array<{ week: number; focus: string; steps: PlanStepDraft[] }>;
  gaps: Array<{ skillId: string; from: SkillLevel; to: SkillLevel }>;
  generatedBy: 'template' | 'ai';
  /** How the planner wrote `title` and `summary` (absent once AI has reworded them). */
  text?: { title: PlanText; summary: PlanText };
}

// ─────────────────────────────── Credentials ───────────────────────────────

export interface UnsignedCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string | { id: string; name?: string };
  validFrom: string;
  validUntil?: string;
  credentialSubject: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DataIntegrityProof {
  type: 'DataIntegrityProof';
  cryptosuite: 'eddsa-jcs-2022';
  created: string;
  verificationMethod: string;
  proofPurpose: 'assertionMethod';
  proofValue: string;
}

export type SignedCredential = UnsignedCredential & { proof: DataIntegrityProof };
