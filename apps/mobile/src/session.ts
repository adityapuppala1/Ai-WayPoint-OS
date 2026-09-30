/**
 * Who is using the app — nobody yet, a guest, or someone with an account — and starting a
 * guest session the first time something needs one. Help lines and scam checks never do.
 */
import type { Me } from '@waypoint/api/client';
import { KEEP_GUEST_HEADER } from '@waypoint/core/headers';
import type { Locale } from '@waypoint/i18n';
import { ApiError, api } from './api';
import { authClient } from './auth';

export type { Me };

export interface Whereabouts {
  locale: Locale;
  country: string | null;
  timeZone: string;
}

let starting: Promise<void> | null = null;

/** Throws ApiError (status 0 when offline) instead of Better Auth's error shape. */
async function authCall<T>(
  call: () => Promise<{
    data: T | null;
    error: { status?: number; code?: string; message?: string } | null;
  }>,
): Promise<T | null> {
  let res: Awaited<ReturnType<typeof call>>;
  try {
    res = await call();
  } catch {
    throw new ApiError(0, 'offline', 'offline');
  }
  if (res.error) {
    throw new ApiError(
      res.error.status ?? 500,
      res.error.code,
      res.error.message ?? 'Sign-in failed',
    );
  }
  return res.data;
}

/**
 * Makes sure there is a session, starting a guest one if needed, and tells Waypoint the
 * person's language, country and time zone so answers and help lines fit where they are.
 * Safe to call from several places at once.
 */
export function ensureSession(where: Whereabouts): Promise<void> {
  starting ??= (async () => {
    const current = await authCall(() => authClient.getSession());
    if (current?.user) return;
    await authCall(() => authClient.signIn.anonymous());
    await api('/me/profile', {
      method: 'PATCH',
      json: {
        locale: where.locale,
        timezone: where.timeZone,
        ...(where.country ? { country: where.country } : {}),
      },
    }).catch(() => undefined); // the defaults from the request headers are good enough
  })().finally(() => {
    starting = null;
  });
  return starting;
}

/**
 * Signs in. What a guest did on this phone moves into the account created from that guest
 * session; into any other account only when the person asks (`keepGuest`), because on a
 * shared phone the guest may have been someone else. Fails with status 403 until the
 * account's email address is confirmed (signing in sends a new link).
 */
export async function signInWithEmail(
  email: string,
  password: string,
  keepGuest = false,
): Promise<void> {
  await authCall(() =>
    authClient.signIn.email(
      { email: email.trim(), password },
      keepGuest ? { headers: { [KEEP_GUEST_HEADER]: '1' } } : undefined,
    ),
  );
}

/**
 * Creates an account. It answers the same whether or not the address already has one (the
 * owner is emailed instead), and the account can be signed in to once the address is
 * confirmed: then a guest's plans, checks and conversations on this phone come with them.
 */
export async function signUpWithEmail(
  name: string,
  email: string,
  password: string,
): Promise<void> {
  await authCall(() =>
    authClient.signUp.email({
      name: name.trim() || 'Waypoint user',
      email: email.trim(),
      password,
    }),
  );
}

/** Signs out on this phone. The keystore copy of the session is removed even when offline. */
export async function signOut(): Promise<void> {
  await authClient.signOut().catch(() => undefined);
}

/** Deletes the account and everything in it, then forgets the session on this phone. */
export async function deleteAccount(): Promise<void> {
  await api('/me', { method: 'DELETE', json: { confirm: 'DELETE' } });
  await signOut();
}

export function fetchMe(signal?: AbortSignal): Promise<Me> {
  return api<Me>('/me', { signal });
}
