/**
 * Moving between the app's pages: the page that leaves fades out and the next one rises in,
 * while the rail, the bottom bar and the phone's header stay exactly where they are. Lite mode
 * takes the movement away and a request for less motion makes it instant. A browser without
 * the View Transitions API simply shows the next page.
 */
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, startAsGuest, test, WITHOUT_WORKER } from './fixtures';

/*
 * One guest for the whole file. New guests from one address are limited (40 a minute, with
 * the count kept while they keep coming), and the whole suite shares that allowance.
 */
const GUEST = join(tmpdir(), `waypoint-e2e-transitions-${process.env.E2E_PORT ?? 3100}.json`);

let guestReady = false;

// Made on first use in each worker, then every test here opens as that guest.
test.use({
  storageState: async ({ browser, baseURL }, use) => {
    if (!guestReady) {
      const context = await browser.newContext({ baseURL, locale: 'en-GB' });
      await startAsGuest(await context.newPage());
      await context.storageState({ path: GUEST });
      await context.close();
      guestReady = true;
    }
    await use(GUEST);
  },
});

async function openToday(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Amani');
}

/** Notes, for every page transition, what the browser animates and for how long. */
async function watchTransitions(page: Page) {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __moves: string[] }).__moves = seen;
    const start = document.startViewTransition?.bind(document);
    if (!start) return;
    document.startViewTransition = ((update: ViewTransitionUpdateCallback) => {
      const transition = start(update);
      transition.ready.then(
        () => {
          for (const a of document.getAnimations()) {
            const effect = a.effect as KeyframeEffect | null;
            const part = effect?.pseudoElement ?? '';
            // What the stylesheet animates (React keeps zero-length animations of its own).
            if (!part.startsWith('::view-transition') || !('animationName' in a)) continue;
            seen.push(
              `${part} ${(a as CSSAnimation).animationName} ${Number(effect?.getComputedTiming().endTime)}`,
            );
          }
        },
        (e) => seen.push(`skipped ${String(e)}`),
      );
      return transition;
    }) as typeof document.startViewTransition;
  });
}

const moves = (page: Page) =>
  page.evaluate(() => (window as unknown as { __moves: string[] }).__moves);

const supported = (page: Page) => page.evaluate(() => 'startViewTransition' in document);

/** Goes to another module the way a person would: the rail on a laptop, a tab on a phone. */
async function goElsewhere(page: Page, isMobile: boolean, round = 0) {
  const nav = page.getByRole('navigation', { name: 'Main' });
  const [name, title] = isMobile
    ? round % 2 === 0
      ? ['Shield', 'Scam Shield']
      : ['Today', /Amani/]
    : round % 2 === 0
      ? ['Money', 'Money']
      : ['Today', /Amani/];
  await nav.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}

test('the page moves and the frame stays still', async ({ page, isMobile }) => {
  await watchTransitions(page);
  await openToday(page);
  // The frame's parts carry their names, so the browser draws them apart from the page.
  const frame = isMobile
    ? [
        [page.getByRole('navigation', { name: 'Main' }), 'wp-bottom-bar'],
        [page.getByRole('banner'), 'wp-header'],
      ]
    : [[page.getByRole('navigation', { name: 'Main' }), 'wp-rail']];
  for (const [part, name] of frame as Array<[ReturnType<Page['locator']>, string]>)
    expect(await part.evaluate((el) => getComputedStyle(el).viewTransitionName)).toBe(name);

  await goElsewhere(page, isMobile);
  if (!(await supported(page))) return;
  const seen = await moves(page);
  expect(seen.some((a) => a.includes('wp-page-out'))).toBe(true);
  expect(seen.some((a) => a.includes('wp-page-in'))).toBe(true);
  // Nothing moves the frame.
  expect(seen.filter((a) => /\((wp-rail|wp-bottom-bar|wp-header)\)/.test(a))).toEqual([]);
  // 240ms in all.
  for (const a of seen.filter((x) => x.includes('wp-page-')))
    expect(Number(a.split(' ').at(-1))).toBeLessThanOrEqual(240);

  // Inside a module, between its own pages, too.
  await page.goto('/path');
  await expect(page.getByRole('heading', { level: 1, name: 'Path' })).toBeVisible();
  const before = (await moves(page)).length;
  await page.getByRole('main').locator('a[href="/path/skills"]').first().click();
  await expect(page).toHaveURL(/\/path\/skills$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect((await moves(page)).slice(before).some((a) => a.includes('wp-page-in'))).toBe(true);
});

// The page is held back: see WITHOUT_WORKER.
test.describe(() => {
  test.use(WITHOUT_WORKER);

  test('a page that keeps someone waiting still arrives with the transition', async ({
    page,
    isMobile,
  }) => {
    await watchTransitions(page);
    await openToday(page);
    const path = isMobile ? '/shield' : '/money';
    // Hold back the answer, as a slow connection would, so the placeholder stands in first.
    await page.route(
      (url) => url.pathname === path,
      async (route) => {
        await new Promise((r) => setTimeout(r, 1500));
        await route.continue().catch(() => undefined);
      },
    );
    const nav = page.getByRole('navigation', { name: 'Main' });
    await nav.getByRole('link', { name: isMobile ? 'Shield' : 'Money', exact: true }).click();
    await expect(
      page.getByRole('main').getByRole('status').filter({ hasText: 'Loading' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 1, name: isMobile ? 'Scam Shield' : 'Money' }),
    ).toBeVisible();
    if (!(await supported(page))) return;
    // The page rises in, rather than appearing from behind the placeholder afterwards.
    expect((await moves(page)).some((a) => a.includes('wp-page-in'))).toBe(true);
  });
});

test('lite mode moves nothing, and less motion is instant', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await watchTransitions(page);
  await openToday(page);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await goElsewhere(page, isMobile);
  if (await supported(page)) {
    const seen = await moves(page);
    expect(seen.length).toBeGreaterThan(0);
    for (const a of seen) expect(Number(a.split(' ').at(-1))).toBeLessThanOrEqual(1);
  }

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await context.addCookies([{ name: 'wp-lite', value: '1', url: baseURL ?? '' }]);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-lite', 'true');
  await goElsewhere(page, isMobile);
  await goElsewhere(page, isMobile, 1);
  expect(await moves(page)).toEqual([]);
});
