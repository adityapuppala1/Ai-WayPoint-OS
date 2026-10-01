/**
 * People in the console (admins only): finding an account, what the platform holds about it
 * as an account (never what the person wrote for themselves: no journal, mood, health, money,
 * conversations or notes), and looking after it: holding it back (a ban, with a reason and an
 * end), signing it out everywhere, its role, and deleting it. Staff are invited by email.
 * Opening an account and every action on it are audited.
 */
import { z } from '@hono/zod-openapi';
import { isStaffRole, STAFF_ROLES } from '@waypoint/core/console';
import { getEnv } from '@waypoint/core/env';
import { newId } from '@waypoint/core/ids';
import { plainName, sealWithKek } from '@waypoint/core/privacy';
import {
  and,
  asc,
  type Database,
  desc,
  enqueueMessage,
  eq,
  gt,
  ilike,
  inArray,
  members,
  or,
  plans,
  profiles,
  type SQL,
  sessions,
  sql,
  staffInvitations,
  users,
} from '@waypoint/db';
import { type Actor, audit } from '../lib/audit';
import { ApiError, badRequest, conflict, forbidden, notFound } from '../lib/problem';
import { keyedHash, rateLimit } from '../lib/request';
import { deleteAccount } from './privacy';

const num = (v: unknown) => Number(v ?? 0);
const PAGE = 50;

// ────────────────────────────────── Finding ──────────────────────────────────

export const AccountQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  kind: z.enum(['all', 'accounts', 'guests', 'staff']).default('accounts'),
  status: z.enum(['all', 'active', 'held', 'unconfirmed']).default('all'),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  sort: z.enum(['joined', 'active', 'name']).default('joined'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

const AccountRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Null for a guest (who has none). */
  email: z.string().nullable(),
  /** The last three digits only. */
  phone: z.string().nullable(),
  role: z.string().nullable(),
  isGuest: z.boolean(),
  verified: z.boolean(),
  held: z.boolean(),
  heldUntil: z.string().nullable(),
  country: z.string().nullable(),
  locale: z.string().nullable(),
  joinedAt: z.string(),
  lastActiveAt: z.string().nullable(),
});

export const AccountListSchema = z
  .object({
    items: z.array(AccountRowSchema),
    total: z.number().int(),
    page: z.number().int(),
    pages: z.number().int(),
    counts: z.object({
      accounts: z.number().int(),
      guests: z.number().int(),
      staff: z.number().int(),
      held: z.number().int(),
      unconfirmed: z.number().int(),
    }),
  })
  .openapi('AccountList');

export type AccountList = z.infer<typeof AccountListSchema>;

const guest = sql`coalesce(${users.isAnonymous}, false)`;
const lastActive = sql<
  string | null
>`(select max(s.updated_at)::text from sessions s where s.user_id = ${users.id})`;
const heldNow = sql`coalesce(${users.banned}, false) and (${users.banExpires} is null or ${users.banExpires} > now())`;

const maskPhone = (phone: string | null) => (phone ? `•••${phone.slice(-3)}` : null);

