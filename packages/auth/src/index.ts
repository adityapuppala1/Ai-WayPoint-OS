/**
 * Authentication (Better Auth).
 *
 * Ways in, from least to most commitment:
 *  1. Guest — use Shield, Ask and plans with no account. Everything moves to the account later.
 *  2. Phone number + SMS code — for people without email.
 *  3. Email + password, and passkeys.
 * Organisations (employers, schools, NGOs) use the organization plugin; platform staff use admin.
 */
import { createHmac } from 'node:crypto';
import { queueAfterTransactionHook } from '@better-auth/core/context';
import { expo } from '@better-auth/expo';
import { passkey } from '@better-auth/passkey';
import { KEEP_GUEST_HEADER, LOCALES } from '@waypoint/core';
import { countryOfNumber, toE164 } from '@waypoint/core/channels';
import { devSecret, getEnv } from '@waypoint/core/env';
import { isUuid, newId } from '@waypoint/core/ids';
import { hasWebAddress, newWrappedDek, scrubLogText, sealWithKek } from '@waypoint/core/privacy';
import {
  and,
  authSchema,
  dbReady,
  enqueueMessage,
  eq,
  getDb,
  profiles,
  sql,
  users,
} from '@waypoint/db';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { betterAuth } from 'better-auth/minimal';
import { nextCookies } from 'better-auth/next-js';
import { admin, anonymous, openAPI, organization, phoneNumber } from 'better-auth/plugins';
import { discardGuest, mergeGuestIntoUser } from './merge';

export { discardGuest, mergeGuestIntoUser } from './merge';

/** The mobile app's own scheme: its requests carry this origin (see the expo plugin below). */
export const MOBILE_SCHEME = 'waypoint';

