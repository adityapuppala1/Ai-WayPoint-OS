/**
 * @waypoint/content — curated, sourced reference data and lookup helpers.
 *
 * Lookups always fall back to global (`ZZ`) data so every person, anywhere, gets
 * something useful; country-specific entries come first when they exist.
 */
import { CIVIC_CHECKLISTS, GOV_PORTALS } from './civic';
import { COUNTRIES } from './countries';
import { EMERGENCY_NUMBERS } from './emergency';
import { HEALTH_LINES, HEALTH_SOURCES } from './health';
import { GLOBAL, normalizeCountry } from './lookup';
import { LEARNING_RESOURCES } from './resources';
import { ROLES } from './roles';
import { SCAM_PATTERNS, SCAM_REPORT_CHANNELS } from './scams';
import { SKILLS } from './skills';
import { SUPPORT_RESOURCES } from './support';
import type {
  CivicChecklist,
  GovPortal,
  HealthLine,
  LearningResource,
  LifeEvent,
  ResourceCost,
  Role,
  ScamCategory,
  ScamPattern,
  ScamReportChannel,
  Skill,
} from './types';

export {
  type SupportDirectoryView,
  type SupportResourceView,
  supportDirectory,
  toView as supportResourceView,
} from './directory';
export {
  CONTENT_NAMES,
  localizeRole,
  localizeSkill,
  type NamesText,
  roleFamily,
  roleTitle,
  skillName,
} from './l10n';
export {
  countryFromTimeZone,
  GLOBAL,
  getCountry,
  getEmergency,
  getSupportResources,
  normalizeCountry,
} from './lookup';
export { CALLING_CODES, toInternational, whatsappLink } from './phone';
export * from './types';
export {
  CIVIC_CHECKLISTS,
  COUNTRIES,
  EMERGENCY_NUMBERS,
  GOV_PORTALS,
  HEALTH_LINES,
  HEALTH_SOURCES,
  LEARNING_RESOURCES,
  ROLES,
  SCAM_PATTERNS,
  SCAM_REPORT_CHANNELS,
  SKILLS,
  SUPPORT_RESOURCES,
};

/** Non-emergency health advice services for a country (only ones checked against a source). */
export function getHealthLines(code?: string | null): HealthLine[] {
  const c = normalizeCountry(code);
  return c ? HEALTH_LINES.filter((l) => l.country === c) : [];
}

export function getReportChannels(code?: string | null): ScamReportChannel[] {
  const c = normalizeCountry(code);
  const local = c ? SCAM_REPORT_CHANNELS.filter((r) => r.country === c) : [];
  const global = SCAM_REPORT_CHANNELS.filter((r) => r.country === GLOBAL);
  return [...local, ...global];
}

export function getScamPatterns(
  filter: { category?: ScamCategory; country?: string | null } = {},
): ScamPattern[] {
  const c = normalizeCountry(filter.country);
  return SCAM_PATTERNS.filter((p) => !filter.category || p.category === filter.category).sort(
    (a, b) => {
      const aLocal = c && a.regions?.includes(c) ? 0 : 1;
      const bLocal = c && b.regions?.includes(c) ? 0 : 1;
      return aLocal - bLocal;
    },
  );
}

export function getScamPattern(id: string): ScamPattern | undefined {
  return SCAM_PATTERNS.find((p) => p.id === id);
}

/**
 * The checklist for a life event: the country-specific version when one exists
 * (with generic items it doesn't already cover appended), otherwise the generic one.
 */
export function getChecklist(event: LifeEvent, code?: string | null): CivicChecklist | undefined {
  const c = normalizeCountry(code);
  const generic = CIVIC_CHECKLISTS.find((x) => x.event === event && x.country === GLOBAL);
  const local = c ? CIVIC_CHECKLISTS.find((x) => x.event === event && x.country === c) : undefined;
  if (!local) return generic;
  if (!generic) return local;
  const have = new Set(local.items.map((i) => i.id));
  return {
    ...local,
    items: [...local.items, ...generic.items.filter((i) => !have.has(i.id))],
    sources: [...local.sources, ...generic.sources],
  };
}

export function listLifeEvents(): LifeEvent[] {
  return [...new Set(CIVIC_CHECKLISTS.filter((x) => x.country === GLOBAL).map((x) => x.event))];
}

export function getGovPortals(code?: string | null): GovPortal[] {
  const c = normalizeCountry(code);
  return c ? GOV_PORTALS.filter((p) => p.country === c) : [];
}

const skillIndex = new Map<string, Skill>();
const roleIndex = new Map<string, Role>();

export function getSkill(id: string): Skill | undefined {
  if (skillIndex.size !== SKILLS.length) {
    skillIndex.clear();
    for (const s of SKILLS) skillIndex.set(s.id, s);
  }
  return skillIndex.get(id);
}

export function getRole(id: string): Role | undefined {
  if (roleIndex.size !== ROLES.length) {
    roleIndex.clear();
    for (const r of ROLES) roleIndex.set(r.id, r);
  }
  return roleIndex.get(id);
}

const COST_ORDER: Record<ResourceCost, number> = {
  free: 0,
  'free-audit': 1,
  'low-cost': 2,
  paid: 3,
};

/**
 * Learning resources that teach any of the given skills, ranked by: skill coverage,
 * language match, regional relevance, then lowest cost.
 */
export function getResourcesForSkills(
  skillIds: string[],
  opts: {
    budget?: 'free' | 'low' | 'any';
    languages?: string[];
    country?: string | null;
    limit?: number;
  } = {},
): LearningResource[] {
  const want = new Set(skillIds);
  const c = normalizeCountry(opts.country);
  const langs = (opts.languages ?? ['en']).map((l) => l.toLowerCase().split('-')[0]);
  const maxCost = opts.budget === 'free' ? 1 : opts.budget === 'low' ? 2 : 3;
  const scored = LEARNING_RESOURCES.filter((r) => COST_ORDER[r.cost] <= maxCost)
    .map((r) => {
      const coverage = r.skills.filter((s) => want.has(s)).length;
      const lang = r.languages.some((l) => langs.includes(l.toLowerCase().split('-')[0])) ? 1 : 0;
      const local = c && r.regions?.includes(c) ? 1 : 0;
      return { r, score: coverage * 10 + lang * 4 + local * 3 - COST_ORDER[r.cost] };
    })
    .filter((x) => x.score >= 10);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, opts.limit ?? 20).map((x) => x.r);
}
