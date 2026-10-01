/**
 * "What's next?": forecasts are published and judged by staff, never invented. With none
 * published the pages say so; once one is published people see its chance in a number and in
 * words, its sources, what to do and the day it will be judged; once judged it is on the
 * public record, which shows no score until enough forecasts have been judged.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { APIRequestContext, Page } from '@playwright/test';
import { expect, snap, test } from './fixtures';
import { STAFF } from './staff';

const LOCALES = ['en', 'hi', 'es', 'fr', 'pt', 'ar', 'sw'] as const;

/** The forecast texts as the message files have them, so the test and the page can't drift. */
function messages(locale: string) {
  const file = join(import.meta.dirname, '../../../packages/i18n/messages', `${locale}.json`);
  return (JSON.parse(readFileSync(file, 'utf8')) as { forecasts: Record<string, string> })
    .forecasts;
}

// A question of its own for every run, so a retry (or a second run against the same server)
// never meets the forecast an earlier run left behind: forecasts cannot be deleted.
const RUN = Date.now().toString(36);
const QUESTION = `Will the statistics office publish labour survey ${RUN} by the due date?`;
const ADVICE = 'Look at the vacancies listed in your county before the survey comes out.';
const CRITERIA = 'Yes if the survey report is on the statistics office website on that day.';
const SOURCE = { name: 'Kenya National Bureau of Statistics', url: 'https://www.knbs.or.ke/' };

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

type Counts = { open: number; awaiting: number; judged: number; annulled: number };
const counts = async (request: APIRequestContext) =>
  (await (await request.get('/api/forecasts/record')).json()) as Counts;

async function signInAsStaff(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(STAFF.email);
  await page.getByLabel('Password').fill(STAFF.password);
  await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/($|start)/);
}

test('with no forecast published, every language says so and nothing is made up @desktop', async ({
  page,
  context,
  baseURL,
  request,
}, testInfo) => {
  const c = await counts(request);
  test.skip(
    c.open + c.awaiting + c.judged + c.annulled > 0,
    'this server already has forecasts (the empty pages are checked on a fresh one)',
  );
  for (const locale of LOCALES) {
    const m = messages(locale);
    await context.addCookies([{ name: 'NEXT_LOCALE', value: locale, url: baseURL ?? '' }]);
    await page.goto('/signals/forecasts');
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.getByRole('heading', { level: 1 }), locale).toHaveText(m.title as string);
    await expect(page.getByText(m.empty as string), locale).toBeVisible();
    await expect(page.getByText(m.honest as string), locale).toBeVisible();
    await expect(page.getByRole('link', { name: m.emptyAction as string })).toBeVisible();
    // Not one forecast, and no percentage anywhere on the page.
    await expect(page.getByRole('main').getByRole('article')).toHaveCount(0);
    await expect(page.getByRole('meter')).toHaveCount(0);

    await page.goto('/signals/forecasts/record');
    await expect(page.getByRole('heading', { level: 1 }), locale).toHaveText(
      m.recordTitle as string,
    );
    await expect(page.getByText(m.recordEmpty as string), locale).toBeVisible();
    await expect(page.getByRole('heading', { name: m.howTitle as string })).toBeVisible();
    await expect(page.getByText(m.scoreLabel as string)).toHaveCount(0);
  }
  await context.addCookies([{ name: 'NEXT_LOCALE', value: 'en', url: baseURL ?? '' }]);
  await page.goto('/signals/forecasts');
  await snap(page, testInfo, 'forecasts-empty');
});

