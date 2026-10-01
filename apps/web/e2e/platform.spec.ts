/**
 * What every browser and operating system must get right, whichever engine draws the page:
 * the cascade order the stylesheet declares, a plain notice for a browser too old for it,
 * fields an iPhone does not zoom into, native date, time and search fields that look alike,
 * and an installed app that turns with the phone.
 */
import type { Locator, Page } from '@playwright/test';
import { hexRoles } from '@waypoint/tokens';
import { expect, snap, startAsGuest, test } from './fixtures';

/** The order declared in packages/ui/src/styles/layers.css, lowest first. */
const LAYERS = ['reset', 'tokens', 'base', 'components', 'utilities'];

test('the cascade order is declared before any style that uses it', async ({ page, request }) => {
  await startAsGuest(page);
  for (const path of ['/welcome', '/', '/settings']) {
    await page.goto(path);
    // Layers are ordered by where each is first named, in the order the browser reads the
    // page's stylesheets: the first thing to name any layer must be the declaration. A layer
    // with no name (React Aria adds one at run time, before the stylesheet) cannot be named
    // again, so it cannot move one of ours.
    const first = await page.evaluate(() => {
      const find = (rules: CSSRuleList): { declared: string[] } | { block: string } | null => {
        for (const rule of rules) {
          if (rule instanceof CSSLayerStatementRule) return { declared: [...rule.nameList] };
          if (rule instanceof CSSLayerBlockRule && rule.name) return { block: rule.name };
          const inner = (rule as CSSGroupingRule).cssRules;
          const found = inner ? find(inner) : null;
          if (found) return found;
        }
        return null;
      };
      for (const sheet of document.styleSheets) {
        const found = find(sheet.cssRules);
        if (found) return found;
      }
      return null;
    });
    expect(first, path).toEqual({ declared: LAYERS });
  }

  // The same in the built file itself: nothing but comments comes before the declaration.
  const href = await page.locator('link[rel="stylesheet"]').first().getAttribute('href');
  const css = await (await request.get(href ?? '')).text();
  expect(css.replace(/\/\*[\s\S]*?\*\//g, '').trimStart()).toMatch(
    new RegExp(`^@layer\\s+${LAYERS.join('\\s*,\\s*')}\\s*;`),
  );
});

test('the built stylesheet keeps what only an iPhone reads', async ({ page, request }) => {
  await page.goto('/welcome');
  const href = await page.locator('link[rel="stylesheet"]').first().getAttribute('href');
  const css = await (await request.get(href ?? '')).text();
  // Turned sideways, an iPhone enlarges text by itself unless told not to, and it only knows
  // the prefixed property. The build drops prefixes no browser in the `browserslist` needs
  // (root package.json), and desktop Safari never needed this one: iOS has to be listed.
  expect(css).toMatch(/-webkit-text-size-adjust:\s*100%/);
});

/**
 * A stylesheet as a browser without cascade layers reads it (Chrome before 99, Firefox before
 * 97, Safari before 15.4): every `@layer` rule is one it does not know, and is skipped whole;
 * and `revert-layer`, which came with layers, is a word it does not know either, so a block
 * that asks for a browser without it applies.
 */
function withoutLayers(css: string): string {
  return skipLayers(css).replace(
    /@supports\s+not\s*\(\s*color\s*:\s*revert-layer\s*\)/g,
    '@media all',
  );
}

function skipLayers(css: string): string {
  let out = '';
  let at = 0;
  for (;;) {
    const start = css.indexOf('@layer', at);
    if (start < 0) return out + css.slice(at);
    out += css.slice(at, start);
    const open = css.indexOf('{', start);
    const end = css.indexOf(';', start);
    if (end >= 0 && (open < 0 || end < open)) {
      // "@layer a, b;" names layers and holds no styles.
      at = end + 1;
      continue;
    }
    let depth = 0;
    let i = open;
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}' && --depth === 0) break;
    }
    at = i + 1;
  }
}

