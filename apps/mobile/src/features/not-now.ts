/**
 * "Not now" on the phone. The website keeps the steps a person set aside today in a cookie the
 * server writes (wp-not-now: the day, then keys that say nothing about the steps). A phone's
 * requests have no cookie jar (api.ts), so it keeps the same value itself, on this phone only,
 * and sends it with Today, which reads it as it reads the website's. The day is the one it is
 * where the person is when they press, as on the website.
 */
import { addNotNow, localDayKey, NOT_NOW_COOKIE } from '@waypoint/core';

/** Where a person's list is kept on this phone (the keys are theirs alone in any case). */
export const notNowStorageKey = (userId: string) => `today.notNow.${userId}`;

/** The stored value with `key` set aside for the day it is now in `timeZone`. */
export function setAside(stored: string | null, key: string, now: Date, timeZone: string): string {
  return addNotNow(stored, localDayKey(now, timeZone), key);
}

/** The cookie a Today request carries for it (api.ts adds the session's), or none. */
export const notNowCookie = (stored: string | null): string | undefined =>
  stored ? `${NOT_NOW_COOKIE}=${stored}` : undefined;
