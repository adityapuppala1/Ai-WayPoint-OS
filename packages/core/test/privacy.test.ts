import { describe, expect, it } from 'vitest';
import {
  decryptField,
  encryptField,
  generateKey,
  hashIdentifier,
  keyFromBase64,
  redactPII,
  safeEqual,
  safeRate,
  suppressSmallGroups,
  unwrapDek,
  verhoeffValid,
  wrapDek,
} from '../src/privacy';

/** Append a Verhoeff check digit to make a valid Aadhaar-format test number. */
function withVerhoeff(base: string): string {
  for (let d = 0; d <= 9; d++) if (verhoeffValid(base + d)) return base + d;
  throw new Error('unreachable');
}

describe('redactPII', () => {
  it('redacts contact details', () => {
    const r = redactPII('Mail me at amina.k@example.org or call +91 98765 43210 today.');
    expect(r.text).toBe('Mail me at [email] or call [phone] today.');
    expect(r.found).toEqual(
      expect.arrayContaining([
        { kind: 'email', count: 1 },
        { kind: 'phone', count: 1 },
      ]),
    );
  });

  it('redacts Luhn-valid cards but keeps other long numbers', () => {
    expect(redactPII('card 4111 1111 1111 1111 exp 12/28').text).toContain('[card]');
    expect(redactPII('ref 4111 1111 1111 1112').text).not.toContain('[card]');
  });

  it('redacts checksum-valid Aadhaar numbers only', () => {
    const valid = withVerhoeff('23456789012');
    const pretty = `${valid.slice(0, 4)} ${valid.slice(4, 8)} ${valid.slice(8)}`;
    expect(redactPII(`My Aadhaar is ${pretty}`).text).toBe('My Aadhaar is [id number]');
  });

  it('redacts valid IBANs, UPI ids and SSNs', () => {
    expect(redactPII('IBAN GB82 WEST 1234 5698 7654 32 please').text).toBe(
      'IBAN [bank account] please',
    );
    expect(redactPII('pay to ravi.k@okaxis').text).toBe('pay to [payment id]');
    expect(redactPII('SSN 123-45-6789').text).toBe('SSN [id number]');
  });

  it('leaves ordinary numbers, years, money and dates alone', () => {
    const text =
      'I earned 25,000 in 2024, paid 1500.50 rent, and my interview is on 12.05.2026 at 10:30.';
    expect(redactPII(text).text).toBe(text);
  });

  it('can keep chosen kinds', () => {
    expect(redactPII('email a@b.co', ['email']).text).toBe('email a@b.co');
  });
});

describe('envelope encryption', () => {
  it('encrypts and decrypts fields bound to their owner', () => {
    const dek = generateKey();
    const ct = encryptField('I felt calmer after the walk.', dek, 'user:1:journal:9');
    expect(ct.startsWith('v1.')).toBe(true);
    expect(decryptField(ct, dek, 'user:1:journal:9')).toBe('I felt calmer after the walk.');
    expect(() => decryptField(ct, dek, 'user:2:journal:9')).toThrow();
    expect(() => decryptField(ct, generateKey(), 'user:1:journal:9')).toThrow();
  });

  it('refuses a shortened authentication tag', () => {
    const dek = generateKey();
    const [version, iv, tag, body] = encryptField('private words', dek, 'aad').split('.');
    const short = Buffer.from(tag as string, 'base64url')
      .subarray(0, 4)
      .toString('base64url');
    expect(() => decryptField([version, iv, short, body].join('.'), dek, 'aad')).toThrow(
      /Unsupported ciphertext/,
    );
  });

  it('wraps data keys and supports key rotation ids', () => {
    const kek1 = generateKey();
    const kek2 = generateKey();
    const dek = generateKey();
    const wrapped = wrapDek(dek, kek2, 'k2');
    expect(wrapped.startsWith('k2:')).toBe(true);
    expect(unwrapDek(wrapped, { k1: kek1, k2: kek2 }).equals(dek)).toBe(true);
    expect(() => unwrapDek(wrapped, { k1: kek1 })).toThrow(/Unknown key-encryption key/);
  });

  it('validates base64 keys and compares safely', () => {
    expect(keyFromBase64(generateKey().toString('base64'))).toHaveLength(32);
    expect(() => keyFromBase64('c2hvcnQ=')).toThrow();
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(hashIdentifier('+15551234567', 's1')).not.toBe(hashIdentifier('+15551234567', 's2'));
  });
});

