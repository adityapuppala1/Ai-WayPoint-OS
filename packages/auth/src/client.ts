/**
 * Browser/React auth client. Import from '@waypoint/auth/client' in client components only.
 */
import { passkeyClient } from '@better-auth/passkey/client';
import {
  adminClient,
  anonymousClient,
  organizationClient,
  phoneNumberClient,
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  basePath: '/api/auth',
  plugins: [
    anonymousClient(),
    phoneNumberClient(),
    organizationClient(),
    adminClient(),
    passkeyClient(),
  ],
});

export const { useSession, signIn, signUp, signOut } = authClient;
