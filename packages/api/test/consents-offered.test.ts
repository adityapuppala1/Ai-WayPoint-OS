/**
 * A switch in Privacy settings must change something. Every choice the website and the phone
 * app offer has to be read somewhere on the server; a purpose nothing reads ("include me in
 * public trend reports", while no such report exists) is not offered until it means something.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONSENT_PURPOSES } from '@waypoint/core';
import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** The purposes listed in `export const <name> = [ … ]` of a source file. */
function listIn(file: string, name: string): string[] {
  const source = readFileSync(join(ROOT, file), 'utf8');
  const body = new RegExp(`export const ${name} = \\[([^\\]]*)\\]`).exec(source)?.[1];
  if (body === undefined) throw new Error(`${name} not found in ${file}`);
  return [...body.matchAll(/'([a-z_]+)'/g)].map((m) => m[1] as string);
}

function sourceUnder(dir: string): string {
  let text = '';
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) text += sourceUnder(path);
    else if (/\.tsx?$/.test(entry.name)) text += readFileSync(join(ROOT, path), 'utf8');
  }
  return text;
}

const offered = {
  website: listIn('apps/web/src/lib/options.ts', 'OFFERED_CONSENTS'),
  'phone app': listIn('apps/mobile/src/place.ts', 'OFFERED_CONSENTS'),
};
// Where a choice takes effect: the API, the assistant and sign-in (guest data moving over).
const server = ['packages/api/src', 'packages/ai/src', 'packages/auth/src']
  .map(sourceUnder)
  .join('\n');

describe('the choices offered in Privacy settings', () => {
  for (const [where, purposes] of Object.entries(offered)) {
    it(`on the ${where}, every choice is one the server acts on`, () => {
      expect(purposes.length).toBeGreaterThan(3);
      for (const purpose of purposes) {
        expect(CONSENT_PURPOSES as readonly string[], purpose).toContain(purpose);
        expect(new RegExp(`\\b${purpose}\\b`).test(server), `${purpose} is read nowhere`).toBe(
          true,
        );
      }
    });
  }

  it('offers the same choices on the website and in the phone app', () => {
    expect(offered['phone app']).toEqual(offered.website);
  });

  it('leaves out the trend-report choice, which nothing reads yet', () => {
    expect(offered.website).not.toContain('research_aggregates');
    // The purpose itself stays, so answers already stored are kept and exported.
    expect(CONSENT_PURPOSES).toContain('research_aggregates');
  });

  it('the public privacy notice lists the choices offered, not every purpose the code knows', () => {
    const notice = readFileSync(join(ROOT, 'apps/web/src/app/privacy/page.tsx'), 'utf8');
    expect(notice).toContain('OFFERED_CONSENTS.map');
    expect(notice).not.toContain('CONSENT_PURPOSES');
  });
});
