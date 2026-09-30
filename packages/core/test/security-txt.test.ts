import { describe, expect, it } from 'vitest';
import { SECURITY_POLICY_URL, SECURITY_REPORT_URL, securityTxt } from '../src/security-txt';

const now = new Date('2026-09-30T10:15:00Z');
const field = (text: string, name: string) =>
  text
    .split('\n')
    .filter((line) => line.startsWith(`${name}: `))
    .map((line) => line.slice(name.length + 2));

describe('/.well-known/security.txt (RFC 9116)', () => {
  it('says where to report a problem with this installation, and until when the file holds', () => {
    const text = securityTxt({
      site: 'https://waypoint.example/',
      contact: 'security@waypoint.example',
      now,
    });
    expect(field(text, 'Contact')).toEqual([
      'mailto:security@waypoint.example',
      SECURITY_REPORT_URL,
    ]);
    expect(field(text, 'Canonical')).toEqual(['https://waypoint.example/.well-known/security.txt']);
    expect(field(text, 'Policy')).toEqual([SECURITY_POLICY_URL]);
    expect(field(text, 'Preferred-Languages')).toEqual(['en']);
    // Exactly one Expires, in the future and less than a year away.
    const [expires] = field(text, 'Expires');
    expect(field(text, 'Expires')).toHaveLength(1);
    const until = new Date(expires as string).getTime();
    expect(until).toBeGreaterThan(now.getTime() + 30 * 86_400_000);
    expect(until).toBeLessThan(now.getTime() + 365 * 86_400_000);
    expect(expires).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(text.endsWith('\n')).toBe(true);
  });

  it('takes a web address as the contact, and works without one', () => {
    expect(
      field(
        securityTxt({ site: 'https://w.example', contact: 'https://w.example/report', now }),
        'Contact',
      )[0],
    ).toBe('https://w.example/report');
    // No contact set up yet: problems in the software itself can still be reported.
    const bare = securityTxt({ site: 'https://w.example', contact: null, now });
    expect(field(bare, 'Contact')).toEqual([SECURITY_REPORT_URL]);
    // Nothing that is not an email address or an https address is ever written out.
    for (const bad of ['javascript:alert(1)', 'http://w.example/report', 'x\nContact: evil'])
      expect(
        field(securityTxt({ site: 'https://w.example', contact: bad, now }), 'Contact'),
      ).toEqual([SECURITY_REPORT_URL]);
  });
});
