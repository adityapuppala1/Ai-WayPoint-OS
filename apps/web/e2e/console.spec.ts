/**
 * The platform console, as the platform's admin uses it: sections grouped by what they are for,
 * outside services with their keys and checks, and (as they are added) the rest.
 */
import type { Browser, Page } from '@playwright/test';
import { expect, linkFromEmail, snap, test } from './fixtures';
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

/** Makes an account in its own browser context; confirms the address when asked to. */
async function newAccount(
  browser: Browser,
  baseURL: string,
  name: string,
  confirm: boolean,
): Promise<{ email: string; page: Page; close: () => Promise<void> }> {
  const email = `${name.toLowerCase()}.${Date.now()}@example.org`;
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto('/sign-up');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('a long e2e-only password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  if (confirm) {
    await page.goto(await linkFromEmail(email, '/api/auth/verify-email'));
    await expect(page.getByRole('heading', { name: 'Email address confirmed' })).toBeVisible();
  }
  return { email, page, close: () => context.close() };
}

test('an admin finds an account, holds it back, and lets it back in', async ({
  browser,
  page,
  baseURL,
}, testInfo) => {
  test.skip(test.info().project.name !== 'desktop', 'one browser is enough for the round trip');
  const someone = await newAccount(browser, baseURL ?? '', 'Wanjiru', false);
  await someone.close();
  await asAdmin(browser, page, baseURL ?? '');

  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { level: 2, name: 'Accounts' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search' }).fill(someone.email);
  await page.getByRole('search').getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/q=/);
  const row = page.getByRole('row', { name: /Wanjiru/ });
  await expect(row.getByText('Not confirmed')).toBeVisible();
  await snap(page, testInfo, 'console-accounts');

  await row.getByRole('link', { name: /Wanjiru/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Wanjiru' })).toBeVisible();
  await expect(page.getByText(someone.email)).toBeVisible();

  await page.getByRole('button', { name: 'Hold back' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Hold this account back?' });
  await dialog.getByLabel('Reason').fill('Repeated spam in shared plans');
  await dialog.getByRole('button', { name: 'Hold back' }).click();
  await expect(page.getByText('Held back with no end date.')).toBeVisible();
  await expect(page.getByText(/Reason: Repeated spam/)).toBeVisible();
  // What was done is on the account's own history.
  await expect(page.getByText('Held the account back')).toBeVisible();

  await page.getByRole('button', { name: 'Let back in' }).click();
  await expect(page.getByText('Held back with no end date.')).toHaveCount(0);
  await expect(page.getByText('Let the account back in')).toBeVisible();
});

test('an admin invites someone to the staff, and they accept from the email', async ({
  browser,
  page,
  baseURL,
}, testInfo) => {
  test.skip(test.info().project.name !== 'desktop', 'one browser is enough for the round trip');
  const invitee = await newAccount(browser, baseURL ?? '', 'Tomas', true);
  try {
    await asAdmin(browser, page, baseURL ?? '');
    await page.goto('/admin/staff');
    await expect(page.getByRole('heading', { level: 2, name: 'Staff' })).toBeVisible();
    await page.getByLabel('Their email address').fill(invitee.email);
    await page.getByRole('button', { name: 'Send invitation' }).click();
    await expect(page.getByText(`Invitation sent to ${invitee.email}.`)).toBeVisible();
    const invitations = page.getByRole('region', { name: 'Invitations' });
    await expect(invitations.getByText(invitee.email)).toBeVisible();
    await expect(invitations.getByText('Waiting')).toBeVisible();
    await snap(page, testInfo, 'console-staff');

    // The invitee opens the email's link, is asked to sign in, and comes back to answer.
    await invitee.page.goto(await linkFromEmail(invitee.email, '/staff-invite/'));
    await expect(invitee.page).toHaveURL(/\/sign-in\?next=%2Fstaff-invite%2F/);
    await invitee.page.getByLabel('Email').fill(invitee.email);
    await invitee.page.getByLabel('Password').fill('a long e2e-only password');
    await invitee.page.getByRole('main').getByRole('button', { name: 'Sign in' }).click();
    await expect(
      invitee.page.getByRole('heading', { level: 1, name: 'Join Waypoint’s staff' }),
    ).toBeVisible();
    await invitee.page.getByRole('button', { name: 'Accept' }).click();
    await expect(invitee.page).toHaveURL(/\/admin/);
    await expect(invitee.page.getByRole('navigation', { name: 'Admin sections' })).toBeVisible();

    await page.reload();
    await expect(invitations.getByText('Accepted')).toBeVisible();
    await expect(
      page.getByRole('region', { name: /The team/ }).getByText(invitee.email),
    ).toBeVisible();
  } finally {
    await invitee.close();
  }
});

test('the system page shows how the platform is doing, and what needs a look', async ({
  browser,
  page,
  baseURL,
}, testInfo) => {
  await asAdmin(browser, page, baseURL ?? '');
  // Some traffic of its own, so the hour has requests to show.
  for (let i = 0; i < 3; i++) await page.request.get('/api/platform');
  await page.goto('/admin/system');
  await expect(page.getByRole('heading', { level: 2, name: 'System health' })).toBeVisible();
  const glance = page.getByRole('list', { name: 'The last 24 hours at a glance' });
  for (const tile of ['Requests', 'Server errors', 'Database size', 'Jobs waiting', 'Running for'])
    await expect(glance.getByText(tile, { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Requests per hour' })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 3, name: 'Slowest responses per hour' }),
  ).toBeVisible();

  // Routes sort by any number column; the table names each route by method and path.
  const routes = page.getByRole('region', { name: 'Routes' });
  await expect(routes.getByRole('rowheader', { name: 'GET /api/platform' })).toBeVisible();
  await routes.getByRole('button', { name: 'Average' }).click();
  await expect(routes.getByRole('columnheader', { name: 'Average' })).toHaveAttribute(
    'aria-sort',
    'descending',
  );

  const db = page.getByRole('region', { name: 'Database' });
  await expect(db.getByText('Built-in database')).toBeVisible();
  await expect(db.getByText('Up to date')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Background work' })).toBeVisible();
  await snap(page, testInfo, 'console-system');
  // Nothing on the page overflows sideways, even on a phone.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()?.width ?? 0,
  );
});
