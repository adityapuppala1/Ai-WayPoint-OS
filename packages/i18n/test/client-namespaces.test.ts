/**
 * The website sends the browser only the message namespaces its client components use
 * (SERVER_ONLY_NAMESPACES stay on the server). This keeps that list honest: a client
 * component that starts using one of them would otherwise show raw keys in production.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { englishMessages, SERVER_ONLY_NAMESPACES } from '../src';

const WEB = join(__dirname, '..', '..', '..', 'apps', 'web', 'src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('messages sent to the browser', () => {
  const serverOnly = new Set<string>(SERVER_ONLY_NAMESPACES);
  const client = files(WEB).filter((f) => /^\s*['"]use client['"]/.test(readFileSync(f, 'utf8')));

  it('finds the website’s client components', () => {
    expect(client.length).toBeGreaterThan(20);
  });

  it('no client component uses a server-only namespace', () => {
    const used: string[] = [];
    for (const file of client) {
      const source = readFileSync(file, 'utf8');
      expect(source, `${file} calls useTranslations() without a namespace`).not.toMatch(
        /useTranslations\(\s*\)/,
      );
      for (const m of source.matchAll(/useTranslations\(\s*['"]([\w.]+)['"]\s*\)/g)) {
        const namespace = (m[1] ?? '').split('.')[0] ?? '';
        if (serverOnly.has(namespace)) used.push(`${file.slice(WEB.length)} → ${namespace}`);
      }
    }
    expect(used).toEqual([]);
  });

  it('only names namespaces that exist', () => {
    for (const namespace of SERVER_ONLY_NAMESPACES)
      expect(Object.keys(englishMessages)).toContain(namespace);
  });

  it('no client component reads next-intl’s locale itself, which can name its digits', () => {
    // There it is the formatting locale ("ar-u-nu-latn", see app/layout.tsx): comparing it with
    // "ar", or sending it to the server, would quietly go wrong. useLanguage() gives "ar".
    const direct = client.filter((file) =>
      /import\s*\{[^}]*\buseLocale\b[^}]*\}\s*from\s*['"]next-intl['"]/.test(
        readFileSync(file, 'utf8'),
      ),
    );
    expect(direct.map((file) => file.slice(WEB.length))).toEqual([]);
  });
});
