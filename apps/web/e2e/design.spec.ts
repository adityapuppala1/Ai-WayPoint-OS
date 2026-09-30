/**
 * The design system's own page (/design): every component and every state, in a real
 * browser. These tests hold the system to what it promises: depth, a dark theme where the
 * Sign stands out, one focus ring, pressed states, and motion that answers an action and
 * is switched off by lite mode or a request for less motion.
 */
import AxeBuilder from '@axe-core/playwright';
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

/** Preferences are cookies the server reads (theme, lite mode, language). */
async function prefer(
  context: BrowserContext,
  baseURL: string | undefined,
  prefs: { theme?: 'light' | 'dark'; lite?: boolean; locale?: string },
) {
  const url = baseURL ?? '';
  const cookies = [
    ...(prefs.theme ? [{ name: 'wp-theme', value: prefs.theme, url }] : []),
    ...(prefs.lite ? [{ name: 'wp-lite', value: '1', url }] : []),
    ...(prefs.locale ? [{ name: 'NEXT_LOCALE', value: prefs.locale, url }] : []),
  ];
  await context.addCookies(cookies);
}

async function open(page: Page) {
  await page.goto('/design');
  await expect(page.getByRole('heading', { level: 1, name: 'Design system' })).toBeVisible();
  // The showcase is interactive once its script has run; the switch says so.
  await expect(page.getByTestId('showcase-ready')).toBeAttached();
}

/** WCAG contrast between two CSS colours, whatever notation the browser reports them in. */
async function contrast(page: Page, a: string, b: string): Promise<number> {
  return page.evaluate(
    ([x, y]) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return 0;
      const luminance = (color: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, bl] = [...ctx.getImageData(0, 0, 1, 1).data].map((v) => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (bl ?? 0);
      };
      const [hi, lo] = [luminance(x as string), luminance(y as string)].sort((m, n) => n - m);
      return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
    },
    [a, b],
  );
}

const style = (locator: Locator, property: string, pseudo?: string) =>
  locator.evaluate(
    (el, [prop, ps]) => getComputedStyle(el, ps || undefined).getPropertyValue(prop as string),
    [property, pseudo ?? ''],
  );

/** Watches for elements being marked as leaving, and notes the animation each one leaves with. */
async function watchExits(page: Page) {
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __exits: string[] }).__exits = seen;
    new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target as HTMLElement;
        if (r.attributeName === 'data-exiting' && el.hasAttribute('data-exiting'))
          seen.push(
            `${el.getAttribute('role') ?? el.className}:${getComputedStyle(el).animationName}`,
          );
      }
    }).observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-exiting'],
    });
  });
  return () => page.evaluate(() => (window as unknown as { __exits: string[] }).__exits);
}

for (const theme of ['light', 'dark'] as const) {
  test(`the showcase has no serious accessibility problems in ${theme}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await prefer(context, baseURL, { theme });
    await open(page);
    expect(await page.locator('html').getAttribute('data-theme')).toBe(theme);
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .exclude('nextjs-portal')
      .analyze();
    const serious = violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(serious).toEqual([]);
  });

  test(`the Sign stands out from the page and panels are lifted in ${theme}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await prefer(context, baseURL, { theme });
    await open(page);
    const sign = page.getByTestId('demo-sign').locator('section');
    const canvas = await style(page.locator('body'), 'background-color');
    // The one bold element: a shape a person can pick out at once (3:1), in the dark as well.
    expect(
      await contrast(page, await style(sign, 'background-color'), canvas),
    ).toBeGreaterThanOrEqual(3);
    expect(await style(sign, 'box-shadow')).not.toBe('none');
    // A panel is lifted by a shadow of two layers (in the dark one of them is a lit top edge).
    const panel = page.getByTestId('elevation-1');
    expect((await style(panel, 'box-shadow')).split(/,(?![^(]*\))/).length).toBeGreaterThanOrEqual(
      2,
    );
    // The marker under the chosen tab is one colour with 3:1 against the page.
    const marker = page.getByRole('tab', { selected: true }).locator('div').last();
    expect(
      await contrast(page, await style(marker, 'background-color'), canvas),
    ).toBeGreaterThanOrEqual(3);
  });
}

