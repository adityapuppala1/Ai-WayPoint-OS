/**
 * Organisations: employers, schools, NGOs, public services and community groups that run
 * programmes for their people — a reskilling cohort, a school leavers' year, a newcomers'
 * programme.
 *
 * What an organisation can see: its own programmes and team, and totals for groups of at least
 * k people who chose to be counted in that programme, rounded, with a little noise, taken once
 * a week and counting people from a week after they join. It never sees who joined, and never
 * anything from Mind, Health, Money, Circles, Ask or Shield. Organisations live in Better
 * Auth's tables (its own endpoints for them are switched off); Waypoint's own details are in
 * `org_profiles`.
 */
import { z } from '@hono/zod-openapi';
import { getRole, roleTitle, skillName } from '@waypoint/content';
import {
  COUNT_AFTER_DAYS,
  type CountMargin,
  type CountNoise,
  canManage,
  effectiveK,
  formatJoinCode,
  K_ANON_CEILING,
  K_ANON_FLOOR,
  type Locale,
  laplaceNoise,
  marginFrom,
  newJoinCode,
  normalizeJoinCode,
  ORG_KINDS,
  ORG_ROLES,
  ORG_SIZE_BANDS,
  type OrgRole,
  orgSlug,
  type ProgrammeCounts,
  participantCount,
  programmeInsights,
  sameTargets,
} from '@waypoint/core';
import { getEnv } from '@waypoint/core/env';
import { newId } from '@waypoint/core/ids';
import { hasWebAddress, plainName, sealWithKek } from '@waypoint/core/privacy';
import {
  and,
  asc,
  count,
  type Database,
  desc,
  enqueueMessage,
  eq,
  gt,
  inArray,
  invitations,
  lt,
  members,
  organizations,
  orgEnrolments,
  orgInsightSnapshots,
  orgProfiles,
  orgProgrammes,
  sql,
  users,
} from '@waypoint/db';
import { type Actor, audit } from '../lib/audit';
import { oneAtATime } from '../lib/locks';
import { ApiError, forbidden, notFound } from '../lib/problem';
import { keyedHash, keyedUniform, rateLimit } from '../lib/request';
import { getConsents, setConsents } from './me';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Organisations one person can own. */
export const ORG_LIMIT = 5;
export const PROGRAMME_LIMIT = 50;
export const TEAM_LIMIT = 500;
export const PENDING_INVITE_LIMIT = 100;
const INVITE_DAYS = 7;

// ─────────────────────────────── Schemas ───────────────────────────────

const Country = z.string().regex(/^[A-Z]{2}$/);
const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const RoleId = z
  .string()
  .max(60)
  .refine((id) => Boolean(getRole(id)), 'Choose roles from the list.');

/**
 * A name other people read — on the join page, a poster, an invitation email. It must not be
 * a way to send them to a website in Waypoint's name.
 */
const PublicName = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .refine((name) => !hasWebAddress(name), 'Please use a name without web addresses.');

export const OrgInputSchema = z
  .object({
    name: PublicName,
    kind: z.enum(ORG_KINDS),
    country: Country.nullish(),
    sizeBand: z.enum(ORG_SIZE_BANDS).nullish(),
  })
  .openapi('OrganisationInput');

export const OrgPatchSchema = z
  .object({
    name: PublicName.optional(),
    kind: z.enum(ORG_KINDS).optional(),
    country: Country.nullish(),
    sizeBand: z.enum(ORG_SIZE_BANDS).nullish(),
    /**
     * Raise the group size needed before any total is shown. It can never be lowered again
     * (and never goes below Waypoint's minimum): lowering it step by step would reveal exact
     * group sizes.
     */
    kAnonMin: z.number().int().min(K_ANON_FLOOR).max(K_ANON_CEILING).optional(),
  })
  .openapi('OrganisationPatch');

const programmeFields = {
  name: PublicName,
  description: z.string().trim().max(600).nullish(),
  targetRoleIds: z.array(RoleId).max(5),
  startsOn: DateOnly.nullish(),
  endsOn: DateOnly.nullish(),
};
const datesInOrder = (v: { startsOn?: string | null; endsOn?: string | null }) =>
  !v.startsOn || !v.endsOn || v.endsOn >= v.startsOn;

export const ProgrammeInputSchema = z
  .object({ ...programmeFields, targetRoleIds: programmeFields.targetRoleIds.default([]) })
  .refine(datesInOrder, { message: 'The end date must be after the start.', path: ['endsOn'] })
  .openapi('ProgrammeInput');

export const ProgrammePatchSchema = z
  .object({
    name: programmeFields.name.optional(),
    description: programmeFields.description,
    targetRoleIds: programmeFields.targetRoleIds.optional(),
    startsOn: programmeFields.startsOn,
    endsOn: programmeFields.endsOn,
    /** Closed programmes stop accepting people; totals stay available. */
    archived: z.boolean().optional(),
  })
  .refine(datesInOrder, { message: 'The end date must be after the start.', path: ['endsOn'] })
  .openapi('ProgrammePatch');

const RoleRefSchema = z.object({ id: z.string(), title: z.string() });
const SafeCountSchema = z
  .object({
    /** Rounded down to a multiple of 5; null when fewer than k people are counted. */
    value: z.number().int().nullable(),
    k: z.number().int(),
  })
  .openapi('SafeCount');

export const ProgrammeSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    targetRoles: z.array(RoleRefSchema),
    startsOn: z.string().nullable(),
    endsOn: z.string().nullable(),
    joinCode: z.string(),
    /** For printing and reading aloud, e.g. K7QM-3WXA. */
    joinCodeDisplay: z.string(),
    /** Path of the join page, e.g. /join/K7QM3WXA (prefix with the site's address). */
    joinPath: z.string(),
    archived: z.boolean(),
    createdAt: z.string(),
    participants: SafeCountSchema,
  })
  .openapi('Programme');

const OrgSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(ORG_KINDS),
  country: z.string().nullable(),
  sizeBand: z.enum(ORG_SIZE_BANDS).nullable(),
  plan: z.string(),
  /** The organisation's own threshold. */
  kAnonMin: z.number().int(),
  /** The group size actually applied: the strictest of the organisation's and Waypoint's. */
  k: z.number().int(),
  /** Waypoint's minimum for every organisation. */
  platformK: z.number().int(),
  createdAt: z.string(),
});

export const MemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(ORG_ROLES),
  joinedAt: z.string(),
  isMe: z.boolean(),
});

export const InvitationSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(ORG_ROLES),
  expiresAt: z.string(),
});

export const OrgViewSchema = z
  .object({
    organisation: OrgSchema,
    role: z.enum(ORG_ROLES),
    canManage: z.boolean(),
    programmes: z.array(ProgrammeSchema),
    members: z.array(MemberSchema),
    /** Pending invitations (only for owners and admins). */
    invitations: z.array(InvitationSchema),
    /** Whether your own email address is confirmed: needed before you can invite people. */
    viewerVerified: z.boolean(),
  })
  .openapi('OrganisationView');

export const OrgSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(ORG_KINDS),
  country: z.string().nullable(),
  role: z.enum(ORG_ROLES),
  programmes: z.number().int(),
});

export const PendingInvitationSchema = z.object({
  id: z.string(),
  organisation: z.string(),
  inviter: z.string(),
  role: z.enum(ORG_ROLES),
  expiresAt: z.string(),
});

export const OrgHomeSchema = z
  .object({
    organisations: z.array(OrgSummarySchema),
    invitations: z.array(PendingInvitationSchema),
    canCreate: z.boolean(),
    platformK: z.number().int(),
  })
  .openapi('OrganisationHome');