export async function listAccounts(
  db: Database,
  input: z.infer<typeof AccountQuerySchema>,
): Promise<AccountList> {
  const where: SQL[] = [];
  if (input.kind === 'accounts') where.push(sql`not ${guest}`);
  if (input.kind === 'guests') where.push(sql`${guest}`);
  if (input.kind === 'staff') where.push(inArray(users.role, [...STAFF_ROLES]));
  if (input.status === 'held') where.push(heldNow);
  if (input.status === 'active') where.push(sql`not (${heldNow})`);
  if (input.status === 'unconfirmed') where.push(sql`not ${guest} and not ${users.emailVerified}`);
  if (input.country) where.push(eq(profiles.country, input.country));
  if (input.q) {
    const like = `%${input.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    where.push(
      or(
        ilike(users.name, like),
        ilike(users.email, like),
        sql`${users.phoneNumber} like ${like}`,
        eq(users.id, input.q),
      ) as SQL,
    );
  }
  const filter = where.length ? and(...where) : undefined;
  const order =
    input.sort === 'name'
      ? users.name
      : input.sort === 'active'
        ? sql`${lastActive} nulls last`
        : users.createdAt;
  const [rows, [total], [counts]] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phoneNumber,
        role: users.role,
        isGuest: guest,
        verified: users.emailVerified,
        held: heldNow,
        heldUntil: users.banExpires,
        country: profiles.country,
        locale: profiles.locale,
        joinedAt: users.createdAt,
        lastActiveAt: lastActive,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(filter)
      .orderBy(input.dir === 'asc' ? asc(order) : desc(order), asc(users.id))
      .limit(PAGE)
      .offset((input.page - 1) * PAGE),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(filter),
    db
      .select({
        accounts: sql<number>`count(*) filter (where not ${guest})::int`,
        guests: sql<number>`count(*) filter (where ${guest})::int`,
        staff: sql<number>`count(*) filter (where ${users.role} in ('admin', 'staff'))::int`,
        held: sql<number>`count(*) filter (where ${heldNow})::int`,
        unconfirmed: sql<number>`count(*) filter (where not ${guest} and not ${users.emailVerified})::int`,
      })
      .from(users),
  ]);
  const n = num(total?.n);
  return {
    items: rows.map((r) => ({
      id: r.id,
      name: r.isGuest ? '' : plainName(r.name, 80),
      email: r.isGuest ? null : r.email,
      phone: maskPhone(r.phone),
      role: r.role,
      isGuest: Boolean(r.isGuest),
      verified: r.verified,
      held: Boolean(r.held),
      heldUntil: r.heldUntil ? r.heldUntil.toISOString() : null,
      country: r.country,
      locale: r.locale,
      joinedAt: r.joinedAt.toISOString(),
      lastActiveAt: r.lastActiveAt ? new Date(r.lastActiveAt).toISOString() : null,
    })),
    total: n,
    page: input.page,
    pages: Math.max(1, Math.ceil(n / PAGE)),
    counts: {
      accounts: num(counts?.accounts),
      guests: num(counts?.guests),
      staff: num(counts?.staff),
      held: num(counts?.held),
      unconfirmed: num(counts?.unconfirmed),
    },
  };
}

// ────────────────────────────────── One account ──────────────────────────────────

export const AccountDetailSchema = z
  .object({
    account: AccountRowSchema.extend({
      heldReason: z.string().nullable(),
      timezone: z.string().nullable(),
      situation: z.string().nullable(),
    }),
    /** Where they are signed in: devices described by kind, never an address. */
    sessions: z.array(z.object({ device: z.string(), lastSeenAt: z.string() })),
    /** How much of the shared parts they use (counts only; nothing they wrote). */
    uses: z.object({ plans: z.number().int(), organisations: z.number().int() }),
    /** What staff did to this account, newest first. */
    history: z.array(z.object({ action: z.string(), at: z.string(), by: z.string().nullable() })),
  })
  .openapi('AccountDetail');

/** A device in words, from its user agent: browser and system families only. */
export function deviceOf(userAgent: string | null): string {
  const ua = userAgent ?? '';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : /okhttp|Expo|Dalvik|CFNetwork/i.test(ua)
            ? 'Waypoint app'
            : 'Other';
  const system = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iOS/.test(ua)
      ? 'iOS'
      : /Mac OS X|Macintosh/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  return system ? `${browser}, ${system}` : browser;
}

export async function accountDetail(
  db: Database,
  actor: Actor,
  id: string,
): Promise<z.infer<typeof AccountDetailSchema>> {
  const list = await listAccounts(db, AccountQuerySchema.parse({ q: id, kind: 'all' }));
  const row = list.items.find((r) => r.id === id);
  if (!row) throw notFound();
  const [[extra], deviceRows, [planCount], [orgCount], history] = await Promise.all([
    db
      .select({
        reason: users.banReason,
        timezone: profiles.timezone,
        situation: profiles.situation,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.id, id)),
    db
      .select({ ua: sessions.userAgent, at: sessions.updatedAt })
      .from(sessions)
      .where(and(eq(sessions.userId, id), gt(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.updatedAt))
      .limit(20),
    db.select({ n: sql<number>`count(*)::int` }).from(plans).where(eq(plans.userId, id)),
    db.select({ n: sql<number>`count(*)::int` }).from(members).where(eq(members.userId, id)),
    db.execute<{ action: string; at: string; by: string | null }>(sql`
      select a.action, a.created_at::text as at, u.name as by
      from audit_log a left join users u on u.id = a.actor_user_id
      where a.target_type = 'user' and a.target_id = ${id}
      order by a.created_at desc limit 30`),
  ]);
  // Who opened whose account is recorded too.
  await audit(db, actor, { action: 'user.view', targetType: 'user', targetId: id });
  return {
    account: {
      ...row,
      heldReason: extra?.reason ?? null,
      timezone: extra?.timezone ?? null,
      situation: extra?.situation ?? null,
    },
    sessions: deviceRows.map((s) => ({ device: deviceOf(s.ua), lastSeenAt: s.at.toISOString() })),
    uses: { plans: num(planCount?.n), organisations: num(orgCount?.n) },
    history: history.rows.map((h) => ({
      action: h.action,
      at: new Date(h.at).toISOString(),
      by: h.by ? plainName(h.by, 60) : null,
    })),
  };
}

// ────────────────────────────────── Looking after it ──────────────────────────────────

export const AccountActionSchema = z
  .discriminatedUnion('action', [
    z.object({
      action: z.literal('hold'),
      reason: z.string().trim().min(3).max(300),
      until: z.iso.datetime({ offset: true }).nullable(),
    }),
    z.object({ action: z.literal('release') }),
    z.object({ action: z.literal('sign-out') }),
    z.object({ action: z.literal('role'), role: z.enum(['member', 'staff', 'admin']) }),
    z.object({ action: z.literal('delete'), confirm: z.string().trim() }),
  ])
  .openapi('AccountAction');

async function target(db: Database, actor: Actor, id: string) {
  if (id === actor.userId) throw forbidden('Ask another admin to do this to your own account.');
  const [row] = await db
    .select({ id: users.id, role: users.role, email: users.email, guest })
    .from(users)
    .where(eq(users.id, id));
  if (!row) throw notFound();
  return row;
}

export async function actOnAccount(
  db: Database,
  actor: Actor,
  id: string,
  input: z.infer<typeof AccountActionSchema>,
): Promise<void> {
  const person = await target(db, actor, id);
  if (input.action === 'hold') {
    if (isStaffRole(person.role))
      throw conflict('Change their role first: a member of staff is not held back.');
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          banned: true,
          banReason: input.reason,
          banExpires: input.until ? new Date(input.until) : null,
        })
        .where(eq(users.id, id));
      // Held back now, not at their next sign-in.
      await tx.delete(sessions).where(eq(sessions.userId, id));
      await audit(tx, actor, {
        action: 'user.hold',
        targetType: 'user',
        targetId: id,
        meta: { until: input.until },
      });
    });
    return;
  }
  if (input.action === 'release') {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ banned: false, banReason: null, banExpires: null })
        .where(eq(users.id, id));
      await audit(tx, actor, { action: 'user.release', targetType: 'user', targetId: id });
    });
    return;
  }
  if (input.action === 'sign-out') {
    await db.transaction(async (tx) => {
      const gone = await tx
        .delete(sessions)
        .where(eq(sessions.userId, id))
        .returning({ id: sessions.id });
      await audit(tx, actor, {
        action: 'user.sign-out',
        targetType: 'user',
        targetId: id,
        meta: { sessions: gone.length },
      });
    });
    return;
  }
  if (input.action === 'role') {
    if (person.guest) throw conflict('A guest has no account to give a role to.');
    const role = input.role === 'member' ? null : input.role;
    await db.transaction(async (tx) => {
      if (person.role === 'admin' && role !== 'admin') {
        const [admins] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(users)
          .where(eq(users.role, 'admin'));
        if (num(admins?.n) <= 1) throw conflict('Waypoint needs at least one admin.');
      }
      await tx.update(users).set({ role }).where(eq(users.id, id));
      // Their sessions carry the old role: they sign in again with the new one.
      await tx.delete(sessions).where(eq(sessions.userId, id));
      await audit(tx, actor, {
        action: 'user.role',
        targetType: 'user',
        targetId: id,
        meta: { from: person.role ?? 'member', to: input.role },
      });
    });
    return;
  }
  // Deleting: the admin types the address (or "guest") to show they mean this account.
  const expected = person.guest ? 'guest' : (person.email ?? '').toLowerCase();
  if (input.confirm.toLowerCase() !== expected)
    throw badRequest('Type the address of the account to delete it.', {
      issues: [{ path: 'confirm', message: 'Type the address of the account to delete it.' }],
    });
  if (isStaffRole(person.role))
    throw conflict('Change their role first: staff are not deleted from here.');
  // The record says an account was deleted by staff, never whose (the person is gone).
  await audit(db, actor, {
    action: 'user.delete',
    targetType: 'user',
    meta: { guest: person.guest },
  });
  await deleteAccount(db, id);
}

// ────────────────────────────────── Staff and invitations ──────────────────────────────────

const INVITE_DAYS = 7;
const INVITES_PER_DAY = 30;

export const StaffSchema = z
  .object({
    staff: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        role: z.enum(STAFF_ROLES),
        lastActiveAt: z.string().nullable(),
        joinedAt: z.string(),
      }),
    ),
    invitations: z.array(
      z.object({
        id: z.string(),
        email: z.string(),
        role: z.enum(STAFF_ROLES),
        status: z.enum(['pending', 'accepted', 'declined', 'revoked', 'expired']),
        invitedBy: z.string().nullable(),
        createdAt: z.string(),
        expiresAt: z.string(),
      }),
    ),
  })
  .openapi('Staff');

export async function staffView(db: Database): Promise<z.infer<typeof StaffSchema>> {
  const [team, invites] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        lastActiveAt: lastActive,
        joinedAt: users.createdAt,
      })
      .from(users)
      .where(inArray(users.role, [...STAFF_ROLES]))
      .orderBy(asc(users.name)),
    db.execute<{
      id: string;
      email: string;
      role: string;
      status: string;
      by: string | null;
      created_at: string;
      expires_at: string;
    }>(sql`
      select i.id, i.email, i.role, i.status, u.name as by, i.created_at::text, i.expires_at::text
      from staff_invitations i left join users u on u.id = i.inviter_id
      order by i.created_at desc limit 50`),
  ]);
  const now = Date.now();
  return {
    staff: team.map((m) => ({
      id: m.id,
      name: plainName(m.name, 80),
      email: m.email,
      role: m.role as 'admin' | 'staff',
      lastActiveAt: m.lastActiveAt ? new Date(m.lastActiveAt).toISOString() : null,
      joinedAt: m.joinedAt.toISOString(),
    })),
    invitations: invites.rows.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role as 'admin' | 'staff',
      status: (i.status === 'pending' && new Date(i.expires_at).getTime() < now
        ? 'expired'
        : i.status) as 'pending',
      invitedBy: i.by ? plainName(i.by, 60) : null,
      createdAt: new Date(i.created_at).toISOString(),
      expiresAt: new Date(i.expires_at).toISOString(),
    })),
  };
}

export const InviteStaffSchema = z
  .object({ email: z.email().max(254), role: z.enum(STAFF_ROLES) })
  .openapi('InviteStaff');

/** Invites someone by email to join the staff; they answer once signed in with that address. */
export async function inviteStaff(
  db: Database,
  actor: Actor,
  input: z.infer<typeof InviteStaffSchema>,
  locale: string,
): Promise<{ id: string }> {
  const email = input.email.trim().toLowerCase();
  const [existing] = await db
    .select({ role: users.role })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  if (isStaffRole(existing?.role))
    throw new ApiError(409, 'already-staff', 'That person is already on the staff.');
  await rateLimit(db, `staff-invites:${actor.userId}`, {
    max: INVITES_PER_DAY,
    windowSeconds: 86_400,
  });
  await rateLimit(db, `staff-invites-to:${keyedHash(email, 'invite-address')}`, {
    max: 3,
    windowSeconds: 86_400,
  });
  const [inviter] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, actor.userId));
  return db.transaction(async (tx) => {
    // A new invitation replaces any still waiting for that address.
    await tx
      .update(staffInvitations)
      .set({ status: 'revoked', answeredAt: new Date() })
      .where(and(eq(staffInvitations.email, email), eq(staffInvitations.status, 'pending')));
    const id = newId();
    await tx.insert(staffInvitations).values({
      id,
      email,
      role: input.role,
      status: 'pending',
      inviterId: actor.userId,
      expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
    });
    await enqueueMessage(tx, {
      channel: 'email',
      recipientRef: sealWithKek(email, 'outbox'),
      payload: {
        template: 'staff-invite',
        inviter: plainName(inviter?.name),
        role: input.role,
        locale,
      },
      secret: { url: `${getEnv().WAYPOINT_URL}/staff-invite/${id}` },
    });
    await audit(tx, actor, {
      action: 'staff.invite',
      targetType: 'staff-invitation',
      targetId: id,
      meta: { role: input.role },
    });
    return { id };
  });
}

export async function revokeStaffInvitation(db: Database, actor: Actor, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const done = await tx
      .update(staffInvitations)
      .set({ status: 'revoked', answeredAt: new Date() })
      .where(and(eq(staffInvitations.id, id), eq(staffInvitations.status, 'pending')))
      .returning({ id: staffInvitations.id });
    if (!done.length) throw notFound();
    await audit(tx, actor, {
      action: 'staff.revoke',
      targetType: 'staff-invitation',
      targetId: id,
    });
  });
}

export const StaffInvitationSchema = z
  .object({
    role: z.enum(STAFF_ROLES),
    invitedBy: z.string().nullable(),
    expiresAt: z.string(),
  })
  .openapi('StaffInvitation');

/**
 * The invitation as its invitee sees it. Only someone signed in with the invited address, and
 * who has confirmed it, can see or answer it; to anyone else it does not exist.
 */
async function invitationFor(db: Database, id: string, userId: string) {
  const [me] = await db
    .select({ email: users.email, verified: users.emailVerified, guest })
    .from(users)
    .where(eq(users.id, userId));
  if (!me || me.guest) throw notFound();
  const [invite] = await db
    .select()
    .from(staffInvitations)
    .where(
      and(
        eq(staffInvitations.id, id),
        eq(staffInvitations.status, 'pending'),
        gt(staffInvitations.expiresAt, new Date()),
        sql`${staffInvitations.email} = lower(${me.email})`,
      ),
    );
  if (!invite) throw notFound();
  if (!me.verified)
    throw new ApiError(
      403,
      'verify-first',
      'Confirm your email address first, then open the invitation again.',
    );
  return invite;
}

export async function staffInvitation(
  db: Database,
  id: string,
  userId: string,
): Promise<z.infer<typeof StaffInvitationSchema>> {
  const invite = await invitationFor(db, id, userId);
  const [inviter] = invite.inviterId
    ? await db.select({ name: users.name }).from(users).where(eq(users.id, invite.inviterId))
    : [];
  return {
    role: invite.role as 'admin' | 'staff',
    invitedBy: inviter?.name ? plainName(inviter.name, 60) : null,
    expiresAt: invite.expiresAt.toISOString(),
  };
}

export const AnswerInvitationSchema = z
  .object({ answer: z.enum(['accept', 'decline']) })
  .openapi('AnswerStaffInvitation');

export async function answerStaffInvitation(
  db: Database,
  id: string,
  userId: string,
  answer: 'accept' | 'decline',
): Promise<void> {
  const invite = await invitationFor(db, id, userId);
  await db.transaction(async (tx) => {
    await tx
      .update(staffInvitations)
      .set({ status: answer === 'accept' ? 'accepted' : 'declined', answeredAt: new Date() })
      .where(eq(staffInvitations.id, id));
    // The route forgets the session's cached copy, so the new role applies at once.
    if (answer === 'accept')
      await tx.update(users).set({ role: invite.role }).where(eq(users.id, userId));
    await audit(
      tx,
      { userId },
      {
        action: answer === 'accept' ? 'staff.join' : 'staff.decline',
        targetType: 'staff-invitation',
        targetId: id,
        meta: { role: invite.role },
      },
    );
  });
}
