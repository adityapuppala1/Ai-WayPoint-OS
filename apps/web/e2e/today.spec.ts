/**
 * Waypoint as one companion rather than twelve pages: Today's next step comes from every
 * module and can be set aside without a word of blame, Today and the phone's More sheet reach
 * everything, the welcome page shows what works before asking anything, and modules point on
 * to each other.
 */
import type { Page } from '@playwright/test';
import { expect, gettingStartedReady, snap, startAsGuest, test } from './fixtures';

/** Every module's address, as the navigation has them. */
const MODULES = [
  '/',
  '/path',
  '/shield',
  '/ask',
  '/signals',
  '/circles',
  '/money',
  '/mind',
  '/health',
  '/civic',
  '/surroundings',
  '/goals',
];

/** Getting started as a guest who says what is going on for them. Ends wherever it leads. */
async function startWith(page: Page, situation: string, from = '/welcome'): Promise<void> {
  await page.goto(from);
  await page.getByRole('link', { name: 'Get started' }).first().click();
  await gettingStartedReady(page);
  // The radio's input sits under its label; press the label, as a person would.
  await page.getByText(situation, { exact: true }).click();
  await expect(page.getByRole('radio', { name: situation })).toBeChecked();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('What should we call you?').fill('Amani');
  for (let step = 0; step < 3; step++) {
    await page.getByRole('button', { name: 'Continue' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Your choices' })).toBeVisible();
  await page.getByRole('button', { name: 'Finish' }).click();
}

const sign = (page: Page) => page.locator('section[aria-live="polite"]').first();

test('someone who lost their job sees their checklist on the sign; “not now” and “done” both move on', async ({
  page,
  context,
}, testInfo) => {
  await startWith(page, 'I recently lost my job or income');
  // Today, not a career form.
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Amani');

  const first = 'Get the decision and your final pay details in writing';
  await expect(sign(page).getByRole('heading', { level: 2 })).toHaveText(first);
  await expect(sign(page).getByRole('link', { name: 'Start' })).toHaveAttribute(
    'href',
    '/civic/job-loss',
  );
  // Where it comes from, and why it is first, in one line each.
  await expect(sign(page)).toContainText('If you have lost your job');
  await expect(sign(page)).toContainText('Why am I seeing this?');
  await expect(sign(page)).toContainText(
    'It is on the checklist for your situation, under “Do now”.',
  );

  await snap(page, testInfo, 'today-lost-job');

  // Done and not now are the same kind of control, side by side.
  const done = sign(page).getByRole('button', { name: 'Mark as done' });
  const notNow = sign(page).getByRole('button', { name: 'Not now' });
  const [a, b] = await Promise.all([done.boundingBox(), notNow.boundingBox()]);
  expect(Math.round(a?.height ?? 0)).toBe(Math.round(b?.height ?? -1));
  expect(await done.getAttribute('class')).toBe(await notNow.getAttribute('class'));

  // Not now: the next step, with nothing said about the one set aside.
  await notNow.click();
  const second = 'Check unemployment support straight away';
  await expect(sign(page).getByRole('heading', { level: 2 })).toHaveText(second);
  await expect(page.getByText(first)).toHaveCount(0);

  // It is remembered for today — as a date and keys that say nothing about the step.
  await page.reload();
  await expect(sign(page).getByRole('heading', { level: 2 })).toHaveText(second);
  const kept = (await context.cookies()).find((c) => c.name === 'wp-not-now');
  expect(kept?.value).toMatch(/^\d{4}-\d{2}-\d{2}:[0-9a-z]{6,12}$/);

  // Done: the item is ticked on the checklist itself, and the sign moves on.
  await sign(page).getByRole('button', { name: 'Mark as done' }).click();
  await expect(sign(page).getByRole('heading', { level: 2 })).toHaveText(
    'Work out how long your money lasts',
  );
  await page.goto('/civic/job-loss');
  await expect(page.getByRole('checkbox', { name: `Mark “${second}” as done` })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: `Mark “${first}” as done` })).not.toBeChecked();
});

test('someone caring for another person is asked how they are, not sent to plan a career', async ({
  page,
}) => {
  await startWith(page, 'I’m caring for someone');
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await expect(sign(page).getByRole('heading', { level: 2 })).toHaveText('Check in with yourself');
  await expect(sign(page).getByRole('link', { name: 'Start' })).toHaveAttribute('href', '/mind');
  await expect(sign(page)).toContainText('You told Waypoint: “I’m caring for someone”.');
  // Nothing can be ticked off here, so there is no "done" — only start, or not now.
  await expect(sign(page).getByRole('button', { name: 'Mark as done' })).toHaveCount(0);
  await sign(page).getByRole('button', { name: 'Not now' }).click();
  await expect(sign(page).getByRole('heading', { level: 2 })).toHaveText('Talk it through');
  // The last step has nothing behind it.
  await expect(sign(page).getByRole('button', { name: 'Not now' })).toHaveCount(0);
  // Their modules come first: Mind, then Circles.
  const tools = page.getByRole('complementary', { name: 'Tools' });
  await expect(tools.getByRole('link').first()).toHaveAttribute('href', '/mind');
  await expect(tools.getByRole('link').nth(1)).toHaveAttribute('href', '/circles');
});

test('Today links to all twelve modules, beside the sign on a laptop and under it on a phone', async ({
  page,
  isMobile,
}) => {
  await startAsGuest(page);
  const tools = page.getByRole('complementary', { name: 'Tools' });
  await expect(tools).toBeVisible();

  if (isMobile) {
    // A phone shows four, and the rest on request — so Today stays short.
    await expect(tools.getByRole('listitem')).toHaveCount(4);
    const all = tools.getByRole('button', { name: 'All modules' });
    await expect(all).toHaveAttribute('aria-expanded', 'false');
    await all.click();
    await expect(all).toHaveAttribute('aria-expanded', 'true');
  } else {
    await expect(tools.getByRole('button', { name: 'All modules' })).toBeHidden();
  }

  // Eleven modules in the list (Today does not link to itself there) and help; the twelfth,
  // Today, is in the navigation on every page.
  for (const href of MODULES.filter((m) => m !== '/'))
    await expect(tools.locator(`a[href="${href}"]`), href).toBeVisible();
  await expect(tools.locator('a[href="/support"]')).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Main' }).locator('a[href="/"]').first(),
  ).toBeVisible();

  // Each row says what it is for.
  await expect(tools.getByRole('link', { name: /Check a message for scams/ })).toBeVisible();
  await expect(tools.getByRole('link', { name: /See how long your money lasts/ })).toBeVisible();

  const [signBox, toolsBox] = await Promise.all([sign(page).boundingBox(), tools.boundingBox()]);
  if (!signBox || !toolsBox)
    throw new Error('the sign and the module list should both be on the page');
  if (isMobile) expect(toolsBox.y).toBeGreaterThan(signBox.y + signBox.height);
  else {
    // At 1280 px the list sits in its own column at the end of the row.
    expect(toolsBox.x).toBeGreaterThanOrEqual(signBox.x + signBox.width);
    expect(Math.abs(toolsBox.y - signBox.y)).toBeLessThan(8);
  }

  // "What changed for you" leads to everything that changed.
  await page.getByRole('link', { name: 'See all' }).first().click();
  await expect(page).toHaveURL(/\/signals$/);
});

