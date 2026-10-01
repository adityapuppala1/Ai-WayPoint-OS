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

// ───────────── The parts pages are built from: header, columns, figures, go-to, transitions ─────────────

async function openExample(page: Page, query = '') {
  await page.goto(`/design/module${query}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Also on Waypoint' })).toBeVisible();
}

/** WCAG contrast of a text colour on a stack of backgrounds (the last one on top, maybe see-through). */
async function contrastOver(page: Page, text: string, layers: string[]): Promise<number> {
  return page.evaluate(
    ([fg, backgrounds]) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return 0;
      const luminance = () => {
        const [r, g, bl] = [...ctx.getImageData(0, 0, 1, 1).data].map((v) => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (bl ?? 0);
      };
      for (const layer of backgrounds as string[]) {
        ctx.fillStyle = layer;
        ctx.fillRect(0, 0, 1, 1);
      }
      const under = luminance();
      ctx.fillStyle = fg as string;
      ctx.fillRect(0, 0, 1, 1);
      const over = luminance();
      const [hi, lo] = [under, over].sort((m, n) => n - m);
      return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
    },
    [text, layers] as const,
  );
}

const box = async (locator: Locator) => {
  const b = await locator.boundingBox();
  if (!b) throw new Error('not on the page');
  return b;
};

for (const theme of ['light', 'dark'] as const) {
  test(`a module page's header is a flat band in the module's tint that reads well in ${theme}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await prefer(context, baseURL, { theme });
    await openExample(page, '?module=path');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your path');
    // One heading for the page.
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const band = page.locator('header').filter({ has: page.getByRole('heading', { level: 1 }) });
    // The module's own tint, flat: never a gradient.
    const tint = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.background = 'var(--wp-tint-path)';
      document.body.append(probe);
      const colour = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return colour;
    });
    expect(await style(band, 'background-color')).toBe(tint);
    expect(await style(band, 'background-image')).toBe('none');
    // The heading and the lead read on the band (in the dark the tint is see-through).
    const canvas = await style(page.locator('body'), 'background-color');
    const heading = await style(page.getByRole('heading', { level: 1 }), 'color');
    const lead = await style(band.locator('p'), 'color');
    expect(await contrastOver(page, heading, [canvas, tint])).toBeGreaterThanOrEqual(4.5);
    expect(await contrastOver(page, lead, [canvas, tint])).toBeGreaterThanOrEqual(4.5);

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .exclude('nextjs-portal')
      .analyze();
    const serious = violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(serious).toEqual([]);
  });
}

test('a module page: mark, heading and actions in the band; two columns on a wide screen, one on a phone', async ({
  page,
  isMobile,
}) => {
  await openExample(page);
  const band = page.locator('header').filter({ has: page.getByRole('heading', { level: 1 }) });
  const mark = await box(band.locator('svg').first());
  const heading = await box(page.getByRole('heading', { level: 1 }));
  const action = await box(band.getByRole('link', { name: 'How this page is built' }));
  const main = await box(page.getByTestId('split-main'));
  const aside = await box(page.getByTestId('split-aside'));
  if (isMobile) {
    // The mark sits above the heading, so the heading has the whole width.
    expect(mark.y + mark.height).toBeLessThanOrEqual(heading.y);
    expect(action.y).toBeGreaterThanOrEqual(heading.y + heading.height);
    // One column: the aside follows the main part, as wide as it.
    expect(aside.y).toBeGreaterThanOrEqual(main.y + main.height);
    expect(Math.abs(aside.width - main.width)).toBeLessThanOrEqual(1);
  } else {
    // Mark, text, actions in a row, in reading order.
    expect(mark.x + mark.width).toBeLessThanOrEqual(heading.x);
    expect(action.x).toBeGreaterThanOrEqual(heading.x + heading.width - 1);
    // The aside is 20rem wide and sits beside the main column.
    expect(aside.x).toBeGreaterThanOrEqual(main.x + main.width);
    expect(Math.abs(aside.y - main.y)).toBeLessThanOrEqual(1);
    expect(Math.round(aside.width)).toBe(320);
  }
  // Every action in the band is a full-size target.
  expect(action.height).toBeGreaterThanOrEqual(44);
  const doc = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(doc.scroll).toBeLessThanOrEqual(doc.client + 1);
});

