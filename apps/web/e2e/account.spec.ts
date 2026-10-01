/**
 * Accounts beyond the first visit: creating one straight away (no guest session), confirming
 * the address, choosing a new password from the emailed link when it's forgotten, and what a
 * failed sign-in says in every language.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, linkFromEmail, test } from './fixtures';

const LOCALES = ['en', 'hi', 'es', 'fr', 'pt', 'ar', 'sw'] as const;

/** The sign-in texts as the message files have them, so the test and the page can't drift. */
function authMessages(locale: string) {
  const file = join(import.meta.dirname, '../../../packages/i18n/messages', `${locale}.json`);
  const all = JSON.parse(readFileSync(file, 'utf8')) as {
    auth: Record<'email' | 'password' | 'submitSignIn' | 'failed' | 'failedHelp', string>;
  };
  return all.auth;
}

test('someone forgets their password and chooses a new one from the email @desktop', async ({
  page,
}) => {
  const email = `rosa.${Date.now()}@example.org`;
  await page.goto('/sign-up');
  await page.getByLabel('Name').fill('Rosa');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('the first long password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  // No guest session here, so nothing is said about bringing one along.
  await expect(page.getByText(/as a guest/)).toHaveCount(0);

  await page.goto(await linkFromEmail(email, '/api/auth/verify-email'));
  await expect(page.getByRole('heading', { name: 'Email address confirmed' })).toBeVisible();

  // Forgotten: ask for a link. The answer is the same for any address.
  await page.goto('/sign-in');
  await page.getByRole('link', { name: 'Forgot your password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send me a link' }).click();
  await expect(page.getByText(/a link is on its way/)).toBeVisible();

  await page.goto(await linkFromEmail(email, '/reset-password'));
  await expect(page).toHaveURL(/\/reset-password\?token=/);
  await page.getByLabel('New password').fill('a second, even longer password');
  await page.getByRole('button', { name: 'Save my new password' }).click();
  await expect(page.getByText(/Your password has been changed/)).toBeVisible();

  // The old password no longer works; the new one does.
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('the first long password');
  await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'We couldn’t sign you in with that email and password.',
  );
  await page.getByLabel('Password').fill('a second, even longer password');
  await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/($|start)/);
});

test('a used or broken reset link says so and offers a new one', async ({ page }) => {
  await page.goto('/reset-password?token=not-a-real-token-at-all');
  await page.getByLabel('New password').fill('a perfectly long password');
  await page.getByRole('button', { name: 'Save my new password' }).click();
  await expect(page.getByText(/expired or has already been used/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Get a new link' })).toBeVisible();
});

test('a failed sign-in says the same for every address, in every language @desktop', async ({
  page,
  context,
  baseURL,
}) => {
  for (const [i, locale] of LOCALES.entries()) {
    const m = authMessages(locale);
    // Each language comes from a different visitor (the test server reads X-Forwarded-For), so
    // seven tries in a row leave the other tests their allowance of ten sign-ins a minute.
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': `198.51.100.${60 + i}` });
    await context.addCookies([{ name: 'NEXT_LOCALE', value: locale, url: baseURL ?? '' }]);
    await page.goto('/sign-in');
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    // An address nobody has: the answer must read exactly as for a wrong password or an
    // address that isn't confirmed yet (see journey.spec.ts), including the help underneath.
    const email = `nobody.${locale}.${Date.now()}@example.org`;
    await page.getByLabel(m.email, { exact: true }).fill(email);
    await page.getByLabel(m.password, { exact: true }).fill('not a password anyone has');
    await page.getByRole('main').getByRole('button', { name: m.submitSignIn }).click();
    const answer = page.getByRole('main').getByRole('alert');
    await expect(answer, locale).toContainText(m.failed);
    await expect(answer, locale).toContainText(m.failedHelp.replace('{email}', email));
  }
});