describe('k-anonymity', () => {
  it('suppresses small groups and their complements', () => {
    const out = suppressSmallGroups(
      [
        { key: 'a', n: 120 },
        { key: 'b', n: 70 },
        { key: 'c', n: 12 },
      ],
      50,
    );
    expect(out.find((g) => g.key === 'c')!.suppressed).toBe(true);
    // Only one small group: the next-smallest is hidden too so c cannot be derived.
    expect(out.find((g) => g.key === 'b')!.suppressed).toBe(true);
    expect(out.find((g) => g.key === 'a')!.suppressed).toBe(false);
  });

  it('keeps hiding until the hidden groups total at least k', () => {
    const out = suppressSmallGroups(
      [
        { key: 'a', n: 300 },
        { key: 'b', n: 60 },
        { key: 'c', n: 10 },
        { key: 'd', n: 8 },
      ],
      50,
    );
    expect(
      out
        .filter((g) => g.suppressed)
        .map((g) => g.key)
        .sort(),
    ).toEqual(['b', 'c', 'd']);
  });

  it('reports safe rates only', () => {
    expect(safeRate(30, 40, 50)).toBeNull(); // group too small
    expect(safeRate(3, 80, 50)).toBeNull(); // small cell
    expect(safeRate(80, 80, 50)).toBeNull(); // unanimous
    expect(safeRate(80, 80, 50, { allowUnanimous: true })).toBe(1);
    expect(safeRate(31, 100, 50)).toBe(0.3);
  });
});

