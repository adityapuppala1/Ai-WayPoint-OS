/**
 * Getting anywhere from anywhere: Ctrl+K (Cmd+K on a Mac) or the search button in the rail,
 * and the same palette from the top of the phone's More sheet. Every module and the main
 * places inside them are there, matched in the reader's language; the last row hands what was
 * typed to Ask without sending it and without putting it in an address. Escape closes the
 * palette, and three presses still leave Waypoint at once.
 */
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, startAsGuest, test } from './fixtures';

/*
 * One guest for the whole file. New guests from one address are limited (40 a minute, with
 * the count kept while they keep coming), and the whole suite shares that allowance.
 */
const GUEST = join(tmpdir(), `waypoint-e2e-goto-${process.env.E2E_PORT ?? 3100}.json`);

let guestReady = false;

// Made on first use in each worker, then every test here opens as that guest.
test.use({
  storageState: async ({ browser, baseURL }, use) => {
    if (!guestReady) {
      const context = await browser.newContext({ baseURL, locale: 'en-GB' });
      await startAsGuest(await context.newPage());
      await context.storageState({ path: GUEST });
      await context.close();
      guestReady = true;
    }
    await use(GUEST);
  },
});

async function openToday(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Amani');
}

test.describe('the go-to palette', () => {
  test('Ctrl+K opens it; part of a module name and Enter go there @desktop', async ({ page }) => {
    await openToday(page);
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Go to' });
    await expect(palette).toBeVisible();
    const search = palette.getByRole('searchbox', { name: 'Search Waypoint' });
    await expect(search).toBeFocused();
    // Every module, each with a line saying what it is, and the places inside them.
    const modules = palette.getByRole('group', { name: 'All modules' });
    await expect(modules.getByRole('menuitem')).toHaveCount(12);
    await expect(modules.getByRole('menuitem', { name: /Money/ })).toContainText(
      'Budget, runway and money safety.',
    );
    const places = palette.getByRole('group', { name: 'More places' });
    for (const name of [
      'Make a plan',
      'Your skills',
      'What’s next?',
      'Our record',
      'Privacy & data',
      'Get help now',
    ])
      await expect(
        places.getByRole('menuitem', { name: new RegExp(name.replace('?', '\\?')) }),
      ).toBeVisible();

    await search.fill('mon');
    await expect(palette.getByRole('menuitem').first()).toContainText('Money');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/money$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Money' })).toBeVisible();
    await expect(palette).toBeHidden();

    // A sub-page by its own name.
    await page.keyboard.press('Control+k');
    await palette.getByRole('searchbox').fill('record');
    await expect(palette.getByRole('menuitem').first()).toContainText('Our record');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/signals\/forecasts\/record$/);
  });

  test('the rail has a button for it, and Escape closes it @desktop', async ({ page }) => {
    await openToday(page);
    const opener = page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('button', { name: 'Search Waypoint' });
    await expect(opener).toBeVisible();
    expect((await opener.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    // The shortcut is shown beside it, and told to screen readers.
    await expect(opener).toContainText('Ctrl+K');
    await expect(opener).toHaveAttribute('aria-keyshortcuts', 'Control+K');
    await opener.click();
    const palette = page.getByRole('dialog', { name: 'Go to' });
    await expect(palette.getByRole('searchbox')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();
    // Focus goes back to the button that opened it.
    await expect(opener).toBeFocused();
  });

  test('the shortcut leaves typing alone @desktop', async ({ page }) => {
    await openToday(page);
    await page.goto('/shield');
    const box = page.getByRole('main').getByRole('textbox').first();
    await box.click();
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog', { name: 'Go to' })).toHaveCount(0);
  });

  test('it matches in Arabic too @desktop', async ({ page, context, baseURL }) => {
    await openToday(page);
    await context.addCookies([{ name: 'NEXT_LOCALE', value: 'ar', url: baseURL ?? '' }]);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'انتقل إلى' });
    await expect(palette).toBeVisible();
    // "مال" is part of "المال", Money.
    await palette.getByRole('searchbox', { name: 'ابحث في Waypoint' }).fill('مال');
    await expect(palette.getByRole('menuitem').first()).toContainText('المال');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/money$/);
  });

  test('the last row takes what was typed to Ask, and sends nothing @desktop', async ({ page }) => {
    await openToday(page);
    let sent = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/ask') sent++;
    });
    const words = 'I lost my job and feel stuck';
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Go to' });
    await palette.getByRole('searchbox').fill(words);
    const items = palette.getByRole('menuitem');
    // Nothing is called that, so it says so, and offers to talk it through.
    const talk = items.last();
    await expect(talk).toContainText(`Talk it through: “${words}”`);
    await expect(talk).toContainText('Nothing in Waypoint matches that.');
    await talk.click();

    await expect(page).toHaveURL(/\/ask$/);
    const composer = page.getByRole('textbox', { name: 'Your message' });
    await expect(composer).toHaveValue(words);
    await expect(composer).toBeFocused();
    // It is waiting for the person, not already on its way.
    await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled();
    await page.waitForTimeout(500);
    expect(sent).toBe(0);
    // What was typed never went into an address.
    expect(page.url()).not.toContain('stuck');
    expect(await page.evaluate(() => JSON.stringify(sessionStorage))).not.toContain('stuck');

    // A place still comes first when one matches; the row is last.
    await page.goto('/');
    await page.keyboard.press('Control+k');
    await palette.getByRole('searchbox').fill('shield');
    await expect(items.first()).toContainText('Shield');
    await expect(items.last()).toContainText('Talk it through: “shield”');
  });

  test('a held Enter on the last row fills Ask in, and still sends nothing @desktop', async ({
    page,
  }) => {
    await openToday(page);
    let sent = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/ask') sent++;
    });
    const words = 'I lost my job and feel stuck';
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Go to' });
    await palette.getByRole('searchbox').fill(words);
    // Nothing matches, so the only row is "Talk it through", and Enter chooses it.
    await expect(palette.getByRole('menuitem')).toHaveCount(1);
    // The key goes down on the row and is still held when Ask's box takes the keyboard: the
    // presses the keyboard repeats land there.
    await page.keyboard.down('Enter');
    await expect(page).toHaveURL(/\/ask$/);
    const composer = page.getByRole('textbox', { name: 'Your message' });
    await expect(composer).toHaveValue(words);
    await expect(composer).toBeFocused();
    await page.keyboard.down('Enter');
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    await page.waitForTimeout(500);
    expect(sent).toBe(0);
    // Nor did the held key type anything into the words.
    await expect(composer).toHaveValue(words);
  });

  test('Escape three times still leaves at once, with the palette open @desktop', async ({
    page,
    context,
  }) => {
    await context.route('https://www.bbc.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>Weather</title><h1>Weather</h1>' }),
    );
    await openToday(page);
    await page.keyboard.press('Control+k');
    await page.getByRole('dialog', { name: 'Go to' }).getByRole('searchbox').fill('money');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL('https://www.bbc.com/weather');
  });

  test('on a phone it opens from the top of More, as a sheet', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the More sheet is the phone layout');
    await openToday(page);
    await page.getByRole('button', { name: 'More' }).click();
    const sheet = page.getByRole('dialog', { name: 'All modules' });
    const opener = sheet.getByRole('button', { name: 'Search Waypoint' });
    await expect(opener).toBeVisible();
    expect((await opener.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    // It comes first, above the places.
    const firstPlace = await sheet.getByRole('link').first().boundingBox();
    expect((await opener.boundingBox())?.y ?? 0).toBeLessThan(firstPlace?.y ?? 0);
    await opener.click();
    await expect(sheet).toBeHidden();
    const palette = page.getByRole('dialog', { name: 'Go to' });
    const search = palette.getByRole('searchbox', { name: 'Search Waypoint' });
    await expect(search).toBeFocused();
    await search.fill('goal');
    await expect(palette.getByRole('menuitem').first()).toContainText('Goals');
    await palette.getByRole('menuitem').first().click();
    await expect(page).toHaveURL(/\/goals$/);
    await expect(palette).toBeHidden();
  });
});
