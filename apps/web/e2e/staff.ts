/**
 * The staff account the test server creates when it starts (see playwright.config.ts). It
 * exists only in the throwaway test database; these are not credentials for anything real.
 */
export const STAFF = {
  email: 'staff@waypoint.test',
  password: 'e2e-only-staff-password',
} as const;