test('a browser that knows cascade layers never shows the old-browser notice', async ({
  page,
  context,
  baseURL,
}) => {
  await page.goto('/welcome');
  const notice = page.locator('.wp-old-browser');
  await expect(notice).toHaveCount(1);
  await expect(notice).toBeHidden();
  // Nor the plain layout kept for such a browser: the header, rail and tab bar still stay in
  // place while the page scrolls.
  await page.goto('/support');
  const pinned = await page.evaluate(
    () =>
      [...document.querySelectorAll('body *')].filter((el) =>
        ['fixed', 'sticky'].includes(getComputedStyle(el).position),
      ).length,
  );
  expect(pinned).toBeGreaterThan(0);
  await page.goto('/welcome');
  // It is in the page all the same, in the reader's language, for the browser that needs it.
  await expect(notice).toContainText('This browser is too old to show Waypoint properly.');
  await context.addCookies([{ name: 'NEXT_LOCALE', value: 'ar', url: baseURL ?? '' }]);
  await page.goto('/welcome');
  await expect(notice).toContainText('هذا المتصفح قديم جدًا');
  await expect(notice.locator('a')).toHaveAttribute('href', '/support');
});

/**
 * Makes this browser write Arabic numbers in Arabic-Indic digits ("١٢") unless a page names
 * its digits, as older ICU versions do (Linux WebKit, older iPhones and Macs). Node's own ICU
 * writes Latin digits ("12"), so a page that left the choice to each engine was drawn one way
 * on the server and another in such a browser, and React threw it away (error 418).
 */
function arabicIndicByDefault() {
  const named = (tag: string) => /-u(?:-[a-z0-9]{2,8})*-nu-/i.test(tag);
  const indic = (tag: unknown) =>
    typeof tag === 'string' && /^ar(?:-|$)/i.test(tag) && !named(tag)
      ? `${tag}${/-u-/i.test(tag) ? '' : '-u'}-nu-arab`
      : tag;
  for (const name of ['NumberFormat', 'DateTimeFormat', 'RelativeTimeFormat'] as const) {
    const Original = Intl[name] as unknown as new (locales?: unknown, options?: unknown) => object;
    // biome-ignore lint/complexity/useArrowFunction: an arrow function cannot be a constructor
    const Indic = function (locales?: unknown, options?: unknown) {
      const list = Array.isArray(locales) ? locales.map(indic) : indic(locales);
      return new Original(list, options);
    } as unknown as typeof Original & { supportedLocalesOf: unknown };
    Indic.prototype = Original.prototype;
    Indic.supportedLocalesOf = (Original as unknown as typeof Intl.NumberFormat).supportedLocalesOf;
    Object.defineProperty(Intl, name, { value: Indic, configurable: true, writable: true });
  }
}

test('Arabic pages are drawn the same by a browser whose own Arabic digits differ', async ({
  page,
  context,
  baseURL,
}) => {
  await page.addInitScript(arabicIndicByDefault);
  await startAsGuest(page, 'Salma');
  expect(
    await page.evaluate(() => [
      new Intl.NumberFormat('ar').format(12),
      new Intl.NumberFormat('ar-u-nu-latn').format(12),
    ]),
  ).toEqual(['١٢', '12']);
  await context.addCookies([{ name: 'NEXT_LOCALE', value: 'ar', url: baseURL ?? '' }]);
  // Pages whose own parts write numbers and dates in the browser: Today's counts, the feedback
  // scale, reminders and forecasts. The fixture fails the test on React's error.
  for (const path of ['/', '/settings/feedback', '/health', '/signals/forecasts']) {
    await page.goto(path);
    await expect(page.locator('html'), path).toHaveAttribute('dir', 'rtl');
  }
  await page.goto('/settings/feedback');
  await expect(page.getByRole('radio', { name: '2', exact: true })).toHaveCount(1);
});

