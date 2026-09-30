/**
 * Server keyring for envelope encryption. The key-encryption key (KEK) comes from WAYPOINT_KEK
 * (32 random bytes, base64). Each KEK is identified by a short hash, stored as the prefix of
 * every wrapped data key, so rotating is: set the new key as WAYPOINT_KEK and the old one as
 * WAYPOINT_KEK_PREVIOUS, then re-wrap data keys in the background.
 */
import { createHash } from 'node:crypto';
import { devSecret, getEnv } from '../env';
import {
  decryptField,
  encryptField,
  generateKey,
  keyFromBase64,
  unwrapDek,
  wrapDek,
} from './crypto';

export interface Keyring {
  currentId: string;
  current: Buffer;
  all: Record<string, Buffer>;
}

const kekId = (key: Buffer) => `k${createHash('sha256').update(key).digest('hex').slice(0, 8)}`;

let cached: Keyring | undefined;

export function getKeyring(): Keyring {
  if (cached) return cached;
  const env = getEnv();
  const current = keyFromBase64(env.WAYPOINT_KEK ?? devSecret('WAYPOINT_KEK'));
  const all: Record<string, Buffer> = { [kekId(current)]: current };
  if (env.WAYPOINT_KEK_PREVIOUS) {
    const prev = keyFromBase64(env.WAYPOINT_KEK_PREVIOUS);
    all[kekId(prev)] = prev;
  }
  cached = { currentId: kekId(current), current, all };
  return cached;
}

/** A fresh data key for a person, returned already wrapped for storage. */
export function newWrappedDek(): string {
  const ring = getKeyring();
  return wrapDek(generateKey(), ring.current, ring.currentId);
}

export function openDek(wrapped: string): Buffer {
  return unwrapDek(wrapped, getKeyring().all);
}

/** Wrap with the current KEK if it was wrapped with an older one (key rotation). */
export function rewrapIfNeeded(wrapped: string): string | null {
  const ring = getKeyring();
  if (wrapped.startsWith(`${ring.currentId}:`)) return null;
  return wrapDek(openDek(wrapped), ring.current, ring.currentId);
}

/**
 * Additional authenticated data binds ciphertext to its owner and row, so an encrypted value
 * copied to another row or person fails to decrypt.
 */
export function aad(table: string, userId: string, rowId?: string): string {
  return rowId ? `${table}:${userId}:${rowId}` : `${table}:${userId}`;
}

export function sealFor(
  dek: Buffer,
  plaintext: string,
  table: string,
  userId: string,
  rowId?: string,
): string {
  return encryptField(plaintext, dek, aad(table, userId, rowId));
}

export function openFor(
  dek: Buffer,
  ciphertext: string,
  table: string,
  userId: string,
  rowId?: string,
): string {
  return decryptField(ciphertext, dek, aad(table, userId, rowId));
}

/**
 * Encrypt server-held secrets (issuer private keys, phone numbers waiting in the outbox) directly
 * with the KEK. The KEK id prefix lets old values decrypt after rotation.
 */
export function sealWithKek(plaintext: string, purpose: string): string {
  const ring = getKeyring();
  return `${ring.currentId}:${encryptField(plaintext, ring.current, `server:${purpose}`)}`;
}

export function openWithKek(sealed: string, purpose: string): string {
  const idx = sealed.indexOf(':');
  const key = getKeyring().all[sealed.slice(0, idx)];
  if (!key) throw new Error('Unknown key-encryption key');
  return decryptField(sealed.slice(idx + 1), key, `server:${purpose}`);
}

/** AAD table names for every encrypted column family. Keep stable: changing one breaks decryption. */
export const SEALED = {
  journal: 'journal',
  mood: 'mood',
  health: 'health',
  memory: 'memory',
  trustedContact: 'trusted-contact',
  money: 'money',
  channelAddress: 'channel-address',
  issuerKey: 'issuer-key',
  goal: 'goal',
  weeklyReview: 'weekly-review',
  reminder: 'reminder',
} as const;

/** Test helper. */
export function resetKeyringForTests(): void {
  cached = undefined;
}
