/**
 * On a slow connection a page is on screen well before its script has arrived, and people
 * start typing. What they typed in that gap must still be there, and count, once the script
 * takes over: it used to be wiped, leaving the button under it switched off.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/** Holds the page's scripts back, as a slow connection would, until the returned function is called. */
async function holdScripts(page: Page): Promise<() => void> {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/_next\/static\/.+\.js(\?|$)/, async (route) => {
    await held;
    await route.continue();
  });
  return release;
}

test('a password typed before the page’s script arrives is kept', async ({ page }) => {
  const release = await holdScripts(page);
  // The page as the server sent it: readable, and not yet listening.
  await page.goto('/reset-password?token=a-token-nobody-was-sent', {
    waitUntil: 'domcontentloaded',
  });
  const field = page.getByLabel('New password');
  const save = page.getByRole('button', { name: 'Save my new password' });
  await field.fill('a perfectly long password');
  await expect(save).toBeDisabled();

  release();
  await expect(save).toBeEnabled();
  await expect(field).toHaveValue('a perfectly long password');
  // …and it is what gets sent: the answer is about the link, not about an empty password.
  await save.click();
  await expect(page.getByText(/expired or has already been used/)).toBeVisible();
});

test('a message pasted into Shield before its script arrives is kept and checked', async ({
  page,
}) => {
  const release = await holdScripts(page);
  await page.goto('/shield', { waitUntil: 'domcontentloaded' });
  const message =
    'URGENT: Your parcel is on hold. Pay the 2.99 customs fee today at http://dhl-parcel-fees.top/pay or it will be returned.';
  const field = page.getByLabel('What did you receive?');
  await field.fill(message);

  release();
  await expect(field).toHaveValue(message);
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByText(/This (looks like|is very likely) a scam/)).toBeVisible();
});