test('staff publish a forecast, people see it, staff judge it, and it goes on the record @desktop', async ({
  page,
  browser,
  baseURL,
  request,
}, testInfo) => {
  test.skip(
    Boolean(process.env.E2E_BASE_URL),
    'needs the staff account that only the test server creates',
  );
  test.setTimeout(240_000);
  const before = await counts(request);
  await signInAsStaff(page);
  await page.goto('/admin/forecasts');
  await expect(page.getByRole('heading', { name: 'Forecasts', level: 2 })).toBeVisible();

  // Nothing about the future is certain: 100% is refused, whoever asks.
  const day = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const certain = await page.request.post('/api/admin/forecasts', {
    data: {
      question: QUESTION,
      whatToDo: ADVICE,
      resolutionCriteria: CRITERIA,
      category: 'jobs',
      probability: 1,
      rationale: 'It has been on time for years.',
      sources: [SOURCE],
      resolvesOn: day,
    },
  });
  expect(certain.status()).toBe(422);
  // …and so is a forecast with no source.
  const unsourced = await page.request.post('/api/admin/forecasts', {
    data: {
      question: QUESTION,
      whatToDo: ADVICE,
      resolutionCriteria: CRITERIA,
      category: 'jobs',
      probability: 0.62,
      rationale: 'It has been on time for years.',
      sources: [],
      resolvesOn: day,
    },
  });
  expect(unsourced.status()).toBe(422);

  const form = page.locator('#publish');
  await form.getByLabel('Question', { exact: true }).first().fill(QUESTION);
  await form.getByLabel('What people can do about it').first().fill(ADVICE);
  await form.getByLabel('How it will be judged').first().fill(CRITERIA);
  await form.getByLabel('Countries').fill('KE');
  const chance = form.getByLabel('Chance, in percent');
  await chance.fill('72');
  await chance.blur();
  await form
    .getByLabel('Why this chance')
    .fill('Six of the last eight surveys were published on the day that was announced.');
  await form.getByLabel('Sources').fill(`${SOURCE.name}, ${SOURCE.url}`);
  await form.getByLabel('Day it will be judged').fill(day);
  await form.getByRole('button', { name: 'Publish forecast' }).click();
  await expect(page.getByText('Forecast published')).toBeVisible();
  await expect(page.getByRole('heading', { name: QUESTION })).toBeVisible();
  await snap(page, testInfo, 'admin-forecasts');

  // Staff learn something new and change the chance, saying why.
  const item = page.getByRole('listitem').filter({ hasText: QUESTION });
  await item.getByRole('button', { name: 'Change the chance' }).click();
  const next = item.getByLabel('Chance, in percent');
  await next.fill('80');
  await next.blur();
  await item
    .getByLabel('Why this chance')
    .fill('The office has now confirmed the publication date in its calendar.');
  await item.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Chance updated')).toBeVisible();

  // Someone with no account, on the other side of the world, sees it: the chance as a number
  // and in words, what to do, where the chance comes from, and the day it will be judged —
  // the day staff chose, not the evening before it.
  const visitor = await browser.newContext({ timezoneId: 'America/Bogota' });
  await visitor.addCookies([{ name: 'wp-tz', value: 'America/Bogota', url: baseURL ?? '' }]);
  const pub = await visitor.newPage();
  await pub.goto('/signals/forecasts');
  const card = pub.getByRole('article').filter({ hasText: QUESTION });
  await expect(card.getByRole('heading', { name: QUESTION })).toBeVisible();
  const meter = card.getByRole('meter', { name: 'Chance this happens' });
  await expect(meter).toHaveAttribute('aria-valuenow', '80');
  await expect(card.getByText('80%').first()).toBeVisible();
  await expect(card.getByText('Likely', { exact: true })).toBeVisible();
  await expect(card.getByText('What you can do')).toBeVisible();
  await expect(card.getByText(ADVICE)).toBeVisible();
  await expect(card.getByRole('link', { name: SOURCE.name })).toHaveAttribute('href', SOURCE.url);
  const chosenDay = new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));
  await expect(card.locator(`time[datetime^="${day}"]`)).toHaveText(`Judged on ${chosenDay}`);
  await expect(card.getByText('Kenya', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'How it will be judged' }).click();
  await expect(card.getByText(CRITERIA)).toBeVisible();
  // Every chance it has shown is there for anyone to see, not only the latest.
  await card.getByRole('button', { name: 'Every chance it has shown' }).click();
  const shown = card.getByRole('list', { name: 'Every chance it has shown' });
  await expect(shown.getByRole('listitem')).toHaveCount(2);
  await expect(shown.getByRole('listitem').first()).toContainText('72%');
  await expect(shown.getByRole('listitem').last()).toContainText('80%');
  await expect(pub.getByText('No forecasts have been published yet.')).toHaveCount(0);
  expect(await noSidewaysScroll(pub)).toBe(true);
  expect(await seriousProblems(pub)).toEqual([]);
  await snap(pub, testInfo, 'forecasts-open');

  // The same page with a forecast on it, on a small phone, in the dark, in Arabic.
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await phone.addCookies([
    { name: 'NEXT_LOCALE', value: 'ar', url: baseURL ?? '' },
    { name: 'wp-theme', value: 'dark', url: baseURL ?? '' },
  ]);
  const small = await phone.newPage();
  await small.goto('/signals/forecasts');
  await expect(small.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(small.getByRole('article').filter({ hasText: QUESTION })).toBeVisible();
  expect(await noSidewaysScroll(small)).toBe(true);
  expect(await seriousProblems(small)).toEqual([]);
  await snap(small, testInfo, 'forecasts-open-phone-dark-ar');

  // The record counts it as still ahead, and says nothing about accuracy it cannot show.
  await pub.goto('/signals/forecasts/record');
  if (before.judged + before.annulled === 0)
    await expect(pub.getByText('No forecast has been judged yet.')).toBeVisible();

  // Staff record the outcome, with where anyone can check it.
  await item.getByRole('button', { name: 'Judge this forecast' }).click();
  // The panel grows open: press the choice as a person would, once it has stopped moving (a
  // forced press on the hidden input could land outside the panel while it was still opening).
  await item.getByText('It happened', { exact: true }).click();
  await expect(item.getByRole('radio', { name: 'It happened' })).toBeChecked();
  await item
    .getByLabel('What happened, or why it can’t be judged')
    .fill('The survey report was published on the announced day.');
  await item.getByLabel('Where anyone can check it (https://…)').fill(SOURCE.url);
  await item.getByRole('button', { name: 'Record the outcome' }).click();
  await expect(page.getByText('Outcome recorded')).toBeVisible();
  // It has left the open list and cannot be judged twice.
  await expect(page.getByRole('heading', { name: QUESTION })).toHaveCount(0);

  await pub.goto('/signals/forecasts/record');
  await expect(pub.getByText('Forecasts judged')).toBeVisible();
  const judgedNow = before.judged + 1;
  if (judgedNow < 10) {
    // A few judged forecasts are not a track record: no score, and the page says why.
    await expect(
      pub.getByText(
        `Judged so far: ${judgedNow}. A score means little before 10, so we don’t show one yet.`,
      ),
    ).toBeVisible();
    await expect(pub.getByText('Average score')).toHaveCount(0);
    await expect(pub.getByRole('table')).toHaveCount(0);
  }
  const judged = pub.getByRole('article').filter({ hasText: QUESTION });
  await expect(judged.getByText('It happened', { exact: true })).toBeVisible();
  await expect(judged.getByText('We said 80%: Likely')).toBeVisible();
  await expect(judged.getByRole('link', { name: 'Check the outcome' })).toHaveAttribute(
    'href',
    SOURCE.url,
  );
  // Its own score, and every chance it showed on the way, stay on the record.
  await expect(judged.getByText(/^Score for this forecast: 0[.,]\d+/)).toBeVisible();
  const kept = judged.getByRole('list', { name: 'Every chance it has shown' });
  await expect(kept.getByRole('listitem')).toHaveCount(2);
  expect(await noSidewaysScroll(pub)).toBe(true);
  expect(await seriousProblems(pub)).toEqual([]);
  await snap(pub, testInfo, 'forecasts-record');
  await small.goto('/signals/forecasts/record');
  await expect(small.getByRole('article').filter({ hasText: QUESTION })).toBeVisible();
  expect(await noSidewaysScroll(small)).toBe(true);
  expect(await seriousProblems(small)).toEqual([]);
  await snap(small, testInfo, 'forecasts-record-phone-dark-ar');
  await phone.close();
  await visitor.close();

  // All three actions are in the staff activity log.
  await page.goto('/admin/audit');
  await expect(page.getByText('Forecast published').first()).toBeVisible();
  await expect(page.getByText('Forecast chance changed').first()).toBeVisible();
  await expect(page.getByText('Forecast judged').first()).toBeVisible();
});

test('What’s next? and the record read right to left in Arabic and fit the screen', async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  const m = messages('ar');
  await context.addCookies([{ name: 'NEXT_LOCALE', value: 'ar', url: baseURL ?? '' }]);
  for (const [path, title] of [
    ['/signals/forecasts', m.title],
    ['/signals/forecasts/record', m.recordTitle],
  ] as const) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title as string);
    // The three sections of Signals are one tap away from each other.
    const nav = page.getByRole('navigation', { name: m.navLabel as string });
    await expect(nav.getByRole('link')).toHaveCount(3);
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    expect(await noSidewaysScroll(page), path).toBe(true);
  }
  await snap(page, testInfo, 'forecasts-record-ar');
});
