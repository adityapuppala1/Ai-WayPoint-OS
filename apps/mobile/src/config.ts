import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;

/** A non-empty address without its trailing slash, or undefined. */
const url = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim().replace(/\/+$/, '') : undefined;

/**
 * The Waypoint server the app talks to (the website's address, or the API's own), fixed when
 * the app is built from EXPO_PUBLIC_WAYPOINT_URL.
 */
export const API_URL: string =
  url(process.env.EXPO_PUBLIC_WAYPOINT_URL) ?? url(extra?.apiUrl) ?? 'http://localhost:3000';

/** The website, for the parts of Waypoint the app opens in the browser. */
export const WEB_URL: string =
  url(process.env.EXPO_PUBLIC_WEBSITE_URL) ?? url(extra?.websiteUrl) ?? API_URL;

/** The app's link scheme (waypoint://…), also its origin when it signs in. */
export const SCHEME = 'waypoint';
