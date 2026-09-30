/**
 * Tables owned by Better Auth (core + anonymous, admin, organization and passkey plugins).
 * Property names must match Better Auth's field names exactly. Any column we add here must be
 * nullable or defaulted; Waypoint's own per-person data lives in `profiles`.
 */
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

const ts = () => timestamp({ withTimezone: true });

export const users = pgTable('users', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: ts()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  // anonymous plugin
  isAnonymous: boolean().default(false),
  // admin plugin
  role: text(),
  banned: boolean().default(false),
  banReason: text(),
  banExpires: ts(),
  // phone-number plugin (sign in by SMS code; many people have a phone but no email)
  phoneNumber: text().unique(),
  phoneNumberVerified: boolean(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: text().primaryKey(),
    expiresAt: ts().notNull(),
    token: text().notNull().unique(),
    createdAt: ts().notNull().defaultNow(),
    updatedAt: ts()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // admin plugin
    impersonatedBy: text(),
    // organization plugin
    activeOrganizationId: text(),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
);

export const accounts = pgTable(
  'accounts',
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: ts(),
    refreshTokenExpiresAt: ts(),
    scope: text(),
    password: text(),
    createdAt: ts().notNull().defaultNow(),
    updatedAt: ts()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('accounts_user_id_idx').on(t.userId)],
);

export const verifications = pgTable(
  'verifications',
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: ts().notNull(),
    createdAt: ts().notNull().defaultNow(),
    updatedAt: ts()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)],
);

export const organizations = pgTable('organizations', {
  id: text().primaryKey(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  logo: text(),
  createdAt: ts().notNull().defaultNow(),
  metadata: text(),
});

export const members = pgTable(
  'members',
  {
    id: text().primaryKey(),
    organizationId: text()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text().notNull().default('member'),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [
    index('members_organization_id_idx').on(t.organizationId),
    index('members_user_id_idx').on(t.userId),
    // One seat per person per organisation (two rows could otherwise dodge the last-owner rule).
    uniqueIndex('members_org_user_idx').on(t.organizationId, t.userId),
  ],
);

export const invitations = pgTable(
  'invitations',
  {
    id: text().primaryKey(),
    organizationId: text()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text().notNull(),
    role: text(),
    status: text().notNull().default('pending'),
    expiresAt: ts().notNull(),
    createdAt: ts().notNull().defaultNow(),
    inviterId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [
    index('invitations_organization_id_idx').on(t.organizationId),
    index('invitations_email_idx').on(t.email),
  ],
);

export const passkeys = pgTable(
  'passkeys',
  {
    id: text().primaryKey(),
    name: text(),
    publicKey: text().notNull(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    credentialID: text().notNull(),
    counter: integer().notNull(),
    deviceType: text().notNull(),
    backedUp: boolean().notNull(),
    transports: text(),
    createdAt: ts(),
    aaguid: text(),
  },
  (t) => [
    index('passkeys_user_id_idx').on(t.userId),
    index('passkeys_credential_id_idx').on(t.credentialID),
  ],
);

export const rateLimits = pgTable('rate_limits', {
  id: text().primaryKey(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint({ mode: 'number' }).notNull(),
});

/** The object passed to Better Auth's Drizzle adapter: keys are Better Auth model names. */
export const authSchema = {
  user: users,
  session: sessions,
  account: accounts,
  verification: verifications,
  organization: organizations,
  member: members,
  invitation: invitations,
  passkey: passkeys,
  rateLimit: rateLimits,
};
