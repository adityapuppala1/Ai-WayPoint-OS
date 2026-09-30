/**
 * The first run and the everyday flow. Getting started opens with what is going on and keeps
 * the answers through a refresh; a pressed link is marked at once and a placeholder holds the
 * page's place; the shell says when the device is offline; on a phone Ask's conversations open
 * from a button; Shield takes a paste; an empty place says one thing and offers one thing to
 * do; nothing is joined with middle dots; and a guest is told once, and only once, where what
 * they saved lives.
 */
import type { Page } from '@playwright/test';
import { expect, snap, startAsGuest, test, WITHOUT_WORKER } from './fixtures';
import { STAFF } from './staff';

const stepTitle = (page: Page) => page.getByRole('main').getByRole('heading', { level: 2 });
const sign = (page: Page) => page.locator('section[aria-live="polite"]').first();
/** What getting started has kept in this tab so far (null before the page is ready). */
const draft = (page: Page) => page.evaluate(() => window.sessionStorage.getItem('wp-start-draft'));

test.describe('getting started', () => {
  test('opens with what is going on, and keeps the answers through a refresh', async ({ page }) => {
    await page.goto('/start');
    await expect(stepTitle(page)).toHaveText('What’s going on for you right now?');
    await expect(page.getByText('Step 1 of 5')).toBeVisible();
    // One question on the first screen: life stage and work type wait for a later step.
    await expect(page.getByText('Where are you in life?')).toHaveCount(0);
    await expect.poll(() => draft(page)).not.toBeNull();

    await page.getByText('I’m caring for someone', { exact: true }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(stepTitle(page)).toHaveText('Where are you, and which language suits you?');
    await page.getByLabel('What should we call you?').fill('Amani');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(stepTitle(page)).toHaveText('What can you already do?');

    // A refresh (or a phone that reloads the tab) lands on the same step with the same answers.
    await page.reload();
    await expect(stepTitle(page)).toHaveText('What can you already do?');
    await expect(page.getByText('Step 3 of 5')).toBeVisible();
    // They are kept in this tab only: nothing about them is in the address.
    expect(new URL(page.url()).search).toBe('');
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByLabel('What should we call you?')).toHaveValue('Amani');
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('radio', { name: 'I’m caring for someone' })).toBeChecked();

    for (let step = 0; step < 3; step++)
      await page.getByRole('button', { name: 'Continue' }).click();
    await expect(stepTitle(page)).toHaveText('How much time can you give this?');
    await expect(page.getByText('Where are you in life?').first()).toBeVisible();
    await expect(page.getByText('How do you work now?').first()).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(stepTitle(page)).toHaveText('Your choices');
    await page.getByRole('button', { name: 'Finish' }).click();

    // Today, with the step for what they said and the name they gave.
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Amani');
    await expect(sign(page).getByRole('heading', { level: 2 })).toHaveText(
      'Check in with yourself',
    );
    // Once the answers are saved, the copy in this tab is gone.
    expect(await draft(page)).toBeNull();
  });

  test('quick exit forgets what was answered', async ({ page, context }) => {
    // Quick exit opens a weather site; stand in for it so the test stays on this machine.
    await context.route('https://www.bbc.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>Weather</title><h1>Weather</h1>' }),
    );
    await page.goto('/start');
    await expect(stepTitle(page)).toHaveText('What’s going on for you right now?');
    await expect.poll(() => draft(page)).not.toBeNull();
    await page.getByText('I recently lost my job or income', { exact: true }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(stepTitle(page)).toHaveText('Where are you, and which language suits you?');
    await expect.poll(() => draft(page)).toContain('lost-job');

    await page.getByRole('button', { name: /Quick exit/ }).click();
    await expect(page).toHaveURL('https://www.bbc.com/weather');

    await page.goto('/start');
    await expect(stepTitle(page)).toHaveText('What’s going on for you right now?');
    await expect.poll(() => draft(page)).not.toBeNull();
    await expect(
      page.getByRole('radio', { name: 'I recently lost my job or income' }),
    ).not.toBeChecked();
  });
});

