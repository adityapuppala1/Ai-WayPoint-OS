/**
 * The places the judge (TypeSafe's Jev) can be asked, on a server with no judge: guided mode in
 * Ask and Scam Shield must answer exactly as they did before it existed. (What happens with a
 * judge is tested with a stand-in, in packages/ai and packages/api: a browser test cannot play
 * the service.)
 */
import { expect, refreshOf, startAsGuest, test } from './fixtures';

test('guided mode answers from keywords, and shows its menu when none matches', async ({
  page,
}) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), 'a server we did not start may use AI services');
  await startAsGuest(page, 'Amani');

  // No keyword for work, money, scams or services: with no judge to ask, the general menu.
  await page.goto('/ask');
  await page
    .getByLabel('Your message')
    .fill('My landlord says I owe him for three months and I cannot cover it');
  // Ask refreshes its page once a reply is complete; the test leaves only after that.
  const refreshed = refreshOf(page);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(/^Guided mode/)).toBeVisible();
  await expect(page.getByText(/I’m in guided mode right now/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Shield: check a message for scams' })).toBeVisible();

  // A keyword still decides on its own.
  await refreshed;
  await page.goto('/ask');
  await page.getByLabel('Your message').fill('I need a job, where do I start?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(/Let’s make a plan/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Make a plan' })).toBeVisible();
});

test('Scam Shield rates a message by its rules alone, with no second opinion', async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), 'a server we did not start may use AI services');
  await page.goto('/shield');
  await page
    .getByLabel('What did you receive?')
    .fill('Hello, we saw your profile. We have a role for you. Reply to hear more.');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByText('No common scam signs found')).toBeVisible();
  // Nothing is set up that could be asked, so nothing claims an AI check took part.
  await expect(page.getByText(/The AI check/)).toHaveCount(0);
});
