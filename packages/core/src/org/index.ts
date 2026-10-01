/**
 * Organisations: employers, schools, NGOs, public services and community groups that run
 * programmes for their people (a reskilling cohort, a school leavers' year, a newcomers'
 * programme). Pure helpers, safe in the browser.
 *
 * The privacy rule behind everything here: an organisation sees totals for groups of at
 * least k people who agreed to be counted — never a person, never a list, never anything
 * from Mind, Health, Money, Circles, Ask or Shield.
 */
import { suppressSmallGroups } from '../privacy/anonymity';

export const ORG_KINDS = ['employer', 'school', 'ngo', 'government', 'community'] as const;
export type OrgKind = (typeof ORG_KINDS)[number];

export const ORG_SIZE_BANDS = ['1-49', '50-249', '250-999', '1000-4999', '5000+'] as const;
export type OrgSizeBand = (typeof ORG_SIZE_BANDS)[number];

/** owner: everything · admin: programmes, team and settings · member: read only. */
export const ORG_ROLES = ['owner', 'admin', 'member'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

/** Roles that can change programmes, the team and settings. */
export const canManage = (role: string | null | undefined): boolean =>
  role === 'owner' || role === 'admin';

/** No organisation can ever see a group smaller than this, whatever it or the server asks. */
export const K_ANON_FLOOR = 20;
/** The most an organisation can raise its own threshold to (beyond this nothing would show). */
export const K_ANON_CEILING = 1000;

/** The group size used for an organisation: the largest of the floor and every setting given. */
export function effectiveK(...settings: Array<number | null | undefined>): number {
  let k = K_ANON_FLOOR;
  for (const s of settings) if (typeof s === 'number' && Number.isFinite(s) && s > k) k = s;
  return Math.min(Math.round(k), K_ANON_CEILING);
}

/**
 * Letters and digits that cannot be confused when read aloud, printed on a poster or typed on
 * a phone keypad: no I, L, O, 0 or 1.
 */
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_LENGTH = 8;

/** A new random join code (8 characters, about 40 bits), e.g. `K7QM3WXA`. */
export function newJoinCode(
  random: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array = defaultRandom,
): string {
  const n = JOIN_CODE_ALPHABET.length;
  // Rejection sampling keeps every character equally likely.
  const limit = 256 - (256 % n);
  let out = '';
  while (out.length < JOIN_CODE_LENGTH) {
    const bytes = random(new Uint8Array(16));
    for (const b of bytes) {
      if (b < limit) out += JOIN_CODE_ALPHABET[b % n];
      if (out.length === JOIN_CODE_LENGTH) break;
    }
  }
  return out;
}

function defaultRandom(bytes: Uint8Array<ArrayBuffer>): Uint8Array {
  return globalThis.crypto.getRandomValues(bytes);
}

/**
 * What someone typed or scanned, as a code to look up: spaces, dashes and case are ignored and
 * a full join link works too. Returns null when it cannot be a code.
 */
export function normalizeJoinCode(input: string | null | undefined): string | null {
  if (!input) return null;
  let raw = input.trim();
  // From a link, what follows its last /join/, without a query, a fragment or a final slash.
  // (Found by position: a pattern searched through what was pasted could take seconds.)
  const at = raw.lastIndexOf('/join/');
  if (at !== -1) {
    const rest = raw.slice(at + '/join/'.length).split(/[?#]/)[0] ?? '';
    const fromLink = rest.endsWith('/') ? rest.slice(0, -1) : rest;
    if (/^[A-Za-z0-9 -]+$/.test(fromLink)) raw = fromLink;
  }
  const code = raw.replace(/[\s-]/g, '').toUpperCase();
  return /^[A-Z0-9]{6,12}$/.test(code) ? code : null;
}

/** For display and printing: `K7QM-3WXA`. */
export function formatJoinCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/** Counts are shown rounded down to a multiple of 5, so one person joining is not visible. */
export function roundDownCount(n: number, step = 5): number {
  return Math.floor(Math.max(0, n) / step) * step;
}

/** A count an organisation may see: rounded, or hidden when the group is smaller than k. */
export interface SafeCount {
  /** Rounded down to a multiple of 5; null when fewer than k people. */
  value: number | null;
  k: number;
}

/**
 * People are counted from a week after they join. Accounts made to single someone out (join,
 * look, compare) have to wait a week before they make any difference, and so does everyone
 * else — the same rule for all.
 */
export const COUNT_AFTER_DAYS = 7;

export interface ProgrammeCounts {
  /** People enrolled for at least COUNT_AFTER_DAYS who chose to be counted in this programme. */
  counted: number;
  /** …of whom have an active plan in Path. */
  withPlan: number;
  /** …of whom finished at least one plan step in the last 30 days. */
  movedForward: number;
  /** …of whom are working towards one of the programme's target roles. */
  onTarget: number;
  /** People (counted) aiming for each role, from their active plans. */
  goals: Array<{ key: string; n: number }>;
  /** People (counted) building each skill, from the gaps in their active plans. */
  skills: Array<{ key: string; n: number }>;
  /** The target roles `onTarget` was counted against (they can change later). */
  targets?: string[];
}

export interface ProgrammeInsights {
  k: number;
  participants: SafeCount;
  /** Proportions rounded to 5 points; null when the group or either side of it is too small. */
  withPlan: number | null;
  movedForward: number | null;
  onTarget: number | null;
  goals: Array<{ key: string; n: number }>;
  skills: Array<{ key: string; n: number }>;
  /** True when groups were hidden to protect privacy. */
  goalsHidden: boolean;
  skillsHidden: boolean;
}

/**
 * Whole-number noise to add to a count, looked up by what is being counted (e.g. `counted`,
 * `goal:nurse`) and the true count itself. The server derives it from a keyed hash: the same
 * true number always gets the same noise, so neither reloading nor waiting for more weeks can
 * average it away, while any change in the number draws fresh noise.
 */
export type CountNoise = (key: string, value: number) => number;

/**
 * Extra people needed on top of k before a number appears (0 to MARGIN_MAX), looked up by the
 * same kind of key as the noise and fixed for a week. Nobody outside the server knows the exact
 * size at which a group becomes visible, so watching a number appear does not tell anyone that
 * the k-th person has just joined — or who that was.
 */
export type CountMargin = (key: string) => number;
export const MARGIN_MAX = 4;

/** A margin (0…MARGIN_MAX) from a uniform number in [0, 1). */
export function marginFrom(u: number): number {
  return Math.min(MARGIN_MAX, Math.max(0, Math.floor(u * (MARGIN_MAX + 1))));
}

/**
 * A Laplace-distributed sample from a uniform number in (0, 1), rounded to a whole number.
 * Scale 1.5 keeps 95% of samples within ±4 — invisible once counts are rounded to 5.
 */
export function laplaceNoise(u: number, scale = 1.5): number {
  const x = Math.min(Math.max(u, 1e-12), 1 - 1e-12) - 0.5;
  return Math.round(-scale * Math.sign(x) * Math.log(1 - 2 * Math.abs(x))) || 0;
}

const STEP = 0.05;

export interface InsightOptions {
  /** The programme has target roles, so `onTarget` means something. */
  hasTargets: boolean;
  /** The target roles changed since these counts were taken: `onTarget` waits for new counts. */
  targetsChanged?: boolean;
  topN?: number;
  noise?: CountNoise;
  margin?: CountMargin;
}

/**
 * Turn raw counts into what an organisation may see. Everything is computed from people who
 * chose to be counted. A number is shown only for a group of at least k people (plus a small
 * margin nobody outside the server knows); a proportion only when both the people it describes
 * and everyone else are such groups, so a few people — or a few accounts made for the purpose —
 * can never single someone out. The numbers shown carry a little noise and are rounded, and
 * lists are ordered by those rounded numbers, never by the exact counts behind them.
 */
export function programmeInsights(
  counts: ProgrammeCounts,
  k: number,
  opts: InsightOptions = { hasTargets: false },
): ProgrammeInsights {
  const topN = opts.topN ?? 8;
  const noise: CountNoise = opts.noise ?? (() => 0);
  const margin: CountMargin = opts.margin ?? (() => 0);
  const needed = (key: string) => k + Math.min(MARGIN_MAX, Math.max(0, margin(key)));
  const enough = counts.counted >= needed('counted');
  const shown = (n: number, key: string) => roundDownCount(Math.max(k, n + noise(key, n)));
  const denominator = Math.max(1, counts.counted + noise('counted', counts.counted));
  const rate = (n: number, key: string): number | null => {
    if (!enough) return null;
    const yes = Math.max(0, Math.min(n, counts.counted));
    if (yes < needed(`${key}:yes`) || counts.counted - yes < needed(`${key}:no`)) return null;
    const noisy = Math.min(
      denominator,
      Math.max(0, yes + noise(`${key}|of:${counts.counted}`, yes)),
    );
    const stepped = Math.round(noisy / denominator / STEP) * STEP;
    // Neither side was empty, so never show 0% or 100%.
    return Math.round(Math.min(1 - STEP, Math.max(STEP, stepped)) * 10_000) / 10_000;
  };
  const groups = (list: Array<{ key: string; n: number }>, prefix: string) => {
    if (!enough) return { items: [], hidden: list.length > 0 };
    const safe = suppressSmallGroups(list, k, (key) => needed(`${prefix}:${key}`));
    const items = safe
      .flatMap((g) => (g.suppressed ? [] : [{ key: g.key, n: shown(g.n, `${prefix}:${g.key}`) }]))
      .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key))
      .slice(0, topN);
    return { items, hidden: safe.some((g) => g.suppressed) };
  };
  const goals = groups(counts.goals, 'goal');
  const skills = groups(counts.skills, 'skill');
  return {
    k,
    participants: { value: enough ? shown(counts.counted, 'counted') : null, k },
    withPlan: rate(counts.withPlan, 'withPlan'),
    movedForward: rate(counts.movedForward, 'movedForward'),
    onTarget: opts.hasTargets && !opts.targetsChanged ? rate(counts.onTarget, 'onTarget') : null,
    goals: goals.items,
    skills: skills.items,
    goalsHidden: goals.hidden,
    skillsHidden: skills.hidden,
  };
}

/** The participant count for a list of programmes, with the same rules as the insights. */
export function participantCount(
  counted: number,
  k: number,
  noise?: CountNoise,
  margin?: CountMargin,
): SafeCount {
  const extra = Math.min(MARGIN_MAX, Math.max(0, margin?.('counted') ?? 0));
  if (counted < k + extra) return { value: null, k };
  return {
    value: roundDownCount(Math.max(k, counted + (noise ? noise('counted', counted) : 0))),
    k,
  };
}

/** Whether two lists of target roles are the same set. */
export function sameTargets(a: readonly string[] | undefined, b: readonly string[]): boolean {
  const left = new Set(a ?? []);
  const right = new Set(b);
  return left.size === right.size && [...left].every((x) => right.has(x));
}

/** A URL-safe slug for an organisation name, with a short random suffix for uniqueness. */
export function orgSlug(name: string, suffix: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return base ? `${base}-${suffix}` : `org-${suffix}`;
}