function trustedOrigins(): string[] {
  const env = getEnv();
  const extra = (env.WEB_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return [
    env.WAYPOINT_URL,
    ...extra,
    `${MOBILE_SCHEME}://`,
    // Expo Go and development builds sign in from exp://<computer>:8081 while you develop.
    ...(env.NODE_ENV === 'production' ? [] : ['exp://']),
  ];
}

function preferredLocale(headers?: Headers | null): string {
  if (!headers) return 'en';
  const cookie = headers.get('cookie') ?? '';
  const fromCookie = /(?:^|;\s*)NEXT_LOCALE=([a-zA-Z-]+)/.exec(cookie)?.[1];
  const candidates = [
    fromCookie,
    ...(headers.get('accept-language') ?? '').split(',').map((p) => p.split(';')[0]?.trim()),
  ];
  for (const c of candidates) {
    const base = c?.toLowerCase().split('-')[0];
    if (base && (LOCALES as readonly string[]).includes(base)) return base;
  }
  return 'en';
}

function timezoneFrom(headers?: Headers | null): string {
  const tz = /(?:^|;\s*)wp-tz=([^;]+)/.exec(headers?.get('cookie') ?? '')?.[1];
  if (!tz) return 'UTC';
  const decoded = decodeURIComponent(tz);
  try {
    new Intl.DateTimeFormat('en', { timeZone: decoded });
    return decoded;
  } catch {
    return 'UTC';
  }
}

/** Country from a trusted edge header when deployed behind one; never from IP lookups. */
function countryFrom(headers?: Headers | null): string | null {
  const c =
    headers?.get('cf-ipcountry') ??
    headers?.get('x-vercel-ip-country') ??
    headers?.get('x-country');
  return c && /^[A-Z]{2}$/.test(c) && c !== 'XX' ? c : null;
}

/**
 * Organisations are managed through /api/org, which applies Waypoint's privacy rules and writes
 * the audit log. The organization plugin's own endpoints are switched off so there is exactly
 * one way in (some, such as listing invitations by email, would bypass those rules).
 */
const ORGANIZATION_PATHS = [
  'accept-invitation',
  'add-team-member',
  'cancel-invitation',
  'check-slug',
  'create',
  'create-role',
  'create-team',
  'delete',
  'delete-role',
  'get-active-member',
  'get-active-member-role',
  'get-full-organization',
  'get-invitation',
  'get-organization',
  'get-role',
  'has-permission',
  'invite-member',
  'leave',
  'list',
  'list-invitations',
  'list-members',
  'list-roles',
  'list-team-members',
  'list-teams',
  'list-user-invitations',
  'list-user-teams',
  'reject-invitation',
  'remove-member',
  'remove-team',
  'remove-team-member',
  'set-active',
  'set-active-team',
  'update',
  'update-member-role',
  'update-role',
  'update-team',
].map((p) => `/organization/${p}`);

/**
 * The admin plugin only supplies the `role` field that marks platform staff. Its endpoints are
 * never used: impersonating someone, setting their password or listing everyone would let
 * staff read what people wrote (crisis-held posts, journals) with no record of it.
 */
const ADMIN_PATHS = [
  'ban-user',
  'create-user',
  'get-user',
  'has-permission',
  'impersonate-user',
  'list-user-sessions',
  'list-users',
  'remove-user',
  'revoke-user-session',
  'revoke-user-sessions',
  'set-role',
  'set-user-password',
  'stop-impersonating',
  'unban-user',
  'update-user',
].map((p) => `/admin/${p}`);

/**
 * Deleting an account goes through DELETE /api/me, which also hands organisations over and
 * removes circle posts. Changing the email address has no screen yet. Phone accounts sign in
 * with a code only: the plugin's password sign-in and its password reset (which sends nothing
 * to the number, so a code could be guessed unnoticed) stay off, as does the Expo plugin's
 * OAuth hand-off, which would redirect anywhere and Waypoint has no social sign-in.
 */
const ACCOUNT_PATHS = [
  '/delete-user',
  '/delete-user/callback',
  '/delete-anonymous-user',
  '/change-email',
  '/update-user',
  '/sign-in/phone-number',
  '/phone-number/request-password-reset',
  '/phone-number/reset-password',
  '/expo-authorization-proxy',
];

/** Everything switched off inside Better Auth (the API also refuses these paths up front). */
export const DISABLED_AUTH_PATHS = [...ORGANIZATION_PATHS, ...ADMIN_PATHS, ...ACCOUNT_PATHS];

/**
 * The only Better Auth endpoints Waypoint uses. Anything else — including endpoints a newer
 * version or plugin adds — answers "not found" before Better Auth sees the request.
 */
const ALLOWED_AUTH_PATHS = new Set([
  '/get-session',
  '/sign-out',
  '/sign-in/anonymous',
  '/sign-in/email',
  '/sign-up/email',
  '/send-verification-email',
  '/verify-email',
  '/request-password-reset',
  '/reset-password',
  '/phone-number/send-otp',
  '/phone-number/verify',
  '/passkey/generate-register-options',
  '/passkey/verify-registration',
  '/passkey/generate-authenticate-options',
  '/passkey/verify-authentication',
  '/passkey/list-user-passkeys',
  '/passkey/delete-passkey',
  '/passkey/update-passkey',
  '/ok',
  '/error',
]);

/** The API reference, in development only (it loads a script from a CDN). */
const DEVELOPMENT_AUTH_PATHS = new Set(['/reference', '/open-api/generate-schema']);

/**
 * The endpoint a request path names inside Better Auth (`/api/auth//Sign-Up/email/` →
 * `/sign-up/email`): decoded, lower-case, single slashes, no trailing slash. Null when the
 * path can't be decoded.
 */
export function authEndpoint(path: string, basePath = '/api/auth'): string | null {
  let p = path;
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(p);
      if (decoded === p) break;
      p = decoded;
    } catch {
      return null;
    }
  }
  p = p
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .toLowerCase();
  if (p.startsWith(basePath)) p = p.slice(basePath.length);
  return `/${p.replace(/^\/+|\/+$/g, '')}`;
}

/**
 * Whether a request path (e.g. `/api/auth/admin/list-users`) is refused: everything outside
 * the endpoints Waypoint uses. Case, repeated or trailing slashes and percent-encoding make
 * no difference.
 */
