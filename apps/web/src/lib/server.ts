/**
 * Server-side helpers for pages: who is viewing, with their profile and consents.
 * Pages call services directly (no HTTP hop); client components use /api.
 */

import { ApiError, type ApiUser, type Consents, limitVisitor, me } from '@waypoint/api';
import { getSession } from '@waypoint/auth';
import { countryFromTimeZone } from '@waypoint/content';
import { type ConsoleArea, canUse, isStaffRole } from '@waypoint/core/console';
import { type Database, dbReady, getDb } from '@waypoint/db';
import type { Route } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';

export interface Viewer {
  db: Database;
  user: ApiUser;
  profile: me.Profile;
  consents: Consents;
}

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await getSession(await headers()).catch(() => null);
  if (!session) return null;
  await dbReady();
  const db = getDb();
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
  try {
    const [profile, consents] = await Promise.all([
      me.getProfile(db, user.id),
      me.getConsents(db, user.id),
    ]);
    return { db, user, profile, consents };
  } catch {
    // The account was deleted while a cached session cookie was still around.
    return null;
  }
});

/** For pages that need a session: send people without one to the welcome page. */
export async function requireViewer(returnTo: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/welcome?next=${encodeURIComponent(returnTo)}` as Route);
  return viewer;
}

/**
 * For pages of the platform console, each its own area (@waypoint/core/console). Checked in every page, not only the layout: a layout is not
 * re-rendered on navigation, so it cannot guard the pages below it on its own.
 */
/** Anyone on the staff (the console's layout); each page then checks its own area. */
export async function requireStaffViewer(returnTo: string): Promise<Viewer> {
  const viewer = await requireViewer(returnTo);
  if (!isStaffRole(viewer.user.role)) notFound();
  return viewer;
}

export async function requireConsole(area: ConsoleArea, returnTo: string): Promise<Viewer> {
  const viewer = await requireViewer(returnTo);
  // Everyone else gets a plain "not found": the console stays unlisted.
  if (!canUse(viewer.user.role, area)) notFound();
  return viewer;
}

/**
 * The country to use for public pages: the profile's, then the edge's country header, then the
 * one the browser's time zone belongs to (the wp-tz cookie, set on the first page).
 */
export async function guessCountry(): Promise<string | null> {
  const viewer = await getViewer();
  if (viewer?.profile.country) return viewer.profile.country;
  const h = await headers();
  const edge =
    h.get('cf-ipcountry') ??
    h.get('x-vercel-ip-country') ??
    h.get('cloudfront-viewer-country') ??
    h.get('x-country-code');
  if (edge && /^[A-Z]{2}$/i.test(edge) && edge.toUpperCase() !== 'XX') return edge.toUpperCase();
  const zone = (await cookies()).get('wp-tz')?.value;
  let tz: string | null = null;
  try {
    tz = zone ? decodeURIComponent(zone) : null;
  } catch {
    tz = null;
  }
  return countryFromTimeZone(viewer?.profile.timezone) ?? countryFromTimeZone(tz) ?? null;
}

/**
 * Pages that look something up by a code or link (join, poster, invitation) are limited like
 * the API calls they stand in for, so they cannot be used to try codes at speed. Over the
 * limit, the visitor gets a calm "wait a moment" page that brings them back afterwards.
 */
export async function pageRateLimit(
  name: string,
  max: number,
  windowSeconds: number,
  returnTo?: string,
): Promise<void> {
  const viewer = await getViewer();
  await dbReady();
  try {
    await limitVisitor(
      viewer?.db ?? getDb(),
      `page-${name}`,
      { headers: await headers(), userId: viewer?.user.id ?? null },
      { max, windowSeconds },
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 429)
      redirect((returnTo ? `/wait?next=${encodeURIComponent(returnTo)}` : '/wait') as Route);
    throw err;
  }
}