test.describe('the app never looks frozen', () => {
  /** Hold back the answer for one page, as a slow connection would. */
  const slow = (page: Page, path: string, ms = 1500) =>
    page.route(
      (url) => url.pathname === path,
      async (route) => {
        await new Promise((r) => setTimeout(r, ms));
        await route.continue().catch(() => undefined);
      },
    );

  // Held back pages: see WITHOUT_WORKER.
  test.describe(() => {
    test.use(WITHOUT_WORKER);

    test('a pressed link is marked at once, and a placeholder holds the page’s place', async ({
      page,
      context,
      baseURL,
      isMobile,
    }, testInfo) => {
      await startAsGuest(page);
      const nav = page.getByRole('navigation', { name: 'Main' });
      // A tab on the phone's bottom bar; a line on the laptop's rail.
      const first = isMobile
        ? { name: 'Shield', path: '/shield', title: 'Scam Shield' }
        : { name: 'Money', path: '/money', title: 'Money' };
      await slow(page, first.path);
      const link = nav.getByRole('link', { name: first.name, exact: true });
      await link.click();

      // At once: the marker on what was pressed…
      await expect(link.locator('[data-pending]')).toBeVisible();
      // …then a page-shaped placeholder instead of a page that seems not to have heard.
      const placeholder = page.getByRole('main').getByRole('status').filter({ hasText: 'Loading' });
      await expect(placeholder).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);
      const moving = await placeholder
        .locator('span[aria-hidden="true"]')
        .first()
        .evaluate((bar) => getComputedStyle(bar).animationName);
      expect(moving).not.toBe('none');
      await snap(page, testInfo, 'placeholder');

      // Then the page itself, and the marker is where the person now is.
      await expect(page.getByRole('heading', { level: 1, name: first.title })).toBeVisible();
      await expect(placeholder).toHaveCount(0);
      await expect(link).toHaveAttribute('aria-current', 'page');
      await expect(nav.locator('[data-pending]')).toHaveCount(0);

      // Lite mode: the same placeholder, standing still.
      await context.addCookies([{ name: 'wp-lite', value: '1', url: baseURL ?? '' }]);
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-lite', 'true');
      await slow(page, '/path');
      await nav.getByRole('link', { name: 'Path', exact: true }).click();
      await expect(placeholder).toBeVisible();
      const still = await placeholder
        .locator('span[aria-hidden="true"]')
        .first()
        .evaluate((bar) => getComputedStyle(bar).animationName);
      expect(still).toBe('none');
      await expect(page.getByRole('heading', { level: 1, name: 'Path' })).toBeVisible();
    });

    test('a row on Today holds the page’s place too', async ({ page }) => {
      await startAsGuest(page);
      await slow(page, '/support');
      const tools = page.getByRole('complementary', { name: 'Tools' });
      // A phone shows the first few rows and "All modules" for the rest.
      const all = tools.getByRole('button', { name: 'All modules' });
      if (await all.isVisible()) await all.click();
      await tools.locator('a[href="/support"]').click();
      await expect(
        page.getByRole('main').getByRole('status').filter({ hasText: 'Loading' }),
      ).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);
      await expect(page).toHaveURL(/\/support$/);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  });

  test('says when the device is offline, and stops saying so when it is back', async ({
    page,
    context,
    problems,
  }) => {
    await startAsGuest(page);
    await page.goto('/explore');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const note = page.getByText('You’re offline. Help lines still work.');
    await expect(note).toHaveCount(0);
    await context.setOffline(true);
    await expect(note).toBeVisible();
    // It is announced, not only shown.
    await expect(page.getByRole('status').filter({ has: note })).toBeVisible();
    await context.setOffline(false);
    await expect(note).toHaveCount(0);
    // Requests that failed while the connection was held down are what this test asked for
    // (the checks for a connection that Next's router makes, and the links it fetches ahead).
    // WebKit words the same refused request as an internal error of its own.
    const expected =
      /net::ERR_(INTERNET_DISCONNECTED|FAILED)|^console: Failed to load resource: WebKit encountered an internal error$/;
    for (let i = problems.length - 1; i >= 0; i--)
      if (expected.test(problems[i] ?? '')) problems.splice(i, 1);
  });

  test('a page that refuses someone still answers 404, not a placeholder @desktop', async ({
    page,
  }) => {
    await startAsGuest(page);
    // A placeholder that streams first would turn this into "200, then not found".
    const res = await page.goto('/admin');
    expect(res?.status()).toBe(404);
  });
});

