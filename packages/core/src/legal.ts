/**
 * Versions of the public privacy notice and terms of use (the website's /privacy and /terms).
 *
 * Every consent records PRIVACY_POLICY_VERSION, so each choice a person made is tied to the
 * notice they could read at the time. Change the version when the notice changes what
 * Waypoint does with information, and change the dates whenever the words change.
 */
export const PRIVACY_POLICY_VERSION = '2026-10';

/** Shown as "Last updated" on each page (ISO dates). */
export const LEGAL_UPDATED = {
  privacy: '2026-10-01',
  terms: '2026-09-30',
} as const;

/** Nobody younger may use Waypoint's personal features (the terms and notice say so). */
export const MINIMUM_AGE = 13;

/**
 * An account whose email address is never confirmed is deleted after this many days (it can
 * never have been signed in to). The confirmation email and the privacy notice say so.
 */
export const UNCONFIRMED_ACCOUNT_DAYS = 7;
