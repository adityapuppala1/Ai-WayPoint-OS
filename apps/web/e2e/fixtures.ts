/**
 * Shared test set-up: every page is watched for script errors and failed requests, so a
 * broken page fails its test even when what the test looks at still renders.
 */
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test as base, expect, type Locator, type Page, type TestInfo } from '@playwright/test';

type Engine = 'chromium' | 'firefox' | 'webkit';

/**
 * Browser noise that says nothing about Waypoint itself. Each engine words it differently, and
 * a line is only forgiven in the engine that writes it: anything else in the console fails
 * the test. Firefox has no list: it writes nothing for a refused request or a cancelled one.
 */
const CONSOLE_NOISE: Record<Engine, RegExp[]> = {
  chromium: [
    // A navigation cancelled a request in flight.
    /net::ERR_ABORTED/,
    // Refusals the tests ask for on purpose (a guest's 401, someone else's 404) are checked
    // where they happen; the browser also logs each one.
    /^Failed to load resource: the server responded with a status of 4\d\d/,
  ],
  firefox: [],
  webkit: [/^Failed to load resource: the server responded with a status of 4\d\d/],
};

/** `next dev` (E2E_DEV=1) talks in the console; the built app does not. */
const DEV_NOISE = process.env.E2E_DEV ? [/Download the React DevTools/, /\[Fast Refresh\]/] : [];

/**
 * WebKit's words for "a navigation cancelled a request in flight": it reports the unfinished
 * request as an error in the page, as "[Fetch API] cannot load http://… due to access control
 * checks." (Playwright passes on the part after "http:"). Only this site's own address is
 * forgiven: a request to it cannot fail a real access check, so the line can only mean the
 * page was left while something was loading (the worker's script, a page fetched ahead).
 */
const cancelledInWebKit = (baseURL: string) => {
  const host = new URL(baseURL).host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^/{1,2}${host}/\\S* due to access control checks\\.$`);
};

/**
 * What WebKit logs for every photograph Playwright takes: to settle animations it adds an
 * empty style of its own to the page and removes it again, and the page's content security
 * policy refuses that style like any other without the page's nonce. Waypoint's own styles
 * are not refused: the many tests that load the same pages and take no photograph (the
 * accessibility checks, for one) would fail on this very line. So it is forgiven once per
 * photograph taken, never more.
 */
const STYLE_REFUSED =
  "Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the style-src directive of the Content Security Policy.";

/** Photographs taken of each page so far (see STYLE_REFUSED). */
const photographs = new WeakMap<Page, number>();
let countsPhotographs = false;
/**
 * Counts every photograph of a page: the whole page (`page.screenshot`) and one part of it
 * (`locator.screenshot`), which WebKit refuses the same style for.
 */
function countPhotographs(page: Page): void {
  if (countsPhotographs) return;
  countsPhotographs = true;
  const taken = (of: Page) => photographs.set(of, (photographs.get(of) ?? 0) + 1);
  const pages = Object.getPrototypeOf(page) as Page;
  const parts = Object.getPrototypeOf(page.locator('html')) as Locator;
  const { screenshot: whole } = pages;
  const { screenshot: part } = parts;
  pages.screenshot = function (this: Page, options) {
    taken(this);
    return whole.call(this, options);
  };
  parts.screenshot = function (this: Locator, options) {
    taken(this.page());
    return part.call(this, options);
  };
}

/**
 * Waits until the page answers to a press. Playwright's `goto` returns when the page has
 * loaded, and the page's script takes over a moment after that: soon enough in Chrome that
 * the tests never noticed, 400 to 650 milliseconds later in WebKit on the machine this was
 * measured on. No person presses a button that fast, but a test does, and the press lands on
 * a button nothing is listening to yet. The app marks the moment (`data-ready` on <html>, set
 * in src/app/providers.tsx); documents that are not the app's own pages (the offline page, a
 * JSON answer) have no mark to wait for.
 */
async function usable(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () =>
        !document.querySelector('meta[property="csp-nonce"]') ||
        document.documentElement.hasAttribute('data-ready'),
      undefined,
      { timeout: 60_000 },
    )
    .catch((error: Error) => {
      throw new Error(`${page.url()} loaded, but its script never took over: ${error.message}`);
    });
}

let waitsWhenLoaded = false;
/**
 * Makes `goto` and `reload` wait for `usable` on every page this worker opens, including the
 * ones a test opens in a second browser context. A call that says what to wait for
 * (`waitUntil`) is left exactly as Playwright does it.
 */
function waitWhenLoaded(page: Page): void {
  if (waitsWhenLoaded) return;
  waitsWhenLoaded = true;
  const proto = Object.getPrototypeOf(page) as Page;
  const { goto, reload } = proto;
  proto.goto = async function (this: Page, url, options) {
    const response = await goto.call(this, url, options);
    if (!options?.waitUntil) await usable(this);
    return response;
  };
  proto.reload = async function (this: Page, options) {
    const response = await reload.call(this, options);
    if (!options?.waitUntil) await usable(this);
    return response;
  };
}

/**
 * The address a test's visitor comes from, the same on every run: one of the private 10.x
 * addresses, chosen by the project and the test. The test server reads the visitor's address
 * from X-Forwarded-For (no trusted proxy is set), and new guests and sign-ins are limited per
 * address with a count that is kept while requests keep coming. Five projects on one server
 * would otherwise share one allowance for the whole run and run out part-way through.
 */
export function visitorAddress(testInfo: Pick<TestInfo, 'project' | 'testId'>): string {
  // FNV-1a, 32 bits: stable, and spread well enough that two tests rarely share an address.
  let hash = 0x811c9dc5;
  for (const char of `${testInfo.project.name}\n${testInfo.testId}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `10.${(hash >>> 24) & 255}.${(hash >>> 16) & 255}.${1 + ((hash & 0xffff) % 254)}`;
}

