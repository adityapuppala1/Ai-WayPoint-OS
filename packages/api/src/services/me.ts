/**
 * The person: profile, consent and trusted contacts.
 * Consent is purpose-specific, off by default, and every change is recorded.
 */
import { z } from '@hono/zod-openapi';
import { countryFromTimeZone, normalizeCountry } from '@waypoint/content';
import {
  CONSENT_PURPOSES,
  type ConsentPurpose,
  LIFE_STAGES,
  LOCALES,
  PRIVACY_POLICY_VERSION,
  SITUATIONS,
  WORK_TYPES,
} from '@waypoint/core';
import { newId } from '@waypoint/core/ids';
import { newWrappedDek, openDek, openFor, SEALED, sealFor } from '@waypoint/core/privacy';
import {
  and,
  consentEvents,
  consents,
  type Database,
  desc,
  eq,
  orgEnrolments,
  profiles,
  trustedContacts,
  users,
} from '@waypoint/db';
import { oneAtATime } from '../lib/locks';
import { ApiError, notFound, unauthorized } from '../lib/problem';
import type { ApiUser, Consents } from '../types';

/** The privacy notice version each consent records (kept with the notice's dates in core). */
export { PRIVACY_POLICY_VERSION };

/**
 * A time zone by its name ("Africa/Nairobi"), never an offset: JavaScript accepts "+05:00", but
 * the database reads such offsets the other way round, and an offset knows nothing of summer time.
 */
export const isTimeZone = (tz: string) => {
  if (!/^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,2}$/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const ProfileSchema = z
  .object({
    displayName: z.string().nullable(),
    locale: z.enum(LOCALES),
    country: z.string().nullable(),
    region: z.string().nullable(),
    timezone: z.string(),
    lifeStage: z.enum(LIFE_STAGES).nullable(),
    situation: z.enum(SITUATIONS).nullable(),
    workType: z.enum(WORK_TYPES).nullable(),
    languages: z.array(z.string()),
    interests: z.array(z.string()),
    sectors: z.array(z.string()),
    currentRole: z.string().nullable(),
    hoursPerWeek: z.number().int(),
    learningBudget: z.enum(['free', 'low', 'any']),
    attentionBudget: z.number().int(),
    quietStart: z.string().nullable(),
    quietEnd: z.string().nullable(),
    liteMode: z.boolean(),
    theme: z.enum(['system', 'light', 'dark']),
    conversationRetentionDays: z.number().int().nullable(),
    onboardedAt: z.string().nullable(),
  })
  .openapi('Profile');

export type Profile = z.infer<typeof ProfileSchema>;

export const ProfilePatchSchema = z
  .object({
    displayName: z.string().trim().min(1).max(60).nullable(),
    locale: z.enum(LOCALES),
    country: z
      .string()
      .regex(/^[A-Za-z]{2}$/)
      .transform((v) => v.toUpperCase())
      .nullable(),
    region: z.string().trim().max(80).nullable(),
    timezone: z.string().max(64).refine(isTimeZone, 'Unknown time zone'),
    lifeStage: z.enum(LIFE_STAGES).nullable(),
    situation: z.enum(SITUATIONS).nullable(),
    workType: z.enum(WORK_TYPES).nullable(),
    languages: z.array(z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/)).max(8),
    interests: z.array(z.string().trim().min(1).max(40)).max(12),
    sectors: z.array(z.string().trim().min(1).max(40)).max(12),
    currentRole: z.string().trim().max(80).nullable(),
    hoursPerWeek: z.number().int().min(1).max(40),
    learningBudget: z.enum(['free', 'low', 'any']),
    attentionBudget: z.number().int().min(0).max(3),
    quietStart: hhmm.nullable(),
    quietEnd: hhmm.nullable(),
    liteMode: z.boolean(),
    theme: z.enum(['system', 'light', 'dark']),
    conversationRetentionDays: z
      .union([z.literal(7), z.literal(30), z.literal(90), z.literal(365)])
      .nullable(),
  })
  .partial()
  .openapi('ProfilePatch');

