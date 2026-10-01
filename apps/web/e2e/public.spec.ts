/**
 * The pages anyone can reach without an account: they must load fast, work in every
 * language (Arabic right to left), and carry the safety and privacy basics.
 */
import { expect, snap, test } from './fixtures';

test('welcome explains Waypoint and links to help, scam checks and the legal pages', async ({
  page,
}, testInfo) => {
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start, no sign-up needed' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Get help now/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Privacy notice' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Terms of use' })).toBeVisible();
  await snap(page, testInfo, 'welcome');
});

test('get help now shows the emergency number and checked services for a country', async ({
  page,
}, testInfo) => {
  await page.goto('/support?country=KE');
  const call = page.locator('a[href^="tel:"]').first();
  await expect(call).toBeVisible();
  expect(await call.getAttribute('href')).toMatch(/^tel:\+?\d+$/);
  await expect(page.getByText('If you or someone else is in immediate danger')).toBeVisible();
  await snap(page, testInfo, 'support-kenya');
});

test('the privacy notice and terms are complete and linked to each other', async ({
  page,
}, testInfo) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy notice' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The short version' })).toBeVisible();
  for (const section of [
    'What we collect, and why',
    'What we never keep',
    'Your choices',
    'Who else handles your information',
    'How long we keep things',
    'Your rights',
    'Contact',
  ])
    await expect(page.getByRole('heading', { level: 2, name: section })).toBeVisible();
  // Nothing outside Waypoint is set up in the test server, and the notice says so.
  await expect(page.getByText('This Waypoint has no outside AI provider set up')).toBeVisible();
  // Feedback is collected, and staff read it — with the address only when a reply was asked for.
  const notice = page.getByRole('article');
  await expect(notice.getByText(/^Feedback you send from Settings/)).toBeVisible();
  await expect(
    notice.getByText(/scam reports, the feedback you send .*your email address only if you asked/),
  ).toBeVisible();
  // Every cookie is named, and what signing out removes from the device.
  await expect(notice.getByText(/“Not now” to the note about creating an account/)).toBeVisible();
  await expect(notice.getByText(/Signing out or deleting your account removes/)).toBeVisible();
  await snap(page, testInfo, 'privacy');

  await page.getByRole('main').getByRole('link', { name: 'Terms of use' }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Terms of use' })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Not an emergency service' }),
  ).toBeVisible();
  await snap(page, testInfo, 'terms');
});

test('Arabic reads right to left, with the same pages translated', async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: 'NEXT_LOCALE', value: 'ar', url: baseURL ?? '' }]);
  await page.goto('/privacy');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('إشعار الخصوصية');
});

test('every page is sent with strict security headers', async ({ request }) => {
  const res = await request.get('/welcome');
  expect(res.status()).toBe(200);
  const h = res.headers();
  expect(h['content-security-policy']).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['content-security-policy']).toContain("object-src 'none'");
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(h['permissions-policy']).toContain('camera=()');
  expect(h['x-powered-by']).toBeUndefined();
});

test('search engines find the public pages and nothing private', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Allow: /privacy');
  expect(robots).toContain('Disallow: /settings');
  expect(robots).toContain('Disallow: /api/');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  for (const path of ['/welcome', '/support', '/shield', '/privacy', '/terms'])
    expect(sitemap).toContain(`${path}</loc>`);
  expect(sitemap).not.toContain('/settings');
});
