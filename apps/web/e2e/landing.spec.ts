/**
 * The welcome page as a landing page: every section in English and Arabic at a phone and a
 * laptop width with nothing scrolling sideways; the 3D hero only where it is welcome (never
 * with less motion asked for or in lite mode, and loaded otherwise in Chromium); the main
 * action starting a guest; and Get help now one press away. The fixtures fail any test that
 * logs an error.
 */
import type { Page } from '@playwright/test';
import { expect, startAsGuest, test } from './fixtures';

const SECTIONS = {
  en: [
    'Whatever brought you here',
    'How it works',
    'What you get',
    'However you reach it',
    'Safety first. Your information stays yours.',
    'Your next step can be a small one.',
  ],
  ar: [
    'أيًّا كان ما أتى بك إلى هنا',
    'كيف يعمل',
    'ما الذي ستجده',
    'بأي طريقة تصل إليه',
    'السلامة أولًا. ومعلوماتك تبقى لك.',
    'يمكن أن تكون خطوتك التالية صغيرة.',
  ],
} as const;

const TITLE = {
  en: 'Know your next step when life changes.',
  ar: 'حين تتغيّر حياتك، اعرف خطوتك التالية.',
} as const;

const START = {
  en: 'Start, no sign-up needed',
  ar: 'ابدأ، دون الحاجة إلى تسجيل',
} as const;

/** Waits long enough for the 3D scene to have been fetched, where it would be. */
async function sceneSettled(page: Page) {
  await page.waitForFunction(
    () => document.querySelector('[data-scene]')?.getAttribute('data-scene') !== 'loading',
    undefined,
    { timeout: 30_000 },
  );
  // The scene is asked for once the browser is idle (at most 2.5 seconds after load).
  await page.waitForTimeout(3_000);
}

for (const width of [375, 1280]) {
  for (const locale of ['en', 'ar'] as const) {
    test(`every section of the welcome page shows at ${width}px in ${locale === 'ar' ? 'Arabic' : 'English'}, with nothing sideways`, async ({
      page,
      context,
      baseURL,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await context.addCookies([{ name: 'NEXT_LOCALE', value: locale, url: baseURL ?? '' }]);
      await page.goto('/welcome');
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { level: 1 })).toHaveText(TITLE[locale]);
      await expect(main.getByRole('link', { name: START[locale] }).first()).toBeVisible();
      const headings = main.getByRole('heading', { level: 2 });
      await expect(headings).toHaveText([...SECTIONS[locale]]);
      for (const name of SECTIONS[locale]) {
        const heading = main.getByRole('heading', { level: 2, name });
        await heading.scrollIntoViewIfNeeded();
        await expect(heading).toBeVisible();
      }
      // Every section has arrived (scrolling through shows what waits to come into view).
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(page.locator('[data-reveal="waiting"]')).toHaveCount(0);
      const sideways = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(sideways).toBe(false);
      // Get help now and the quick exit stay in the header, as on every page.
      // (Its label is the short one on a phone, so it is found by where it goes.)
      await expect(page.getByRole('banner').locator('a[href="/support"]')).toBeVisible();
      await expect(
        page.getByRole('banner').getByRole('button', { name: /Quick exit|خروج سريع/ }),
      ).toBeVisible();
    });
  }
}

test.describe('with less motion asked for', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the 3D scene is never loaded: the drawing stays', async ({ page }) => {
    await page.goto('/welcome');
    await sceneSettled(page);
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.locator('[data-scene]')).toHaveAttribute('data-scene', 'static');
    await expect(page.locator('[data-scene] svg').first()).toBeVisible();
  });
});

test('in lite mode the 3D scene is never loaded', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'wp-lite', value: '1', url: baseURL ?? '' }]);
  await page.goto('/welcome');
  await expect(page.locator('html')).toHaveAttribute('data-lite', 'true');
  await sceneSettled(page);
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('[data-decision]')).toHaveAttribute('data-decision', 'lite');
});

test('on a wide screen in Chromium the 3D scene loads after the page, without blocking it', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'WebGL in the other test browsers depends on the machine');
  await page.setViewportSize({ width: 1280, height: 800 });
  const scripts = () =>
    page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .filter((e) => (e as PerformanceResourceTiming).initiatorType === 'script')
        .map((e) => e.name),
    );
  // The scripts the page itself names: the scene must not be one of them. (Comparing with
  // what had loaded at some moment would race a fast machine that fetches the scene early.)
  const html = await (await page.request.get('/welcome')).text();
  const named = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(([, src]) => src ?? '');
  const before = { has: (url: string) => named.some((src) => url.endsWith(src)) };
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('[data-scene]')).toHaveAttribute('data-scene', 'live', {
    timeout: 30_000,
  });
  await expect(page.locator('[data-scene] canvas')).toHaveCount(1);
  await expect(page.locator('[data-scene] canvas')).toHaveAttribute('aria-hidden', 'true');
  // The scene came in a chunk of its own, fetched after the page was already usable.
  const later = (await scripts()).filter((name) => !before.has(name));
  expect(later.length).toBeGreaterThan(0);
  // The page carries on working: the main action is still there.
  await expect(page.getByRole('link', { name: START.en }).first()).toBeVisible();
});

test('the main action starts a guest, with no account', async ({ page }) => {
  await startAsGuest(page, 'Amani');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Amani');
});

test('Get help now is one press away from the top of the page', async ({ page }) => {
  await page.goto('/welcome');
  await page.getByRole('main').getByRole('link', { name: 'Get help now' }).first().click();
  await expect(page).toHaveURL(/\/support$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Get help now' })).toBeVisible();
});