test('a browser too old for the stylesheet is told so, and can still read the help numbers', async ({
  page,
}, testInfo) => {
  await page.route('**/*.css', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: withoutLayers(await response.text()) });
  });
  await page.goto('/welcome');
  const notice = page.locator('.wp-old-browser');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('This browser is too old to show Waypoint properly.');
  // The first thing on the page, not somewhere below everything else.
  expect((await notice.boundingBox())?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(200);
  await snap(page, testInfo, 'old-browser-welcome');

  await notice.getByRole('link', { name: 'Get help now' }).click();
  await expect(page).toHaveURL(/\/support$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Get help now' })).toBeVisible();
  await expect(page.getByText('If you or someone else is in immediate danger')).toBeVisible();
  // Kenya, from the test's time zone: the emergency number can be read and pressed, and
  // nothing lies over it.
  const call = page.getByRole('main').locator('a[href^="tel:"]').first();
  await expect(call).toBeVisible();
  await call.scrollIntoViewIfNeeded();
  const readable = await call.evaluate((link) => {
    const box = link.getBoundingClientRect();
    const onTop = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    // Without the stylesheet no picture may swallow the screen (an icon with no size of its
    // own would grow to the full width of the page). The widest picture with a size of its own
    // is the drawn name in the logo, 4.25em wide at the size of the text around it, so each
    // picture is measured in its own text size (it differs between engines without the
    // stylesheet). An icon with no size of its own is hundreds of pixels wide: 20em and more.
    const widest = Math.max(
      0,
      ...[...document.querySelectorAll('svg, img')].map(
        (el) =>
          el.getBoundingClientRect().width /
          (Number.parseFloat(getComputedStyle(el).fontSize) || 16),
      ),
    );
    return {
      onTop: Boolean(onTop && (onTop === link || link.contains(onTop))),
      text: (link.textContent ?? '').trim().length > 0,
      widest,
    };
  });
  expect(readable.onTop).toBe(true);
  expect(readable.text).toBe(true);
  expect(readable.widest).toBeLessThanOrEqual(5);
  await snap(page, testInfo, 'old-browser-support');
});

test('only running text hangs its punctuation, never a field or a line cut short', async ({
  page,
}) => {
  await startAsGuest(page);
  let hangs = 0;
  for (const path of ['/privacy', '/', '/ask', '/settings', '/circles', '/health']) {
    await page.goto(path);
    const found = await page.evaluate(() => {
      if (!CSS.supports('hanging-punctuation', 'first last')) return null;
      const hanging = (el: Element) =>
        getComputedStyle(el).getPropertyValue('hanging-punctuation') !== 'none';
      const fieldOrCut = [...document.querySelectorAll('body *')].filter((el) => {
        const s = getComputedStyle(el);
        const clamp = s.getPropertyValue('-webkit-line-clamp');
        return (
          el.matches('input, textarea, select, [contenteditable]') ||
          s.textOverflow === 'ellipsis' ||
          (clamp !== '' && clamp !== 'none')
        );
      });
      return {
        wrong: fieldOrCut
          .filter(hanging)
          .map((el) => `${el.tagName.toLowerCase()}.${el.className}`)
          .slice(0, 5),
        checked: fieldOrCut.length,
        paragraphs: [...document.querySelectorAll('main p:not([class])')].filter(hanging).length,
      };
    });
    // Chrome and Firefox do not hang punctuation at all: there is nothing to get wrong.
    test.skip(found === null, 'only Safari hangs punctuation');
    expect(found?.wrong, path).toEqual([]);
    if (path === '/privacy') hangs = found?.paragraphs ?? 0;
  }
  // Long text still gets it: the paragraphs of the privacy notice.
  expect(hangs).toBeGreaterThan(0);
});

