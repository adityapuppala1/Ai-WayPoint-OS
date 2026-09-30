/**
 * Envelope encryption for sensitive fields (journal entries, memories marked sensitive).
 * Each person gets a random data key (DEK); the DEK is stored wrapped by the server's
 * key-encryption key (KEK). Deleting the wrapped DEK makes every field unreadable at once
 * ("crypto-shredding"), including copies in backups.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const ALG = 'aes-256-gcm';
/** Full 128-bit tags only: a shortened tag would be far easier to forge. */
const TAG_BYTES = 16;

export function generateKey(): Buffer {
  return randomBytes(32);
}

export function keyFromBase64(b64: string): Buffer {
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) throw new Error('Key must be 32 bytes (base64)');
  return key;
}

function seal(plain: Buffer, key: Buffer, aad?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv, { authTagLength: TAG_BYTES });
  if (aad) cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join(
    '.',
  );
}

function open(payload: string, key: Buffer, aad?: string): Buffer {
  const [version, iv, tag, ct] = payload.split('.');
  if (version !== 'v1' || !iv || !tag || ct === undefined)
    throw new Error('Unsupported ciphertext');
  const authTag = Buffer.from(tag, 'base64url');
  if (authTag.length !== TAG_BYTES) throw new Error('Unsupported ciphertext');
  const decipher = createDecipheriv(ALG, key, Buffer.from(iv, 'base64url'), {
    authTagLength: TAG_BYTES,
  });
  if (aad) decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]);
}

/** Wrap a person's data key with the server KEK. `kekId` lets keys rotate without re-encrypting data. */
export function wrapDek(dek: Buffer, kek: Buffer, kekId = 'k1'): string {
  return `${kekId}:${seal(dek, kek, 'dek')}`;
}

export function unwrapDek(wrapped: string, keks: Record<string, Buffer>): Buffer {
  const idx = wrapped.indexOf(':');
  const kekId = wrapped.slice(0, idx);
  const kek = keks[kekId];
  if (!kek) throw new Error(`Unknown key-encryption key ${kekId}`);
  return open(wrapped.slice(idx + 1), kek, 'dek');
}

/** Encrypt a field. `aad` binds the ciphertext to its owner/record so it can't be swapped. */
export function encryptField(plaintext: string, dek: Buffer, aad?: string): string {
  return seal(Buffer.from(plaintext, 'utf8'), dek, aad);
}

export function decryptField(payload: string, dek: Buffer, aad?: string): string {
  return open(payload, dek, aad).toString('utf8');
}

/** One-way, salted hash for identifiers we must count but never store (IP addresses, phone numbers). */
export function hashIdentifier(value: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${value}`).digest('base64url').slice(0, 32);
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