export const InsightsSchema = z
  .object({
    k: z.number().int(),
    participants: SafeCountSchema,
    withPlan: z.number().nullable(),
    movedForward: z.number().nullable(),
    onTarget: z.number().nullable(),
    goals: z.array(z.object({ id: z.string(), title: z.string(), n: z.number().int() })),
    skills: z.array(z.object({ id: z.string(), name: z.string(), n: z.number().int() })),
    goalsHidden: z.boolean(),
    skillsHidden: z.boolean(),
    /** Monday of the week these totals belong to: they do not change during the week. */
    weekOf: z.string(),
    /** When this week's totals were taken. */
    asOf: z.string(),
    /** The Monday new totals can be taken. */
    nextUpdate: z.string(),
    /** People are counted from this many days after they join. */
    countAfterDays: z.number().int(),
    /** The target roles changed this week: the share working towards them returns next week. */
    onTargetPending: z.boolean(),
  })
  .openapi('ProgrammeInsights');

export const ProgrammeViewSchema = z
  .object({
    organisation: OrgSchema,
    role: z.enum(ORG_ROLES),
    canManage: z.boolean(),
    programme: ProgrammeSchema,
    insights: InsightsSchema,
  })
  .openapi('ProgrammeView');

export const InviteInputSchema = z
  .object({
    email: z.email().max(254),
    role: z.enum(['admin', 'member']),
  })
  .openapi('InviteInput');

export const RoleInputSchema = z.object({ role: z.enum(ORG_ROLES) }).openapi('MemberRoleInput');

export const InvitationViewSchema = z
  .object({
    id: z.string(),
    organisation: z.object({ name: z.string(), kind: z.enum(ORG_KINDS) }),
    inviter: z.string(),
    role: z.enum(ORG_ROLES),
    status: z.enum(['pending', 'accepted', 'rejected', 'canceled', 'expired']),
    /** The invited address, partly hidden, e.g. a•••@example.org */
    emailHint: z.string(),
    /** True when the signed-in account is the one invited. */
    forYou: z.boolean(),
    /** The invited account has not confirmed its email address yet (needed to answer). */
    needsVerification: z.boolean(),
    /** Only once you have joined the team. */
    organisationId: z.string().nullable(),
  })
  .openapi('InvitationView');

export const JoinPreviewSchema = z
  .object({
    code: z.string(),
    codeDisplay: z.string(),
    programme: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      startsOn: z.string().nullable(),
      endsOn: z.string().nullable(),
      targetRoles: z.array(RoleRefSchema),
    }),
    organisation: z.object({
      name: z.string(),
      kind: z.enum(ORG_KINDS),
      country: z.string().nullable(),
    }),
    k: z.number().int(),
    /** False once the organisation has closed the programme. */
    open: z.boolean(),
    joined: z.boolean(),
    /** Whether you are counted in this programme's totals (false until you join and choose it). */
    counted: z.boolean(),
  })
  .openapi('ProgrammeJoinPreview');

export const JoinInputSchema = z
  .object({
    /**
     * Count me in this programme's anonymous totals. Applies to this programme only; choosing
     * it also allows organisations to count you at all (consent `org_aggregates`).
     */
    countMe: z.boolean(),
  })
  .openapi('ProgrammeJoinInput');

export const ProgrammeCountInputSchema = z
  .object({ counted: z.boolean() })
  .openapi('ProgrammeCountInput');

export const MyProgrammeSchema = z.object({
  id: z.string(),
  name: z.string(),
  organisation: z.string(),
  kind: z.enum(ORG_KINDS),
  targetRoles: z.array(RoleRefSchema),
  joinedAt: z.string(),
  archived: z.boolean(),
  /** You chose to be counted in this programme's totals. */
  counted: z.boolean(),
});

export const MyProgrammesSchema = z
  .object({
    programmes: z.array(MyProgrammeSchema),
    /**
     * Organisations may count you at all (consent `org_aggregates`). When off, no programme
     * counts you, whatever you chose for each.
     */
    countingAllowed: z.boolean(),
  })
  .openapi('MyProgrammes');

export type OrgView = z.infer<typeof OrgViewSchema>;
export type OrgHome = z.infer<typeof OrgHomeSchema>;
export type ProgrammeSummary = z.infer<typeof ProgrammeSchema>;
export type ProgrammeView = z.infer<typeof ProgrammeViewSchema>;
export type InvitationView = z.infer<typeof InvitationViewSchema>;
export type JoinPreview = z.infer<typeof JoinPreviewSchema>;
export type MyProgrammes = z.infer<typeof MyProgrammesSchema>;

// ─────────────────────────────── Helpers ───────────────────────────────

type OrgKindT = (typeof ORG_KINDS)[number];
type SizeBandT = (typeof ORG_SIZE_BANDS)[number];

/** Waypoint's minimum group size (WAYPOINT_K_ANON_MIN, never below the floor). */
export function platformK(): number {
  return effectiveK(getEnv().WAYPOINT_K_ANON_MIN);
}

/** Better Auth allows comma-separated roles; the strongest one counts. */
function roleOf(raw: string | null | undefined): OrgRole {
  const parts = (raw ?? '').split(',').map((r) => r.trim());
  if (parts.includes('owner')) return 'owner';
  if (parts.includes('admin')) return 'admin';
  return 'member';
}

const kindOf = (k: string | null | undefined): OrgKindT =>
  (ORG_KINDS as readonly string[]).includes(k ?? '') ? (k as OrgKindT) : 'community';
const bandOf = (b: string | null | undefined): SizeBandT | null =>
  (ORG_SIZE_BANDS as readonly string[]).includes(b ?? '') ? (b as SizeBandT) : null;

const roles = (ids: string[], locale: string) =>
  ids.filter((id) => getRole(id)).map((id) => ({ id, title: roleTitle(id, locale) }));

