/**
 * A plan step or checklist line that sends someone to a page must send them to a page that
 * exists. The list of pages is read from the web app's own folder, so a page that is renamed
 * or never built fails here instead of showing "not found" on somebody's next step.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CIVIC_CHECKLISTS,
  LEARNING_RESOURCES,
  listLifeEvents,
  ROLES,
  SKILLS,
} from '@waypoint/content';
import { describe, expect, it } from 'vitest';
import { currentStepHref, draftPlan, PLAN_TEMPLATES_EN } from '../src/path';
import { type PathInput, SITUATIONS } from '../src/types';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const APP_DIR = join(ROOT, 'apps', 'web', 'src', 'app');
const MESSAGES_DIR = join(ROOT, 'packages', 'i18n', 'messages');

/** Every page of the web app as a pattern: `/path/plans/[id]` matches `/path/plans/abc`. */
function appRoutes(dir = APP_DIR, segments: string[] = []): RegExp[] {
  const routes: RegExp[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // Folders in brackets group pages without adding to the address; `_` and `@` folders
      // are never pages.
      if (/^[_@]/.test(entry.name)) continue;
      const group = /^\(.*\)$/.test(entry.name);
      routes.push(
        ...appRoutes(join(dir, entry.name), group ? segments : [...segments, entry.name]),
      );
    } else if (/^page\.(tsx|ts|jsx|js)$/.test(entry.name)) {
      const pattern = segments
        .map((s) =>
          /^\[\[?\.\.\./.test(s)
            ? '.+'
            : /^\[.+\]$/.test(s)
              ? '[^/]+'
              : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        )
        .join('/');
      routes.push(new RegExp(`^/${pattern}$`));
    }
  }
  return routes;
}

const routes = appRoutes();
const events = new Set<string>(listLifeEvents());

/** Whether an in-app address leads to a real page (the part after # or ? is not the page). */
function resolves(href: string): boolean {
  const path = href.split(/[?#]/)[0] ?? '';
  if (!path.startsWith('/') || !routes.some((r) => r.test(path))) return false;
  // A checklist page exists only for the life events there is a checklist for.
  const event = /^\/civic\/([^/]+)$/.exec(path)?.[1];
  return event === undefined || events.has(event);
}

const data = { roles: ROLES, skills: SKILLS, resources: LEARNING_RESOURCES };
const base: PathInput = {
  skills: [],
  interests: ['digital', 'data'],
  hoursPerWeek: 6,
  horizonWeeks: 8,
  situation: 'steady',
  languages: ['en'],
  budget: 'free',
};

/** Every address any plan can carry: each situation, plan length and role, and no role. */
function planHrefs(): Set<string> {
  const hrefs = new Set<string>();
  for (const situation of SITUATIONS)
    for (const horizonWeeks of [4, 8, 12] as const)
      for (const roleId of [undefined, ...ROLES.map((r) => r.id)]) {
        const plan = draftPlan({ ...base, situation, horizonWeeks }, data, { roleId });
        for (const week of plan.weeks)
          for (const step of week.steps) if (step.href) hrefs.add(step.href);
      }
  return hrefs;
}

describe('pages that plans and checklists send people to', () => {
  it('reads the pages from the web app, and can tell a missing one', () => {
    expect(routes.length).toBeGreaterThan(20);
    expect(resolves('/')).toBe(true);
    expect(resolves('/goals#review')).toBe(true);
    expect(resolves('/path/plans/0190a3c2-1111-7000-8000-000000000000#step-1')).toBe(true);
    expect(resolves('/civic/job-loss')).toBe(true);
    expect(resolves('/civic/winning-the-lottery')).toBe(false);
    expect(resolves('/path/no-such-page')).toBe(false);
    expect(resolves('https://example.org/')).toBe(false);
  });

  it('every step a plan can contain leads to a page that exists', () => {
    const hrefs = planHrefs();
    // Plans do link somewhere (the weekly review, circles, the job-loss checklist).
    expect(hrefs.size).toBeGreaterThanOrEqual(3);
    for (const href of hrefs) expect(resolves(href), href).toBe(true);
  });

  it('plans saved before the proof pages were dropped stop pointing at them', () => {
    // Proof of work (projects, reviews, credentials) is not built: these two pages never existed.
    expect(resolves('/path/projects/new')).toBe(false);
    expect(resolves('/path/proof')).toBe(false);
    for (const old of ['/path/projects/new', '/path/proof']) {
      const now = currentStepHref(old);
      expect(now === null || resolves(now), `${old} → ${now}`).toBe(true);
    }
    expect(currentStepHref('/goals#review')).toBe('/goals#review');
    expect(currentStepHref(null)).toBeNull();
  });

  it('promises only what a plan delivers: no credential, nothing “verified”, in any language', () => {
    // Nothing issues a credential or verifies a project yet, so no plan text may say so.
    const promised: Record<string, RegExp> = {
      en: /verified|credential/i,
      hi: /सत्यापित|प्रमाणपत्र/,
      es: /verificad|credencial/i,
      fr: /vérifié|attestation/i,
      pt: /verificad|credencial/i,
      ar: /موثّق|شهادة/,
      sw: /thibitishwa|cheti/i,
    };
    expect(Object.values(PLAN_TEMPLATES_EN).join('\n')).not.toMatch(promised.en!);
    for (const [locale, words] of Object.entries(promised)) {
      const messages = JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8')) as {
        planTemplates: Record<string, string>;
      };
      for (const [key, text] of Object.entries(messages.planTemplates))
        expect(text, `${locale} planTemplates.${key}`).not.toMatch(words);
    }
  });

  it('every checklist link is an official https address or a page that exists', () => {
    let links = 0;
    for (const list of CIVIC_CHECKLISTS)
      for (const item of list.items)
        for (const link of item.links ?? []) {
          links += 1;
          const ok = link.url.startsWith('/') ? resolves(link.url) : /^https:\/\//.test(link.url);
          expect(ok, `${list.event}/${list.country}/${item.id}: ${link.url}`).toBe(true);
        }
    expect(links).toBeGreaterThan(5);
  });

  it('checklists describe Waypoint as it is', () => {
    const lines = CIVIC_CHECKLISTS.flatMap((list) =>
      list.items.map((item) => `${item.title} ${item.detail}`),
    ).join('\n');
    // There is no "work passport": Path keeps plans and skills, nothing that certifies work.
    expect(lines).not.toMatch(/work passport/i);
    // Surroundings gives weather, air quality and general advice. It does not relay alerts.
    expect(lines).not.toMatch(/Surroundings[^.]*alerts/i);
  });
});