test('every control shows the same focus ring: a 2px ring and a 3px signal halo', async ({
  page,
}) => {
  await open(page);
  const ring = /0px 0px 0px 2px.*0px 0px 0px 5px/;
  for (const name of ['Start my plan', 'Settings', 'Skip for now']) {
    const control = page.getByRole('button', { name, exact: true }).first();
    await control.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(control).toBeFocused();
    // The ring fades in over 120ms: wait for it to arrive at its full size.
    await expect.poll(() => style(control, 'box-shadow'), { message: name }).toMatch(ring);
  }
  // A tab and a text field, reached the way a keyboard user reaches them.
  const tab = page.getByRole('tab', { name: 'Route' });
  await tab.focus();
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() => style(page.getByRole('tab', { name: 'Skills' }), 'box-shadow'))
    .toMatch(ring);
  const field = page.getByRole('textbox', { name: 'Your name' });
  await field.focus();
  await expect.poll(() => style(field, 'box-shadow')).toMatch(ring);
});

test('pressing a button answers at once, and hover fills do not stay after a tap', async ({
  page,
  isMobile,
}) => {
  await open(page);
  const quiet = page.getByRole('button', { name: 'Skip for now' });
  expect(await style(quiet, 'transition-duration')).toContain('0.12s');
  if (isMobile) {
    // A phone has no pointer that hovers, so the hover rules do not apply at all.
    expect(await page.evaluate(() => matchMedia('(hover: hover)').matches)).toBe(false);
    await quiet.tap();
    await expect.poll(() => style(quiet, 'background-color')).toBe('rgba(0, 0, 0, 0)');
  } else {
    await quiet.hover();
    await expect.poll(() => style(quiet, 'background-color')).not.toBe('rgba(0, 0, 0, 0)');
    await page.mouse.down();
    await expect(quiet).toHaveAttribute('data-pressed', 'true');
    await expect.poll(() => style(quiet, 'scale')).toBe('0.97');
    await page.mouse.up();
  }
});

test('a toast rises in, offers Undo as a full-size button, and leaves with an animation', async ({
  page,
}) => {
  await open(page);
  const exits = await watchExits(page);
  const title = page.getByTestId('demo-sign').getByRole('heading');
  const first = await title.textContent();
  await page.getByRole('button', { name: 'Mark as done' }).click();
  await expect(title).not.toHaveText(first ?? '');

  const toast = page.getByRole('alertdialog').filter({ hasText: 'Marked as done' });
  await expect(toast).toBeVisible();
  expect(await style(toast, 'animation-name')).not.toBe('none');
  // The message names the action, so a screen reader announces it with the toast.
  await expect(toast.getByRole('alert')).toContainText('Undo');
  const undo = toast.getByRole('button', { name: 'Undo' });
  // Measured once the toast has risen into place (it arrives slightly smaller).
  await expect.poll(async () => (await undo.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await undo.boundingBox())?.width).toBeGreaterThanOrEqual(44);

  await undo.click();
  // Undo takes the step back, and the toast leaves.
  await expect(title).toHaveText(first ?? '');
  await expect(toast).toBeHidden();
  const left = await exits();
  expect(left.some((e) => e.startsWith('alertdialog:') && !e.endsWith(':none'))).toBe(true);
});

