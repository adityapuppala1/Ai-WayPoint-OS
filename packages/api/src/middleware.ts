/** Session, access and caching middleware shared by every route. */
import { getAuth } from '@waypoint/auth';
import { type ConsoleArea, canUse, isStaffRole } from '@waypoint/core/console';
import { createMiddleware } from 'hono/factory';
import { forbidden, unauthorized } from './lib/problem';
import { limitVisitor } from './lib/request';
import type { ApiUser, AppEnv } from './types';

/** The session cookies Better Auth sets (with or without the `__Secure-` prefix). */
const SESSION_COOKIE = /(?:^|;\s*)(?:__Secure-)?waypoint\.session_(?:token|data)=/;

/** Reads the Better Auth session (cookie cache keeps this cheap) and sets `user`. */
export const withSession = createMiddleware<AppEnv>(async (c, next) => {
  c.set('user', null);
  c.set('sessionId', null);
  // No session cookie, no session: most public requests (help lines, scam checks, health
  // probes) carry none, and asking the auth library anyway costs more than the request itself.
  if (!SESSION_COOKIE.test(c.req.header('cookie') ?? '')) return next();
  const session = await getAuth()
    .api.getSession({ headers: c.req.raw.headers })
    .catch(() => null);
  if (session) {
    const u = session.user as typeof session.user & {
      isAnonymous?: boolean | null;
      role?: string | null;
    };
    const user: ApiUser = {
      id: u.id,
      name: u.name,
      email: u.email,
      emailVerified: Boolean(u.emailVerified),
      isGuest: Boolean(u.isAnonymous),
      role: u.role ?? null,
    };
    c.set('user', user);
    c.set('sessionId', session.session.id);
  }
  await next();
});

/** Any session, including a guest session. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get('user')) throw unauthorized();
  await next();
});

/** A full account (not a guest) — for things that need a way to reach the person later. */
export const requireAccount = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user');
  if (!user) throw unauthorized();
  if (user.isGuest)
    throw forbidden(
      'Create a free account to use this. Everything you did as a guest comes with you.',
    );
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user');
  if (!user) throw unauthorized();
  if (user.role !== 'admin') throw forbidden();
  await next();
});

/** Anyone on the staff (an admin or staff); each part of the console then checks its own area. */
export const requireStaff = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user');
  if (!user) throw unauthorized();
  if (!isStaffRole(user.role)) throw forbidden();
  await next();
});

/** One part of the platform console (see @waypoint/core/console for who may open which). */
export function requireArea(area: ConsoleArea) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user');
    if (!user) throw unauthorized();
    if (!canUse(user.role, area)) throw forbidden();
    await next();
  });
}

/** Personal data must never be cached by browsers or proxies. */
export const noStore = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  if (!c.res.headers.has('Cache-Control')) c.res.headers.set('Cache-Control', 'private, no-store');
});

/** Rate limit per signed-in person, or per (hashed) IP address for anonymous callers. */
export function limit(name: string, max: number, windowSeconds: number) {
  return createMiddleware<AppEnv>(async (c, next) => {
    await limitVisitor(
      c.get('db'),
      name,
      { headers: c.req.raw.headers, userId: c.get('user')?.id ?? null },
      { max, windowSeconds },
    );
    await next();
  });
}