test('"Also on Waypoint" is a named list of at most three rows that lead somewhere', async ({
  page,
}) => {
  await openExample(page);
  const stops = page.getByRole('region', { name: 'Also on Waypoint' });
  // The page offered five places; a list of next stops never grows into a feed.
  await expect(stops.getByRole('listitem')).toHaveCount(3);
  await expect(stops.getByRole('link')).toHaveCount(3);
  for (const row of await stops.getByRole('link').all())
    expect((await box(row)).height).toBeGreaterThanOrEqual(44);
  await stops.getByRole('link', { name: /Figures/ }).click();
  await expect(page).toHaveURL(/\/design#figures$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Design system' })).toBeVisible();
});

test('the go-to palette opens from the keyboard, narrows as you type and goes where you choose @desktop', async ({
  page,
}) => {
  await open(page);
  const palette = page.getByRole('dialog', { name: 'Go to' });
  // While typing in a field, Ctrl+K belongs to the text.
  const field = page.getByRole('textbox', { name: 'Your name' });
  await field.focus();
  await page.keyboard.press('Control+k');
  await expect(palette).toBeHidden();
  await field.blur();

  await page.keyboard.press('Control+k');
  await expect(palette).toBeVisible();
  const search = palette.getByRole('searchbox', { name: 'Search the design system' });
  await expect(search).toBeFocused();
  const items = palette.getByRole('menuitem');
  expect(await items.count()).toBeGreaterThan(10);
  // Grouped under headings a screen reader announces.
  await expect(palette.getByRole('group', { name: 'Modules' })).toBeVisible();
  // A box near the top of the screen, so it stays put while the list changes length.
  const modal = await box(palette.locator('..'));
  expect(modal.y).toBeLessThan(150);
  expect(modal.width).toBeLessThanOrEqual(576);

  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .include('[role="dialog"]')
    .analyze();
  expect(
    violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);

  // Arrow keys move through the list while the caret stays in the field.
  await page.keyboard.press('ArrowDown');
  await expect(search).toBeFocused();
  const active = await search.getAttribute('aria-activedescendant');
  expect(active).toBeTruthy();
  await page.keyboard.press('ArrowDown');
  await expect(search).not.toHaveAttribute('aria-activedescendant', active ?? '');
  // The row the keyboard is on shows the focus ring, drawn inside the row.
  const current = palette.locator(`[id="${await search.getAttribute('aria-activedescendant')}"]`);
  await expect
    .poll(() => style(current, 'box-shadow'))
    .toMatch(/0px 0px 0px 2px inset.*0px 0px 0px 5px inset/);

  // Every word typed must match, in any order, in the label or the description.
  await search.fill('page example');
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText('An example module page');
  await expect(palette.getByRole('status')).toHaveText('1 result');
  // Nothing matches: one sentence says so.
  await search.fill('zzzz');
  await expect(palette.getByText('Nothing matches. Try another word.')).toBeVisible();
  await expect(palette.getByRole('status')).toHaveText('0 results');
  await expect(palette.getByRole('link')).toHaveCount(0);
  // Arabic and Hindi, where there is no lower case to fall back on.
  await search.fill('مال');
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText('المال');
  await search.fill('बजट');
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText('पैसा');

  // Escape empties the field first, then closes.
  await page.keyboard.press('Escape');
  await expect(search).toHaveValue('');
  await expect(palette).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(palette).toBeHidden();

  // An item can do something instead of going somewhere.
  await page.keyboard.press('Control+k');
  await search.fill('toast');
  await expect(items).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(palette).toBeHidden();
  await expect(
    page.getByRole('alertdialog').filter({ hasText: 'Opened from the palette' }),
  ).toBeVisible();

  // Enter goes to the first match, through the app's router.
  await page.keyboard.press('Control+k');
  await expect(search).toHaveValue('');
  await search.fill('example');
  await expect(items).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/design\/module$/);
  await expect(palette).toBeHidden();
});

