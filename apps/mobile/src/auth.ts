/**
 * Sign-in for the app: Better Auth with its Expo plugin. The session cookie is kept in the
 * phone's secure keystore (Keychain / Android Keystore), never in plain storage, and is sent
 * with each request (see api.ts). Requests carry the app's scheme as their origin, which the
 * server trusts (packages/auth).
 *
 * People can use Waypoint without an account: the first time something needs one (Today, Ask,
 * reporting a scam), the app starts a guest session. Creating an account later keeps
 * everything the guest did.
 */
import { expoClient } from '@better-auth/expo/client';
import { anonymousClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_URL, SCHEME } from './config';

/** The web build is for previews: the browser keeps the cookie, so nothing is stored here. */
const browserStorage = {
  getItem: (_key: string): string | null => null,
  setItem: (_key: string, _value: string): void => {},
  getItemAsync: async (_key: string): Promise<string | null> => null,
  setItemAsync: async (_key: string, _value: string): Promise<void> => {},
};

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: SCHEME,
      storagePrefix: 'waypoint',
      cookiePrefix: 'waypoint',
      storage: Platform.OS === 'web' ? browserStorage : SecureStore,
    }),
    anonymousClient(),
  ],
});

export type AuthSession = typeof authClient.$Infer.Session;