/** Every field a person types or picks in, with a text size under 16px. */
const smallFields = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('input:not([type="hidden"]), textarea, select')]
      .filter((el) => Number.parseFloat(getComputedStyle(el).fontSize) < 16)
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}[type=${el.getAttribute('type')}] ${getComputedStyle(el).fontSize}`,
      ),
  );

test('no field is small enough to make an iPhone zoom the page', async ({ page }) => {
  for (const path of ['/welcome', '/sign-in', '/sign-up', '/shield', '/start']) {
    await page.goto(path);
    expect(await smallFields(page), path).toEqual([]);
  }
  await startAsGuest(page);
  for (const path of [
    '/settings',
    '/settings/privacy',
    '/ask',
    '/health',
    '/goals',
    '/mind',
    '/money',
    '/path',
    '/signals',
    '/surroundings',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await smallFields(page), path).toEqual([]);
  }
  // The two that were 14px: quiet hours, in Settings.
  await page.goto('/settings');
  for (const label of ['From', 'Until'])
    expect(
      await page.getByLabel(label, { exact: true }).evaluate((el) => getComputedStyle(el).fontSize),
      label,
    ).toBe('16px');
});

test('date, time and search fields look the same in every browser', async ({
  page,
  browserName,
}, testInfo) => {
  await startAsGuest(page);
  /** How the browser draws a field: only what the page's own styles decide may be left. */
  const look = (field: Locator) =>
    field.evaluate((el) => {
      const s = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      const parent = (el.parentElement as HTMLElement).getBoundingClientRect();
      // The page's own tokens, as this browser computes them.
      const probe = document.body.appendChild(document.createElement('div'));
      probe.style.cssText =
        'block-size: var(--wp-touch-min); border-radius: var(--wp-radius-sm); background: var(--wp-raised)';
      const token = getComputedStyle(probe);
      const expected = {
        height: probe.getBoundingClientRect().height,
        radius: token.borderTopLeftRadius,
        background: token.backgroundColor,
      };
      probe.remove();
      // The height the page's own styles give it: its line, padding and border, and at least
      // its minimum. An engine that sizes the field by itself ends up somewhere else.
      const px = (value: string) => Number.parseFloat(value) || 0;
      const styled = Math.max(
        px(s.minHeight),
        px(s.lineHeight) +
          px(s.paddingTop) +
          px(s.paddingBottom) +
          px(s.borderTopWidth) +
          px(s.borderBottomWidth),
      );
      return {
        appearance: s.getPropertyValue('appearance') || s.getPropertyValue('-webkit-appearance'),
        fontSize: s.fontSize,
        height: Math.round(box.height),
        expectedHeight: Math.round(expected.height),
        styledHeight: Math.round(styled),
        radius: s.borderTopLeftRadius,
        expectedRadius: expected.radius,
        background: s.backgroundColor,
        expectedBackground: expected.background,
        // A field its browser sizes by itself is narrower than the space the page gives it.
        fills: Math.abs(box.width - parent.width) <= 1,
      };
    });
  const same = (found: Awaited<ReturnType<typeof look>>, name: string) => {
    expect(found.appearance, `${name}: no look of the browser's own`).toBe('none');
    expect(found.fontSize, name).toBe('16px');
    expect(found.height, `${name}: height`).toBe(found.expectedHeight);
    expect(found.radius, `${name}: corners`).toBe(found.expectedRadius);
    expect(found.background, `${name}: background`).toBe(found.expectedBackground);
  };

  // Quiet hours in Settings: two time fields side by side.
  await page.goto('/settings');
  for (const label of ['From', 'Until']) {
    const found = await look(page.getByLabel(label, { exact: true }));
    same(found, `quiet hours, ${label}`);
    expect(found.fills, `quiet hours, ${label}: fills its column`).toBe(true);
  }
  await page.getByLabel('From', { exact: true }).scrollIntoViewIfNeeded();
  await snap(page, testInfo, 'native-time');

  // A new reminder in Health: a date and a time. (The date's label follows the repeat
  // chosen beside it, so the fields are found by their type.)
  await page.goto('/health');
  const date = page.getByRole('main').locator('input[type="date"]');
  const time = page.getByRole('main').locator('input[type="time"]');
  for (const [name, field] of [
    ['date', date],
    ['time', time],
  ] as const) {
    const found = await look(field);
    same(found, `reminder, ${name}`);
    expect(found.fills, `reminder, ${name}: fills its column`).toBe(true);
  }
  // They are still the browser's own fields: a date typed the standard way is taken.
  await date.fill('2031-05-17');
  await expect(date).toHaveValue('2031-05-17');
  await time.fill('07:45');
  await expect(time).toHaveValue('07:45');
  await date.scrollIntoViewIfNeeded();
  await snap(page, testInfo, 'native-date');

  // Searching the signals: the design system's search field. It is as tall as the design
  // system's other text fields (their line and padding, above the touch minimum), not exactly
  // the minimum as the plain date and time fields are: the same in every engine, never smaller
  // than a thumb, with the same corners and background.
  await page.goto('/signals');
  const search = page.getByRole('searchbox', { name: 'Search signals' });
  const found = await look(search);
  same({ ...found, expectedHeight: found.styledHeight }, 'search');
  expect(found.height, 'search: at least the touch minimum').toBeGreaterThanOrEqual(
    found.expectedHeight,
  );
  await search.fill('rent');
  if (browserName !== 'firefox') {
    // Chrome and Safari add a "clear" cross of their own once there is text; Firefox has none.
    // A page cannot read the style of that cross, so the check is that this engine kept the
    // rule hiding it: an engine drops a whole rule whose selector it does not know.
    const cross = await page.evaluate(() => {
      const styleRules = (list: CSSRuleList): CSSStyleRule[] =>
        [...list].flatMap((rule) =>
          rule instanceof CSSStyleRule
            ? [rule]
            : 'cssRules' in rule
              ? styleRules((rule as CSSGroupingRule).cssRules)
              : [],
        );
      return [...document.styleSheets]
        .flatMap((sheet) => styleRules(sheet.cssRules))
        .filter((rule) => rule.selectorText.includes('::-webkit-search-cancel-button'))
        .map((rule) => rule.style.display);
    });
    expect(cross).toContain('none');
  }
  await snap(page, testInfo, 'native-search');
});

