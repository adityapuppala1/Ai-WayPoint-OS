/**
 * Getting started keeps what has been answered so far in this tab (sessionStorage), so a
 * refresh, a swipe back or a phone that reloads the page does not lose it. It is never put in
 * the address and never sent anywhere. Finishing removes it, quick exit removes it (it clears
 * everything this tab stored), and closing the tab removes it.
 *
 * Every access is guarded: storage can be missing or blocked (private windows, strict
 * settings), and then getting started works as it did before, without the safety net.
 */
export const DRAFT_KEY = 'wp-start-draft';

export interface OnboardingDraft {
  step: number;
  name: string;
  country: string;
  situation: string | null;
  lifeStage: string | null;
  workType: string | null;
  picked: Array<{ skillId: string; level: number }>;
  hours: number;
  budget: string;
  attention: string;
  consents: Record<string, boolean>;
}

/** What is allowed in each answer, so a stale or edited draft can never put in anything else. */
export interface DraftLimits {
  steps: number;
  countries: ReadonlySet<string>;
  situations: readonly string[];
  lifeStages: readonly string[];
  workTypes: readonly string[];
  skills: ReadonlySet<string>;
  consents: readonly string[];
}

const BUDGETS = ['free', 'low', 'any'];
const ATTENTION = ['0', '1', '2', '3'];

const oneOf = (value: unknown, allowed: readonly string[]): string | null | undefined =>
  value === null ? null : typeof value === 'string' && allowed.includes(value) ? value : undefined;

/**
 * The answers kept in this tab, or null when there are none. Each answer is checked against
 * what the form itself allows; one that does not fit is left out and the form keeps its own
 * starting value for it.
 */
export function readDraft(limits: DraftLimits): Partial<OnboardingDraft> | null {
  let raw: unknown;
  try {
    const stored = window.sessionStorage.getItem(DRAFT_KEY);
    if (!stored) return null;
    raw = JSON.parse(stored);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  const out: Partial<OnboardingDraft> = {};

  if (Number.isInteger(d.step) && (d.step as number) >= 0 && (d.step as number) < limits.steps)
    out.step = d.step as number;
  if (typeof d.name === 'string') out.name = d.name.slice(0, 60);
  if (typeof d.country === 'string' && (d.country === '' || limits.countries.has(d.country)))
    out.country = d.country;

  const situation = oneOf(d.situation, limits.situations);
  if (situation !== undefined) out.situation = situation;
  const lifeStage = oneOf(d.lifeStage, limits.lifeStages);
  if (lifeStage !== undefined) out.lifeStage = lifeStage;
  const workType = oneOf(d.workType, limits.workTypes);
  if (workType !== undefined) out.workType = workType;

  if (Array.isArray(d.picked)) {
    const seen = new Set<string>();
    out.picked = [];
    for (const item of d.picked as Array<Record<string, unknown> | null>) {
      const id = item?.skillId;
      const level = item?.level;
      if (typeof id !== 'string' || !limits.skills.has(id) || seen.has(id)) continue;
      if (!Number.isInteger(level) || (level as number) < 1 || (level as number) > 4) continue;
      seen.add(id);
      out.picked.push({ skillId: id, level: level as number });
    }
  }

  if (Number.isInteger(d.hours) && (d.hours as number) >= 1 && (d.hours as number) <= 20)
    out.hours = d.hours as number;
  if (typeof d.budget === 'string' && BUDGETS.includes(d.budget)) out.budget = d.budget;
  if (typeof d.attention === 'string' && ATTENTION.includes(d.attention))
    out.attention = d.attention;

  if (d.consents && typeof d.consents === 'object') {
    const given = d.consents as Record<string, unknown>;
    out.consents = Object.fromEntries(limits.consents.map((c) => [c, given[c] === true]));
  }
  return out;
}

export function writeDraft(draft: OnboardingDraft): void {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage full or blocked: the answers stay on the page for this visit.
  }
}

export function clearDraft(): void {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing was kept, so there is nothing to remove.
  }
}
