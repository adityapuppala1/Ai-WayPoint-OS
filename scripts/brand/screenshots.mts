/**
 * Real screens from Waypoint for the welcome page: Today, Scam Shield with a sample scam
 * checked, Ask in guided mode and Get help now, in light and dark, at a phone and a desktop
 * size. Written as WebP to apps/web/public/landing/ (`{screen}-{phone|desktop}-{theme}.webp`).
 *
 * It starts nothing: it runs against the browser tests' server, which has no AI provider (so
 * Ask answers in guided mode), a fresh database and nothing that leaves the machine. Start
 * that server, then run this:
 *
 *   pnpm --filter @waypoint/web build
 *   # start apps/web/e2e/server.mjs with the environment playwright.config.ts gives it
 *   # (PORT=3150, WAYPOINT_URL, WAYPOINT_DATA_DIR, the test-only secrets, empty AI keys), then:
 *   pnpm exec tsx scripts/brand/screenshots.mts http://localhost:3150
 *
 * Rebuild afterwards: a production build serves only the public files it was built with.
 *
 * Each size and theme is a new guest who says they lost their job, the way the browser tests
 * make one (e2e/fixtures.ts). Nothing on the screens is invented: they are what that guest sees.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { launch, ROOT, sharp } from './browser.mjs';

/** The test server's address: the first argument, or the port the browser tests use here. */
const BASE = process.argv[2] ?? 'http://localhost:3150';
const OUT = join(ROOT, 'apps/web/public/landing');

const SIZES = {
  phone: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  desktop: {
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
} as const;
type Size = keyof typeof SIZES;
type Theme = 'light' | 'dark';

const SCAM =
  'URGENT: Your parcel is on hold. Pay the 2.99 customs fee today at http://dhl-parcel-fees.top/pay or it will be returned.';
const QUESTION = 'I lost my job last week. Where do I start?';

let visitor = 0;
async function context(browser: Browser, size: Size, theme: Theme): Promise<BrowserContext> {
  visitor += 1;
  const ctx = await browser.newContext({
    ...SIZES[size],
    baseURL: BASE,
    locale: 'en-GB',
    timezoneId: 'Africa/Nairobi',
    colorScheme: theme,
    reducedMotion: 'reduce',
    // A visitor address of its own, as the tests give each test (fixtures.ts), so new guests
    // are not held back by one shared allowance.
    extraHTTPHeaders: { 'x-forwarded-for': `10.250.${visitor}.${10 + visitor}` },
  });
  await ctx.addCookies([
    { name: 'wp-theme', value: theme, url: BASE },
    { name: 'NEXT_LOCALE', value: 'en', url: BASE },
  ]);
  return ctx;
}

/** The page's script has taken over (src/app/providers.tsx marks it). */
async function ready(page: Page) {
  await page.waitForFunction(() => document.documentElement.hasAttribute('data-ready'), undefined, {
    timeout: 60_000,
  });
}

async function go(page: Page, path: string) {
  await page.goto(path);
  await ready(page);
}

/** A guest who lost their job, from the welcome page through getting started. */
async function startAsGuest(page: Page) {
  await go(page, '/welcome');
  await page.getByRole('link', { name: 'Start, no sign-up needed' }).first().click();
  await page.waitForURL(/\/start/);
  await page.waitForFunction(() => window.sessionStorage.getItem('wp-start-draft') !== null);
  await page.getByText('I recently lost my job or income', { exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('What should we call you?').fill('Amani');
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.waitForURL(/\/$/, { timeout: 60_000 });
  await ready(page);
}

/** Waits for fonts and pictures, then a moment for anything still settling. */
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('load');
  await page.waitForTimeout(600);
}

async function save(page: Page, shot: string, size: Size, theme: Theme) {
  const png = await page.screenshot({ type: 'png' });
  const file = join(OUT, `${shot}-${size}-${theme}.webp`);
  await sharp()(png).webp({ quality: 78, effort: 6 }).toFile(file);
  console.log(file.slice(ROOT.length + 1));
}

/** Scrolls so `heading` sits a little below the top, as a person reading it would. */
async function bringUp(page: Page, name: string | RegExp) {
  await page
    .getByRole('heading', { name })
    .first()
    .evaluate((el) => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(top - 160, 0), behavior: 'instant' });
    });
  await page.waitForTimeout(200);
}

mkdirSync(OUT, { recursive: true });
const browser = await launch();
try {
  for (const size of ['phone', 'desktop'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      const ctx = await context(browser, size, theme);
      const page = await ctx.newPage();
      await startAsGuest(page);

      // Today: the next step on the sign.
      await page.getByText('Your next step').first().waitFor();
      await settle(page);
      await save(page, 'today', size, theme);

      // Scam Shield, after checking a sample parcel-fee message.
      await go(page, '/shield');
      await page.getByLabel('What did you receive?').fill(SCAM);
      await page.getByRole('button', { name: 'Check', exact: true }).click();
      await page.getByRole('heading', { name: 'What we found' }).waitFor();
      await settle(page);
      if (size === 'phone') await bringUp(page, 'What we found');
      await save(page, 'shield', size, theme);

      // Ask with no AI provider: Waypoint's guided answer.
      await go(page, '/ask');
      await page.getByLabel('Your message').fill(QUESTION);
      await page.getByRole('button', { name: 'Send' }).click();
      await page
        .getByText(/^Guided mode/)
        .first()
        .waitFor();
      await page.waitForURL(/\/ask\?c=/);
      await settle(page);
      // The question at the top of the screen, so the answer shows above the message box.
      await page
        .getByText(QUESTION)
        .first()
        .evaluate((el) => {
          const top = el.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({ top: Math.max(top - 90, 0), behavior: 'instant' });
        });
      await page.waitForTimeout(200);
      await save(page, 'ask', size, theme);

      // Get help now, for Kenya (from the time zone).
      await go(page, '/support');
      await page.locator('a[href^="tel:"]').first().waitFor();
      await settle(page);
      await save(page, 'help', size, theme);

      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