test('the installed app turns with the phone and takes the page background as its colour', async ({
  page,
  request,
}) => {
  const canvas = { light: hexRoles('light').canvas, dark: hexRoles('dark').canvas };
  const manifest = (await (await request.get('/manifest.webmanifest')).json()) as Record<
    string,
    unknown
  >;
  // Locked to portrait, someone with their phone fixed sideways on a wheelchair mount could
  // not use the installed app (WCAG 1.3.4).
  expect(manifest).not.toHaveProperty('orientation');
  expect(manifest.theme_color).toBe(canvas.light);
  expect(manifest.background_color).toBe(canvas.light);

  // The pages say the same to the browser, in light and in dark…
  await page.goto('/welcome');
  for (const scheme of ['light', 'dark'] as const)
    await expect(
      page.locator(`meta[name="theme-color"][media="(prefers-color-scheme: ${scheme})"]`),
    ).toHaveAttribute('content', canvas[scheme]);

  // …and so does the offline page, which is a plain file with the colours written in.
  await page.goto('/offline.html');
  for (const scheme of ['light', 'dark'] as const) {
    await expect(
      page.locator(`meta[name="theme-color"][media="(prefers-color-scheme: ${scheme})"]`),
    ).toHaveAttribute('content', canvas[scheme]);
    await page.emulateMedia({ colorScheme: scheme });
    const background = await page.evaluate(() => {
      const probe = document.body.appendChild(document.createElement('div'));
      probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--bg');
      const [r = 0, g = 0, b = 0] = (getComputedStyle(probe).color.match(/\d+/g) ?? []).map(Number);
      probe.remove();
      return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    });
    expect(background, `offline page background, ${scheme}`).toBe(canvas[scheme]);
  }
});