/** Monday (UTC) of the current week: totals, noise and margins are all fixed per week. */
function weekOf(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function weeksAfter(week: string, n: number): string {
  const d = new Date(`${week}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * n);
  return d.toISOString().slice(0, 10);
}

/**
 * Noise for a programme's numbers, seeded by the true value rather than the week: a number
 * that stays the same keeps the same noise for good, so collecting weeks of figures cannot
 * average it away.
 */
function noiseFor(programmeId: string): CountNoise {
  return (key, value) =>
    laplaceNoise(keyedUniform(`${programmeId}|${key}|${value}`, 'org-insights'));
}

function marginFor(programmeId: string, week: string): CountMargin {
  return (key) => marginFrom(keyedUniform(`${programmeId}|${key}|${week}`, 'org-margin'));
}

/** Only the confirmed owner of an address may act on what was sent to it. */
async function emailVerified(db: Pick<Database, 'select'>, userId: string): Promise<boolean> {
  const [u] = await db
    .select({ verified: users.emailVerified })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return Boolean(u?.verified);
}

const verifyFirst = (message: string) => new ApiError(403, 'verify-email', message);

function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}•••@${domain}`;
}

async function orgRows(db: Database, orgId: string) {
  const [row] = await db
    .select({ org: organizations, profile: orgProfiles })
    .from(organizations)
    .leftJoin(orgProfiles, eq(orgProfiles.organizationId, organizations.id))
    .where(eq(organizations.id, orgId))
    .limit(1);
  return row ?? null;
}

type OrgRow = NonNullable<Awaited<ReturnType<typeof orgRows>>>;

function orgSummary(row: OrgRow) {
  const p = row.profile;
  const kAnonMin = p?.kAnonMin ?? 50;
  return {
    id: row.org.id,
    name: row.org.name,
    kind: kindOf(p?.kind),
    country: p?.country ?? null,
    sizeBand: bandOf(p?.sizeBand),
    plan: p?.plan ?? 'free',
    kAnonMin,
    k: effectiveK(kAnonMin, platformK()),
    platformK: platformK(),
    createdAt: row.org.createdAt.toISOString(),
  };
}

async function myRole(
  db: Pick<Database, 'select'>,
  orgId: string,
  userId: string,
): Promise<OrgRole | null> {
  const [m] = await db
    .select({ role: members.role })
    .from(members)
    .where(and(eq(members.organizationId, orgId), eq(members.userId, userId)))
    .limit(1);
  return m ? roleOf(m.role) : null;
}

/** The organisation and the person's role in it. Not a member: 404 (its existence stays private). */
async function context(db: Database, orgId: string, userId: string) {
  const row = await orgRows(db, orgId);
  const role = row ? await myRole(db, orgId, userId) : null;
  if (!row || !role) throw notFound('Organisation');
  return { row, role };
}

async function managerContext(db: Database, orgId: string, userId: string) {
  const ctx = await context(db, orgId, userId);
  if (!canManage(ctx.role))
    throw forbidden('Only owners and admins of this organisation can do that.');
  return ctx;
}

type ProgrammeRow = typeof orgProgrammes.$inferSelect;

/**
 * The people a week's totals are made of: those who chose to be counted in this programme at
 * least COUNT_AFTER_DAYS before the week began, and still allow organisations to count them
 * at all.
 *
 * - The cut-off is the start of the week, not the moment the totals happen to be taken: whether
 *   someone who chose recently appears never depends on when staff look.
 * - Only people with an account and a confirmed email address count. A guest session costs
 *   nothing to create, so counting guests would let an organisation fill a group with made-up
 *   people and then watch for the one real person who joins. A guest's choice is kept and
 *   starts to count once they have an account.
 */
function countedPeople(programmeId: string, week: string) {
  const chosenBy = new Date(
    new Date(`${week}T00:00:00Z`).getTime() - COUNT_AFTER_DAYS * 86_400_000,
  ).toISOString();
  return sql`
    select e.user_id from org_enrolments e
    join consents c on c.user_id = e.user_id and c.purpose = 'org_aggregates' and c.granted = true
    join users u on u.id = e.user_id
      and coalesce(u.is_anonymous, false) = false and u.email_verified = true
    where e.programme_id = ${programmeId} and e.counted = true
      and e.counted_since <= ${chosenBy}::timestamptz`;
}

/** `counted_since` for a choice: kept when already counting, started now when switched on. */
const countedSinceFor = (counted: boolean) =>
  counted ? sql`coalesce(${orgEnrolments.countedSince}, now())` : null;

const StoredCountsSchema = z.object({
  counted: z.number().int().nonnegative(),
  withPlan: z.number().int().nonnegative(),
  movedForward: z.number().int().nonnegative(),
  onTarget: z.number().int().nonnegative(),
  goals: z.array(z.object({ key: z.string(), n: z.number().int().nonnegative() })),
  skills: z.array(z.object({ key: z.string(), n: z.number().int().nonnegative() })),
  targets: z.array(z.string()).optional(),
});

/** Raw counts for one programme, for the week that starts on `week`. */
async function countsFor(
  db: Database,
  p: ProgrammeRow,
  k: number,
  week: string,
): Promise<ProgrammeCounts> {
  const counted = countedPeople(p.id, week);
  const total = await db.execute<{ n: number }>(sql`select count(*)::int as n from (${counted}) x`);
  const n = Number(total.rows[0]?.n ?? 0);
  const targets = [...p.targetRoleIds];
  // Below k nothing else can be shown this week (k never goes down), so nothing else is read.
  if (n < k)
    return {
      counted: n,
      withPlan: 0,
      movedForward: 0,
      onTarget: 0,
      goals: [],
      skills: [],
      targets,
    };

  const active = await db.execute<{
    user_id: string;
    target_role_id: string | null;
    gaps: Array<{ skillId: string; from: number; to: number }> | null;
  }>(sql`
    select distinct on (p.user_id) p.user_id, p.target_role_id, p.gaps
    from plans p
    where p.status = 'active' and p.user_id in (${counted})
    order by p.user_id, p.updated_at desc`);
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const moved = await db.execute<{ n: number }>(sql`
    select count(distinct p.user_id)::int as n
    from plan_steps s join plans p on p.id = s.plan_id
    where s.status = 'done' and s.done_at >= ${since}::timestamptz and p.user_id in (${counted})`);

  const targetSet = new Set(targets);
  const goals = new Map<string, number>();
  const skills = new Map<string, number>();
  let onTarget = 0;
  for (const r of active.rows) {
    if (r.target_role_id) {
      goals.set(r.target_role_id, (goals.get(r.target_role_id) ?? 0) + 1);
      if (targetSet.has(r.target_role_id)) onTarget++;
    }
    const building = new Set(
      (Array.isArray(r.gaps) ? r.gaps : []).filter((g) => g.to > g.from).map((g) => g.skillId),
    );
    for (const s of building) skills.set(s, (skills.get(s) ?? 0) + 1);
  }
  const list = (m: Map<string, number>) => [...m].map(([key, count]) => ({ key, n: count }));
  return {
    counted: n,
    withPlan: active.rows.length,
    movedForward: Number(moved.rows[0]?.n ?? 0),
    onTarget,
    goals: list(goals),
    skills: list(skills),
    targets,
  };
}

interface WeeklyCounts {
  counts: ProgrammeCounts;
  takenAt: Date;
}

/** Snapshots older than this are deleted when a new one is taken. */
const SNAPSHOT_WEEKS_KEPT = 26;

/** What is served when this week's totals cannot be read: nothing to show. */
const NOTHING: ProgrammeCounts = {
  counted: 0,
  withPlan: 0,
  movedForward: 0,
  onTarget: 0,
  goals: [],
  skills: [],
};

/**
 * This week's totals for each programme: taken the first time anyone looks during the week,
 * then served unchanged until the next Monday. Comparing two views can never show one person
 * joining, leaving or changing their mind — so fresh counts are never served in their place:
 * if the week's row cannot be read, it is replaced once, and otherwise nothing is shown.
 */
async function weeklyCounts(
  db: Database,
  programmes: ProgrammeRow[],
  k: number,
  week: string,
): Promise<Map<string, WeeklyCounts>> {
  const out = new Map<string, WeeklyCounts>();
  if (!programmes.length) return out;
  const unreadable = new Set<string>();
  const read = async (ids: string[]) => {
    const rows = await db
      .select()
      .from(orgInsightSnapshots)
      .where(
        and(inArray(orgInsightSnapshots.programmeId, ids), eq(orgInsightSnapshots.week, week)),
      );
    for (const r of rows) {
      const parsed = StoredCountsSchema.safeParse(r.counts);
      if (parsed.success) out.set(r.programmeId, { counts: parsed.data, takenAt: r.takenAt });
      else unreadable.add(r.programmeId);
    }
  };
  await read(programmes.map((p) => p.id));
  for (const p of programmes) {
    if (out.has(p.id)) continue;
    if (unreadable.has(p.id))
      await db
        .delete(orgInsightSnapshots)
        .where(and(eq(orgInsightSnapshots.programmeId, p.id), eq(orgInsightSnapshots.week, week)));
    const counts = await countsFor(db, p, k, week);
    // If someone else took this week's snapshot a moment ago, theirs stands.
    await db
      .insert(orgInsightSnapshots)
      .values({ programmeId: p.id, week, counts: { ...counts } })
      .onConflictDoNothing();
    await db
      .delete(orgInsightSnapshots)
      .where(
        and(
          eq(orgInsightSnapshots.programmeId, p.id),
          lt(orgInsightSnapshots.week, weeksAfter(week, -SNAPSHOT_WEEKS_KEPT)),
        ),
      );
    await read([p.id]);
    if (!out.has(p.id)) out.set(p.id, { counts: NOTHING, takenAt: new Date() });
  }
  return out;
}

/**
 * Take this week's totals for every programme that has none yet. The worker runs this, so the
 * totals are taken as each week begins rather than at a moment staff choose by opening the
 * page: two looks a few minutes apart, either side of midnight on Sunday, can no longer be
 * compared to see who joined or left in between. Returns how many were taken.
 */
export async function takeWeeklySnapshots(db: Database, limit = 200): Promise<number> {
  const week = weekOf();
  const due = await db
    .select({ programme: orgProgrammes, kAnonMin: orgProfiles.kAnonMin })
    .from(orgProgrammes)
    .leftJoin(orgProfiles, eq(orgProfiles.organizationId, orgProgrammes.organizationId))
    .where(
      sql`not exists (select 1 from ${orgInsightSnapshots}
            where ${orgInsightSnapshots.programmeId} = ${orgProgrammes.id}
              and ${orgInsightSnapshots.week} = ${week})`,
    )
    .orderBy(orgProgrammes.createdAt)
    .limit(limit);
  for (const row of due)
    await weeklyCounts(db, [row.programme], effectiveK(row.kAnonMin ?? 50, platformK()), week);
  return due.length;
}

function programmeSummary(
  p: ProgrammeRow,
  counted: number,
  k: number,
  locale: string,
  week = weekOf(),
): ProgrammeSummary {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    targetRoles: roles(p.targetRoleIds, locale),
    startsOn: p.startsOn,
    endsOn: p.endsOn,
    joinCode: p.joinCode,
    joinCodeDisplay: formatJoinCode(p.joinCode),
    joinPath: `/join/${p.joinCode}`,
    archived: Boolean(p.archivedAt),
    createdAt: p.createdAt.toISOString(),
    participants: participantCount(counted, k, noiseFor(p.id), marginFor(p.id, week)),
  };
}

async function uniqueJoinCode(db: Pick<Database, 'select'>): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = newJoinCode();
    const [taken] = await db
      .select({ id: orgProgrammes.id })
      .from(orgProgrammes)
      .where(eq(orgProgrammes.joinCode, code))
      .limit(1);
    if (!taken) return code;
  }
  throw new Error('Could not find a free join code');
}