test('in Arabic the module list moves to the other side of the sign @desktop', async ({
  page,
  context,
  baseURL,
}) => {
  await startAsGuest(page);
  await context.addCookies([{ name: 'NEXT_LOCALE', value: 'ar', url: baseURL ?? '' }]);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const [signBox, toolsBox] = await Promise.all([
    sign(page).boundingBox(),
    page.getByRole('complementary').boundingBox(),
  ]);
  if (!signBox || !toolsBox)
    throw new Error('the sign and the module list should both be on the page');
  expect(toolsBox.x + toolsBox.width).toBeLessThanOrEqual(signBox.x);
});

test('on a phone, More is a directory that reaches every place that is not a tab', async ({
  page,
  isMobile,
}, testInfo) => {
  test.skip(!isMobile, 'wide screens show the rail instead of the bottom bar');
  await startAsGuest(page);
  const more = page.getByRole('button', { name: 'More' });
  await more.click();
  const sheet = page.getByRole('dialog', { name: 'All modules' });
  await expect(sheet).toBeVisible();
  // Each place says what it is, not only its name.
  await expect(sheet.getByRole('link', { name: /Money/ })).toContainText(
    'Budget, runway and money safety.',
  );
  // One column, and every row big enough for a thumb.
  const boxes = await sheet.getByRole('link').evaluateAll((links) =>
    links.map((l) => {
      const r = l.getBoundingClientRect();
      return { x: Math.round(r.x), height: r.height };
    }),
  );
  expect(boxes.length).toBeGreaterThanOrEqual(12);
  expect(new Set(boxes.map((b) => b.x)).size).toBe(1);
  for (const b of boxes) expect(b.height).toBeGreaterThanOrEqual(44);
  await snap(page, testInfo, 'more-sheet');
  // The tabs are not repeated here.
  await expect(sheet.locator('a[href="/path"]')).toHaveCount(0);

  await sheet.getByRole('link', { name: /Join a programme/ }).click();
  await expect(page).toHaveURL(/\/join$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await more.click();
  await page
    .getByRole('dialog', { name: 'All modules' })
    .getByRole('link', { name: /What’s next\?/ })
    .click();
  await expect(page).toHaveURL(/\/signals\/forecasts$/);
  await expect(page.getByRole('heading', { level: 1, name: 'What’s next?' })).toBeVisible();
});

test('the welcome page shows every module, and what it says works without an account does', async ({
  page,
}) => {
  await page.goto('/welcome');
  // What getting started will ask, before anything is asked.
  const route = page.getByRole('list', { name: 'Setting up' });
  await expect(route.getByRole('listitem')).toHaveText([
    /What’s going on/,
    /Where you are/,
    /What you can do/,
    /Your time/,
    /Your choices/,
  ]);

  // Every module is on the page: open as it is, or through getting started.
  const open = ['/shield', '/support', '/civic', '/surroundings', '/signals/forecasts'];
  const main = page.getByRole('main');
  for (const href of open) await expect(main.locator(`a[href="${href}"]`), href).toBeVisible();
  for (const href of MODULES.filter((m) => !open.includes(m))) {
    const through = href === '/' ? '/start' : `/start?next=${encodeURIComponent(href)}`;
    await expect(main.locator(`a[href="${through}"]`).first(), href).toBeVisible();
  }
  await expect(
    main
      .getByRole('link', { name: /Money/ })
      .filter({ hasText: 'Budget, runway and money safety.' }),
  ).toBeVisible();

  // The five that need no account really open: no trip back to the welcome page.
  for (const href of open) {
    await page.goto(href);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(new URL(page.url()).pathname, href).toBe(href);
  }
});

test('getting started ends where the person was heading', async ({ page }) => {
  await page.goto('/money');
  await expect(page).toHaveURL(/\/welcome\?next=%2Fmoney/);
  await expect(page.getByRole('link', { name: 'Get started' }).first()).toHaveAttribute(
    'href',
    '/start?next=%2Fmoney',
  );
  await startWith(page, 'I do gig or freelance work', '/welcome?next=%2Fmoney');
  await expect(page).toHaveURL(/\/money$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Money' })).toBeVisible();
  // A destination that is not on this site is never followed.
  await page.goto('/start?next=https://example.org/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('modules point on to each other: “Also on Waypoint” at the foot', async ({ page }) => {
  await startAsGuest(page);
  const also = page.getByRole('region', { name: 'Also on Waypoint' });

  // Mind: people in the same situation, or talking it through.
  await page.goto('/mind');
  await expect(also.getByRole('link')).toHaveCount(2);
  await expect(also.locator('a[href="/circles"]')).toBeVisible();

  // Money: only once the numbers show pressure.
  await page.goto('/money');
  await expect(page.getByRole('heading', { level: 1, name: 'Money' })).toBeVisible();
  await expect(also).toHaveCount(0);
  const saved = await page.request.put('/api/money', {
    data: {
      currency: 'KES',
      income: { mode: 'none' },
      essentials: { housing: 30000, food: 20000 },
      other: 0,
      debt: 0,
      savings: 10000,
    },
  });
  expect(saved.ok()).toBe(true);
  await page.reload();
  const links = also.getByRole('link');
  await expect(links.first()).toBeVisible();
  const count = await links.count();
  expect(count).toBeGreaterThanOrEqual(1);
  expect(count).toBeLessThanOrEqual(3);
  await also.locator('a[href="/civic"]').click();
  await expect(page).toHaveURL(/\/civic$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Services' })).toBeVisible();

  // A checklist: money, or talking it through.
  await page.goto('/civic/job-loss');
  await expect(also.locator('a[href="/money"]')).toBeVisible();

  // Shield: nothing extra for an ordinary message; after a high verdict, help and a place to talk.
  await page.goto('/shield');
  const box = page.getByLabel('What did you receive?');
  await box.fill('See you at the station at six. I will bring the tickets.');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByText('No common scam signs found')).toBeVisible();
  await expect(also).toHaveCount(0);
  await box.fill(
    'URGENT: Your parcel is on hold. Pay the 2.99 customs fee today at http://dhl-parcel-fees.top/pay or it will be returned.',
  );
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(also.locator('a[href="/support"]')).toBeVisible();
  await expect(also.locator('a[href="/ask"]')).toBeVisible();
});
