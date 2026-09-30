/**
 * Content contracts.
 *
 * Everything in @waypoint/content is curated, sourced reference data that ships with the
 * code (versioned and reviewed like code) rather than living in the database. Every
 * factual record carries `sources` with the URL it was checked against and the date.
 * Crisis and emergency data is safety-critical: never add a number that has not been
 * checked against an official or primary source.
 */

/** ISO 3166-1 alpha-2, upper case. `ZZ` means "global / applies anywhere". */
export type CountryCode = string;

/** BCP-47 language subtag, e.g. `en`, `hi`, `sw`, `pt-BR`. */
export type LanguageTag = string;

export interface SourceRef {
  url: string;
  title: string;
  /** ISO date (YYYY-MM-DD) the fact was last checked against this source. */
  checkedAt: string;
}

// ───────────────────────────── Countries ─────────────────────────────

export interface CountryProfile {
  code: CountryCode;
  name: string;
  /** Primary languages people use for services, most common first. */
  languages: LanguageTag[];
  currency: string; // ISO 4217
  /** Region grouping used for defaults (not a political statement). */
  region:
    | 'south-asia'
    | 'east-asia'
    | 'southeast-asia'
    | 'middle-east-north-africa'
    | 'sub-saharan-africa'
    | 'europe'
    | 'north-america'
    | 'latin-america-caribbean'
    | 'oceania'
    | 'central-asia';
}

export interface EmergencyNumbers {
  country: CountryCode;
  /** The single number to tell someone to call first, if one exists (e.g. 112, 911). */
  general?: string;
  police?: string;
  ambulance?: string;
  fire?: string;
  notes?: string;
  sources: SourceRef[];
}

// ─────────────────────────── Support & crisis ───────────────────────────

export type SupportKind =
  | 'crisis-line' // suicide / emotional crisis
  | 'text-line'
  | 'chat'
  | 'mental-health' // non-crisis mental health support line
  | 'domestic-violence'
  | 'child-helpline'
  | 'elder-abuse'
  | 'poison'
  | 'directory'; // e.g. a verified global directory of helplines

export interface SupportResource {
  /** Stable slug, e.g. `in-tele-manas`. Never reuse an id for a different service. */
  id: string;
  country: CountryCode;
  kind: SupportKind;
  name: string;
  /** Dialable string exactly as a person would type it locally, e.g. `14416`, `988`. */
  phone?: string;
  /** Number to send a text/SMS to, if the service offers text support. */
  sms?: string;
  /** Short keyword to text, if the service needs one (e.g. `HOME`). */
  smsKeyword?: string;
  /** WhatsApp number as published by the service (local or international format). */
  whatsapp?: string;
  url?: string;
  /** Human-readable availability, e.g. `24/7` or `Mon–Fri 10:00–18:00 local`. */
  hours?: string;
  languages?: LanguageTag[];
  /** True when calls are free of charge from local phones, if known. */
  free?: boolean;
  /** Who it is for, in one short sentence. */
  audience?: string;
  sources: SourceRef[];
}

// ─────────────────────────────── Health ───────────────────────────────

/**
 * A national, non-emergency health advice service: a nurse line or an out-of-hours doctor
 * service that helps people decide where to get care. Same rules as support services:
 * only official or primary sources, never guessed.
 */
export interface HealthLine {
  id: string;
  country: CountryCode;
  name: string;
  phone?: string;
  url?: string;
  hours?: string;
  free?: boolean;
  languages?: LanguageTag[];
  /** What it is for, in one short sentence. */
  audience: string;
  /** Anything people need to know, e.g. regional names. */
  notes?: string;
  sources: SourceRef[];
}

// ─────────────────────────────── Scams ───────────────────────────────

export type ScamCategory =
  | 'job'
  | 'bank-kyc'
  | 'delivery'
  | 'investment'
  | 'crypto'
  | 'lottery-prize'
  | 'romance'
  | 'sextortion'
  | 'tech-support'
  | 'impersonation-authority'
  | 'digital-arrest'
  | 'loan-app'
  | 'utility-disconnection'
  | 'tax-refund'
  | 'government-scheme'
  | 'family-emergency'
  | 'marketplace'
  | 'rental'
  | 'charity'
  | 'phishing-link'
  | 'sim-swap-otp'
  | 'qr-code'
  | 'deepfake-voice'
  | 'other';

