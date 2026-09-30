/**
 * Automated accessibility checks (axe-core, WCAG 2.2 A and AA) on the pages people reach
 * first, in light and dark, left to right and right to left. Automated checks catch about a
 * third of problems; they complement, never replace, testing with people who use assistive
 * technology.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, startAsGuest, test } from './fixtures';

const PAGES = [
  '/welcome',
  '/support?country=IN',
  '/shield',
  '/signals/forecasts',
  '/signals/forecasts/record',
  '/sign-in',
  '/sign-up',
  '/start',
  '/text',
  '/privacy',
  '/terms',
];

async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    // The Next.js development badge is not part of Waypoint.
    .exclude('nextjs-portal')
    .analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

for (const path of PAGES) {
  test(`${path} has no serious accessibility problems`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(await audit(page)).toEqual([]);
  });
}

test('dark mode and Arabic keep their contrast and structure', async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    { name: 'NEXT_LOCALE', value: 'ar', url: baseURL ?? '' },
    { name: 'wp-theme', value: 'dark', url: baseURL ?? '' },
  ]);
  for (const path of ['/welcome', '/privacy', '/support?country=EG']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(await audit(page), path).toEqual([]);
  }
});

test('every module a signed-in person uses has no serious accessibility problems @desktop', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await startAsGuest(page);
  const problems: string[] = [];
  for (const path of [
    '/',
    '/path',
    '/path/new',
    '/path/skills',
    '/ask',
    '/signals',
    '/circles',
    '/money',
    '/mind',
    '/health',
    '/civic',
    '/surroundings',
    '/goals',
    '/explore',
    '/settings',
    '/settings/privacy',
    '/org',
    '/join',
  ]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    for (const found of await audit(page)) problems.push(`${path}: ${found}`);
  }
  expect(problems).toEqual([]);
});
