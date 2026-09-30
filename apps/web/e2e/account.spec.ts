/**
 * Accounts beyond the first visit: creating one straight away (no guest session), confirming
 * the address, and choosing a new password from the emailed link when it's forgotten.
 */
import { expect, linkFromEmail, test } from './fixtures';

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
  await expect(page.getByText(/don’t match/)).toBeVisible();
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
