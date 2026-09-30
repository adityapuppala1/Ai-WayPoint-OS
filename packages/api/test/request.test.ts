import { isBlockedAuthPath } from '@waypoint/auth';
import { describe, expect, it } from 'vitest';
import { clientIp, ipv6Network } from '../src/lib/request';

const ip = (headers: Record<string, string>) => clientIp(new Headers(headers));

describe('the visitor’s address', () => {
  it('comes from the one configured header, never from others a visitor can add', () => {
    // Default: X-Forwarded-For. A made-up CF-Connecting-IP or X-Real-IP changes nothing.
    expect(ip({ 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' })).toBe('2.2.2.2');
    expect(ip({ 'x-real-ip': '3.3.3.3' })).toBe('unknown');
    // The right-most entry is the one the nearest proxy saw; entries before it are claims.
    expect(ip({ 'x-forwarded-for': '9.9.9.9, 8.8.8.8, 2.2.2.2' })).toBe('2.2.2.2');
    expect(ip({ 'x-forwarded-for': '9.9.9.9, not-an-address' })).toBe('unknown');
    expect(ip({})).toBe('unknown');
  });

  it('unwraps ports and brackets, and counts IPv6 as its /64 network', () => {
    expect(ip({ 'x-forwarded-for': '203.0.113.9:51234' })).toBe('203.0.113.9');
    expect(ip({ 'x-forwarded-for': '::ffff:10.0.0.1' })).toBe('10.0.0.1');
    expect(ip({ 'x-forwarded-for': '2001:db8:abcd:12:1:2:3:4' })).toBe('2001:db8:abcd:12::/64');
    expect(ip({ 'x-forwarded-for': '[2001:db8:abcd:12::99]:443' })).toBe('2001:db8:abcd:12::/64');
    // Changing the last half of the address does not give a fresh allowance.
    expect(ipv6Network('2001:db8:abcd:12:ffff:ffff:ffff:1')).toBe(
      ipv6Network('2001:db8:abcd:12::2'),
    );
    expect(ipv6Network('::1')).toBe('0:0:0:0::/64');
  });
});

describe('switched-off parts of the auth library', () => {
  it('stay switched off however the path is written', () => {
    for (const path of [
      '/api/auth/admin/impersonate-user',
      '/api/auth/admin/list-users/',
      '/api/auth//admin/list-users',
      '/api/auth/ADMIN/set-user-password',
      '/api/auth/admin%2Flist-users',
      '/api/auth/%61dmin/list-users',
      '/api/auth/organization/create',
      '/api/auth/delete-user',
      '/api/auth/delete-user/callback',
      '/api/auth/change-email',
      '/api/auth/%E0%A4%A',
      // Phone accounts: no password sign-in, no silent password reset.
      '/api/auth/sign-in/phone-number',
      '/api/auth/phone-number/request-password-reset',
      '/api/auth/phone-number/reset-password',
      '/api/auth/phone-number%2Freset-password',
      // An open redirect Waypoint has no use for.
      '/api/auth/expo-authorization-proxy',
      // Anything Waypoint doesn't use, including what a future version might add.
      '/api/auth/update-user',
      '/api/auth/list-sessions',
      '/api/auth/sign-in/social',
      '/api/auth/administrator-notes',
      '/api/auth/reset-password/token/extra',
    ])
      expect(isBlockedAuthPath(path), path).toBe(true);
    for (const path of [
      '/api/auth/sign-in/email',
      '/api/auth/sign-in/email/',
      '/api/auth/sign-up/email',
      '/api/auth/sign-in/anonymous',
      '/api/auth/get-session',
      '/api/auth/sign-out',
      '/api/auth/send-verification-email',
      '/api/auth/verify-email',
      '/api/auth/request-password-reset',
      '/api/auth/reset-password',
      '/api/auth/reset-password/AbC123xyz',
      '/api/auth/phone-number/send-otp',
      '/api/auth/phone-number/verify',
      '/api/auth/passkey/generate-authenticate-options',
    ])
      expect(isBlockedAuthPath(path), path).toBe(false);
  });

  it('shows the API reference in development only', () => {
    expect(isBlockedAuthPath('/api/auth/reference', '/api/auth', true)).toBe(false);
    expect(isBlockedAuthPath('/api/auth/reference', '/api/auth', false)).toBe(true);
  });
});