test('on a phone the go-to palette is a sheet that opens from its button', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'the sheet is the phone layout');
  await open(page);
  const opener = page.getByRole('button', { name: 'Go to a section' });
  expect((await box(opener)).height).toBeGreaterThanOrEqual(44);
  await opener.tap();
  const palette = page.getByRole('dialog', { name: 'Go to' });
  await expect(palette).toBeVisible();
  const search = palette.getByRole('searchbox', { name: 'Search the design system' });
  await expect(search).toBeFocused();
  // Full width, resting on the bottom edge of what is visible.
  const sheet = palette.locator('..');
  const viewport = page.viewportSize();
  await expect.poll(async () => Math.round((await box(sheet)).width)).toBe(viewport?.width);
  await expect
    .poll(async () => {
      const b = await box(sheet);
      return Math.round(b.y + b.height);
    })
    .toBe(viewport?.height);
  // The field stays on screen and the list scrolls by itself.
  expect((await box(search)).y).toBeGreaterThanOrEqual(0);
  expect(await style(palette.getByRole('menu'), 'overflow-y')).toBe('auto');
  const first = palette.getByRole('menuitem').first();
  expect((await box(first)).height).toBeGreaterThanOrEqual(44);

  await search.fill('example');
  await expect(palette.getByRole('menuitem')).toHaveCount(1);
  await palette.getByRole('menuitem').first().tap();
  await expect(page).toHaveURL(/\/design\/module$/);
  await expect(palette).toBeHidden();
});

test('figures say what they show: a line, a ring and a number that counts to its value', async ({
  page,
}) => {
  // The page's clock is the test's to move (below, while the number counts); until then
  // it runs as usual.
  await page.clock.install();
  await open(page);
  // A line of values is a picture with words, not a chart to be deciphered.
  const line = page.getByRole('img', { name: /^Savings over 6 weeks/ });
  await expect(line).toBeVisible();
  await expect(line.locator('polyline')).toHaveCount(1);
  await expect(line.locator('circle')).toHaveCount(1);
  // It takes the module's line colour.
  const moneyLine = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--wp-line-money)';
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  });
  expect(await style(line.locator('polyline'), 'stroke')).toBe(moneyLine);

  // A ring is a meter with its value in words, and the same value in the middle.
  const ring = page.getByRole('meter', { name: 'Steps done this week' }).first();
  await expect(ring).toHaveAttribute('aria-valuetext', '3 of 5');
  await expect(ring).toHaveAttribute('aria-valuenow', '3');
  await expect(ring).toHaveAttribute('aria-valuemax', '5');
  await expect(ring).toContainText('3 of 5');
  const arc = ring.locator('circle').nth(1);
  expect(await style(arc, 'animation-name')).not.toBe('none');
  await page.getByRole('button', { name: 'Complete a step' }).click();
  await expect(ring).toHaveAttribute('aria-valuetext', '4 of 5');
  await expect.poll(() => style(arc, 'stroke-dasharray')).toMatch(/^80(px)?, 100(px)?$/);

  // A number counts to its new value, written by the formatter it was given.
  const number = page.getByTestId('demo-number');
  const arabic = page.getByTestId('demo-number-arabic');
  await expect(number).toHaveText('1,250');
  await expect(arabic).toHaveText('١٬٢٥٠');
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __counted: string[] }).__counted = seen;
    const target = document.querySelector('[data-testid="demo-number-arabic"]');
    if (!target) return;
    new MutationObserver(() => {
      const moving = target.querySelector('[aria-hidden="true"]');
      if (moving?.textContent) seen.push(moving.textContent);
    }).observe(target, { childList: true, subtree: true, characterData: true });
  });
  // Time stands still while the count is stepped through a frame or three at a time, so
  // what is seen does not depend on how fast the machine draws.
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  await page.getByRole('button', { name: "Add this week's saving" }).click();
  // While it counts, a screen reader is given the number it will arrive at.
  await expect(number.locator('.wp-visually-hidden')).toHaveText('1,500');
  await expect(arabic.locator('.wp-visually-hidden')).toHaveText('١٬٥٠٠');
  for (let step = 0; step < 12; step++) {
    await page.clock.runFor(48);
    await page.evaluate(() => new Promise((done) => queueMicrotask(() => done(null))));
  }
  await page.clock.resume();
  // And it arrives there.
  await expect(number).toHaveText('1,500');
  await expect(arabic).toHaveText('١٬٥٠٠');
  await expect(arabic.locator('[aria-hidden="true"]')).toHaveCount(0);
  const counted = await page.evaluate(
    () => (window as unknown as { __counted: string[] }).__counted,
  );
  // It passed through numbers in between, every one of them in Arabic digits.
  expect(new Set(counted).size).toBeGreaterThan(2);
  for (const text of counted) expect(text).toMatch(/^[٠-٩٬]+$/);

  // A strip of figures is a list.
  const strip = page.getByRole('list', { name: 'Our forecasting record' });
  await expect(strip.getByRole('listitem')).toHaveCount(4);
});

