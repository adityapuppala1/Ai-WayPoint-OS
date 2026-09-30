import { describe, expect, it } from 'vitest';
import {
  base58Decode,
  base58Encode,
  buildWorkCredential,
  canonicalizeJson,
  didWebDocument,
  didWebFromOrigin,
  generateIssuerKey,
  issueCredential,
  publicKeyFromMultibase,
  publicKeyMultibaseFromPrivatePem,
  verifyCredential,
} from '../src/credentials';

describe('base58btc', () => {
  it('round-trips bytes including leading zeros', () => {
    const bytes = Uint8Array.from([0, 0, 1, 2, 255, 128, 64]);
    expect(base58Decode(base58Encode(bytes))).toEqual(bytes);
    expect(base58Encode(new TextEncoder().encode('hello world'))).toBe('StV1DL6CwTryKyV');
  });
});

describe('JCS', () => {
  it('sorts keys and normalises numbers', () => {
    expect(canonicalizeJson({ b: 1, a: [3, { d: 1e2, c: 'x' }] })).toBe(
      '{"a":[3,{"c":"x","d":100}],"b":1}',
    );
  });
});

describe('eddsa-jcs-2022 credentials', () => {
  const key = generateIssuerKey();
  const did = didWebFromOrigin('https://waypoint.example');
  const vm = `${did}#key-1`;
  const unsigned = buildWorkCredential({
    id: 'urn:uuid:0192f1f0-0000-7000-8000-000000000001',
    issuerDid: did,
    issuerName: 'Waypoint',
    subjectName: 'Amina K.',
    project: {
      title: 'Clinic appointment tracker',
      summary: 'A spreadsheet that cut missed appointments at a community clinic.',
      completedAt: new Date('2026-09-01T00:00:00Z'),
    },
    skills: ['spreadsheet-analysis', 'data-cleaning'],
    verification: {
      level: 'mentor',
      reviewer: 'J. Otieno',
      reviewedAt: new Date('2026-09-10T00:00:00Z'),
    },
    validFrom: new Date('2026-09-10T00:00:00Z'),
  });

  it('derives the public key from the private key', () => {
    expect(publicKeyMultibaseFromPrivatePem(key.privateKeyPem)).toBe(key.publicKeyMultibase);
    expect(key.publicKeyMultibase.startsWith('z6Mk')).toBe(true); // Ed25519 multikeys start with z6Mk
    expect(() => publicKeyFromMultibase(key.publicKeyMultibase)).not.toThrow();
  });

  it('signs and verifies', () => {
    const vc = issueCredential({
      credential: unsigned,
      verificationMethod: vm,
      privateKeyPem: key.privateKeyPem,
    });
    expect(vc.proof.cryptosuite).toBe('eddsa-jcs-2022');
    expect(vc.proof.proofValue.startsWith('z')).toBe(true);
    expect(verifyCredential(vc, key.publicKeyMultibase)).toEqual({ valid: true });
  });

  it('detects tampering', () => {
    const vc = issueCredential({
      credential: unsigned,
      verificationMethod: vm,
      privateKeyPem: key.privateKeyPem,
    });
    const tampered = structuredClone(vc);
    (tampered.credentialSubject as { name: string }).name = 'Someone Else';
    expect(verifyCredential(tampered, key.publicKeyMultibase)).toEqual({
      valid: false,
      reason: 'signature-mismatch',
    });
    const otherKey = generateIssuerKey();
    expect(verifyCredential(vc, otherKey.publicKeyMultibase).valid).toBe(false);
  });

  it('rejects expired credentials', () => {
    const vc = issueCredential({
      credential: { ...unsigned, validUntil: '2020-01-01T00:00:00Z' },
      verificationMethod: vm,
      privateKeyPem: key.privateKeyPem,
    });
    expect(verifyCredential(vc, key.publicKeyMultibase)).toEqual({
      valid: false,
      reason: 'expired',
    });
  });

  it('builds did:web identifiers and documents', () => {
    expect(didWebFromOrigin('http://localhost:3000')).toBe('did:web:localhost%3A3000');
    const doc = didWebDocument(did, key.publicKeyMultibase);
    expect(doc.assertionMethod).toEqual([vm]);
    expect(doc.verificationMethod[0]!.type).toBe('Multikey');
  });
});