export type ProfilePatch = z.infer<typeof ProfilePatchSchema>;

export const ConsentsSchema = z
  .object(
    Object.fromEntries(CONSENT_PURPOSES.map((p) => [p, z.boolean()])) as Record<
      ConsentPurpose,
      z.ZodBoolean
    >,
  )
  .openapi('Consents');

export const MeSchema = z
  .object({
    user: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().nullable(),
      /** The email address is confirmed (needed to answer invitations and to invite). */
      emailVerified: z.boolean(),
      isGuest: z.boolean(),
      /**
       * A guest only: an account was created from this guest session and hasn't been signed
       * in to yet. Signing in to it on this device brings along what the guest did.
       */
      accountPending: z.boolean(),
      role: z.string().nullable(),
    }),
    profile: ProfileSchema,
    consents: ConsentsSchema,
    trustedContacts: z.number().int(),
  })
  .openapi('Me');

export type Me = z.infer<typeof MeSchema>;

type ProfileRow = typeof profiles.$inferSelect;

function toProfile(row: ProfileRow): Profile {
  const oneOf = <T extends readonly string[]>(list: T, v: string | null): T[number] | null =>
    v && (list as readonly string[]).includes(v) ? (v as T[number]) : null;
  return {
    displayName: row.displayName,
    locale: (LOCALES as readonly string[]).includes(row.locale)
      ? (row.locale as Profile['locale'])
      : 'en',
    country: row.country,
    region: row.region,
    timezone: row.timezone,
    lifeStage: oneOf(LIFE_STAGES, row.lifeStage),
    situation: oneOf(SITUATIONS, row.situation),
    workType: oneOf(WORK_TYPES, row.workType),
    languages: row.languages,
    interests: row.interests,
    sectors: row.sectors,
    currentRole: row.currentRole,
    hoursPerWeek: row.hoursPerWeek,
    learningBudget: (['free', 'low', 'any'].includes(row.learningBudget)
      ? row.learningBudget
      : 'free') as Profile['learningBudget'],
    attentionBudget: row.attentionBudget,
    quietStart: row.quietStart,
    quietEnd: row.quietEnd,
    liteMode: row.liteMode,
    theme: (['system', 'light', 'dark'].includes(row.theme)
      ? row.theme
      : 'system') as Profile['theme'],
    conversationRetentionDays: row.conversationRetentionDays,
    onboardedAt: row.onboardedAt?.toISOString() ?? null,
  };
}

/** The profile row, created on first use if the sign-up hook did not run (e.g. imported users). */
/**
 * Where to find help for this person: the country they chose, or else the one their time zone
 * belongs to. Used for emergency numbers and support lines only, so someone who skipped the
 * question still sees numbers that work where they are.
 */
export function helpCountry(profile: {
  country: string | null;
  timezone?: string | null;
}): string | null {
  return profile.country ?? countryFromTimeZone(profile.timezone) ?? null;
}

export async function getProfileRow(db: Database, userId: string): Promise<ProfileRow> {
  const [row] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (row) return row;
  // A session cached in a cookie can outlive a deleted account for a few seconds.
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw unauthorized();
  const [created] = await db
    .insert(profiles)
    .values({ userId, dekWrapped: newWrappedDek() })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [again] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!again) throw notFound('Profile');
  return again;
}

export async function getProfile(db: Database, userId: string): Promise<Profile> {
  return toProfile(await getProfileRow(db, userId));
}

export async function getConsents(db: Database, userId: string): Promise<Consents> {
  const rows = await db.select().from(consents).where(eq(consents.userId, userId));
  const out = Object.fromEntries(CONSENT_PURPOSES.map((p) => [p, false])) as Consents;
  for (const r of rows) {
    if ((CONSENT_PURPOSES as readonly string[]).includes(r.purpose))
      out[r.purpose as ConsentPurpose] = r.granted;
  }
  return out;
}