test.describe('Ask', () => {
  test('on a phone the conversations open from a button, in a sheet', async ({
    page,
    isMobile,
  }, testInfo) => {
    await startAsGuest(page);
    await page.goto('/ask');
    const open = page.getByRole('button', { name: 'Conversations' });
    const list = isMobile
      ? page.getByRole('dialog', { name: 'Conversations' })
      : page.getByRole('complementary', { name: 'Conversations' });
    if (isMobile) {
      // The list is not left under the message box, where nobody finds it.
      await expect(page.getByRole('complementary', { name: 'Conversations' })).toBeHidden();
      await open.click();
    } else await expect(open).toBeHidden();

    // Nothing yet: one sentence, and one thing to do.
    await expect(list.getByText('Your conversations will appear here.')).toBeVisible();
    await list.getByRole('button', { name: 'New conversation' }).click();
    if (isMobile) await expect(list).toHaveCount(0);
    await expect(page.getByLabel('Your message')).toBeFocused();

    await page.getByLabel('Your message').fill('I lost my job last week. Where do I start?');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText(/^Guided mode/)).toBeVisible();
    await expect(page).toHaveURL(/\/ask\?c=[0-9a-f-]{36}/);
    const first = page.url();

    // A new conversation, then back to the first one from the list.
    await page.getByRole('button', { name: 'New conversation' }).first().click();
    await expect(page).toHaveURL(/\/ask$/);
    await expect(page.getByText('Try asking')).toBeVisible();
    if (isMobile) await open.click();
    await expect(list.getByRole('link')).toHaveCount(1);
    if (isMobile) await snap(page, testInfo, 'ask-conversations');
    await list.getByRole('link').click();
    await expect(page).toHaveURL(first);
    await expect(page.getByText('I lost my job last week').first()).toBeVisible();
    if (isMobile) await expect(list).toHaveCount(0);
  });

  // Ask's answer is stood in for: see WITHOUT_WORKER.
  test.describe(() => {
    test.use(WITHOUT_WORKER);

    test('something Ask saved is a row that opens where it went', async ({ page }) => {
      await startAsGuest(page);
      // No AI provider runs in tests, so stand in for the answer of one that saved a goal.
      const chunks = [
        { type: 'start', messageId: 'a1b2c3d4-0000-4000-8000-000000000001' },
        { type: 'start-step' },
        {
          type: 'tool-input-available',
          toolCallId: 'call-1',
          toolName: 'create_goal',
          input: { title: 'Walk every morning' },
        },
        {
          type: 'tool-output-available',
          toolCallId: 'call-1',
          output: { saved: true, goalId: 'g1', href: '/goals' },
        },
        {
          type: 'tool-input-available',
          toolCallId: 'call-2',
          toolName: 'draft_plan',
          input: { title: 'A plan' },
        },
        {
          type: 'tool-output-available',
          toolCallId: 'call-2',
          // A link that leaves Waypoint is never followed: no row, and no link.
          output: { saved: true, href: 'https://example.org/plan' },
        },
        { type: 'finish-step' },
        { type: 'finish' },
      ];
      await page.route('**/api/ask', (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({
              status: 200,
              headers: {
                'content-type': 'text/event-stream',
                'x-vercel-ai-ui-message-stream': 'v1',
              },
              body: `${chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('')}data: [DONE]\n\n`,
            })
          : route.continue(),
      );
      await page.goto('/ask');
      await page.getByLabel('Your message').fill('Help me set a goal to walk every morning');
      await page.getByRole('button', { name: 'Send' }).click();

      const row = page.getByRole('main').getByRole('link', { name: /Goal saved/ });
      await expect(row).toBeVisible();
      await expect(row).toHaveAttribute('href', '/goals');
      // The destination's own mark and name, in a row big enough to press.
      await expect(row).toContainText('Goals');
      expect((await row.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      await expect(page.getByText('Plan saved')).toBeVisible();
      await expect(page.locator('a[href^="https://example.org"]')).toHaveCount(0);
      await row.click();
      await expect(page).toHaveURL(/\/goals$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Goals' })).toBeVisible();
    });
  });
});

test.describe('Shield', () => {
  const SCAM =
    'URGENT: Your parcel is on hold. Pay the 2.99 customs fee today at http://dhl-parcel-fees.top/pay or it will be returned.';

  test('Paste fills the box from the clipboard', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'only Chromium lets a test grant clipboard access');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/shield');
    await page.evaluate((text) => navigator.clipboard.writeText(text), SCAM);
    await page.getByRole('button', { name: 'Paste', exact: true }).click();
    await expect(page.getByLabel('What did you receive?')).toHaveValue(SCAM);
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.getByText(/This (looks like|is very likely) a scam/)).toBeVisible();
  });

  test('no Paste button where the browser cannot read the clipboard, or will not', async ({
    page,
  }) => {
    // A browser with no clipboard reading at all: the button is never offered.
    await page.addInitScript(() => {
      if (window.sessionStorage.getItem('e2e-clipboard') === 'refuses') {
        Object.defineProperty(Navigator.prototype, 'clipboard', {
          configurable: true,
          get: () => ({
            readText: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')),
          }),
        });
        // Not refused in advance: the refusal comes when the button is pressed.
        navigator.permissions.query = () =>
          Promise.resolve({ state: 'prompt' } as PermissionStatus);
      } else {
        Object.defineProperty(Navigator.prototype, 'clipboard', {
          configurable: true,
          get: () => undefined,
        });
      }
    });
    await page.goto('/shield');
    const box = page.getByLabel('What did you receive?');
    await expect(box).toBeVisible();
    await box.fill('Hello');
    await expect(page.getByRole('button', { name: 'Paste', exact: true })).toHaveCount(0);

    // A browser that refuses: the button goes away, and the box is left as it was.
    await page.evaluate(() => window.sessionStorage.setItem('e2e-clipboard', 'refuses'));
    await page.reload();
    await page.getByLabel('What did you receive?').fill('Hello again');
    await page.getByRole('button', { name: 'Paste', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Paste', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('What did you receive?')).toHaveValue('Hello again');
  });
});

test.describe('empty places', () => {
  /** The one empty place on the page that says `says`. */
  const empty = (page: Page, says: string) =>
    page.getByRole('main').getByRole('note').filter({ hasText: says });

  const focusIsInside = (page: Page, selector: string) =>
    page.evaluate((s) => Boolean(document.activeElement?.closest(s)), selector);

  test('say one thing and offer one thing to do', async ({ page }) => {
    await startAsGuest(page);

    // Goals: the way in is the form that is already open underneath.
    await page.goto('/goals');
    const goals = empty(page, 'No goals yet.');
    await expect(goals).toBeVisible();
    await expect(goals.locator('a, button')).toHaveCount(1);
    await goals.getByRole('link', { name: 'Add a goal' }).click();
    await expect(page.getByLabel('What do you want to do?')).toBeFocused();

    // Mind: the two-week picture is empty until the first check-in, which is just above it.
    await page.goto('/mind');
    const trend = empty(page, 'Your check-ins will show here.');
    await expect(trend).toBeVisible();
    await expect(trend.locator('a, button')).toHaveCount(1);
    await trend.getByRole('link', { name: 'How are you today?' }).click();
    expect(await focusIsInside(page, '#checkin')).toBe(true);

    // Health: the week is empty until a day is logged.
    await page.goto('/health');
    const week = empty(page, 'Log a day to see your week here.');
    await expect(week).toBeVisible();
    await expect(week.locator('a, button')).toHaveCount(1);
    await week.getByRole('link', { name: 'Log today' }).click();
    expect(await focusIsInside(page, '#today')).toBe(true);
  });

  test('someone with an account and no circle is pointed at the circles they can join @desktop', async ({
    page,
  }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(STAFF.email);
    await page.getByLabel('Password').fill(STAFF.password);
    await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/($|start)/);
    await page.goto('/circles');
    const mine = empty(page, 'You haven’t joined a circle yet.');
    await expect(mine).toBeVisible();
    await expect(mine.locator('a, button')).toHaveCount(1);
    const target = await mine.getByRole('link').getAttribute('href');
    expect(target).toMatch(/^#circles-(suggested|browse)$/);
    await expect(page.locator(target as string)).toBeVisible();
  });
});

test.describe('no middle dots between facts', () => {
  test('a reminder says how often and when on separate lines', async ({ page }) => {
    await startAsGuest(page);
    const day = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const saved = await page.request.post('/api/wellbeing/reminders', {
      data: { title: 'Blood pressure tablets', repeat: 'daily', date: day, time: '09:00' },
    });
    expect(saved.ok()).toBe(true);
    await page.goto('/health');
    const row = page.getByRole('listitem').filter({ hasText: 'Blood pressure tablets' });
    await expect(row).toBeVisible();
    expect(await row.innerText()).not.toContain('·');
    const [often, when] = await Promise.all([
      row.getByText('Every day', { exact: true }).boundingBox(),
      row.getByText(/^Next: /).boundingBox(),
    ]);
    expect(when?.y ?? 0).toBeGreaterThan(often?.y ?? Number.POSITIVE_INFINITY);
    expect(await page.getByRole('main').innerText()).not.toContain(' · ');
  });

  test('Today’s weather line says the weather, then the place and the air', async ({ page }) => {
    await startAsGuest(page);
    // The forecast this device saved last time (Surroundings keeps it here, never on the server).
    await page.evaluate(() => {
      const place = { label: 'Nairobi', latitude: -1.29, longitude: 36.82 };
      window.localStorage.setItem('wp-place', JSON.stringify(place));
      window.localStorage.setItem(
        'wp-surroundings',
        JSON.stringify({
          key: '-1.29,36.82',
          fetchedAt: Date.now(),
          weather: { current: { temperature: 24, code: 3 } },
          air: { current: { usAqi: 42 } },
        }),
      );
    });
    await page.reload();
    const tools = page.getByRole('complementary', { name: 'Tools' });
    const all = tools.getByRole('button', { name: 'All modules' });
    if (await all.isVisible()) await all.click();
    const row = tools.locator('a[href="/surroundings"]');
    await expect(row).toContainText('Nairobi');
    await expect(row).toContainText('24');
    expect(await row.innerText()).not.toContain('·');
    // The place and the air are two lines, not one joined line.
    const [place, air] = await Promise.all([
      row.getByText('Nairobi', { exact: true }).boundingBox(),
      row.getByText(/^Air: /).boundingBox(),
    ]);
    expect(air?.y ?? 0).toBeGreaterThan(place?.y ?? Number.POSITIVE_INFINITY);
  });
});

test('a guest is told once where what they saved lives, and “Not now” is remembered', async ({
  page,
  context,
}, testInfo) => {
  await startAsGuest(page);
  const note = page.getByRole('region', { name: 'Your account' });
  // Nothing saved yet: nothing to say.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(note).toHaveCount(0);

  const saved = await page.request.post('/api/goals', {
    data: { title: 'Walk every morning', area: 'health' },
  });
  expect(saved.status()).toBe(201);
  await page.reload();
  await expect(note).toBeVisible();
  await expect(note).toContainText(
    'You’re using Waypoint as a guest. Create a free account to keep your plan on any device.',
  );
  await expect(note.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
    'href',
    '/sign-up',
  );
  await snap(page, testInfo, 'guest-note');
  // It is a note, not a wall: the page underneath is all there.
  await expect(sign(page).getByRole('heading', { level: 2 })).toBeVisible();

  // The server sets the cookie that remembers it, for a year: one the page wrote itself,
  // Safari and every iPhone browser would forget after seven days, and the note would return.
  const answer = page.waitForResponse(
    (res) =>
      res.url().endsWith('/api/preferences') &&
      res.request().method() === 'POST' &&
      (res.request().postDataJSON() as { guestNote?: string } | null)?.guestNote === 'off',
    { timeout: 30_000 },
  );
  await note.getByRole('button', { name: 'Not now' }).click();
  await expect(note).toHaveCount(0);
  const setCookie = ((await (await answer).headerValue('set-cookie')) ?? '').toLowerCase();
  expect(setCookie).toContain('wp-guest-note=off');
  expect(setCookie).toContain('max-age=31536000');
  // Remembered as a display choice in this browser; it does not come back.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(note).toHaveCount(0);
  await page.goto('/goals');
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(note).toHaveCount(0);
  expect((await context.cookies()).find((c) => c.name === 'wp-guest-note')?.value).toBe('off');
});

test('on a phone held sideways, the bottom bar and the side sheet keep clear of the camera cut-out', async ({
  page,
  browserName,
  isMobile,
}) => {
  test.skip(!isMobile || browserName !== 'chromium', 'safe areas can only be set in Chromium');
  await startAsGuest(page);
  await page.setViewportSize({ width: 844, height: 390 });
  const cdp = await page.context().newCDPSession(page);
  const inset = 47;
  await cdp.send(
    'Emulation.setSafeAreaInsetsOverride' as never,
    {
      insets: { left: inset, right: inset },
    } as never,
  );

  const edges = (boxes: Array<{ x: number; width: number } | null>) => ({
    left: Math.min(...boxes.map((b) => b?.x ?? -1)),
    right: Math.max(...boxes.map((b) => (b ? b.x + b.width : Number.POSITIVE_INFINITY))),
  });

  // The bottom bar: no tab under the cut-out on either side.
  const nav = page.getByRole('navigation', { name: 'Main' });
  const tabs = await Promise.all(
    (await nav.locator('a, button').all()).map((tab) => tab.boundingBox()),
  );
  expect(tabs.length).toBe(5);
  expect(edges(tabs).left).toBeGreaterThanOrEqual(inset);
  expect(edges(tabs).right).toBeLessThanOrEqual(844 - inset);

  // The More sheet sits against the far edge: its rows and its close button stay clear too.
  await nav.getByRole('button', { name: 'More' }).click();
  const sheet = page.getByRole('dialog', { name: 'All modules' });
  await expect(sheet).toBeVisible();
  // Measured once it has finished sliding in, not on the way.
  await expect(page.locator('[data-entering]')).toHaveCount(0);
  const inside = await Promise.all(
    (await sheet.locator('a, button').all()).map((el) => el.boundingBox()),
  );
  expect(edges(inside).right).toBeLessThanOrEqual(844 - inset);
});