describe('text for logs and for emails to other people', () => {
  it('keeps statement values, one-time tokens and personal details out of logs', async () => {
    const { scrubLogText } = await import('../src/privacy');
    const drizzle =
      'Failed query: insert into "outbox" ("recipient_ref", "payload") values ($1, $2)\nparams: v1.abc,{"url":"https://w.example/verify-email?token=eyJhbGci.x.y"}';
    expect(scrubLogText(drizzle)).toBe(
      'Failed query: insert into "outbox" ("recipient_ref", "payload") values ($1, $2)',
    );
    expect(scrubLogText('GET /api/auth/verify-email?token=eyJ.abc.def&callbackURL=%2F')).toBe(
      'GET /api/auth/verify-email?token=[redacted]&callbackURL=%2F',
    );
    expect(scrubLogText('SMTP 550 rejected for ada@example.org')).toBe(
      'SMTP 550 rejected for [email]',
    );
  });

  it('turns names into one plain line with no links', async () => {
    const { plainName } = await import('../src/privacy');
    expect(plainName('  Ada   Lovelace ')).toBe('Ada Lovelace');
    expect(plainName('Ada\nClick https://evil.example/login now')).toBe('Ada Click … now');
    expect(plainName('Bank of Waypoint — verify at www.bank-verify.example')).toBe(
      'Bank of Waypoint — verify at …',
    );
    expect(plainName('Support: bit.ly/x9')).toBe('Support: …');
    expect(plainName('Dr. J. R. Okafor')).toBe('Dr. J. R. Okafor');
    expect(plainName('Riverside Works Ltd.')).toBe('Riverside Works Ltd.');
    expect(plainName('x'.repeat(100), 20)).toHaveLength(20);
    expect(plainName(null)).toBe('');
    // Invisible characters can't hide a link or fake a different name.
    for (const invisible of ['\u00ad', '\u061c', '\u2060', '\u2062', '\ufeff', '\u180e', '\u3164'])
      expect(plainName(`Ada${invisible}Lovelace`)).toBe('Ada Lovelace');
    // Emoji keep their look.
    expect(plainName('Ama \u2764\ufe0f')).toBe('Ama \u2764\ufe0f');
  });

  it('takes web addresses out of names however they are written', async () => {
    const { hasWebAddress, plainName } = await import('../src/privacy');
    // Capital letters are still an address, and so are the full stops other scripts use.
    expect(plainName('SECURE-BANK.COM Support')).toBe('\u2026 Support');
    expect(plainName('Verify at Secure-Bank.Com/login')).toBe('Verify at \u2026');
    expect(plainName('evil.com\u3002')).toBe('\u2026\u3002');
    expect(plainName('evil\uff0ecom')).toBe('\u2026');
    expect(plainName('pay\u3002evil\u3002top now')).toBe('\u2026 now');
    for (const name of [
      'SECURE-BANK.COM',
      'Visit Evil.Top',
      'evil.com\u3002',
      'evil\uff0ecom',
      'https://x.example',
      'WWW.BANK.EXAMPLE',
      'My-Bank.Co.Uk team',
    ])
      expect(hasWebAddress(name), name).toBe(true);
    // Ordinary names, with their titles, initials and company endings, are not addresses…
    for (const name of [
      'Dr. J. R. Okafor',
      'Dr.Smith',
      'St.John Ambulance',
      'Riverside Works Ltd.',
      'Acme S.A.',
      'J.R.R. Tolkien',
      'Amina K.',
      'Node.js Meetup',
      '\u0645\u0624\u0633\u0633\u0629 \u0627\u0644\u0623\u0645\u0644',
    ])
      expect(hasWebAddress(name), name).toBe(false);
    // …and in an email they read as they were typed.
    for (const name of ['Dr. J. R. Okafor', 'Riverside Works Ltd.', 'Amina K.'])
      expect(plainName(name), name).toBe(name);
  });

  it('cannot be slowed to a crawl by a very long name', async () => {
    const { hasWebAddress, plainName } = await import('../src/privacy');
    for (const long of ['a-'.repeat(120_000), 'a.'.repeat(120_000), `${'x'.repeat(200_000)}.com`]) {
      const started = performance.now();
      // Nothing that long is a name: it is refused without being searched.
      expect(hasWebAddress(long)).toBe(true);
      expect(plainName(long).length).toBeLessThanOrEqual(60);
      expect(performance.now() - started).toBeLessThan(250);
    }
  });

  it('leaves nothing in an emailed name that a mail app would turn into a link', async () => {
    const { plainName } = await import('../src/privacy');
    // Endings no list could keep up with, and other alphabets: the dot itself is opened up.
    expect(plainName('Secure-Bank.Cam')).toBe('Secure-Bank. Cam');
    expect(plainName('Pay.Rocks today')).toBe('Pay. Rocks today');
    expect(plainName('банк.рф')).toBe('банк. рф');
    expect(plainName('Dr.Smith')).toBe('Dr. Smith');
    expect(plainName('Version 2.5 Club')).toBe('Version 2.5 Club');
    expect(plainName('Dr. J. R. Okafor')).toBe('Dr. J. R. Okafor');
  });

  it('removes phone numbers wherever they sit in a line', () => {
    for (const text of [
      'call (0712345678) now',
      'tel:+254711000000',
      'whatsapp:+254711000000 refused',
      '{"to":"+254711000000","status":"failed"}',
      'to=+254711000000&from=+15550001111',
      'number:0712345678.',
      '<+254 711 000 000>',
    ])
      expect(redactPII(text).text, text).not.toMatch(/\d{5}/);
    // Things that are not phone numbers stay readable.
    expect(redactPII('on 12.05.2024 at 10:30').text).toBe('on 12.05.2024 at 10:30');
    expect(redactPII('total 1234.50 for order A1234567').text).toBe(
      'total 1234.50 for order A1234567',
    );
    expect(redactPII('error 550 5.7.1 in version 1.2.3').text).toBe(
      'error 550 5.7.1 in version 1.2.3',
    );
    expect(redactPII('at 2024-05-12 10:30:15 on 2024-05-12T10:30:15Z').text).toBe(
      'at 2024-05-12 10:30:15 on 2024-05-12T10:30:15Z',
    );
  });
});