export async function setConsents(
  db: Database,
  userId: string,
  changes: Partial<Consents>,
  source: 'settings' | 'onboarding' | 'prompt' = 'settings',
): Promise<Consents> {
  const entries = Object.entries(changes).filter(
    (e): e is [ConsentPurpose, boolean] =>
      (CONSENT_PURPOSES as readonly string[]).includes(e[0]) && typeof e[1] === 'boolean',
  );
  if (entries.length) {
    const current = await getConsents(db, userId);
    const changed = entries.filter(([p, g]) => current[p] !== g);
    await db.transaction(async (tx) => {
      for (const [purpose, granted] of entries) {
        await tx
          .insert(consents)
          .values({ userId, purpose, granted, policyVersion: PRIVACY_POLICY_VERSION })
          .onConflictDoUpdate({
            target: [consents.userId, consents.purpose],
            set: { granted, policyVersion: PRIVACY_POLICY_VERSION, updatedAt: new Date() },
          });
      }
      // Turning counting off stops it everywhere: every programme's own choice goes back to
      // off, so turning it on again later never quietly restores an old choice.
      if (entries.some(([purpose, granted]) => purpose === 'org_aggregates' && !granted))
        await tx
          .update(orgEnrolments)
          .set({ counted: false, countedSince: null })
          .where(eq(orgEnrolments.userId, userId));
      if (changed.length) {
        await tx.insert(consentEvents).values(
          changed.map(([purpose, granted]) => ({
            userId,
            purpose,
            granted,
            policyVersion: PRIVACY_POLICY_VERSION,
            source,
          })),
        );
      }
    });
  }
  return getConsents(db, userId);
}

export async function updateProfile(
  db: Database,
  userId: string,
  patch: ProfilePatch,
): Promise<Profile> {
  await getProfileRow(db, userId);
  const values: Partial<typeof profiles.$inferInsert> = { ...patch, updatedAt: new Date() };
  if (patch.country !== undefined)
    values.country = patch.country ? (normalizeCountry(patch.country) ?? null) : null;
  await db.update(profiles).set(values).where(eq(profiles.userId, userId));
  return getProfile(db, userId);
}

export async function markOnboarded(db: Database, userId: string): Promise<void> {
  await db
    .update(profiles)
    .set({ onboardedAt: new Date(), updatedAt: new Date() })
    .where(eq(profiles.userId, userId));
}

/** Whether the account's email address is confirmed (read fresh, not from the session). */
export async function isEmailVerified(db: Database, userId: string): Promise<boolean> {
  const [u] = await db
    .select({ verified: users.emailVerified })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return Boolean(u?.verified);
}

/**
 * Whether an account was created from this guest session and is waiting for its first sign-in
 * (what the guest did moves into it then). Always false for anyone but a guest.
 */
export async function guestAccountPending(db: Database, guestId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(eq(profiles.guestOrigin, guestId))
    .limit(1);
  return Boolean(row);
}

export async function getMe(db: Database, user: ApiUser): Promise<Me> {
  const [profile, consentMap, contacts, [u], pending] = await Promise.all([
    getProfile(db, user.id),
    getConsents(db, user.id),
    db
      .select({ id: trustedContacts.id })
      .from(trustedContacts)
      .where(eq(trustedContacts.userId, user.id)),
    db
      .select({ name: users.name, email: users.email, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1),
    user.isGuest ? guestAccountPending(db, user.id) : Promise.resolve(false),
  ]);
  return {
    user: {
      id: user.id,
      name: u?.name ?? user.name,
      email: user.isGuest ? null : (u?.email ?? user.email),
      emailVerified: Boolean(u?.emailVerified),
      isGuest: user.isGuest,
      accountPending: pending,
      role: user.role,
    },
    profile,
    consents: consentMap,
    trustedContacts: contacts.length,
  };
}

// ───────────────────────────── Trusted contacts ─────────────────────────────

export const TrustedContactInputSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[\d\s().-]{6,20}$/, 'Enter a phone number with digits only')
      .optional(),
    email: z.email().max(120).optional(),
    relation: z.string().trim().max(40).optional(),
  })
  .refine((v) => v.phone || v.email, { message: 'Add a phone number or an email address' })
  .openapi('TrustedContactInput');