// ─────────────────────────────── Organisations ───────────────────────────────

export async function orgHome(db: Database, userId: string, email: string): Promise<OrgHome> {
  const mine = await db
    .select({ org: organizations, profile: orgProfiles, role: members.role })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .leftJoin(orgProfiles, eq(orgProfiles.organizationId, organizations.id))
    .where(eq(members.userId, userId))
    .orderBy(asc(organizations.name));
  const ids = mine.map((m) => m.org.id);
  const programmeCounts = ids.length
    ? await db
        .select({ orgId: orgProgrammes.organizationId, n: count() })
        .from(orgProgrammes)
        .where(inArray(orgProgrammes.organizationId, ids))
        .groupBy(orgProgrammes.organizationId)
    : [];
  const byOrg = new Map(programmeCounts.map((r) => [r.orgId, Number(r.n)]));
  const owned = mine.filter((m) => roleOf(m.role) === 'owner').length;
  // Invitations are matched by email address, so only list them for an address the person has
  // proved they own. Anyone else needs the link from the invitation email, which is that proof.
  const [me] = await db
    .select({ verified: users.emailVerified })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return {
    organisations: mine.map((m) => ({
      id: m.org.id,
      name: m.org.name,
      kind: kindOf(m.profile?.kind),
      country: m.profile?.country ?? null,
      role: roleOf(m.role),
      programmes: byOrg.get(m.org.id) ?? 0,
    })),
    invitations: me?.verified ? await pendingInvitationsFor(db, email) : [],
    canCreate: owned < ORG_LIMIT,
    platformK: platformK(),
  };
}

export async function createOrganisation(
  db: Database,
  actor: Actor,
  input: z.infer<typeof OrgInputSchema>,
): Promise<{ id: string }> {
  // Counted and created one at a time per person, so the limit holds when requests arrive together.
  return oneAtATime(db, `orgs:${actor.userId}`, (tx) =>
    createOrganisationUnlocked(tx, actor, input),
  );
}

async function createOrganisationUnlocked(
  db: Database,
  actor: Actor,
  input: z.infer<typeof OrgInputSchema>,
): Promise<{ id: string }> {
  const [owned] = await db
    .select({ n: count() })
    .from(members)
    .where(and(eq(members.userId, actor.userId), eq(members.role, 'owner')));
  if (Number(owned?.n ?? 0) >= ORG_LIMIT)
    throw new ApiError(409, 'limit', `You can run up to ${ORG_LIMIT} organisations.`);
  const id = newId();
  await db.transaction(async (tx) => {
    let slug = orgSlug(input.name, newJoinCode().slice(0, 4).toLowerCase());
    for (let i = 0; i < 5; i++) {
      const [taken] = await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);
      if (!taken) break;
      slug = orgSlug(input.name, newJoinCode().slice(0, 6).toLowerCase());
    }
    const now = new Date();
    await tx.insert(organizations).values({ id, name: input.name, slug, createdAt: now });
    await tx
      .insert(members)
      .values({ id: newId(), organizationId: id, userId: actor.userId, role: 'owner' });
    await tx.insert(orgProfiles).values({
      organizationId: id,
      kind: input.kind,
      country: input.country ?? null,
      sizeBand: input.sizeBand ?? null,
      kAnonMin: Math.max(50, platformK()),
    });
    await audit(tx, actor, {
      action: 'org.created',
      organizationId: id,
      targetType: 'organization',
      targetId: id,
      meta: { kind: input.kind },
    });
  });
  return { id };
}

export async function orgView(
  db: Database,
  userId: string,
  orgId: string,
  locale: string,
): Promise<OrgView> {
  const { row, role } = await context(db, orgId, userId);
  const org = orgSummary(row);
  const programmeRows = await db
    .select()
    .from(orgProgrammes)
    .where(eq(orgProgrammes.organizationId, orgId))
    .orderBy(desc(orgProgrammes.createdAt));
  const week = weekOf();
  const weekly = await weeklyCounts(db, programmeRows, org.k, week);
  const team = await db
    .select({
      id: members.id,
      userId: members.userId,
      role: members.role,
      createdAt: members.createdAt,
      name: users.name,
      email: users.email,
    })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(eq(members.organizationId, orgId))
    .orderBy(asc(members.createdAt));
  const manage = canManage(role);
  const pending = manage
    ? await db
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.organizationId, orgId),
            eq(invitations.status, 'pending'),
            gt(invitations.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(invitations.createdAt))
    : [];
  const rank = { owner: 0, admin: 1, member: 2 } as const;
  return {
    organisation: org,
    role,
    canManage: manage,
    programmes: programmeRows.map((p) =>
      programmeSummary(p, weekly.get(p.id)?.counts.counted ?? 0, org.k, locale, week),
    ),
    members: team
      .map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: roleOf(m.role),
        joinedAt: m.createdAt.toISOString(),
        isMe: m.userId === userId,
      }))
      .sort((a, b) => rank[a.role] - rank[b.role]),
    invitations: pending.map((i) => ({
      id: i.id,
      email: i.email,
      role: roleOf(i.role),
      expiresAt: i.expiresAt.toISOString(),
    })),
    viewerVerified: await emailVerified(db, userId),
  };
}

