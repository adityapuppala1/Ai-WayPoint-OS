/**
 * The platform console, as the platform's admin uses it: sections grouped by what they are for,
 * outside services with their keys and checks, and (as they are added) the rest.
 */
import type { Browser, Page } from '@playwright/test';
import { expect, snap, test } from './fixtures';
import { STAFF } from './staff';

let staffCookies: Awaited<ReturnType<import('@playwright/test').BrowserContext['cookies']>> | null =
  null;

/** Signs the page in as the platform's admin (once per worker; the session is reused). */
async function asAdmin(browser: Browser, page: Page, baseURL: string): Promise<void> {
  if (!staffCookies) {
    const own = await browser.newContext({ baseURL });
    const signIn = await own.newPage();
    await signIn.goto('/sign-in');
    await signIn.getByLabel('Email').fill(STAFF.email);
    await signIn.getByLabel('Password').fill(STAFF.password);
    await signIn.getByRole('main').getByRole('button', { name: 'Sign in' }).click();
    await expect(signIn).toHaveURL(/\/($|start)/);
    staffCookies = (await own.cookies()).filter(
      (c) => c.name !== 'NEXT_LOCALE' && c.name !== 'wp-theme',
    );
    await own.close();
  }
  await page.context().addCookies(staffCookies);
}

test('the console groups its sections, and lists outside services with their state', async ({
  browser,
  page,
  baseURL,
}, testInfo) => {
  await asAdmin(browser, page, baseURL ?? '');
  await page.goto('/admin/integrations');
  const nav = page.getByRole('navigation', { name: 'Admin sections' });
  for (const group of ['Home', 'People', 'Safety', 'Content', 'Insights', 'Platform'])
    await expect(nav.getByText(group, { exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Integrations' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await expect(page.getByRole('heading', { level: 2, name: 'Integrations' })).toBeVisible();
  for (const group of ['AI models', 'Second opinion', 'Texts: SMS, WhatsApp and USSD', 'Email'])
    await expect(page.getByRole('heading', { level: 3, name: group, exact: true })).toBeVisible();
  // A service no test sets up.
  const ollama = page.getByRole('article', { name: 'Ollama (your own server)' });
  await expect(ollama.getByText('Not set up')).toBeVisible();
  await snap(page, testInfo, 'console-integrations');
});

test('an admin saves a key, sees only its end, and removes it again', async ({
  browser,
  page,
  baseURL,
}) => {
  test.skip(test.info().project.name !== 'desktop', 'one browser is enough for the round trip');
  await asAdmin(browser, page, baseURL ?? '');
  await page.goto('/admin/integrations');
  const resend = page.getByRole('article', { name: 'Resend' });
  await resend.getByRole('button', { name: 'Settings' }).click();
  await resend.getByLabel('API key').fill('re_e2e_only_key_7q2w');
  await resend.getByRole('button', { name: 'Save', exact: true }).click();
  try {
    await expect(page.getByText('Saved. In use now')).toBeVisible();
    await expect(resend.getByText('Not checked yet')).toBeVisible();
    const settings = resend.getByRole('button', { name: 'Settings' });
    if ((await settings.getAttribute('aria-expanded')) !== 'true') await settings.click();
    await expect(resend.getByText('Saved here: ••••7q2w')).toBeVisible();
    // The key itself never comes back to the browser.
    expect(await page.content()).not.toContain('re_e2e_only_key');

    await resend.getByRole('button', { name: 'Remove' }).click();
    await expect(resend.getByText('Will be removed when you save')).toBeVisible();
    await resend.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(resend.getByText('Not set up')).toBeVisible();
  } finally {
    // Whatever happened above, the next test finds Resend as it was.
    await page.request.put('/api/admin/integrations/resend', {
      data: { values: { RESEND_API_KEY: null } },
      headers: { origin: baseURL ?? '' },
    });
  }
});

test('someone signed out never reaches the console', async ({ page, request }) => {
  // The API refuses outright; the page sends them to sign in.
  for (const path of ['/api/admin/integrations', '/api/admin/audit'])
    expect((await request.get(path)).status(), path).toBe(401);
  await page.goto('/admin/integrations');
  await expect(page).toHaveURL(/\/welcome\?next=/);
});

test('an admin closes Waypoint for maintenance, and help stays open', async ({
  browser,
  page,
  baseURL,
}, testInfo) => {
  test.skip(test.info().project.name !== 'desktop', 'one browser is enough for the round trip');
  await asAdmin(browser, page, baseURL ?? '');
  await page.goto('/admin/maintenance');
  const card = page.getByRole('region', { name: 'Maintenance mode' });
  await expect(card.getByText('Open', { exact: true })).toBeVisible();
  await card.getByRole('switch', { name: 'Closed for maintenance' }).click({ force: true });
  await card
    .getByLabel('What people see')
    .fill('We are upgrading the database. Back by 22:30 UTC.');
  await card.getByRole('button', { name: 'Save' }).click();
  // Closing is asked about first.
  const dialog = page.getByRole('alertdialog', { name: 'Close Waypoint for maintenance?' });
  await dialog.getByRole('button', { name: 'Close for maintenance' }).click();
  try {
    await expect(card.getByText('Closed now')).toBeVisible();
    await snap(page, testInfo, 'console-maintenance');

    const visitor = await browser.newContext({ baseURL });
    const guest = await visitor.newPage();
    // Signed out, so Today sends them to the welcome page: closed too.
    await guest.goto('/');
    await expect(
      guest.getByRole('heading', { level: 1, name: 'Waypoint is closed for maintenance' }),
    ).toBeVisible();
    await expect(
      guest.getByText('We are upgrading the database. Back by 22:30 UTC.'),
    ).toBeVisible();
    await guest.getByRole('main').getByRole('link', { name: 'Get help now' }).click();
    await expect(guest).toHaveURL(/\/support/);
    await expect(
      guest.getByRole('heading', { level: 1, name: 'Waypoint is closed for maintenance' }),
    ).toHaveCount(0);
    expect((await guest.request.get('/api/today')).status()).toBe(503);
    await visitor.close();
  } finally {
    await page.request.put('/api/admin/maintenance', {
      data: { maintenance: { on: false, message: '', until: null, startsAt: null } },
      headers: { origin: baseURL ?? '' },
    });
  }
  await page.reload();
  await expect(card.getByText('Open', { exact: true })).toBeVisible();
});
