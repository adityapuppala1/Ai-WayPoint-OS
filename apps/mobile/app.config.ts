/**
 * Waypoint for iOS and Android. The app talks to the same API as the web app: set
 * EXPO_PUBLIC_WAYPOINT_URL to its public address (http://10.0.2.2:3000 reaches `pnpm dev` from
 * the Android emulator; your computer's LAN address works from a phone on the same Wi-Fi).
 * If the API runs on its own address (apps/api), set EXPO_PUBLIC_WEBSITE_URL to the website's.
 */
import type { ExpoConfig } from 'expo/config';

const SLATE = '#2b3645';

const config: ExpoConfig = {
  name: 'Waypoint',
  slug: 'waypoint',
  scheme: 'waypoint',
  version: '0.1.0',
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  description:
    'Help with work, money, safety and hard days: help lines and scam checks that work offline, a next step for this week, and someone to talk to.',
  ios: {
    bundleIdentifier: 'org.waypoint.app',
    supportsTablet: true,
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: 'org.waypoint.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      monochromeImage: './assets/monochrome-icon.png',
      backgroundColor: SLATE,
    },
    // Only what the app uses: calling and texting are handed to the phone's own apps.
    permissions: [],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
    ],
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    ['expo-localization', { supportsRTL: true }],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        backgroundColor: SLATE,
        dark: { image: './assets/splash-icon.png', backgroundColor: SLATE },
      },
    ],
    [
      'expo-updates',
      // No update server: the app only uses reloadAsync() to switch to a right-to-left layout.
      { enabled: false },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_WAYPOINT_URL ?? 'http://localhost:3000',
    // Only when the website is served from another address than the API.
    ...(process.env.EXPO_PUBLIC_WEBSITE_URL
      ? { websiteUrl: process.env.EXPO_PUBLIC_WEBSITE_URL }
      : {}),
  },
};

export default config;
