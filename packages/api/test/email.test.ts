import { LOCALES } from '@waypoint/core';
import { describe, expect, it } from 'vitest';
import { EMAIL_COPY } from '../src/email/copy';
import { EMAIL_TEMPLATES, renderEmail } from '../src/email/render';

const url = 'https://waypoint.example/org/invite/abc';

describe('emails', () => {
  it('exist for every template in every language, with the link written out too', () => {
    for (const locale of LOCALES)
      for (const template of EMAIL_TEMPLATES) {
        const mail = renderEmail(template, { url, name: 'Ana', organization: 'Acme' }, locale);
        expect(mail, `${locale} ${template}`).not.toBeNull();
        expect(mail?.subject.trim().length).toBeGreaterThan(5);
        expect(mail?.text).toContain(url);
        expect(mail?.html).toContain(`href="${url}"`);
        expect(mail?.html).toContain(`lang="${locale}"`);
        // Nothing left unfilled.
        expect(`${mail?.subject}${mail?.text}`).not.toMatch(/\{\w+\}/);
      }
  });

  it('never carries a link that is not a web address', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', '//evil.example', ''])
      expect(renderEmail('reset-password', { url: bad }, 'en')).toBeNull();
  });

  it('shows names typed by others as plain text only', () => {
    const mail = renderEmail(
      'org-invite',
      {
        url,
        inviter: 'Eve <script>alert(1)</script>\nhttps://evil.example',
        organization: 'Acme "Helpers" & Co <b>',
      },
      'en',
    );
    expect(mail?.html).not.toContain('<script>');
    expect(mail?.html).not.toContain('<b>');
    expect(mail?.html).toContain('&amp; Co');
    expect(mail?.subject).not.toContain('\n');
  });

  it('says "someone" in the reader’s language when the inviter has no name', () => {
    const fr = renderEmail('org-invite', { url, inviter: '', organization: 'Acme' }, 'fr');
    expect(fr?.subject).toBe(`${EMAIL_COPY.fr.someone} vous invite à rejoindre Acme sur Waypoint`);
    const hi = renderEmail(
      'org-invite',
      { url, inviter: 'Waypoint user', organization: 'Acme' },
      'hi',
    );
    expect(hi?.subject.startsWith('किसी ने')).toBe(true);
  });

  it('reads right to left in Arabic', () => {
    const mail = renderEmail('verify-email', { url, name: 'Ana' }, 'ar');
    expect(mail?.html).toContain('dir="rtl"');
  });
});