export async function updateOrganisation(
  db: Database,
  actor: Actor,
  orgId: string,
  patch: z.infer<typeof OrgPatchSchema>,
): Promise<void> {
  await managerContext(db, orgId, actor.userId);
  await db.transaction(async (tx) => {
    await lockOrganisation(tx, orgId);
    if (!canManage(await myRole(tx, orgId, actor.userId)))
      throw forbidden('Only owners and admins of this organisation can do that.');
    // Raise-only, checked under the lock: stepping the threshold down and up again would
    // reveal exact group sizes.
    if (patch.kAnonMin !== undefined) {
      const [current] = await tx
        .select({ kAnonMin: orgProfiles.kAnonMin })
        .from(orgProfiles)
        .where(eq(orgProfiles.organizationId, orgId))
        .limit(1);
      if (patch.kAnonMin < (current?.kAnonMin ?? 50))
        throw new ApiError(
          409,
          'k-lower',
          'The group size can be raised, but never lowered again.',
        );
    }
    if (patch.name !== undefined)
      await tx.update(organizations).set({ name: patch.name }).where(eq(organizations.id, orgId));
    const profile: Partial<typeof orgProfiles.$inferInsert> = {};
    if (patch.kind !== undefined) profile.kind = patch.kind;
    if (patch.country !== undefined) profile.country = patch.country;
    if (patch.sizeBand !== undefined) profile.sizeBand = patch.sizeBand;
    if (patch.kAnonMin !== undefined) profile.kAnonMin = Math.max(patch.kAnonMin, platformK());
    if (Object.keys(profile).length) {
      await tx
        .insert(orgProfiles)
        .values({ organizationId: orgId, kind: patch.kind ?? 'community', ...profile })
        .onConflictDoUpdate({ target: orgProfiles.organizationId, set: profile });
    }
    await audit(tx, actor, {
      action: 'org.updated',
      organizationId: orgId,
      targetType: 'organization',
      targetId: orgId,
      meta: { fields: Object.keys(patch) },
    });
  });
}

export async function deleteOrganisation(db: Database, actor: Actor, orgId: string): Promise<void> {
  const { role, row } = await context(db, orgId, actor.userId);
  if (role !== 'owner') throw forbidden('Only an owner can delete the organisation.');
  await db.transaction(async (tx) => {
    await audit(tx, actor, {
      action: 'org.deleted',
      organizationId: null,
      targetType: 'organization',
      targetId: orgId,
      meta: { name: row.org.name },
    });
    // Programmes, enrolments, the team, invitations and the profile go with it (cascade).
    await tx.delete(organizations).where(eq(organizations.id, orgId));
  });
}

// ─────────────────────────────── Programmes ───────────────────────────────

async function programmeIn(db: Database, orgId: string, programmeId: string) {
  const [p] = await db
    .select()
    .from(orgProgrammes)
    .where(and(eq(orgProgrammes.id, programmeId), eq(orgProgrammes.organizationId, orgId)))
    .limit(1);
  if (!p) throw notFound('Programme');
  return p;
}

export async function createProgramme(
  db: Database,
  actor: Actor,
  orgId: string,
  input: z.infer<typeof ProgrammeInputSchema>,
): Promise<{ id: string; joinCode: string }> {
  // Counted and created one at a time per organisation, so the limit holds.
  return oneAtATime(db, `programmes:${orgId}`, (tx) =>
    createProgrammeUnlocked(tx, actor, orgId, input),
  );
}

async function createProgrammeUnlocked(
  db: Database,
  actor: Actor,
  orgId: string,
  input: z.infer<typeof ProgrammeInputSchema>,
): Promise<{ id: string; joinCode: string }> {
  await managerContext(db, orgId, actor.userId);
  const [existing] = await db
    .select({ n: count() })
    .from(orgProgrammes)
    .where(eq(orgProgrammes.organizationId, orgId));
  if (Number(existing?.n ?? 0) >= PROGRAMME_LIMIT)
    throw new ApiError(
      409,
      'limit',
      `An organisation can run up to ${PROGRAMME_LIMIT} programmes.`,
    );
  return db.transaction(async (tx) => {
    const joinCode = await uniqueJoinCode(tx);
    const [row] = await tx
      .insert(orgProgrammes)
      .values({
        organizationId: orgId,
        name: input.name,
        description: input.description || null,
        targetRoleIds: [...new Set(input.targetRoleIds)],
        startsOn: input.startsOn ?? null,
        endsOn: input.endsOn ?? null,
        joinCode,
      })
      .returning({ id: orgProgrammes.id });
    if (!row) throw new Error('Could not create the programme');
    await audit(tx, actor, {
      action: 'org.programme.created',
      organizationId: orgId,
      targetType: 'programme',
      targetId: row.id,
    });
    return { id: row.id, joinCode };
  });
}

export async function updateProgramme(
  db: Database,
  actor: Actor,
  orgId: string,
  programmeId: string,
  patch: z.infer<typeof ProgrammePatchSchema>,
): Promise<void> {
  await managerContext(db, orgId, actor.userId);
  const current = await programmeIn(db, orgId, programmeId);
  const startsOn = patch.startsOn !== undefined ? patch.startsOn : current.startsOn;
  const endsOn = patch.endsOn !== undefined ? patch.endsOn : current.endsOn;
  if (startsOn && endsOn && endsOn < startsOn)
    throw new ApiError(422, 'dates', 'The end date must be after the start.');
  const set: Partial<typeof orgProgrammes.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.description !== undefined) set.description = patch.description || null;
  if (patch.targetRoleIds !== undefined) set.targetRoleIds = [...new Set(patch.targetRoleIds)];
  if (patch.startsOn !== undefined) set.startsOn = patch.startsOn;
  if (patch.endsOn !== undefined) set.endsOn = patch.endsOn;
  if (patch.archived !== undefined)
    set.archivedAt = patch.archived ? (current.archivedAt ?? new Date()) : null;
  if (!Object.keys(set).length) return;
  await db.transaction(async (tx) => {
    await tx.update(orgProgrammes).set(set).where(eq(orgProgrammes.id, programmeId));
    await audit(tx, actor, {
      action:
        patch.archived === true
          ? 'org.programme.closed'
          : patch.archived === false
            ? 'org.programme.reopened'
            : 'org.programme.updated',
      organizationId: orgId,
      targetType: 'programme',
      targetId: programmeId,
      meta: { fields: Object.keys(set) },
    });
  });
}

/** A new join code; the old one stops working at once (for example after a poster leaked). */
export async function newProgrammeCode(
  db: Database,
  actor: Actor,
  orgId: string,
  programmeId: string,
): Promise<{ joinCode: string }> {
  await managerContext(db, orgId, actor.userId);
  await programmeIn(db, orgId, programmeId);
  return db.transaction(async (tx) => {
    const joinCode = await uniqueJoinCode(tx);
    await tx.update(orgProgrammes).set({ joinCode }).where(eq(orgProgrammes.id, programmeId));
    await audit(tx, actor, {
      action: 'org.programme.code-changed',
      organizationId: orgId,
      targetType: 'programme',
      targetId: programmeId,
    });
    return { joinCode };
  });
}

export async function deleteProgramme(
  db: Database,
  actor: Actor,
  orgId: string,
  programmeId: string,
): Promise<void> {
  await managerContext(db, orgId, actor.userId);
  const p = await programmeIn(db, orgId, programmeId);
  await db.transaction(async (tx) => {
    await audit(tx, actor, {
      action: 'org.programme.deleted',
      organizationId: orgId,
      targetType: 'programme',
      targetId: programmeId,
      meta: { name: p.name },
    });
    await tx.delete(orgProgrammes).where(eq(orgProgrammes.id, programmeId));
  });
}

