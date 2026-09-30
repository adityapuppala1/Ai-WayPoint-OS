/** Scam Shield works for anyone, with no account, and explains what it found. */
import { expect, snap, test } from './fixtures';

test('a parcel-fee scam is flagged with its warning signs and what to do', async ({
  page,
}, testInfo) => {
  await page.goto('/shield');
  await page
    .getByLabel('What did you receive?')
    .fill(
      'URGENT: Your parcel is on hold. Pay the 2.99 customs fee today at http://dhl-parcel-fees.top/pay or it will be returned.',
    );
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What we found' })).toBeVisible();
  await expect(page.getByText(/This (looks like|is very likely) a scam/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Warning signs' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What to do' })).toBeVisible();
  await expect(page.getByText('dhl-parcel-fees.top').first()).toBeVisible();
  await snap(page, testInfo, 'shield-scam');
});

test('an ordinary message is not called a scam', async ({ page }) => {
  await page.goto('/shield');
  await page
    .getByLabel('What did you receive?')
    .fill('Hi Amani, are we still on for lunch at 1 tomorrow? Same place as last time.');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByText('No common scam signs found')).toBeVisible();
});

test('a scam written in Swahili is caught too', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'NEXT_LOCALE', value: 'sw', url: baseURL ?? '' }]);
  await page.goto('/shield');
  await page
    .getByLabel('Umepokea nini?')
    .fill(
      'Hongera! Umeshinda zawadi ya shilingi 50,000. Tuma ada ya usajili ya shilingi 500 kwa M-Pesa leo ili kupokea zawadi yako.',
    );
  await page.getByRole('button', { name: 'Kagua', exact: true }).click();
  await expect(
    page.getByText(/Hii inaonekana kuwa ulaghai|Hii ina uwezekano mkubwa sana kuwa ulaghai/),
  ).toBeVisible();
});