export function isBlockedAuthPath(
  path: string,
  basePath = '/api/auth',
  development = process.env.NODE_ENV !== 'production',
): boolean {
  const p = authEndpoint(path, basePath);
  if (p === null) return true;
  if (ALLOWED_AUTH_PATHS.has(p)) return false;
  // The link in a password-reset email: /reset-password/<token>, nothing further.
  if (/^\/reset-password\/[^/]+$/.test(p)) return false;
  if (development && DEVELOPMENT_AUTH_PATHS.has(p)) return false;
  return true;
}

/**
 * A name goes into emails other people receive (an invitation says who sent it): one line, at
 * most 80 characters, no links or web addresses, however they are written ("SECURE-BANK.COM").
 */
function unacceptableName(name: unknown): boolean {
  if (name === undefined) return false;
  if (typeof name !== 'string') return true;
  const n = name.trim();
  return (
    n.length < 1 ||
    n.length > 80 ||
    // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters
    /[\u0000-\u001f\u007f]/.test(n) ||
    hasWebAddress(n)
  );
}

/** Checks that run before Better Auth handles a request. */
const beforeHooks = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== '/sign-up/email' && ctx.path !== '/update-user') return;
  const body = (ctx.body ?? {}) as Record<string, unknown>;
  // A phone number is only ever added by proving it with a code (phone-number/verify);
  // otherwise someone could claim a number and later sign in as its owner's account.
  if (ctx.path === '/sign-up/email' && ('phoneNumber' in body || 'phoneNumberVerified' in body))
    throw new APIError('BAD_REQUEST', {
      message: 'A phone number is added by confirming it with a code.',
    });
  // Guests and phone accounts have placeholder addresses under .invalid, which can never
  // receive mail: nobody can create an account with one.
  if (
    ctx.path === '/sign-up/email' &&
    typeof body.email === 'string' &&
    /\.invalid\.?$/i.test(body.email.trim())
  )
    throw new APIError('BAD_REQUEST', { message: 'Please use an email address you can open.' });
  if (unacceptableName(body.name))
    throw new APIError('BAD_REQUEST', {
      message: 'Please use a name of up to 80 characters, without links.',
    });
});

/**
 * The visitor's address, as the API worked it out (from WAYPOINT_CLIENT_IP_HEADER, skipping
 * TRUSTED_PROXIES) and passed on in this header — any copy a visitor sends is removed first.
 * Better Auth's own limits and the API's then count the same visitor the same way.
 */
export const AUTH_CLIENT_IP_HEADER = 'x-waypoint-client-ip';

/**
 * The guest a new account is being created from: the API sets it from the visitor's session
 * when that session is a guest's (any copy a visitor sends is removed first). What the guest
 * did moves into that account when it first signs in on the guest's device.
 */
export const AUTH_GUEST_HEADER = 'x-waypoint-guest';

/** Sent by Waypoint's apps when the person asks to bring their guest activity along. */
export { KEEP_GUEST_HEADER };

function ipAddressOptions() {
  return {
    ipAddressHeaders: [AUTH_CLIENT_IP_HEADER],
    ipv6Subnet: 64 as const,
  };
}

/**
 * Run work once Better Auth's own transaction (if any) has committed: a sign-up that fails
 * sends nothing, and the embedded database — one connection — is never asked to write outside
 * a transaction that is still open.
 */
function afterCommit(work: () => Promise<void>): Promise<void> {
  return queueAfterTransactionHook(work, {
    onError: (err) => {
      console.error(
        '[waypoint] could not queue a message:',
        scrubLogText((err as Error).message, 200),
      );
    },
  });
}

function sendAfterCommit(message: Parameters<typeof enqueueMessage>[1]): Promise<void> {
  return afterCommit(async () => {
    await enqueueMessage(getDb(), message);
  });
}

/**
 * True the first time a key is seen in a window, false after that until the window ends
 * (stored with the rate-limit counters, so every server instance agrees).
 */
