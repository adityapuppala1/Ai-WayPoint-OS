/**
 * One person's first visit, end to end: getting started as a guest, Today, talking something
 * through (including a message that needs the crisis card), privacy choices, downloading their
 * data, creating an account that keeps everything (confirming the address from the real email),
 * signing out and back in.
 */
import { readFileSync } from 'node:fs';
import { expect, linkFromEmail, snap, startAsGuest, test } from './fixtures';

test('a guest gets started, asks for help, keeps their choices and creates an account @desktop', async ({
  page,
}, testInfo) => {
  await startAsGuest(page, 'Amani');
  await expect(page.getByText('Your next step')).toBeVisible();
  // Getting started suggested Kenya from the time zone, so Today knows the emergency number.
  await expect(page.getByRole('link', { name: '999' })).toBeVisible();
  await snap(page, testInfo, 'today-guest');

  // Ask, with no AI provider: Waypoint's guided answers.
  await page.goto('/ask');
  await page.getByLabel('Your message').fill('I lost my job last week. Where do I start?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(/^Guided mode/)).toBeVisible();
  await expect(page).toHaveURL(/\/ask\?c=[0-9a-f-]{36}/);
  await snap(page, testInfo, 'ask-guided');

  // A message about ending one's life: the support card, before anything else.
  await page.goto('/ask');
  await page.getByLabel('Your message').fill('I want to end my life tonight');
  await page.getByRole('button', { name: 'Send' }).click();
  const card = page.getByRole('region', { name: 'Your safety matters most right now.' });
  await expect(card).toBeVisible();
  // The guest never chose a country: the numbers follow the browser's time zone (Nairobi).
  await expect(card.locator('a[href^="tel:"]').first()).toBeVisible();
  // Said once, on the card — not repeated underneath it.
  await expect(page.getByText(/have already hurt yourself/)).toHaveCount(1);
  await snap(page, testInfo, 'ask-crisis');

  // A privacy choice is saved and still set after a reload.
  await page.goto('/settings/privacy');
  const memory = page.getByRole('switch', { name: 'Remember things I ask you to' });
  await expect(memory).not.toBeChecked();
  // The switch's input sits under its label; press the label, as a person would.
  await page.getByText('Remember things I ask you to', { exact: true }).click();
  await expect(page.getByText('Choice saved')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Remember things I ask you to' })).toBeChecked();

  // Everything Waypoint holds, as a file.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download my data' }).click(),
  ]);
  const exported = JSON.parse(readFileSync((await download.path()) as string, 'utf8'));
  expect(JSON.stringify(exported)).toContain('Amani');
  expect(JSON.stringify(exported)).toContain('I lost my job last week');

  // Creating an account keeps what the guest did.
  const email = `amani.${Date.now()}@example.org`;
  const password = 'a long walk to the market';
  await page.goto('/sign-up');
  await expect(page.getByText(/By creating an account, you agree to the/)).toBeVisible();
  await page.getByLabel('Name').fill('Amani');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  // The same answer for every address: check your email.
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await expect(page.getByText(/moves into your account the first time you sign in/)).toBeVisible();
  await snap(page, testInfo, 'check-email');

  // Signing in before confirming answers exactly like a wrong password (anything else would
  // show whether the address already had an account) and says what to do if the account is
  // new: with the right password, a fresh link is emailed.
  const signIn = async (withPassword: string) => {
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(withPassword);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/sign-in/email')),
      page.getByRole('main').getByRole('button', { name: 'Sign in' }).click(),
    ]);
  };
  await page.goto('/sign-in');
  await signIn(password);
  const answer = page.getByRole('main').getByRole('alert');
  await expect(answer).toContainText('We couldn’t sign you in with that email and password.');
  await expect(answer).toContainText('Please confirm your email address first.');
  await expect(answer).toContainText(`a new link is on its way to ${email}`);
  const beforeConfirming = await answer.innerText();
  await signIn('not the password at all');
  await expect(answer).toBeVisible();
  expect(await answer.innerText()).toBe(beforeConfirming);

  // The link in the email confirms the address, and says what happens next.
  await page.goto(await linkFromEmail(email, '/api/auth/verify-email'));
  await expect(page.getByRole('heading', { name: 'Email address confirmed' })).toBeVisible();
  await expect(page.getByText(/bring along what you did as a guest/)).toBeVisible();
  await page.getByRole('main').getByRole('link', { name: 'Sign in' }).click();
  await expect(page.getByText(/Sign in to the account you created/)).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Amani');
  // Everything done as a guest came along.
  await page.goto('/ask');
  await expect(page.getByText('I lost my job last week').first()).toBeVisible();

  // Signing out, then back in.
  await page.getByRole('button', { name: /Amani/ }).first().click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/welcome/);
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Amani');
});

test('pages that need a session send guests to get started, and come back after', async ({
  page,
}) => {
  await page.goto('/money');
  await expect(page).toHaveURL(/\/(welcome|sign-in)\?next=%2Fmoney/);
});