export async function programmeView(
  db: Database,
  userId: string,
  orgId: string,
  programmeId: string,
  locale: string,
): Promise<ProgrammeView> {
  const { row, role } = await context(db, orgId, userId);
  const org = orgSummary(row);
  const p = await programmeIn(db, orgId, programmeId);
  const week = weekOf();
  const weekly = (await weeklyCounts(db, [p], org.k, week)).get(p.id);
  const counts = weekly?.counts ?? NOTHING;
  const hasTargets = p.targetRoleIds.length > 0;
  // A share of people working towards roles they were not counted against would be wrong, and
  // changing the roles mid-week must not become a way to look again.
  const targetsChanged = !sameTargets(counts.targets, p.targetRoleIds);
  const insights = programmeInsights(counts, org.k, {
    hasTargets,
    targetsChanged,
    noise: noiseFor(p.id),
    margin: marginFor(p.id, week),
  });
  return {
    organisation: org,
    role,
    canManage: canManage(role),
    programme: programmeSummary(p, counts.counted, org.k, locale, week),
    insights: {
      k: insights.k,
      participants: insights.participants,
      withPlan: insights.withPlan,
      movedForward: insights.movedForward,
      onTarget: insights.onTarget,
      goals: insights.goals.map((g) => ({ id: g.key, title: roleTitle(g.key, locale), n: g.n })),
      skills: insights.skills.map((s) => ({ id: s.key, name: skillName(s.key, locale), n: s.n })),
      goalsHidden: insights.goalsHidden,
      skillsHidden: insights.skillsHidden,
      weekOf: week,
      asOf: (weekly?.takenAt ?? new Date()).toISOString(),
      nextUpdate: weeksAfter(week, 1),
      countAfterDays: COUNT_AFTER_DAYS,
      onTargetPending: hasTargets && targetsChanged && insights.participants.value !== null,
    },
  };
}

// ─────────────────────────────── Team ───────────────────────────────

type Reader = Pick<Database, 'select'>;

async function ownerCount(db: Reader, orgId: string): Promise<number> {
  const rows = await db
    .select({ role: members.role })
    .from(members)
    .where(eq(members.organizationId, orgId));
  return rows.filter((r) => roleOf(r.role) === 'owner').length;
}

/**
 * Team changes that could leave an organisation without an owner run one at a time: the row
 * lock makes two owners stepping down at the same moment wait for each other.
 */
async function lockOrganisation(tx: Tx, orgId: string): Promise<void> {
  await tx.execute(sql`select id from organizations where id = ${orgId} for update`);
}

/** Invitation emails one address can receive in a day, from every organisation together. */
const INVITES_PER_ADDRESS_PER_DAY = 3;
/** Invitation emails one organisation can send in a day. */
const INVITES_PER_ORG_PER_DAY = 50;

export async function inviteMember(
  db: Database,
  actor: Actor,
  orgId: string,
  input: z.infer<typeof InviteInputSchema>,
  locale: Locale = 'en',
): Promise<{ id: string; path: string }> {
  const { row, role } = await managerContext(db, orgId, actor.userId);
  // Admins bring in members; only an owner decides who else may manage the organisation
  // (as with changing someone's role).
  if (input.role === 'admin' && role !== 'owner')
    throw forbidden('Only an owner can invite an admin.');
  // An invitation is an email sent in someone's name: only from a confirmed address.
  if (!(await emailVerified(db, actor.userId)))
    throw verifyFirst('Confirm your email address before inviting people.');
  const email = input.email.trim().toLowerCase();
  const [already] = await db
    .select({ id: members.id })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(and(eq(members.organizationId, orgId), sql`lower(${users.email}) = ${email}`))
    .limit(1);
  if (already)
    throw new ApiError(409, 'already-member', 'That person is already in this organisation.');
  const [team] = await db
    .select({ n: count() })
    .from(members)
    .where(eq(members.organizationId, orgId));
  if (Number(team?.n ?? 0) >= TEAM_LIMIT)
    throw new ApiError(409, 'limit', `A team can have up to ${TEAM_LIMIT} people.`);
  // Nobody can use Waypoint to fill someone's inbox, and no organisation can mail in bulk.
  await rateLimit(db, `org-invites:${orgId}`, {
    max: INVITES_PER_ORG_PER_DAY,
    windowSeconds: 86_400,
  });
  await rateLimit(db, `invites-to:${keyedHash(email, 'invite-address')}`, {
    max: INVITES_PER_ADDRESS_PER_DAY,
    windowSeconds: 86_400,
  });

  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);
  const [inviter] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, actor.userId))
    .limit(1);
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(
          eq(invitations.organizationId, orgId),
          eq(invitations.email, email),
          eq(invitations.status, 'pending'),
        ),
      )
      .limit(1);
    let id: string;
    if (existing) {
      id = existing.id;
      await tx
        .update(invitations)
        .set({ role: input.role, expiresAt, inviterId: actor.userId })
        .where(eq(invitations.id, id));
    } else {
      const [pending] = await tx
        .select({ n: count() })
        .from(invitations)
        .where(and(eq(invitations.organizationId, orgId), eq(invitations.status, 'pending')));
      if (Number(pending?.n ?? 0) >= PENDING_INVITE_LIMIT)
        throw new ApiError(409, 'limit', 'Too many invitations are waiting for an answer.');
      id = newId();
      await tx.insert(invitations).values({
        id,
        organizationId: orgId,
        email,
        role: input.role,
        status: 'pending',
        expiresAt,
        inviterId: actor.userId,
      });
    }
    const path = `/org/invite/${id}`;
    await enqueueMessage(tx, {
      channel: 'email',
      recipientRef: sealWithKek(email, 'outbox'),
      payload: {
        template: 'org-invite',
        // Names typed by others go out as plain text only: no links, one line. With no name,
        // the email says "someone" in its own language.
        organization: plainName(row.org.name, 80),
        inviter: plainName(inviter?.name),
        // The inviter's language is only a guess at the invitee's: the email is short and
        // its link opens Waypoint in the language of the invitee's browser.
        locale,
      },
      secret: { url: `${getEnv().WAYPOINT_URL}${path}` },
    });
    await audit(tx, actor, {
      action: 'org.member.invited',
      organizationId: orgId,
      targetType: 'invitation',
      targetId: id,
      meta: { role: input.role },
    });
    return { id, path };
  });
}

export async function cancelInvitation(
  db: Database,
  actor: Actor,
  orgId: string,
  invitationId: string,
): Promise<void> {
  await managerContext(db, orgId, actor.userId);
  const res = await db
    .update(invitations)
    .set({ status: 'canceled' })
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.organizationId, orgId),
        eq(invitations.status, 'pending'),
      ),
    )
    .returning({ id: invitations.id });
  if (!res.length) throw notFound('Invitation');
  await audit(db, actor, {
    action: 'org.member.invite-canceled',
    organizationId: orgId,
    targetType: 'invitation',
    targetId: invitationId,
  });
}

async function memberIn(db: Reader, orgId: string, memberId: string) {
  const [m] = await db
    .select()
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.organizationId, orgId)))
    .limit(1);
  if (!m) throw notFound('Team member');
  return m;
}

