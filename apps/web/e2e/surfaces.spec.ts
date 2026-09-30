/**
 * Things that were built underneath and now have a surface, each in a real browser:
 *
 * - a signal can be saved, hidden ("Not relevant") and brought back, and the Saved list keeps
 *   what was saved; an empty search says what did not match and offers one way on;
 * - staff add a sourced signal in the console and withdraw it, and both are in the log;
 * - staff edit an open forecast's details and add a translation, whose question is then fixed;
 *   a verdict recorded by one member of staff is shown as waiting for a second check, in the
 *   console and in public;
 * - "Tell us what worked, or what didn't" reaches staff without saying who a guest is.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { BrowserContext, Page } from '@playwright/test';
import { expect, snap, startAsGuest, test } from './fixtures';
import { STAFF } from './staff';

// Words of its own for every run and every browser, so a second run against the same server
// never meets what an earlier one left behind.
const RUN = Date.now().toString(36);
const SOURCE = { name: 'Kenya National Bureau of Statistics', url: 'https://www.knbs.or.ke/' };
const SUMMARY =
  'The statistics office has published this quarter’s labour survey. It shows where jobs were added and lost by county.';

const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

/** The texts as the message files have them, so the test and the page can't drift. */
function messages(locale: string) {
  const file = join(import.meta.dirname, '../../../packages/i18n/messages', `${locale}.json`);
  return JSON.parse(readFileSync(file, 'utf8')) as {
    signals: Record<string, string>;
    settings: Record<string, string>;
  };
}

/** Show the pages in Arabic on a dark screen (or put them back), as the person's own choices do. */
const inArabicAndDark = (context: BrowserContext, url: string, on: boolean) =>
  context.addCookies([
    { name: 'NEXT_LOCALE', value: on ? 'ar' : 'en', url },
    { name: 'wp-theme', value: on ? 'dark' : 'light', url },
  ]);

const noSidewaysScroll = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );

