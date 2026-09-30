/**
 * Translated names for content: skills, roles and role families. Longer content (descriptions,
 * checklists, the scam library) is English for now and translated by people, not machines,
 * before it ships — see docs/ROADMAP.md. Anything missing falls back to English by id.
 */
import { ROLES } from '../roles';
import { SKILLS } from '../skills';
import type { Role, Skill } from '../types';
import { ar } from './ar';
import { es } from './es';
import { fr } from './fr';
import { hi } from './hi';
import { pt } from './pt';
import { sw } from './sw';

export interface NamesText {
  skills: Record<string, string>;
  roles: Record<string, string>;
  /** Keyed by the English family name, e.g. `Data & analytics`. */
  families: Record<string, string>;
}

export const CONTENT_NAMES: Record<string, NamesText> = { hi, es, fr, pt, ar, sw };

const names = (locale?: string | null): NamesText | undefined =>
  locale ? CONTENT_NAMES[locale] : undefined;

export function skillName(id: string, locale?: string | null): string {
  return names(locale)?.skills[id] ?? SKILLS.find((s) => s.id === id)?.name ?? id;
}

export function roleTitle(id: string, locale?: string | null): string {
  return names(locale)?.roles[id] ?? ROLES.find((r) => r.id === id)?.title ?? id;
}

export function roleFamily(family: string, locale?: string | null): string {
  return names(locale)?.families[family] ?? family;
}

/** A copy of the skill with its name in the locale (description stays English for now). */
export function localizeSkill<T extends Skill>(skill: T, locale?: string | null): T {
  const n = names(locale);
  return n ? { ...skill, name: n.skills[skill.id] ?? skill.name } : skill;
}

/** A copy of the role with its title and family in the locale. */
export function localizeRole<T extends Role>(role: T, locale?: string | null): T {
  const n = names(locale);
  return n
    ? {
        ...role,
        title: n.roles[role.id] ?? role.title,
        family: n.families[role.family] ?? role.family,
      }
    : role;
}