export interface ScamPattern {
  id: string;
  category: ScamCategory;
  /** Plain-language name, sentence case, e.g. `Pay-to-work job offers`. */
  title: string;
  /** 2–3 sentences: how it works, from the victim's point of view. */
  howItWorks: string;
  /** 3–6 concrete red flags a person can spot. */
  redFlags: string[];
  /** 2–4 things to do, in order. */
  whatToDo: string[];
  /** Countries where this is especially common. Empty/undefined = global. */
  regions?: CountryCode[];
  sources: SourceRef[];
}

export interface ScamReportChannel {
  country: CountryCode;
  name: string;
  phone?: string;
  url?: string;
  /** One sentence on when/why to use it. */
  what: string;
  /** True if reporting quickly improves the chance of recovering money (e.g. India 1930). */
  timeCritical?: boolean;
  sources: SourceRef[];
}

// ───────────────────────── Civic life events ─────────────────────────

export type LifeEvent =
  | 'job-loss'
  | 'first-job'
  | 'moving-country'
  | 'moving-city'
  | 'new-baby'
  | 'bereavement'
  | 'retirement'
  | 'disability'
  | 'serious-illness'
  | 'starting-business'
  | 'disaster';

export type Urgency = 'now' | 'this-week' | 'this-month' | 'later';

export interface ChecklistLink {
  label: string;
  url: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  /** One or two sentences. Plain language. */
  detail: string;
  urgency: Urgency;
  links?: ChecklistLink[];
}

export interface CivicChecklist {
  event: LifeEvent;
  /** `ZZ` for the generic, works-anywhere checklist. */
  country: CountryCode;
  title: string;
  intro: string;
  items: ChecklistItem[];
  sources: SourceRef[];
}

/** Official "front doors" to government services per country. */
export interface GovPortal {
  country: CountryCode;
  name: string;
  url: string;
  what: string;
  sources: SourceRef[];
}

// ─────────────────────────── Skills & roles ───────────────────────────

export type SkillCategory =
  | 'foundational'
  | 'digital'
  | 'data'
  | 'ai'
  | 'software'
  | 'communication'
  | 'business'
  | 'finance'
  | 'care'
  | 'trades'
  | 'green'
  | 'creative'
  | 'language'
  | 'agriculture';

export interface Skill {
  id: string; // kebab-case slug, e.g. `spreadsheet-analysis`
  name: string;
  category: SkillCategory;
  description: string;
}

export type AiExposure = 'low' | 'medium' | 'high';

export interface Role {
  id: string;
  title: string;
  family: string; // e.g. `Data & analytics`
  summary: string;
  /** Skill ids, most important first. */
  skills: string[];
  /** Typical ways people enter the role, e.g. `Portfolio of 3 projects`, `Apprenticeship`. */
  entryPaths: string[];
  /**
   * How exposed the role's tasks are to generative AI, per published research (e.g. ILO).
   * Exposure is not the same as job loss: many exposed roles are augmented, not replaced.
   */
  aiExposure: AiExposure;
  aiNote: string;
  sources: SourceRef[];
}

export type ResourceCost = 'free' | 'free-audit' | 'low-cost' | 'paid';
export type ResourceFormat =
  | 'course'
  | 'guide'
  | 'practice'
  | 'video'
  | 'book'
  | 'tool'
  | 'community';

export interface LearningResource {
  id: string;
  title: string;
  provider: string;
  url: string;
  /** Skill ids this resource teaches. */
  skills: string[];
  cost: ResourceCost;
  hours?: number;
  languages: LanguageTag[];
  format: ResourceFormat;
  /** Countries where it is especially relevant (e.g. national skilling portals). */
  regions?: CountryCode[];
  checkedAt: string;
}
