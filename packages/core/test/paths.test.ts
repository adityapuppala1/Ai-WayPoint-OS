import { describe, expect, it } from 'vitest';
import { isInternalPath, safeExternalHref, safeNextPath } from '../src/paths';

describe('paths people are sent back to', () => {
  it('allows ordinary paths on this site', () => {
    for (const p of [
      '/',
      '/join/K7QM3WXA',
      '/org/invite/0199a3c4-7b1e',
      '/settings#account',
      '/join?x=1&y=2',
    ])
      expect(isInternalPath(p), p).toBe(true);
  });

  it('refuses anything a browser would read as another site or a script', () => {
    for (const p of [
      '//evil.example',
      '/\\evil.example',
      '/%5Cevil.example',
      '/%2F%2Fevil.example',
      '\\\\evil.example',
      'https://evil.example',
      'javascript:alert(1)',
      '/ok\nLocation: https://evil.example',
      '/%0d%0aSet-Cookie:x',
      '',
      undefined,
    ])
      expect(isInternalPath(p), String(p)).toBe(false);
    expect(safeNextPath('/\\evil.example')).toBe('/');
    expect(safeNextPath('//evil.example', '/today')).toBe('/today');
    expect(safeNextPath('/path')).toBe('/path');
  });
});

describe('links built from data (an AI source, a signal, a forecast)', () => {
  it('open only web pages', () => {
    expect(safeExternalHref('https://www.who.int/news/item/x')).toBe(
      'https://www.who.int/news/item/x',
    );
    expect(safeExternalHref(' https://example.org/a b ')).toBe('https://example.org/a%20b');
    for (const bad of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:x',
      'file:///etc/passwd',
      '//evil.example',
      '/relative',
      'http://example.org/plain',
      'https://user:pass@example.org/',
      'not a url',
      '',
      null,
      undefined,
    ])
      expect(safeExternalHref(bad), String(bad)).toBeNull();
  });
});
