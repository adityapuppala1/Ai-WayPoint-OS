/**
 * Language, theme and time zone are remembered in cookies the server sets, not ones the page
 * writes. Safari, and every browser on an iPhone, forgets a cookie written by a page's script
 * after seven days; one sent by the server is kept for the year it asks for. No test browser
 * applies that seven-day rule (Playwright's WebKit is not Safari), so these tests check the
 * cause instead: the answer that carries `Set-Cookie`, and a cookie that lasts the year.
 */
import type { BrowserContext, Page, Response } from '@playwright/test';
import { expect, startAsGuest, test } from './fixtures';

const DAY = 86_400;

/** The answer to the page's next request to save these preferences. */
const saved = (page: Page, choice: string) =>
  page.waitForResponse(
    (res) =>
      res.url().endsWith('/api/preferences') &&
      res.request().method() === 'POST' &&
      choice in ((res.request().postDataJSON() ?? {}) as Record<string, unknown>),
    { timeout: 30_000 },
  );

/** The `Set-Cookie` line for one cookie in an answer, lower-cased. */
async function setCookieLine(res: Response, name: string): Promise<string> {
  const lines = (await res.headersArray())
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    // Some engines hand over every Set-Cookie line as one header, a line each.
    .flatMap((h) => h.value.split('\n'));
  return (lines.find((line) => line.startsWith(`${name}=`)) ?? '').toLowerCase();
}

/** How many days the browser will keep a cookie; 0 when it has none by that name. */
async function daysKept(context: BrowserContext, name: string): Promise<number> {
  const cookie = (await context.cookies()).find((c) => c.name === name);
  return cookie ? (cookie.expires - Date.now() / 1000) / DAY : 0;
}

test('a language chosen as a visitor is a cookie the server set, and survives a reload', async ({
  page,
  context,
}) => {
  await page.goto('/welcome');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  const answer = saved(page, 'locale');
  await page.getByRole('button', { name: /Language/ }).click();
  await page.getByRole('option', { name: 'Français' }).click();
  const res = await answer;
  expect(res.status()).toBe(200);
  const line = await setCookieLine(res, 'NEXT_LOCALE');
  expect(line).toContain('next_locale=fr');
  expect(line).toContain('max-age=31536000');
  expect(line).toContain('path=/');
  expect(line).toContain('samesite=lax');

  // The page is redrawn in French straight away, and again after a reload.
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('link', { name: 'Obtenir de l’aide' }).first()).toBeVisible();
  expect(await daysKept(context, 'NEXT_LOCALE')).toBeGreaterThan(300);
});

test('a theme chosen in Settings is a cookie the server set, and survives a reload', async ({
  page,
  context,
}) => {
  await startAsGuest(page);
  await page.goto('/settings');
  const theme = page.getByRole('radiogroup', { name: 'Appearance' });

  const answer = saved(page, 'theme');
  await theme.getByRole('radio', { name: 'Dark' }).click();
  // At once, before the server has answered.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const res = await answer;
  expect(res.status()).toBe(200);
  const line = await setCookieLine(res, 'wp-theme');
  expect(line).toContain('wp-theme=dark');
  expect(line).toContain('max-age=31536000');

  await expect.poll(() => daysKept(context, 'wp-theme')).toBeGreaterThan(300);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(theme.getByRole('radio', { name: 'Dark' })).toBeChecked();

  // "Device" is a choice too: written down, so it holds against the saved profile.
  const back = saved(page, 'theme');
  await theme.getByRole('radio', { name: 'Device' }).click();
  expect(await setCookieLine(await back, 'wp-theme')).toContain('wp-theme=system');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  await expect(theme.getByRole('radio', { name: 'Device' })).toBeChecked();
  await page.reload();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
});

test('the device time zone is a cookie the server set on the first page', async ({
  page,
  context,
}) => {
  const answer = saved(page, 'timezone');
  await page.goto('/welcome');
  const res = await answer;
  // The answer is read to its end: in Chrome a page with an answer nobody read never settles.
  await page.waitForLoadState('networkidle', { timeout: 10_000 });
  // The tests run in Nairobi (playwright.config.ts).
  const line = await setCookieLine(res, 'wp-tz');
  expect(decodeURIComponent(line)).toContain('wp-tz=africa/nairobi');
  expect(line).toContain('max-age=31536000');
  expect(await daysKept(context, 'wp-tz')).toBeGreaterThan(300);

  // Once it is right, the page does not ask again.
  let again = 0;
  page.on('request', (req) => {
    if (req.url().endsWith('/api/preferences')) again++;
  });
  await page.reload();
  await page.goto('/support');
  expect(again).toBe(0);
});

test('when the cookies are lost, a signed-in person keeps their language and theme', async ({
  page,
  context,
}) => {
  await startAsGuest(page);
  await page.goto('/settings');
  const dark = saved(page, 'theme');
  await page
    .getByRole('radiogroup', { name: 'Appearance' })
    .getByRole('radio', { name: 'Dark' })
    .click();
  await dark;
  const french = saved(page, 'locale');
  await page.getByRole('button', { name: /Language/ }).click();
  await page.getByRole('option', { name: 'Français' }).click();
  await french;
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  // Both choices are in the profile before the cookies go.
  await expect
    .poll(async () => {
      const me = (await (await page.request.get('/api/me')).json()) as {
        profile: { locale: string; theme: string };
      };
      return `${me.profile.locale} ${me.profile.theme}`;
    })
    .toBe('fr dark');

  // The browser forgets the preference cookies (another device would have none either).
  for (const name of ['NEXT_LOCALE', 'wp-theme', 'wp-lite', 'wp-tz'])
    await context.clearCookies({ name });
  const restored = saved(page, 'locale');
  await page.goto('/settings');
  // Drawn from the saved profile by the server…
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // …and the cookies are put back, so the next page needs no lookup.
  const res = await restored;
  expect(await setCookieLine(res, 'NEXT_LOCALE')).toContain('next_locale=fr');
  expect(await setCookieLine(res, 'wp-theme')).toContain('wp-theme=dark');
  expect(await daysKept(context, 'NEXT_LOCALE')).toBeGreaterThan(300);
});