test('completing a step fills the route to the next station', async ({ page }) => {
  await open(page);
  const route = page.getByRole('list', { name: 'Steps this week' });
  const stations = route.getByRole('listitem');
  await expect(stations.nth(0)).toHaveAttribute('data-state', 'current');
  // The travelled track is a line of no length until its station is done.
  expect(Number.parseFloat(await style(stations.nth(0), 'height', '::after'))).toBe(0);
  expect(await style(stations.nth(0), 'transition-duration', '::after')).toBe('0.48s');

  await page.getByRole('button', { name: 'Mark as done' }).click();
  await expect(stations.nth(0)).toHaveAttribute('data-state', 'done');
  await expect(stations.nth(1)).toHaveAttribute('data-state', 'current');
  await expect(stations.nth(1)).toHaveAttribute('aria-current', 'step');
  // It grows to reach the next station.
  await expect
    .poll(async () => Number.parseFloat(await style(stations.nth(0), 'height', '::after')))
    .toBeGreaterThan(20);
  // A station with somewhere to go is a link.
  await expect(route.getByRole('link', { name: 'Finish the SQL practice set' })).toHaveAttribute(
    'href',
    '#route',
  );
});

test('tabs and the segmented control move one marker to the choice', async ({ page }) => {
  await open(page);
  const tabs = page.getByRole('tablist', { name: 'Plan views' });
  const markers = tabs.locator('[role="tab"] > div');
  await expect(markers).toHaveCount(1);
  expect(await style(markers.first(), 'transition-property')).toContain('translate');
  await tabs.getByRole('tab', { name: 'Proof' }).click();
  await expect(page.getByText('Verified work you can share with employers.')).toBeVisible();
  // Still one marker, now in the chosen tab.
  await expect(markers).toHaveCount(1);
  await expect(tabs.getByRole('tab', { name: 'Proof' }).locator('div')).toHaveCount(1);

  const density = page.getByRole('radiogroup', { name: 'Text size' });
  await density.getByRole('radio', { name: 'Large' }).click();
  await expect(density.getByRole('radio', { name: 'Large' })).toBeChecked();
  await expect(density.locator('button > div')).toHaveCount(1);
});

test('a disclosure opens and closes by height', async ({ page }) => {
  await open(page);
  const trigger = page.getByRole('button', { name: 'Why am I seeing this?' });
  const answer = page.getByText('We matched it to your city and the role in your plan.');
  // Closed means no height and hidden from everyone (but still found by find-in-page, where
  // the browser can do that). Measured, because browsers differ in what they call "visible".
  const panel = page.locator(`[id="${await trigger.getAttribute('aria-controls')}"]`);
  const height = async () => (await panel.boundingBox())?.height ?? 0;
  await expect(panel).toHaveAttribute('hidden', /.*/);
  expect(await height()).toBe(0);

  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(answer).toBeVisible();
  await expect(panel).not.toHaveAttribute('hidden', /.*/);
  expect(await style(panel, 'transition-property')).toMatch(/block-size|height/);
  expect(await style(panel, 'transition-duration')).toBe('0.18s');
  await expect.poll(height).toBeGreaterThan(20);

  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  // The hidden attribute comes back only once the panel has finished closing.
  await expect(panel).toHaveAttribute('hidden', /.*/);
  expect(await height()).toBe(0);
});