export async function changeMemberRole(
  db: Database,
  actor: Actor,
  orgId: string,
  memberId: string,
  role: OrgRole,
): Promise<void> {
  await context(db, orgId, actor.userId);
  await db.transaction(async (tx) => {
    await lockOrganisation(tx, orgId);
    // Checked again under the lock: the answers cannot change until this finishes.
    if ((await myRole(tx, orgId, actor.userId)) !== 'owner')
      throw forbidden('Only an owner can change roles.');
    const m = await memberIn(tx, orgId, memberId);
    if (roleOf(m.role) === 'owner' && role !== 'owner' && (await ownerCount(tx, orgId)) <= 1)
      throw new ApiError(409, 'last-owner', 'An organisation needs at least one owner.');
    await tx.update(members).set({ role }).where(eq(members.id, memberId));
    // Someone who can no longer invite people has their unanswered invitations withdrawn.
    if (!canManage(role)) await withdrawInvitations(tx, orgId, m.userId);
    await audit(tx, actor, {
      action: 'org.member.role-changed',
      organizationId: orgId,
      targetType: 'member',
      targetId: memberId,
      meta: { from: roleOf(m.role), to: role },
    });
  });
}

/** Cancel the invitations someone sent that nobody has answered yet. */
async function withdrawInvitations(tx: Tx, orgId: string, inviterId: string): Promise<void> {
  await tx
    .update(invitations)
    .set({ status: 'canceled' })
    .where(
      and(
        eq(invitations.organizationId, orgId),
        eq(invitations.inviterId, inviterId),
        eq(invitations.status, 'pending'),
      ),
    );
}

/** Remove someone from the team — or leave it yourself. */
export async function removeMember(
  db: Database,
  actor: Actor,
  orgId: string,
  memberId: string,
): Promise<void> {
  await context(db, orgId, actor.userId);
  await db.transaction(async (tx) => {
    await lockOrganisation(tx, orgId);
    const mine = await myRole(tx, orgId, actor.userId);
    if (!mine) throw notFound('Organisation');
    const m = await memberIn(tx, orgId, memberId);
    const self = m.userId === actor.userId;
    const target = roleOf(m.role);
    if (!self) {
      if (!canManage(mine)) throw forbidden();
      if (target === 'owner' && mine !== 'owner')
        throw forbidden('Only an owner can remove another owner.');
    }
    if (target === 'owner' && (await ownerCount(tx, orgId)) <= 1)
      throw new ApiError(
        409,
        'last-owner',
        'An organisation needs at least one owner. Make someone else an owner first, or delete the organisation.',
      );
    await tx.delete(members).where(eq(members.id, memberId));
    // What they sent out goes with them: an invitation must not outlive its sender's place
    // in the team (a removed admin's accomplice could otherwise still join as an admin).
    await withdrawInvitations(tx, orgId, m.userId);
    await audit(tx, actor, {
      action: self ? 'org.member.left' : 'org.member.removed',
      organizationId: orgId,
      targetType: 'member',
      targetId: memberId,
    });
  });
}

// ─────────────────────────────── Invitations (for the invitee) ───────────────────────────────