export const TrustedContactSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    relation: z.string().nullable(),
  })
  .openapi('TrustedContact');

export type TrustedContact = z.infer<typeof TrustedContactSchema>;

/** The person's data key, unwrapped for this request only. */
export async function userDek(db: Database, userId: string): Promise<Buffer> {
  const row = await getProfileRow(db, userId);
  if (!row.dekWrapped) throw notFound('Data key');
  return openDek(row.dekWrapped);
}

export async function listTrustedContacts(db: Database, userId: string): Promise<TrustedContact[]> {
  const rows = await db
    .select()
    .from(trustedContacts)
    .where(eq(trustedContacts.userId, userId))
    .orderBy(desc(trustedContacts.createdAt));
  if (!rows.length) return [];
  const dek = await userDek(db, userId);
  const t = SEALED.trustedContact;
  return rows.map((r) => ({
    id: r.id,
    name: openFor(dek, r.nameCt, t, userId, r.id),
    phone: r.phoneCt ? openFor(dek, r.phoneCt, t, userId, r.id) : null,
    email: r.emailCt ? openFor(dek, r.emailCt, t, userId, r.id) : null,
    relation: r.relation,
  }));
}

export async function addTrustedContact(
  db: Database,
  userId: string,
  input: z.infer<typeof TrustedContactInputSchema>,
): Promise<TrustedContact> {
  // Counted and saved one at a time per person, so the limit holds when requests arrive together.
  return oneAtATime(db, `contacts:${userId}`, (tx) => addTrustedContactUnlocked(tx, userId, input));
}

async function addTrustedContactUnlocked(
  db: Database,
  userId: string,
  input: z.infer<typeof TrustedContactInputSchema>,
): Promise<TrustedContact> {
  const existing = await db
    .select({ id: trustedContacts.id })
    .from(trustedContacts)
    .where(eq(trustedContacts.userId, userId));
  if (existing.length >= 3) {
    throw new ApiError(409, 'limit', 'You can save up to three trusted contacts.');
  }
  const dek = await userDek(db, userId);
  const id = newId();
  const t = SEALED.trustedContact;
  await db.insert(trustedContacts).values({
    id,
    userId,
    nameCt: sealFor(dek, input.name, t, userId, id),
    phoneCt: input.phone ? sealFor(dek, input.phone, t, userId, id) : null,
    emailCt: input.email ? sealFor(dek, input.email, t, userId, id) : null,
    relation: input.relation ?? null,
  });
  return {
    id,
    name: input.name,
    phone: input.phone ?? null,
    email: input.email ?? null,
    relation: input.relation ?? null,
  };
}

/**
 * Whether the support card should offer the person's own contacts: they switched that choice
 * on and saved at least one. The card never contacts anyone; its buttons open the phone's own
 * apps, and the details are fetched by the owner's own browser (see /me/trusted-contacts).
 */
export async function offersTrustedContact(db: Database, userId: string): Promise<boolean> {
  const [choice] = await db
    .select({ granted: consents.granted })
    .from(consents)
    .where(and(eq(consents.userId, userId), eq(consents.purpose, 'trusted_contact')))
    .limit(1);
  if (!choice?.granted) return false;
  const [contact] = await db
    .select({ id: trustedContacts.id })
    .from(trustedContacts)
    .where(eq(trustedContacts.userId, userId))
    .limit(1);
  return Boolean(contact);
}

export async function removeTrustedContact(
  db: Database,
  userId: string,
  id: string,
): Promise<void> {
  const res = await db
    .delete(trustedContacts)
    .where(and(eq(trustedContacts.id, id), eq(trustedContacts.userId, userId)))
    .returning({ id: trustedContacts.id });
  if (!res.length) throw notFound('Contact');
}
