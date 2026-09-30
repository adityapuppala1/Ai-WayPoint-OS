/**
 * Verifiable work credentials — W3C Verifiable Credentials 2.0 secured with the
 * Data Integrity `eddsa-jcs-2022` cryptosuite (Ed25519 over JSON Canonicalization).
 * Anyone can verify a Waypoint credential with only the issuer's public DID document;
 * no Waypoint account or API call is needed. Node's built-in crypto only.
 */
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  type KeyObject,
  sign,
  verify,
} from 'node:crypto';
import canonicalize from 'canonicalize';
import type { DataIntegrityProof, SignedCredential, UnsignedCredential } from '../types';
import { base58Decode, base58Encode } from './base58';

export { base58Decode, base58Encode } from './base58';

const ED25519_MULTICODEC = Uint8Array.from([0xed, 0x01]);

export const VC_CONTEXT_V2 = 'https://www.w3.org/ns/credentials/v2';

/** RFC 8785 JSON Canonicalization Scheme. */
export function canonicalizeJson(value: unknown): string {
  const out = canonicalize(value);
  if (out === undefined) throw new Error('Value cannot be canonicalized');
  return out;
}

const b64url = (buf: Uint8Array) => Buffer.from(buf).toString('base64url');

export interface IssuerKey {
  publicKeyMultibase: string;
  privateKeyPem: string;
}

export function generateIssuerKey(): IssuerKey {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKeyMultibase: multibaseFromPublicKey(publicKey),
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
  };
}

export function multibaseFromPublicKey(key: KeyObject): string {
  const jwk = key.export({ format: 'jwk' }) as { x?: string };
  if (!jwk.x) throw new Error('Not an Ed25519 public key');
  const raw = Buffer.from(jwk.x, 'base64url');
  return `z${base58Encode(Uint8Array.from([...ED25519_MULTICODEC, ...raw]))}`;
}

export function publicKeyFromMultibase(multibase: string): KeyObject {
  if (!multibase.startsWith('z')) throw new Error('Expected base58btc multibase (z…)');
  const bytes = base58Decode(multibase.slice(1));
  if (bytes.length !== 34 || bytes[0] !== 0xed || bytes[1] !== 0x01)
    throw new Error('Not an Ed25519 Multikey');
  return createPublicKey({
    key: { kty: 'OKP', crv: 'Ed25519', x: b64url(bytes.slice(2)) },
    format: 'jwk',
  });
}

export function publicKeyMultibaseFromPrivatePem(privateKeyPem: string): string {
  return multibaseFromPublicKey(createPublicKey(createPrivateKey(privateKeyPem)));
}

function sha256(data: string): Buffer {
  return createHash('sha256').update(data, 'utf8').digest();
}

function hashData(document: Record<string, unknown>, proofConfig: Record<string, unknown>): Buffer {
  return Buffer.concat([sha256(canonicalizeJson(proofConfig)), sha256(canonicalizeJson(document))]);
}

export function issueCredential(opts: {
  credential: UnsignedCredential;
  verificationMethod: string;
  privateKeyPem: string;
  created?: Date;
}): SignedCredential {
  const { proof: _ignored, ...unsecured } = opts.credential as UnsignedCredential & {
    proof?: unknown;
  };
  const proofOptions = {
    type: 'DataIntegrityProof' as const,
    cryptosuite: 'eddsa-jcs-2022' as const,
    created: (opts.created ?? new Date()).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    verificationMethod: opts.verificationMethod,
    proofPurpose: 'assertionMethod' as const,
  };
  const proofConfig = { ...proofOptions, '@context': unsecured['@context'] };
  const signature = sign(
    null,
    hashData(unsecured, proofConfig),
    createPrivateKey(opts.privateKeyPem),
  );
  const proof: DataIntegrityProof = { ...proofOptions, proofValue: `z${base58Encode(signature)}` };
  return { ...(unsecured as UnsignedCredential), proof };
}

export function verifyCredential(
  vc: SignedCredential,
  publicKeyMultibase: string,
): { valid: boolean; reason?: string } {
  try {
    const { proof, ...unsecured } = vc;
    if (proof?.type !== 'DataIntegrityProof' || proof.cryptosuite !== 'eddsa-jcs-2022') {
      return { valid: false, reason: 'unsupported-proof' };
    }
    if (proof.proofPurpose !== 'assertionMethod') return { valid: false, reason: 'wrong-purpose' };
    const { proofValue, ...proofOptions } = proof;
    if (!proofValue?.startsWith('z')) return { valid: false, reason: 'bad-proof-value' };
    const proofConfig = { ...proofOptions, '@context': unsecured['@context'] };
    const ok = verify(
      null,
      hashData(unsecured, proofConfig),
      publicKeyFromMultibase(publicKeyMultibase),
      Buffer.from(base58Decode(proofValue.slice(1))),
    );
    if (!ok) return { valid: false, reason: 'signature-mismatch' };
    const now = Date.now();
    if (vc.validFrom && Date.parse(vc.validFrom) > now + 5 * 60_000)
      return { valid: false, reason: 'not-yet-valid' };
    if (vc.validUntil && Date.parse(vc.validUntil) < now)
      return { valid: false, reason: 'expired' };
    return { valid: true };
  } catch (err) {
    return { valid: false, reason: err instanceof Error ? err.message : 'invalid' };
  }
}

/** did:web identifier for an origin: https://waypoint.example → did:web:waypoint.example, localhost:3000 → did:web:localhost%3A3000 */
export function didWebFromOrigin(origin: string): string {
  const url = new URL(origin);
  return `did:web:${encodeURIComponent(url.host)}`;
}

export function didWebDocument(did: string, publicKeyMultibase: string) {
  const keyId = `${did}#key-1`;
  return {
    '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/multikey/v1'],
    id: did,
    verificationMethod: [{ id: keyId, type: 'Multikey', controller: did, publicKeyMultibase }],
    assertionMethod: [keyId],
    authentication: [keyId],
  };
}

/** A Waypoint work credential: a project someone completed, the skills it shows, and who reviewed it. */
export function buildWorkCredential(opts: {
  id: string;
  issuerDid: string;
  issuerName: string;
  subjectName: string;
  project: { title: string; summary: string; evidenceUrl?: string; completedAt: Date };
  skills: string[];
  verification: {
    level: 'self' | 'peer' | 'mentor' | 'employer';
    reviewer?: string;
    reviewedAt?: Date;
  };
  validFrom?: Date;
}): UnsignedCredential {
  return {
    '@context': [VC_CONTEXT_V2],
    id: opts.id,
    type: ['VerifiableCredential', 'WaypointWorkCredential'],
    issuer: { id: opts.issuerDid, name: opts.issuerName },
    validFrom: (opts.validFrom ?? new Date()).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    name: `Verified project: ${opts.project.title}`,
    credentialSubject: {
      name: opts.subjectName,
      achievement: {
        type: 'Project',
        title: opts.project.title,
        summary: opts.project.summary,
        ...(opts.project.evidenceUrl ? { evidence: opts.project.evidenceUrl } : {}),
        completedAt: opts.project.completedAt.toISOString().slice(0, 10),
        skills: opts.skills,
      },
      verification: {
        level: opts.verification.level,
        ...(opts.verification.reviewer ? { reviewer: opts.verification.reviewer } : {}),
        ...(opts.verification.reviewedAt
          ? { reviewedAt: opts.verification.reviewedAt.toISOString().slice(0, 10) }
          : {}),
      },
    },
  };
}