async function firstInWindow(key: string, windowSeconds: number): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const res = await getDb().execute<{ count: number | string }>(sql`
    insert into rate_limits (id, key, count, last_request)
    values (${newId()}, ${key}, 1, ${now})
    on conflict (key) do update set
      count = case when rate_limits.last_request < ${windowStart} then 1 else rate_limits.count + 1 end,
      last_request = case when rate_limits.last_request < ${windowStart} then ${now} else rate_limits.last_request end
    returning count`);
  return Number(res.rows[0]?.count ?? 1) === 1;
}

/** True while a key has been seen at most `max` times in the window (same store as above). */
async function withinWindow(key: string, windowSeconds: number, max: number): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const res = await getDb().execute<{ count: number | string }>(sql`
    insert into rate_limits (id, key, count, last_request)
    values (${newId()}, ${key}, 1, ${now})
    on conflict (key) do update set
      count = case when rate_limits.last_request < ${windowStart} then 1 else rate_limits.count + 1 end,
      last_request = case when rate_limits.last_request < ${windowStart} then ${now} else rate_limits.last_request end
    returning count`);
  return Number(res.rows[0]?.count ?? 1) <= max;
}

/** The inbox an address delivers to: lower case, without a "+tag". */
function inbox(email: string): string {
  const [local = '', domain = ''] = email.trim().toLowerCase().split('@');
  return `${local.split('+')[0]}@${domain}`;
}

/**
 * Whether one more email of this kind may go to an inbox. Signing in before confirming asks
 * for a fresh link each time, and accounts can be created for `name+1@…`, `name+2@…`: without a
 * cap per inbox, anyone could fill someone else's with Waypoint's mail. Confirmation links: one
 * every two minutes and six a day; reset links: three an hour. Counted under a keyed hash.
 */
async function mayEmail(kind: 'confirm' | 'reset', email: string, secret: string) {
  const who = createHmac('sha256', secret)
    .update(`mail:${inbox(email)}`)
    .digest('base64url')
    .slice(0, 32);
  if (kind === 'reset') return withinWindow(`mail:reset:${who}`, 3600, 3);
  return (
    (await withinWindow(`mail:confirm:${who}`, 120, 1)) &&
    (await withinWindow(`mail:confirm-day:${who}`, 86_400, 6))
  );
}

/**
 * The auth library's per-visitor limits, kept in the shared database without the visitor's
 * address: its own database store writes keys such as `203.0.113.9|/sign-in/email`, and
 * Waypoint never stores an IP address. Here the key is a keyed hash, and counting is one
 * atomic statement, so every server instance agrees.
 */
export function hashedRateLimitStorage() {
  return {
    consume: async (key: string, rule: { window: number; max: number }) => {
      const env = getEnv();
      const secret = env.BETTER_AUTH_SECRET ?? devSecret('BETTER_AUTH_SECRET');
      const digest = createHmac('sha256', secret).update(key).digest('base64url').slice(0, 32);
      const now = Date.now();
      const windowMs = rule.window * 1000;
      const windowStart = now - windowMs;
      const res = await getDb().execute<{
        count: number | string;
        last_request: number | string;
      }>(sql`
        insert into rate_limits (id, key, count, last_request)
        values (${newId()}, ${`auth:${digest}`}, 1, ${now})
        on conflict (key) do update set
          count = case when rate_limits.last_request < ${windowStart} then 1 else rate_limits.count + 1 end,
          last_request = case when rate_limits.last_request < ${windowStart} then ${now} else rate_limits.last_request end
        returning count, last_request`);
      const row = res.rows[0];
      if (!row || Number(row.count) <= rule.max) return { allowed: true, retryAfter: null };
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((Number(row.last_request) + windowMs - now) / 1000)),
      };
    },
  };
}

/** Placeholder addresses (guests, phone accounts) that can never receive mail. */
const undeliverable = (email: string) => /\.invalid\.?$/i.test(email);

/**
 * A confirmation link always ends on the page that says it worked, even when it was sent
 * without one (as when someone signs in before confirming): a bare "/" would drop a signed-out
 * visitor on the welcome page with no word about their address.
 */
function confirmationLink(url: string): string {
  try {
    const link = new URL(url);
    const onward = link.searchParams.get('callbackURL');
    if (!onward || onward === '/') link.searchParams.set('callbackURL', '/email-confirmed');
    return link.toString();
  } catch {
    return url;
  }
}

