import type { Database } from '@waypoint/db';
import type { Locale } from '@waypoint/i18n';

/** The signed-in person as the API sees them. Guests are real (anonymous) accounts. */
export interface ApiUser {
  id: string;
  name: string;
  email: string;
  /** From the session (may lag by a minute): checks that matter read the database. */
  emailVerified: boolean;
  isGuest: boolean;
  role: string | null;
}

export interface AppEnv {
  Variables: {
    db: Database;
    user: ApiUser | null;
    sessionId: string | null;
    requestId: string;
    /** The language to answer in: `?locale=`, then the language cookie, then Accept-Language. */
    locale: Locale;
    /** Set once a server error has been kept with its own words (lib/metrics.ts). */
    errorKept?: boolean;
  };
}

export type Consents = Record<import('@waypoint/core').ConsentPurpose, boolean>;