export const test = base.extend<{ problems: string[]; allow: { console: RegExp[] } }>({
  /**
   * Every test is a visitor of its own (see visitorAddress): the header goes with the page,
   * its `request`, and any context the test makes with `browser.newContext()` or
   * `playwright.request.newContext()` without headers of its own. A test that sets the header
   * itself (`page.setExtraHTTPHeaders`, or `test.use({ extraHTTPHeaders })`) keeps its own.
   */
  extraHTTPHeaders: async ({ extraHTTPHeaders }, use, testInfo) => {
    await use({ 'x-forwarded-for': visitorAddress(testInfo), ...extraHTTPHeaders });
  },
  /**
   * Console lines a single file expects on purpose, on top of the engine's own noise: set
   * with `test.use({ allow: { console: […] } })` and say why there.
   */
  allow: [{ console: [] }, { option: true }],
  problems: [
    async ({ page, browserName, baseURL, allow }, use, testInfo) => {
      waitWhenLoaded(page);
      const problems: string[] = [];
      const ignored = [...CONSOLE_NOISE[browserName], ...DEV_NOISE, ...allow.console];
      const cancelled = browserName === 'webkit' && baseURL ? cancelledInWebKit(baseURL) : null;
      // Photographs taken of this page, and the refusals WebKit logged (see STYLE_REFUSED).
      countPhotographs(page);
      let refusals = 0;
      page.on('pageerror', (error) => {
        if (cancelled?.test(error.message)) return;
        problems.push(`page error: ${error.message}`);
      });
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const text = message.text();
        if (browserName === 'webkit' && text === STYLE_REFUSED) refusals++;
        else if (!ignored.some((re) => re.test(text))) problems.push(`console: ${text}`);
      });
      page.on('response', (response) => {
        // Expected refusals (401 for a guest, 404 for someone else's things) are tested
        // directly; a server error anywhere is a bug.
        if (response.status() >= 500) problems.push(`${response.status()} ${response.url()}`);
      });
      await use(problems);
      // A test that has already failed is photographed once more, by Playwright itself.
      const taken =
        (photographs.get(page) ?? 0) + (testInfo.status !== testInfo.expectedStatus ? 1 : 0);
      if (refusals > taken)
        problems.push(`console: ${STYLE_REFUSED} (${refusals} times, for ${taken} photographs)`);
      expect(problems, 'errors while the test ran').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * For tests that hold back or stand in for the app's own requests with `page.route`: in
 * WebKit the route never sees a request from a page that the service worker looks after, so
 * there it would do nothing and the test would check something else. Use it with
 * `test.use(WITHOUT_WORKER)`. The worker only keeps the offline page and the help numbers
 * (public/sw.js), which such tests do not look at.
 */
export const WITHOUT_WORKER = { serviceWorkers: 'block' } as const;

/**
 * This page's own data refresh (its server component request, as after a save), once all of it
 * has arrived. Start waiting before the press that refreshes, and leave or reload the page only
 * after: one cut off half-way is logged as an error in Firefox, and in WebKit ("Load failed")
 * it even reaches the page's error boundary. Its headers come first, so waiting for those is
 * not enough.
 */
export function refreshOf(page: Page): Promise<void> {
  const path = new URL(page.url()).pathname;
  return page
    .waitForResponse(
      (r) =>
        r.request().method() === 'GET' &&
        new URL(r.url()).pathname === path &&
        r.url().includes('_rsc=') &&
        !r.request().headers()['next-router-prefetch'],
    )
    .then(async (r) => {
      await r.finished();
    });
}

/** A full-page screenshot saved with the test's results, for looking over by eye. */
export async function snap(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

/**
 * Getting started is ready for answers once it has begun keeping them (in this tab only, so a
 * refresh does not lose them). Before that, a press on "Continue" would go nowhere.
 */
export async function gettingStartedReady(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/start/);
  await expect
    .poll(() => page.evaluate(() => window.sessionStorage.getItem('wp-start-draft')))
    .not.toBeNull();
}

/**
 * The first visit as a guest: welcome → getting started (all five steps, nothing required) →
 * Today. Returns once the guest session exists.
 */
export async function startAsGuest(page: Page, name = 'Amani'): Promise<void> {
  await page.goto('/welcome');
  await page.getByRole('link', { name: 'Get started' }).first().click();
  await gettingStartedReady(page);
  // The first question is what is going on; like every answer here, it can be left open.
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('What should we call you?').fill(name);
  for (let step = 0; step < 3; step++) {
    await page.getByRole('button', { name: 'Continue' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Your choices' })).toBeVisible();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
}

/** The file the test server's mail catcher writes to (set in playwright.config.ts). */
const mailFile = () =>
  process.env.E2E_MAIL_FILE ??
  join(tmpdir(), `waypoint-e2e-mail-${Number(process.env.E2E_PORT ?? 3100)}.jsonl`);

/** Quoted-printable (how email bodies wrap long lines) back to plain text. */
const unwrap = (raw: string) =>
  raw
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));

/**
 * Waits for an email to `to` whose link contains `pathPart`, and returns that link — as a
 * person would find it in their inbox. Only emails caught by the test server's mail catcher.
 */
export async function linkFromEmail(to: string, pathPart: string): Promise<string> {
  let found: string | undefined;
  await expect
    .poll(
      () => {
        const file = mailFile();
        if (!existsSync(file)) return undefined;
        const mails = readFileSync(file, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line) as { to: string[]; raw: string })
          .filter((m) => m.to.includes(to.toLowerCase()));
        for (const mail of mails.reverse()) {
          const links = unwrap(mail.raw).match(/https?:\/\/[^\s"<>]+/g) ?? [];
          found = links.find((l) => l.includes(pathPart));
          if (found) return found;
        }
        return undefined;
      },
      { message: `an email to ${to} with a ${pathPart} link`, timeout: 30_000 },
    )
    .toBeTruthy();
  return (found as string).replace(/&amp;/g, '&');
}