async function pendingInvitationsFor(db: Database, email: string) {
  const rows = await db
    .select({
      id: invitations.id,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      organisation: organizations.name,
      inviter: users.name,
    })
    .from(invitations)
    .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
    .innerJoin(users, eq(users.id, invitations.inviterId))
    .where(
      and(
        sql`lower(${invitations.email}) = ${email.toLowerCase()}`,
        eq(invitations.status, 'pending'),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(invitations.createdAt));
  return rows.map((r) => ({
    id: r.id,
    organisation: r.organisation,
    inviter: r.inviter,
    role: roleOf(r.role),
    expiresAt: r.expiresAt.toISOString(),
  }));
}

async function invitationRow(db: Database, id: string) {
  const [row] = await db
    .select({
      invitation: invitations,
      organisation: organizations.name,
      kind: orgProfiles.kind,
      inviter: users.name,
    })
    .from(invitations)
    .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
    .leftJoin(orgProfiles, eq(orgProfiles.organizationId, invitations.organizationId))
    .innerJoin(users, eq(users.id, invitations.inviterId))
    .where(eq(invitations.id, id))
    .limit(1);
  if (!row) throw notFound('Invitation');
  return row;
}

type InvitationStatus = InvitationView['status'];

function statusOf(i: typeof invitations.$inferSelect): InvitationStatus {
  if (i.status === 'pending' && i.expiresAt <= new Date()) return 'expired';
  return (['pending', 'accepted', 'rejected', 'canceled'] as const).includes(i.status as 'pending')
    ? (i.status as InvitationStatus)
    : 'canceled';
}

export async function invitationView(
  db: Database,
  viewer: { id: string; email: string | null; isGuest: boolean } | null,
  id: string,
): Promise<InvitationView> {
  const row = await invitationRow(db, id);
  const i = row.invitation;
  const status = statusOf(i);
  const forYou = Boolean(
    viewer && !viewer.isGuest && viewer.email?.toLowerCase() === i.email.toLowerCase(),
  );
  const verified = forYou && viewer ? await emailVerified(db, viewer.id) : false;
  const inTeam =
    forYou && viewer && status === 'accepted'
      ? Boolean(await myRole(db, i.organizationId, viewer.id))
      : false;
  return {
    id: i.id,
    organisation: { name: row.organisation, kind: kindOf(row.kind) },
    inviter: row.inviter,
    role: roleOf(i.role),
    status,
    emailHint: maskEmail(i.email),
    forYou,
    needsVerification: forYou && !verified && status === 'pending',
    organisationId: inTeam ? i.organizationId : null,
  };
}

export async function respondToInvitation(
  db: Database,
  actor: Actor & { email: string },
  id: string,
  accept: boolean,
): Promise<{ organisationId: string }> {
  const row = await invitationRow(db, id);
  const i = row.invitation;
  if (i.email.toLowerCase() !== actor.email.toLowerCase())
    throw forbidden('This invitation was sent to a different email address.');
  // The link alone proves nothing (colleagues may have seen it): the address must be confirmed.
  if (!(await emailVerified(db, actor.userId)))
    throw verifyFirst('Confirm your email address first: we can send you a link.');
  const status = statusOf(i);
  if (status !== 'pending')
    throw new ApiError(409, status, 'This invitation can no longer be answered.');
  await db.transaction(async (tx) => {
    // Only a still-pending invitation can be answered, once (a cancellation may have just won).
    const answered = await tx
      .update(invitations)
      .set({ status: accept ? 'accepted' : 'rejected' })
      .where(
        and(
          eq(invitations.id, id),
          eq(invitations.status, 'pending'),
          gt(invitations.expiresAt, new Date()),
        ),
      )
      .returning({ id: invitations.id });
    if (!answered.length)
      throw new ApiError(409, 'answered', 'This invitation can no longer be answered.');
    // Checked again as it is accepted: whoever sent it must still be allowed to bring people
    // in (and only an owner's invitation can make an admin).
    if (accept) {
      const sender = i.inviterId ? await myRole(tx, i.organizationId, i.inviterId) : null;
      if (!sender || !canManage(sender) || (roleOf(i.role) === 'admin' && sender !== 'owner'))
        throw new ApiError(409, 'withdrawn', 'This invitation can no longer be answered.');
    }
    if (accept)
      await tx
        .insert(members)
        .values({
          id: newId(),
          organizationId: i.organizationId,
          userId: actor.userId,
          role: roleOf(i.role) === 'owner' ? 'admin' : roleOf(i.role),
        })
        .onConflictDoNothing();
    await audit(tx, actor, {
      action: accept ? 'org.member.joined' : 'org.member.declined',
      organizationId: i.organizationId,
      targetType: 'invitation',
      targetId: id,
    });
  });
  return { organisationId: i.organizationId };
}

// ─────────────────────────────── Joining a programme (participants) ───────────────────────────────

async function programmeByCode(db: Database, raw: string) {
  const code = normalizeJoinCode(raw);
  if (!code) throw notFound('Programme');
  const [row] = await db
    .select({ programme: orgProgrammes, organisation: organizations, profile: orgProfiles })
    .from(orgProgrammes)
    .innerJoin(organizations, eq(organizations.id, orgProgrammes.organizationId))
    .leftJoin(orgProfiles, eq(orgProfiles.organizationId, orgProgrammes.organizationId))
    .where(eq(orgProgrammes.joinCode, code))
    .limit(1);
  if (!row) throw notFound('Programme');
  return row;
}

async function enrolmentOf(db: Reader, programmeId: string, userId: string) {
  const [row] = await db
    .select({ counted: orgEnrolments.counted })
    .from(orgEnrolments)
    .where(and(eq(orgEnrolments.programmeId, programmeId), eq(orgEnrolments.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function joinPreview(
  db: Database,
  userId: string | null,
  rawCode: string,
  locale: string,
): Promise<JoinPreview> {
  const { programme: p, organisation, profile } = await programmeByCode(db, rawCode);
  const mine = userId ? await enrolmentOf(db, p.id, userId) : null;
  const allowed = mine?.counted && userId ? (await getConsents(db, userId)).org_aggregates : false;
  return {
    code: p.joinCode,
    codeDisplay: formatJoinCode(p.joinCode),
    programme: {
      id: p.id,
      name: p.name,
      description: p.description,
      startsOn: p.startsOn,
      endsOn: p.endsOn,
      targetRoles: roles(p.targetRoleIds, locale),
    },
    organisation: {
      name: organisation.name,
      kind: kindOf(profile?.kind),
      country: profile?.country ?? null,
    },
    k: effectiveK(profile?.kAnonMin ?? 50, platformK()),
    open: !p.archivedAt,
    joined: Boolean(mine),
    counted: Boolean(mine?.counted && allowed),
  };
}

export async function joinProgramme(
  db: Database,
  userId: string,
  rawCode: string,
  input: z.infer<typeof JoinInputSchema>,
): Promise<{ programmeId: string }> {
  const { programme: p } = await programmeByCode(db, rawCode);
  const mine = await enrolmentOf(db, p.id, userId);
  if (p.archivedAt && !mine)
    throw new ApiError(409, 'closed', 'This programme is no longer taking new people.');
  await db.transaction(async (tx) => {
    // The permission is recorded first, then the enrolment it covers, together or not at all.
    // Choosing not to be counted here changes nothing anywhere else.
    if (input.countMe) await setConsents(tx, userId, { org_aggregates: true }, 'prompt');
    await tx
      .insert(orgEnrolments)
      .values({
        programmeId: p.id,
        userId,
        counted: input.countMe,
        countedSince: input.countMe ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: [orgEnrolments.programmeId, orgEnrolments.userId],
        set: { counted: input.countMe, countedSince: countedSinceFor(input.countMe) },
      });
  });
  return { programmeId: p.id };
}

/** Choose whether one programme counts you (from its next weekly totals). */
export async function setProgrammeCounted(
  db: Database,
  userId: string,
  programmeId: string,
  counted: boolean,
): Promise<void> {
  await db.transaction(async (tx) => {
    if (counted) await setConsents(tx, userId, { org_aggregates: true }, 'settings');
    const res = await tx
      .update(orgEnrolments)
      .set({ counted, countedSince: countedSinceFor(counted) })
      .where(and(eq(orgEnrolments.programmeId, programmeId), eq(orgEnrolments.userId, userId)))
      .returning({ id: orgEnrolments.programmeId });
    if (!res.length) throw notFound('Programme');
  });
}

export async function myProgrammes(
  db: Database,
  userId: string,
  locale: string,
): Promise<MyProgrammes> {
  const rows = await db
    .select({
      programme: orgProgrammes,
      organisation: organizations.name,
      kind: orgProfiles.kind,
      joinedAt: orgEnrolments.enrolledAt,
      counted: orgEnrolments.counted,
    })
    .from(orgEnrolments)
    .innerJoin(orgProgrammes, eq(orgProgrammes.id, orgEnrolments.programmeId))
    .innerJoin(organizations, eq(organizations.id, orgProgrammes.organizationId))
    .leftJoin(orgProfiles, eq(orgProfiles.organizationId, orgProgrammes.organizationId))
    .where(eq(orgEnrolments.userId, userId))
    .orderBy(desc(orgEnrolments.enrolledAt));
  return {
    programmes: rows.map((r) => ({
      id: r.programme.id,
      name: r.programme.name,
      organisation: r.organisation,
      kind: kindOf(r.kind),
      targetRoles: roles(r.programme.targetRoleIds, locale),
      joinedAt: r.joinedAt.toISOString(),
      archived: Boolean(r.programme.archivedAt),
      counted: r.counted,
    })),
    countingAllowed: (await getConsents(db, userId)).org_aggregates,
  };
}

export async function leaveProgramme(
  db: Database,
  userId: string,
  programmeId: string,
): Promise<void> {
  const res = await db
    .delete(orgEnrolments)
    .where(and(eq(orgEnrolments.programmeId, programmeId), eq(orgEnrolments.userId, userId)))
    .returning({ id: orgEnrolments.programmeId });
  if (!res.length) throw notFound('Programme');
}

// ─────────────────────────────── Account deletion ───────────────────────────────

/**
 * Before an account is deleted: organisations it is the only owner of pass to their
 * longest-standing admin — never to a read-only member, who was not trusted with the
 * organisation — or are deleted when there is no admin. People in its programmes keep all
 * their own data either way.
 */
export async function handOverOrganisations(tx: Tx, userId: string): Promise<void> {
  const owned = await tx
    .select({ orgId: members.organizationId })
    .from(members)
    .where(eq(members.userId, userId));
  for (const { orgId } of owned) {
    await lockOrganisation(tx, orgId);
    // Read under the lock: a role may have changed a moment ago.
    if ((await myRole(tx, orgId, userId)) !== 'owner') continue;
    const team = await tx
      .select({ id: members.id, userId: members.userId, role: members.role })
      .from(members)
      .where(eq(members.organizationId, orgId))
      .orderBy(asc(members.createdAt));
    const others = team.filter((m) => m.userId !== userId);
    if (others.some((m) => roleOf(m.role) === 'owner')) continue;
    const heir = others.find((m) => roleOf(m.role) === 'admin');
    if (heir) {
      await tx.update(members).set({ role: 'owner' }).where(eq(members.id, heir.id));
      await audit(tx, null, {
        action: 'org.owner.handed-over',
        organizationId: orgId,
        targetType: 'member',
        targetId: heir.id,
      });
    } else {
      await audit(tx, null, {
        action: 'org.deleted',
        targetType: 'organization',
        targetId: orgId,
        meta: { reason: 'owner-account-deleted' },
      });
      await tx.delete(organizations).where(eq(organizations.id, orgId));
    }
  }
}

/** Organisations that would be deleted with this account (no other owner and no admin). */
export async function organisationsLostWithAccount(
  db: Database,
  userId: string,
): Promise<string[]> {
  const mine = await db
    .select({ orgId: members.organizationId, role: members.role, name: organizations.name })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .where(eq(members.userId, userId));
  const lost: string[] = [];
  for (const m of mine) {
    if (roleOf(m.role) !== 'owner') continue;
    const team = await db
      .select({ userId: members.userId, role: members.role })
      .from(members)
      .where(eq(members.organizationId, m.orgId));
    const heirs = team.filter(
      (t) => t.userId !== userId && (roleOf(t.role) === 'owner' || roleOf(t.role) === 'admin'),
    );
    if (!heirs.length) lost.push(m.name);
  }
  return lost.sort((a, b) => a.localeCompare(b));
}