/** Serious accessibility problems on the page as it is now (axe, WCAG 2.2 A and AA). */
async function seriousProblems(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .exclude('nextjs-portal')
    .analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

/** An API call made by the page itself, as the person's own browser makes it. */
async function call<T>(
  page: Page,
  path: string,
  init: { method?: string; json?: unknown } = {},
): Promise<{ status: number; body: T }> {
  return page.evaluate(
    async ([p, i]) => {
      const res = await fetch(p, {
        method: i.method ?? (i.json === undefined ? 'GET' : 'POST'),
        headers: i.json === undefined ? undefined : { 'content-type': 'application/json' },
        body: i.json === undefined ? undefined : JSON.stringify(i.json),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
    [path, init] as const,
  );
}

/**
 * The staff session, once staff have signed in. Sign-ins from one address are limited to ten
 * a minute, and the limit only resets after a quiet minute, so on a fast machine the specs
 * together can run into it: staff sign in once here and every later test reuses the session.
 */
let staffCookies: Awaited<ReturnType<BrowserContext['cookies']>> | undefined;

async function signInAsStaff(page: Page) {
  if (staffCookies) {
    await page.context().addCookies(staffCookies);
    await page.goto('/');
  } else {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(STAFF.email);
    await page.getByLabel('Password').fill(STAFF.password);
    await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click();
  }
  await expect(page).toHaveURL(/\/($|start)/);
  staffCookies ??= await page.context().cookies();
}

const needsStaff = () =>
  test.skip(
    Boolean(process.env.E2E_BASE_URL),
    'needs the staff account that only the test server creates',
  );

/** Press something that tells the server about a signal, and wait until the server has it. */
async function andSaved(page: Page, press: () => Promise<void>) {
  await Promise.all([
    page.waitForResponse(
      (r) => /\/api\/signals\/[^/]+\/state$/.test(new URL(r.url()).pathname) && r.ok(),
    ),
    press(),
  ]);
}

test('a signal can be saved, hidden and brought back, and an empty search says so', async ({
  page,
  browser,
  context,
  baseURL,
}, testInfo) => {
  needsStaff();
  test.setTimeout(180_000);
  // Signals are only ever added by staff: one about everywhere, so this guest is shown it.
  const staffContext = await browser.newContext();
  const staff = await staffContext.newPage();
  await signInAsStaff(staff);
  const title = `Labour survey ${RUN} ${testInfo.project.name} shows where jobs were added`;
  const published = await call<{ id: string }>(staff, '/api/admin/signals', {
    json: {
      title,
      summary: SUMMARY,
      sourceName: SOURCE.name,
      sourceUrl: SOURCE.url,
      publishedOn: day(-2),
      importance: 5,
    },
  });
  expect(published.status).toBe(201);

  try {
    await startAsGuest(page, 'Neema');
    // Before anything is saved, the Saved list says so and offers one way on.
    await page.goto('/signals?saved=1');
    await expect(page.getByText('You haven’t saved any signals yet.')).toBeVisible();
    await page.getByRole('main').getByRole('link', { name: 'Show all signals' }).click();
    await expect(page).toHaveURL(/\/signals$/);

    const item = page.getByRole('article').filter({ hasText: title });
    await expect(item.getByRole('heading', { name: title })).toBeVisible();
    await expect(item.getByRole('link', { name: `Source: ${SOURCE.name}` })).toHaveAttribute(
      'href',
      SOURCE.url,
    );
    expect(await noSidewaysScroll(page)).toBe(true);
    expect(await seriousProblems(page)).toEqual([]);

    // Save is a switch: it says "Saved", and pressing it again would take the save back. It
    // is also said in a toast whose Undo takes it back.
    await andSaved(page, () => item.getByRole('button', { name: `Save: ${title}` }).click());
    const said = page.getByRole('alertdialog').filter({ hasText: title });
    await expect(said).toContainText('Saved');
    await andSaved(page, () => said.getByRole('button', { name: 'Undo' }).click());
    await expect(item.getByRole('button', { name: `Save: ${title}` })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    // The toast outlives the page: its Undo, pressed on the Saved list, leaves nothing there
    // saying the signal is kept.
    const filters = page.getByRole('navigation', { name: 'Which signals to show' });
    await andSaved(page, () => item.getByRole('button', { name: `Save: ${title}` }).click());
    await filters.getByRole('link', { name: 'Saved' }).click();
    await expect(page).toHaveURL(/saved=1/);
    await expect(item.getByRole('heading', { name: title })).toBeVisible();
    await andSaved(page, () => said.getByRole('button', { name: 'Undo' }).click());
    await expect(item).toHaveCount(0);
    await expect(page.getByText('You haven’t saved any signals yet.')).toBeVisible();
    await filters.getByRole('link', { name: 'All' }).click();
    await expect(page).toHaveURL(/\/signals$/);
    await andSaved(page, () => item.getByRole('button', { name: `Save: ${title}` }).click());
    await expect(item.getByRole('button', { name: `Saved: ${title}` })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await snap(page, testInfo, 'signals-saved');

    // The same list in Arabic on a dark screen: right to left, the buttons in Arabic, nothing
    // off the edge and nothing too faint to read.
    const ar = messages('ar').signals;
    await inArabicAndDark(context, baseURL ?? '', true);
    await page.goto('/signals');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(item.getByRole('button', { name: `${ar.saved}: ${title}` })).toBeVisible();
    await expect(item.getByRole('button', { name: `${ar.dismiss}: ${title}` })).toBeVisible();
    await expect(page.getByRole('link', { name: ar.filterAll as string })).toBeVisible();
    expect(await noSidewaysScroll(page)).toBe(true);
    expect(await seriousProblems(page)).toEqual([]);
    await snap(page, testInfo, 'signals-ar-dark');
    await inArabicAndDark(context, baseURL ?? '', false);
    await page.goto('/signals');

    await filters.getByRole('link', { name: 'Saved' }).click();
    await expect(page).toHaveURL(/saved=1/);
    await expect(filters.getByRole('link', { name: 'Saved' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(item.getByRole('heading', { name: title })).toBeVisible();
    // What someone chose to keep is not offered for hiding on the list of kept things.
    await expect(item.getByRole('button', { name: /^Not relevant/ })).toHaveCount(0);

    // "Not relevant" hides it and leaves a way back where it was, with the keyboard on it.
    await filters.getByRole('link', { name: 'All' }).click();
    await expect(page).toHaveURL(/\/signals$/);
    await andSaved(page, () =>
      item.getByRole('button', { name: `Not relevant: ${title}` }).click(),
    );
    await expect(page.getByText('Hidden. You won’t be shown this again.')).toBeVisible();
    await expect(item).toHaveCount(0);
    const undo = page.getByRole('button', { name: 'Undo' });
    await expect(undo).toBeFocused();
    expect(await seriousProblems(page)).toEqual([]);
    await andSaved(page, () => undo.click());
    await expect(item.getByRole('heading', { name: title })).toBeVisible();
    await expect(item.getByRole('button', { name: `Not relevant: ${title}` })).toBeFocused();

    // Hidden for good once the page is left: it is gone from "All", and still among the saved.
    await andSaved(page, () =>
      item.getByRole('button', { name: `Not relevant: ${title}` }).click(),
    );
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Signals' })).toBeVisible();
    await expect(item).toHaveCount(0);
    await page.goto('/signals?saved=1');
    await expect(item.getByRole('heading', { name: title })).toBeVisible();

    // A search that finds nothing says what it looked for, and offers one way on.
    await page.goto('/signals');
    const search = page.getByRole('searchbox', { name: 'Search signals' });
    await search.fill(`qzx${RUN}`);
    await page.getByRole('main').getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`q=qzx${RUN}`));
    await expect(page.getByText(`No signals match “qzx${RUN}”.`)).toBeVisible();
    expect(await noSidewaysScroll(page)).toBe(true);
    await page.getByRole('main').getByRole('link', { name: 'Show all signals' }).click();
    await expect(page).toHaveURL(/\/signals$/);
  } finally {
    // Withdrawn again, so no other test meets a signal it did not expect.
    await call(staff, `/api/admin/signals/${published.body.id}`, { method: 'DELETE' });
    await staffContext.close();
  }
});

test('staff add a sourced signal, people see it, and staff withdraw it @desktop', async ({
  page,
  browser,
}, testInfo) => {
  needsStaff();
  test.setTimeout(180_000);
  const title = `County offices ${RUN} extend opening hours for ID applications`;
  await signInAsStaff(page);
  await page.goto('/admin/signals');
  await expect(page.getByRole('heading', { name: 'Signals', level: 2 })).toBeVisible();

  // No source, no signal: whoever asks, and however the address is written.
  const signal = {
    title,
    summary: SUMMARY,
    sourceName: SOURCE.name,
    sourceUrl: SOURCE.url,
    publishedOn: day(-1),
  };
  for (const bad of [
    { sourceUrl: undefined },
    { sourceUrl: 'http://www.knbs.or.ke/' },
    { sourceName: '' },
    { publishedOn: day(3) },
  ]) {
    const refused = await call(page, '/api/admin/signals', { json: { ...signal, ...bad } });
    expect(refused.status, JSON.stringify(bad)).toBe(422);
  }

  const form = page.locator('#add');
  await form.getByRole('button', { name: 'Publish signal' }).click();
  await expect(form.getByRole('alert')).toContainText('Some fields need attention.');

  await form.getByLabel('What changed').fill(title);
  await form.getByLabel('Summary').fill(SUMMARY);
  await form.getByLabel('Source name').fill(SOURCE.name);
  await form.getByLabel('Source address (https://…)').fill(SOURCE.url);
  await form.getByLabel('Day the source published it').fill(day(-1));
  await form.getByLabel('Countries').fill('ke');
  await form.getByLabel('Sectors').fill('Public services');
  const importance = form.getByLabel('Importance');
  await importance.fill('4');
  await importance.blur();
  await form.getByRole('button', { name: 'Publish signal' }).click();
  await expect(page.getByText('Signal published')).toBeVisible();

  const item = page.getByRole('listitem').filter({ hasText: title });
  await expect(item.getByRole('heading', { name: title })).toBeVisible();
  await expect(item.getByRole('link', { name: `Source: ${SOURCE.name}` })).toHaveAttribute(
    'href',
    SOURCE.url,
  );
  await expect(item.getByText('Kenya', { exact: true })).toBeVisible();
  await expect(item.getByText('Importance 4 of 5')).toBeVisible();
  expect(await noSidewaysScroll(page)).toBe(true);
  expect(await seriousProblems(page)).toEqual([]);
  await snap(page, testInfo, 'admin-signals');

  // Someone in Kenya sees it, with where it came from.
  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  await startAsGuest(pub, 'Wanjiru');
  await call(pub, '/api/me/profile', { method: 'PATCH', json: { country: 'KE' } });
  await pub.goto('/signals');
  const shown = pub.getByRole('article').filter({ hasText: title });
  await expect(shown.getByRole('heading', { name: title })).toBeVisible();
  await expect(shown.getByRole('link', { name: `Source: ${SOURCE.name}` })).toHaveAttribute(
    'href',
    SOURCE.url,
  );

  // Withdrawn: gone from the console and from what people see.
  await item.getByRole('button', { name: `Withdraw: ${title}` }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Withdraw this signal?' });
  await expect(dialog).toContainText('It will no longer be shown to anyone');
  await dialog.getByRole('button', { name: 'Withdraw', exact: true }).click();
  await expect(page.getByText('Signal withdrawn')).toBeVisible();
  await expect(page.getByRole('heading', { name: title })).toHaveCount(0);
  await pub.reload();
  await expect(pub.getByRole('heading', { level: 1, name: 'Signals' })).toBeVisible();
  await expect(pub.getByRole('heading', { name: title })).toHaveCount(0);
  await visitor.close();

  // It stays withdrawn: typed in again, the console says so and publishes nothing.
  await form.getByLabel('What changed').fill(title);
  await form.getByLabel('Summary').fill(SUMMARY);
  await form.getByLabel('Source name').fill(SOURCE.name);
  await form.getByLabel('Source address (https://…)').fill(SOURCE.url);
  await form.getByLabel('Day the source published it').fill(day(-1));
  await form.getByRole('button', { name: 'Publish signal' }).click();
  await expect(form.getByRole('alert')).toContainText(
    'This signal was withdrawn, so it can’t be published again.',
  );
  await expect(page.getByRole('heading', { name: title })).toHaveCount(0);

  // Both actions are in the staff activity log.
  await page.goto('/admin/audit');
  await expect(page.getByText('Signal published').first()).toBeVisible();
  await expect(page.getByText('Signal withdrawn').first()).toBeVisible();
});

test('staff edit an open forecast and add a translation; a verdict waits for a second check @desktop', async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  needsStaff();
  test.setTimeout(240_000);
  const question = `Will the county publish housing survey ${RUN} by the due date?`;
  const swQuestion = `Je, kaunti itachapisha utafiti wa makazi ${RUN} kabla ya tarehe?`;
  const advice = 'Ask the county housing office which estates the survey covers.';
  await signInAsStaff(page);
  const published = await call<{ id: string }>(page, '/api/admin/forecasts', {
    json: {
      question,
      whatToDo: 'Look at the rents listed in your estate before the survey comes out.',
      resolutionCriteria: 'Yes if the survey report is on the county website on that day.',
      category: 'prices',
      regions: ['KE'],
      probability: 0.4,
      rationale: 'Two of the last five surveys were published on the announced day.',
      sources: [SOURCE],
      resolvesOn: day(30),
    },
  });
  expect(published.status).toBe(201);
  const id = published.body.id;

  await page.goto('/admin/forecasts');
  const item = page.getByRole('listitem').filter({ hasText: question });
  await item.getByRole('link', { name: `Edit details: ${question}` }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/forecasts/${id}$`));
  await expect(page.getByRole('heading', { name: 'Edit forecast details' })).toBeVisible();
  // The question is there to read, not to change.
  await expect(page.getByText(question)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Question', exact: true })).toHaveCount(0);

  await page.getByLabel('What people can do about it').first().fill(advice);
  await page.getByLabel('Countries').fill('KE, TZ');

  // A translation started without its question is checked like any other, not dropped while
  // the form says it saved: nothing is saved until it is put right.
  await page.getByRole('button', { name: 'In Español (optional)' }).click();
  const es = page.getByRole('group', { name: 'In Español (optional)' });
  await es
    .getByLabel('What people can do about it')
    .fill('Pregunta en la oficina de vivienda del condado qué barrios cubre la encuesta.');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Some fields need attention.' }),
  ).toBeVisible();
  await expect(page.getByText('Forecast details saved')).toHaveCount(0);
  const unsaved = await call<{ whatToDo: string; translations: Record<string, unknown> }>(
    page,
    `/api/admin/forecasts/${id}`,
  );
  expect(unsaved.body.whatToDo).not.toBe(advice);
  expect(unsaved.body.translations).toEqual({});
  await es.getByLabel('What people can do about it').fill('');

  await page.getByRole('button', { name: 'In Kiswahili (optional)' }).click();
  const sw = page.getByRole('group', { name: 'In Kiswahili (optional)' });
  await expect(sw.getByText('Once saved, a translation’s question')).toBeVisible();
  await sw.getByLabel('Question').fill(swQuestion);
  await sw
    .getByLabel('What people can do about it')
    .fill('Uliza ofisi ya makazi ya kaunti ni mitaa ipi imo kwenye utafiti.');
  await sw
    .getByLabel('How it will be judged')
    .fill('Ndiyo ikiwa ripoti ya utafiti iko kwenye tovuti ya kaunti siku hiyo.');
  expect(await seriousProblems(page)).toEqual([]);
  await snap(page, testInfo, 'admin-forecast-edit');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Forecast details saved')).toBeVisible();

  // Saved: the translation's question is now shown as fixed, with no field to change it.
  const saved = page.getByRole('group', { name: 'In Kiswahili', exact: true });
  await expect(saved.getByText(swQuestion)).toBeVisible();
  await expect(
    saved.getByText('This translation’s question and how it is judged are fixed'),
  ).toBeVisible();
  await expect(saved.getByRole('textbox', { name: 'Question' })).toHaveCount(0);
  await expect(saved.getByRole('textbox', { name: 'How it will be judged' })).toHaveCount(0);
  // …and the server agrees, whoever asks.
  const moved = await call(page, `/api/admin/forecasts/${id}`, {
    method: 'PATCH',
    json: {
      translations: {
        sw: {
          question: `Je, kaunti itachapisha utafiti wa ajira ${RUN} kabla ya tarehe?`,
          whatToDo: 'Uliza ofisi ya makazi ya kaunti ni mitaa ipi imo kwenye utafiti.',
          resolutionCriteria:
            'Ndiyo ikiwa ripoti ya utafiti iko kwenye tovuti ya kaunti siku hiyo.',
        },
      },
    },
  });
  expect(moved.status).toBe(422);

  // People see the new advice, and Kiswahili readers the question in their language.
  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  await pub.goto('/signals/forecasts');
  const card = pub.getByRole('article').filter({ hasText: question });
  await expect(card.getByText(advice)).toBeVisible();
  await expect(card.getByText('Kenya and Tanzania')).toBeVisible();
  await visitor.addCookies([{ name: 'NEXT_LOCALE', value: 'sw', url: baseURL ?? '' }]);
  await pub.goto('/signals/forecasts');
  await expect(pub.getByRole('heading', { name: swQuestion })).toBeVisible();
  await visitor.clearCookies();

  // The outcome is recorded by this member of staff: the only one this server has.
  const judged = await call(page, `/api/admin/forecasts/${id}/judge`, {
    json: {
      outcome: 'no',
      note: 'The county has moved the survey to next quarter.',
      sourceUrl: SOURCE.url,
    },
  });
  expect(judged.status).toBe(200);
  await page.goto('/admin/forecasts?state=unchecked');
  const waiting = page.getByRole('listitem').filter({ hasText: question });
  await expect(
    waiting.getByText(
      'Awaiting a second check. You recorded this outcome, so someone else has to confirm it.',
    ),
  ).toBeVisible();
  // They cannot be their own second check: no button, and the server refuses.
  await expect(waiting.getByRole('button', { name: /^Confirm the outcome/ })).toHaveCount(0);
  const own = await call(page, `/api/admin/forecasts/${id}/confirm`, { json: {} });
  expect(own.status).toBe(403);
  expect(await noSidewaysScroll(page)).toBe(true);
  expect(await seriousProblems(page)).toEqual([]);
  await snap(page, testInfo, 'admin-forecast-second-check');
  // Judged, it can no longer be edited, and the edit page says so.
  await page.goto(`/admin/forecasts/${id}`);
  await expect(page.getByText('This forecast can no longer be changed')).toBeVisible();

  // In public the verdict stands, and says its second check is missing.
  await pub.goto('/signals/forecasts/record');
  const record = pub.getByRole('article').filter({ hasText: question });
  await expect(record.getByText('It didn’t happen', { exact: true })).toBeVisible();
  await expect(record.getByText('Not yet double-checked', { exact: false })).toBeVisible();
  await expect(pub.getByText(/outcomes? ha(s|ve) not been double-checked yet/)).toBeVisible();
  await expect(
    pub.getByText('A second member of staff checks each outcome.', { exact: false }),
  ).toBeVisible();
  expect(await seriousProblems(pub)).toEqual([]);
  await snap(pub, testInfo, 'forecast-not-double-checked');
  await visitor.close();

  await page.goto('/admin/audit');
  await expect(page.getByText('Forecast details changed').first()).toBeVisible();
});

/**
 * Chooses what the feedback is about. The option is chosen with the keyboard, and the list is
 * gone before anything else is pressed: while it slides in or fades out it sits over the
 * form, and a press by position could land on the wrong option or on the list itself.
 */
async function chooseTopic(page: Page, topic: string) {
  await page.getByRole('button', { name: /What is it about\?/ }).click();
  const list = page.getByRole('listbox');
  await list.getByRole('option', { name: topic }).press('Enter');
  await expect(list).toBeHidden();
  await expect(page.getByRole('button', { name: /What is it about\?/ })).toContainText(topic);
}

test('anyone can tell us what worked or what didn’t, from Settings', async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  await startAsGuest(page, 'Baraka');
  await page.goto('/settings');
  await page.getByRole('link', { name: /Tell us what worked, or what didn’t/ }).click();
  await expect(page).toHaveURL(/\/settings\/feedback$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Tell us what worked, or what didn’t',
  );
  // A guest has no address to reply to, so no reply is offered.
  await expect(page.getByRole('checkbox', { name: 'I’d like a reply' })).toHaveCount(0);

  // An empty note is not sent.
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Write a few words or choose a number first.',
  );

  await chooseTopic(page, 'Shield');
  await page.getByRole('radio', { name: '2', exact: true }).check({ force: true });
  await page.getByLabel('What happened?').fill('The scam check took a long time on my phone.');
  expect(await noSidewaysScroll(page)).toBe(true);
  expect(await seriousProblems(page)).toEqual([]);
  await snap(page, testInfo, 'feedback-form');

  // The same form in Arabic on a dark screen, before anything is sent.
  await inArabicAndDark(context, baseURL ?? '', true);
  await page.goto('/settings/feedback');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    messages('ar').settings.feedbackTitle as string,
  );
  expect(await noSidewaysScroll(page)).toBe(true);
  expect(await seriousProblems(page)).toEqual([]);
  await snap(page, testInfo, 'feedback-form-ar-dark');
  await inArabicAndDark(context, baseURL ?? '', false);
  await page.goto('/settings/feedback');
  await chooseTopic(page, 'Shield');
  await page.getByRole('radio', { name: '2', exact: true }).check({ force: true });
  await page.getByLabel('What happened?').fill('The scam check took a long time on my phone.');
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.getByText('Thank you. Your feedback has been sent.')).toBeVisible();
  // The words are cleared, so they are not sent twice.
  await expect(page.getByLabel('What happened?')).toHaveValue('');
});

test('feedback reaches staff without saying who a guest is @desktop', async ({
  page,
  browser,
}, testInfo) => {
  needsStaff();
  test.setTimeout(180_000);
  // A guest writes, with a phone number in the message.
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await startAsGuest(guest, 'Zuhura');
  const words = `Guest note ${RUN}: the help lines page was clear.`;
  const sent = await call(guest, '/api/feedback', {
    json: {
      module: 'support',
      rating: 4,
      message: `${words} Call me on +254 712 345 678.`,
      wantsReply: true,
    },
  });
  expect(sent.status).toBe(201);
  const me = await call<{ user: { id: string } }>(guest, '/api/me');
  await guestContext.close();

  // Staff have an account with an address, so they are offered a reply.
  await signInAsStaff(page);
  await page.goto('/settings/feedback?about=signals');
  const reply = page.getByRole('checkbox', { name: 'I’d like a reply' });
  await expect(
    page.getByText(`A reply would go to ${STAFF.email}.`, { exact: false }),
  ).toBeVisible();
  await reply.check({ force: true });
  const staffWords = `Staff note ${RUN}: adding a signal took one minute.`;
  await page.getByLabel('What happened?').fill(staffWords);
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.getByText('Thank you. Your feedback has been sent.')).toBeVisible();

  await page.goto('/admin/feedback');
  await expect(page.getByRole('heading', { name: 'Feedback', level: 2 })).toBeVisible();
  const mine = page.getByRole('listitem').filter({ hasText: staffWords });
  await expect(mine.getByText('Signals', { exact: true })).toBeVisible();
  await expect(mine.getByRole('link', { name: STAFF.email })).toHaveAttribute(
    'href',
    `mailto:${STAFF.email}`,
  );
  const theirs = page.getByRole('listitem').filter({ hasText: words });
  await expect(theirs.getByText('Get help now', { exact: true })).toBeVisible();
  await expect(theirs.getByText('Rated 4 of 5')).toBeVisible();
  // The phone number was removed before the message was kept, and nothing names the guest.
  await expect(theirs).not.toContainText('712');
  await expect(theirs.getByRole('link')).toHaveCount(0);
  await expect(page.getByRole('main')).not.toContainText(me.body.user.id);
  // Newest first: the staff note was sent after the guest's.
  const order = await page
    .getByRole('main')
    .getByRole('listitem')
    .evaluateAll((items) => items.map((i) => i.textContent ?? ''));
  expect(order.findIndex((text) => text.includes(staffWords))).toBeLessThan(
    order.findIndex((text) => text.includes(words)),
  );
  expect(await noSidewaysScroll(page)).toBe(true);
  expect(await seriousProblems(page)).toEqual([]);
  await snap(page, testInfo, 'admin-feedback');
});