test('moving between pages: the page fades to the next one and the bar stays still', async ({
  page,
}) => {
  // Note what the browser animates each time a page transition starts.
  await page.addInitScript(() => {
    const seen: string[][] = [];
    (window as unknown as { __transitions: string[][] }).__transitions = seen;
    const start = document.startViewTransition?.bind(document);
    if (!start) return;
    document.startViewTransition = ((update: ViewTransitionUpdateCallback) => {
      const transition = start(update);
      transition.ready.then(
        () =>
          seen.push(
            document.getAnimations().flatMap((a) => {
              const effect = a.effect as KeyframeEffect | null;
              const part = effect?.pseudoElement ?? '';
              if (!part.startsWith('::view-transition')) return [];
              const name = (a as CSSAnimation).animationName ?? '';
              return [`${part} ${name} ${effect?.getComputedTiming().duration}`];
            }),
          ),
        () => seen.push(['skipped']),
      );
      return transition;
    }) as typeof document.startViewTransition;
  });
  await open(page);
  const bar = page.getByRole('navigation', { name: 'Design system pages' });
  await bar.getByRole('link', { name: 'An example page' }).click();
  await expect(page).toHaveURL(/\/design\/module$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Money' })).toBeVisible();
  // A browser without the View Transitions API just shows the next page.
  if (!(await page.evaluate(() => 'startViewTransition' in document))) return;

  expect(await style(bar, 'view-transition-name')).toBe('wp-header');
  const runs = await page.evaluate(
    () => (window as unknown as { __transitions: string[][] }).__transitions,
  );
  const animations = runs.flat();
  expect(animations.some((a) => a.includes('wp-page-out'))).toBe(true);
  expect(animations.some((a) => a.includes('wp-page-in'))).toBe(true);
  // Nothing moves the bar: it is drawn on its own and kept still.
  expect(animations.filter((a) => a.includes('(wp-header)'))).toEqual([]);
  // Within the motion range: 120ms out, 180ms in.
  for (const a of animations.filter((x) => x.includes('wp-page-')))
    expect(Number(a.split(' ').at(-1))).toBeLessThanOrEqual(240);

  // Back again works the same way.
  await bar.getByRole('link', { name: 'Design system' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Design system' })).toBeVisible();
});

test('lite mode and a request for less motion take the page transition and the counting away', async ({
  page,
  context,
  baseURL,
}) => {
  await page.addInitScript(() => {
    const seen: number[] = [];
    (window as unknown as { __durations: number[] }).__durations = seen;
    const start = document.startViewTransition?.bind(document);
    if (!start) return;
    document.startViewTransition = ((update: ViewTransitionUpdateCallback) => {
      const transition = start(update);
      const note = () => {
        for (const a of document.getAnimations()) {
          const effect = a.effect as KeyframeEffect | null;
          // What the stylesheet animates. (React also keeps two zero-length animations of
          // its own on the transition, which move nothing.)
          if (effect?.pseudoElement?.startsWith('::view-transition') && 'animationName' in a)
            seen.push(Number(effect.getComputedTiming().endTime));
        }
      };
      transition.ready.then(note, () => {});
      return transition;
    }) as typeof document.startViewTransition;
  });
  const durations = () =>
    page.evaluate(() => (window as unknown as { __durations: number[] }).__durations);
  const bar = page.getByRole('navigation', { name: 'Design system pages' });

  // Less motion: the next page is simply there.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.getByRole('button', { name: "Add this week's saving" }).click();
  // The number changes at once: nothing is ever marked as counting.
  await expect(page.getByTestId('demo-number')).toHaveText('1,500');
  await expect(page.getByTestId('demo-number').locator('[aria-hidden="true"]')).toHaveCount(0);
  await bar.getByRole('link', { name: 'An example page' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Money' })).toBeVisible();
  if (await page.evaluate(() => 'startViewTransition' in document))
    expect((await durations()).length).toBeGreaterThan(0);
  for (const d of await durations()) expect(d).toBeLessThanOrEqual(1);

  // Lite mode: no animation at all, on the page or between pages.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await prefer(context, baseURL, { lite: true });
  await open(page);
  expect(await page.locator('html').getAttribute('data-lite')).toBe('true');
  const arc = page
    .getByRole('meter', { name: 'Steps done this week' })
    .first()
    .locator('circle')
    .nth(1);
  expect(await style(arc, 'animation-name')).toBe('none');
  await page.getByRole('button', { name: "Add this week's saving" }).click();
  await expect(page.getByTestId('demo-number')).toHaveText('1,500');
  await bar.getByRole('link', { name: 'An example page' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Money' })).toBeVisible();
  expect(await durations()).toEqual([]);
});

test('in Arabic a module page mirrors, and a line of values still runs left to right', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await prefer(context, baseURL, { locale: 'ar' });
  await openExample(page);
  expect(await page.locator('html').getAttribute('dir')).toBe('rtl');
  const band = page.locator('header').filter({ has: page.getByRole('heading', { level: 1 }) });
  const mark = await box(band.locator('svg').first());
  const heading = await box(page.getByRole('heading', { level: 1 }));
  const main = await box(page.getByTestId('split-main'));
  const aside = await box(page.getByTestId('split-aside'));
  if (!isMobile) {
    // The mark leads from the right, and the aside is on the left.
    expect(mark.x).toBeGreaterThanOrEqual(heading.x + heading.width);
    expect(aside.x + aside.width).toBeLessThanOrEqual(main.x);
  }
  // A figure's rule is at its leading edge: the right.
  const figure = page
    .getByRole('list', { name: 'Where things stand' })
    .getByRole('listitem')
    .first();
  expect(Number.parseFloat(await style(figure, 'border-right-width'))).toBeGreaterThan(0);
  expect(Number.parseFloat(await style(figure, 'border-left-width'))).toBe(0);
  // Charts do not mirror: the newest value, the dot, is at the right end.
  const line = page.getByRole('img', { name: /^Savings over 6 weeks/ });
  const dot = await box(line.locator('circle'));
  const drawing = await box(line);
  expect(dot.x + dot.width / 2).toBeGreaterThan(drawing.x + drawing.width * 0.8);
  const doc = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(doc.scroll).toBeLessThanOrEqual(doc.client + 1);
});