/** The guest a new account is being created from, as the API passed it on (a guest's id). */
async function guestFrom(headers: Headers | null): Promise<string | null> {
  const id = headers?.get(AUTH_GUEST_HEADER);
  if (!isUuid(id)) return null;
  const [guest] = await getDb()
    .select({ id: users.id, isAnonymous: users.isAnonymous })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return guest?.isAnonymous ? guest.id : null;
}

function createAuth() {
  const env = getEnv();
  const db = getDb();
  const secret = env.BETTER_AUTH_SECRET ?? devSecret('BETTER_AUTH_SECRET');
  const rpID = new URL(env.WAYPOINT_URL).hostname;

  return betterAuth({
    appName: 'Waypoint',
    baseURL: env.BETTER_AUTH_URL ?? env.WAYPOINT_URL,
    basePath: '/api/auth',
    secret,
    trustedOrigins: trustedOrigins(),
    disabledPaths: [
      ...DISABLED_AUTH_PATHS,
      // The API reference page loads a script from a CDN: development only.
      ...(env.isProd ? ['/reference', '/open-api/generate-schema'] : []),
    ],
    hooks: { before: beforeHooks },
    // Better Auth's own log lines never carry tokens, addresses or statement values.
    logger: {
      level: env.isProd ? 'warn' : 'info',
      log: (level, message, ...args) => {
        const details = args.map((a) =>
          a instanceof Error
            ? `${a.name}${(a as { code?: unknown }).code ? ` ${String((a as { code?: unknown }).code)}` : ''}: ${scrubLogText(a.message, 200)}`
            : typeof a === 'string'
              ? scrubLogText(a, 200)
              : '',
        );
        const line = `[auth] ${scrubLogText(message, 300)} ${details.filter(Boolean).join(' | ')}`;
        if (level === 'error') console.error(line.trim());
        else if (level === 'warn') console.warn(line.trim());
        else console.info(line.trim());
      },
    },
    database: drizzleAdapter(db as never, {
      provider: 'pg',
      schema: authSchema,
      transaction: true,
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      // An account can be signed in to only once its owner has confirmed the address. So
      // creating an account answers the same whether or not the address already has one
      // ("check your email"), and nobody can learn who uses Waypoint by trying addresses.
      requireEmailVerification: true,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }, request) => {
        if (undeliverable(user.email)) return;
        const locale = preferredLocale(request?.headers);
        await afterCommit(async () => {
          if (!(await mayEmail('reset', user.email, secret))) return;
          await enqueueMessage(getDb(), {
            channel: 'email',
            recipientRef: sealWithKek(user.email, 'outbox'),
            payload: { template: 'reset-password', name: user.name, userId: user.id, locale },
            secret: { url },
          });
        });
      },
      // The link in a reset email proves the address is theirs, as a confirmation link would.
      onPasswordReset: async ({ user }) => {
        if (undeliverable(user.email) || user.emailVerified) return;
        await db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id));
      },
      // Someone tried to create an account with an address that already has one. The answer
      // they see is the usual "check your email"; the owner gets a note saying how to sign in
      // (at most one a day, however often someone tries).
      onExistingUserSignUp: async ({ user }) => {
        if (undeliverable(user.email)) return;
        await afterCommit(async () => {
          const key = createHmac('sha256', secret)
            .update(`account-exists:${user.email.toLowerCase()}`)
            .digest('base64url')
            .slice(0, 32);
          if (!(await firstInWindow(`mail:exists:${key}`, 86_400))) return;
          await enqueueMessage(getDb(), {
            channel: 'email',
            recipientRef: sealWithKek(user.email, 'outbox'),
            // In the account's own language, not whoever typed the address.
            payload: { template: 'account-exists', name: user.name, userId: user.id },
            secret: { url: `${env.WAYPOINT_URL}/sign-in` },
          });
        });
      },
    },
    emailVerification: {
      // Confirming the address is what lets someone sign in, and answer invitations sent to it.
      sendOnSignUp: true,
      // Signing in before confirming sends a fresh link (only whoever knows the password can).
      sendOnSignIn: true,
      // A link in an email never signs anyone in: whoever opens it just confirms the address.
      autoSignInAfterVerification: false,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }, request) => {
        // Guest and phone accounts have placeholder addresses that can never receive mail.
        if (undeliverable(user.email)) return;
        const locale = preferredLocale(request?.headers);
        await afterCommit(async () => {
          // The link already sent still works for 24 hours, so nothing is lost by not
          // sending another one straight away.
          if (!(await mayEmail('confirm', user.email, secret))) return;
          await enqueueMessage(getDb(), {
            channel: 'email',
            recipientRef: sealWithKek(user.email, 'outbox'),
            payload: { template: 'verify-email', name: user.name, userId: user.id, locale },
            secret: { url: confirmationLink(url) },
          });
        });
      },
    },
    user: {
      deleteUser: { enabled: false },
      changeEmail: { enabled: false },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      // A short cache: organisation changes must show up quickly.
      cookieCache: { enabled: true, maxAge: 60 },
    },
    // One-time links and codes are looked up by a keyed hash: the table never holds a phone
    // number or a usable token in the clear.
    verification: {
      storeIdentifier: {
        hash: async (identifier: string) =>
          createHmac('sha256', secret).update(`verification:${identifier}`).digest('base64url'),
      },
    },
    rateLimit: {
      enabled: true,
      // In memory for the embedded database (one process); otherwise in the shared database,
      // under keyed hashes rather than the visitor's address.
      ...(env.embeddedDb
        ? { storage: 'memory' as const }
        : { customStorage: hashedRateLimitStorage() }),
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 60, max: 5 },
        '/phone-number/send-otp': { window: 300, max: 3 },
        '/phone-number/verify': { window: 300, max: 10 },
        // A class scanning a poster together shares one address: room for a busy minute.
        '/sign-in/anonymous': { window: 60, max: 40 },
        '/send-verification-email': { window: 3600, max: 5 },
        '/request-password-reset': { window: 3600, max: 5 },
      },
    },
    advanced: {
      cookiePrefix: 'waypoint',
      useSecureCookies: env.WAYPOINT_URL.startsWith('https://'),
      database: { generateId: () => newId() },
      // Rate limits are per visitor: read the one address header our own edge sets, never a
      // header a visitor could add themselves to get a fresh allowance.
      ipAddress: ipAddressOptions(),
    },
    databaseHooks: {
      session: {
        // Waypoint never stores anyone's IP address (only a keyed hash, where it is needed).
        create: { before: async (session) => ({ data: { ...session, ipAddress: null } }) },
        update: {
          before: async (session) =>
            'ipAddress' in session ? { data: { ...session, ipAddress: null } } : undefined,
        },
      },
      user: {
        create: {
          after: async (user, ctx) => {
            const headers = ctx?.request?.headers ?? ctx?.headers ?? null;
            await db
              .insert(profiles)
              .values({
                userId: user.id,
                locale: preferredLocale(headers),
                timezone: timezoneFrom(headers),
                country: countryFrom(headers),
                dekWrapped: newWrappedDek(),
                guestOrigin: (user as { isAnonymous?: boolean | null }).isAnonymous
                  ? null
                  : await guestFrom(headers),
              })
              .onConflictDoNothing();
          },
        },
      },
    },
    plugins: [
      anonymous({
        emailDomainName: 'guest.waypoint.invalid',
        generateName: () => 'Guest',
        // Someone signs in (or finishes creating an account) on a device where a guest session
        // is open. What the guest did moves into the account only if the account was created
        // from that guest, or the person asked for it; otherwise it is deleted with the guest,
        // as it would have been had they signed out.
        onLinkAccount: async ({ anonymousUser, newUser, ctx }) => {
          const guestId = anonymousUser.user.id;
          const userId = newUser.user.id;
          if (guestId === userId || (newUser.user as { isAnonymous?: boolean }).isAnonymous) return;
          const [profile] = await db
            .select({ guestOrigin: profiles.guestOrigin })
            .from(profiles)
            .where(eq(profiles.userId, userId))
            .limit(1);
          const headers = ctx?.request?.headers ?? ctx?.headers ?? null;
          const asked = headers?.get(KEEP_GUEST_HEADER) === '1';
          if (profile?.guestOrigin === guestId || asked) {
            await mergeGuestIntoUser(db, guestId, userId);
            await db
              .update(profiles)
              .set({ guestOrigin: null })
              .where(and(eq(profiles.userId, userId), eq(profiles.guestOrigin, guestId)));
          } else {
            await discardGuest(db, guestId);
          }
        },
      }),
      phoneNumber({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 5,
        // Only a number written in full international form, in a country Waypoint serves.
        phoneNumberValidator: (phone) => toE164(phone) === phone && countryOfNumber(phone) !== null,
        sendOTP: async ({ phoneNumber: to, code }, ctx) => {
          await sendAfterCommit({
            channel: 'sms',
            recipientRef: sealWithKek(to, 'outbox'),
            payload: {
              template: 'otp',
              locale: preferredLocale(ctx?.request?.headers ?? ctx?.headers),
            },
            secret: { code },
          });
        },
        signUpOnVerification: {
          getTempEmail: (phone) => `${phone.replace(/\D/g, '')}@phone.waypoint.invalid`,
          getTempName: () => 'Waypoint user',
        },
      }),
      organization({
        // Tables and roles only: organisations are created and managed through /api/org (see
        // ORGANIZATION_PATHS above), which also sends invitation emails.
        allowUserToCreateOrganization: false,
        organizationLimit: 5,
        membershipLimit: 5000,
        creatorRole: 'owner',
      }),
      admin({ defaultRole: 'user', adminRoles: ['admin'] }),
      // The mobile app keeps its session cookie in the phone's secure storage and sends its
      // scheme as the origin (native requests have none); browsers can't set that header
      // across sites without passing CORS, which doesn't allow it.
      expo(),
      passkey({ rpID, rpName: 'Waypoint', origin: env.WAYPOINT_URL }),
      openAPI({ path: '/reference' }),
      // Must be last: lets Server Actions set auth cookies.
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const KEY = Symbol.for('waypoint.auth');
type G = typeof globalThis & { [KEY]?: Auth };

/** The Better Auth instance for this process (created on first use). */
export function getAuth(): Auth {
  const g = globalThis as G;
  g[KEY] ??= createAuth();
  return g[KEY];
}

export type Session = Auth['$Infer']['Session'];

/** Resolve the session from request headers; null for signed-out visitors. */
export async function getSession(headers: Headers): Promise<Session | null> {
  await dbReady();
  return getAuth().api.getSession({ headers });
}

/**
 * Create (or promote) the administrator named in WAYPOINT_ADMIN_EMAIL on start-up.
 * The password is only used when the account does not exist yet. An existing account is only
 * promoted once its owner has confirmed the address: otherwise whoever signed up with it first
 * — perhaps not the owner — would become an administrator.
 */
export async function ensureAdmin(): Promise<
  'created' | 'promoted' | 'exists' | 'unverified' | 'skipped'
> {
  const env = getEnv();
  const email = env.WAYPOINT_ADMIN_EMAIL?.toLowerCase();
  if (!email) return 'skipped';
  await dbReady();
  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    if (existing.role === 'admin') return 'exists';
    if (!existing.emailVerified) return 'unverified';
    await db.update(users).set({ role: 'admin' }).where(eq(users.id, existing.id));
    return 'promoted';
  }
  if (!env.WAYPOINT_ADMIN_PASSWORD || env.WAYPOINT_ADMIN_PASSWORD.length < 10) {
    throw new Error(
      'WAYPOINT_ADMIN_PASSWORD must be at least 10 characters to create the admin account.',
    );
  }
  const res = await getAuth().api.signUpEmail({
    body: { email, password: env.WAYPOINT_ADMIN_PASSWORD, name: 'Administrator' },
  });
  await db
    .update(users)
    .set({ role: 'admin', emailVerified: true })
    .where(eq(users.id, res.user.id));
  return 'created';
}