test('a sheet and a dialog leave with an animation and keep their scrolling to themselves', async ({
  page,
}) => {
  await open(page);
  const exits = await watchExits(page);
  await page.getByRole('button', { name: 'Open a sheet' }).click();
  const sheet = page.getByRole('dialog', { name: 'Check-in with your circle' });
  await expect(sheet).toBeVisible();
  // Where the browser knows the property (the WebKit build used for tests on Windows does not).
  if (await page.evaluate(() => CSS.supports('overscroll-behavior', 'contain')))
    expect(await style(sheet.locator('..'), 'overscroll-behavior-y')).toBe('contain');
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  await page.getByRole('button', { name: 'Open a dialog' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share your project' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();

  // Both the panel and the dimmed page behind it left with an animation, twice.
  const left = (await exits()).filter((e) => !e.endsWith(':none'));
  expect(left.length).toBeGreaterThanOrEqual(4);
});

test('meters grow to their value, and a loading page has a shape', async ({ page }) => {
  await open(page);
  const meter = page.getByRole('meter', { name: 'Chance this happens' });
  const fill = meter.locator('span').first();
  expect(await style(fill, 'animation-name')).not.toBe('none');
  const track = await meter.boundingBox();
  await expect
    .poll(async () => ((await fill.boundingBox())?.width ?? 0) / (track?.width ?? 1))
    .toBeCloseTo(0.68, 1);

  const loading = page.getByRole('status').filter({ hasText: 'Loading your day' });
  await expect(loading).toBeVisible();
  expect(
    await style(loading.locator('span[aria-hidden="true"]').first(), 'animation-name'),
  ).not.toBe('none');
});

test('lite mode and a request for less motion switch all of it off', async ({
  page,
  context,
  baseURL,
}) => {
  // Less motion, asked for in the device settings: everything still happens, at once.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const stations = page.getByRole('list', { name: 'Steps this week' }).getByRole('listitem');
  expect(await style(stations.nth(0), 'transition-duration', '::after')).toBe('0.001s');
  const loading = page.getByRole('status').filter({ hasText: 'Loading your day' });
  const block = loading.locator('span[aria-hidden="true"]').first();
  expect(await style(block, 'animation-name')).toBe('none');
  await page.getByRole('button', { name: 'Mark as done' }).click();
  const toast = page.getByRole('alertdialog').filter({ hasText: 'Marked as done' });
  await expect(toast).toBeVisible();
  expect(await style(toast, 'animation-duration')).toBe('0.001s');
  await toast.getByRole('button', { name: 'Undo' }).click();
  await expect(toast).toBeHidden();

  // Lite mode: no animation and no transition anywhere, and skeletons are still blocks.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await prefer(context, baseURL, { lite: true });
  await open(page);
  expect(await page.locator('html').getAttribute('data-lite')).toBe('true');
  expect(await style(stations.nth(0), 'transition-property', '::after')).toBe('none');
  expect(await style(block, 'animation-name')).toBe('none');
  expect(await style(block, 'background-image')).toBe('none');
  await page.getByRole('button', { name: 'Mark as done' }).click();
  await expect(toast).toBeVisible();
  expect(await style(toast, 'animation-name')).toBe('none');
  await expect(stations.nth(0)).toHaveAttribute('data-state', 'done');
  await toast.getByRole('button', { name: 'Close' }).click();
  await expect(toast).toBeHidden();
  // The tabs still work without their sliding marker.
  await page.getByRole('tab', { name: 'Skills' }).click();
  await expect(page.getByText('Skills you have and skills this plan builds.')).toBeVisible();
});

test('in Arabic the Sign, the toast and the list mirror, and nothing leaves the screen', async ({
  page,
  context,
  baseURL,
}) => {
  await prefer(context, baseURL, { locale: 'ar' });
  await open(page);
  expect(await page.locator('html').getAttribute('dir')).toBe('rtl');
  // The signal edge, and the room made for it, are on the right.
  const sign = page.getByTestId('demo-sign').locator('section');
  const left = Number.parseFloat(await style(sign, 'padding-left'));
  const right = Number.parseFloat(await style(sign, 'padding-right'));
  expect(right).toBeGreaterThan(left);
  // A focused row draws its ring evenly inside, not as a bar on one side.
  const row = page.getByRole('link', { name: /Entry-level analyst postings/ });
  // Safari does not stop at links with Tab unless asked to, so: a key press (the keyboard
  // is in use), then focus moved to the row.
  await page.keyboard.press('Tab');
  await row.focus();
  await expect
    .poll(() => style(row, 'box-shadow'))
    .toMatch(/0px 0px 0px 2px inset.*0px 0px 0px 5px inset/);
  // The toast keeps more room where its text starts: on the right.
  await page.getByRole('button', { name: 'Mark as done' }).click();
  const toast = page.getByRole('alertdialog').filter({ hasText: 'Marked as done' });
  await expect(toast).toBeVisible();
  expect(Number.parseFloat(await style(toast, 'padding-right'))).toBeGreaterThan(
    Number.parseFloat(await style(toast, 'padding-left')),
  );
  const doc = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(doc.scroll).toBeLessThanOrEqual(doc.client + 1);
});
