/**
 * The judge (TypeSafe's Jev) is optional. With no key, as on the test server, Waypoint must
 * behave exactly as it did before the judge existed: the privacy notice names no outside AI
 * service, and staff can still open the console that shows what AI costs.
 */
import { expect, test } from './fixtures';
import { STAFF } from './staff';

test('with no judge set up, the privacy notice names no outside AI service', async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), 'a server we did not start may use AI services');
  await page.goto('/privacy');
  await expect(
    page.getByText('This Waypoint has no outside AI provider set up, so nothing is sent to one.'),
  ).toBeVisible();
  await expect(page.getByText('TypeSafe')).toHaveCount(0);
});

test('staff can open the console that shows what AI costs', async ({ page }) => {
  test.skip(
    Boolean(process.env.E2E_BASE_URL),
    'needs the staff account that only the test server creates',
  );
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(STAFF.email);
  await page.getByLabel('Password').fill(STAFF.password);
  await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/($|start)/);

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'AI', exact: true })).toBeVisible();
  // The judge is not a provider that can answer, so nothing here claims one is set up.
  await expect(
    page.getByText('No AI provider is set up — Waypoint is answering in guided mode.'),
  ).toBeVisible();
  // A usage name without a label would show as its code.
  await expect(page.getByText(/judge-(shield|plan|reply)/)).toHaveCount(0);
});
