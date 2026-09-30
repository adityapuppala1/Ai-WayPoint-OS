/**
 * Things Waypoint tells people it does, checked in a real browser: a plan's steps and Today's
 * next step only lead to pages that exist; a goal or weekly review that suggests danger gets
 * the support card; Privacy offers only choices that change something; a trusted contact can
 * be reached with one tap from the support card (through the phone's own apps, Waypoint sends
 * nothing); and the person can see what Waypoint remembers.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, snap, startAsGuest, test } from './fixtures';

type Messages = {
  a11y: { call: string; text: string };
  ask: { inputLabel: string; send: string };
  consents: Record<string, string>;
  settings: Record<string, string>;
  support: Record<string, string>;
};

/** The texts as the message files have them, so the test and the page can't drift. */
function messages(locale: string): Messages {
  const file = join(import.meta.dirname, '../../../packages/i18n/messages', `${locale}.json`);
  return JSON.parse(readFileSync(file, 'utf8')) as Messages;
}
const EN = messages('en');

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

const noSidewaysScroll = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );

const DANGER = 'I want to end my life tonight';
const CARD = 'Your safety matters most right now.';

test('a plan’s steps and Today’s next step only lead to pages that exist @desktop', async ({
  page,
}) => {
  await startAsGuest(page, 'Zawadi');
  type Step = { id: string; title: string; kind: string; href: string | null };
  const made = await call<{ id: string; weeks: Array<{ steps: Step[] }> }>(
    page,
    '/api/path/plans',
    { json: { hoursPerWeek: 6, horizonWeeks: 4 } },
  );
  expect(made.status).toBe(201);
  const plan = made.body;
  const steps = plan.weeks.flatMap((w) => w.steps);

  await page.goto(`/path/plans/${plan.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // Nothing on the plan promises a credential: none is issued.
  await expect(page.getByRole('main')).not.toContainText(/verified|credential/i);
  // Every "Start" link on the plan opens a real page.
  const hrefs = await page
    .getByRole('main')
    .getByRole('link', { name: 'Start', exact: true })
    .evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute('href') as string))]);
  expect(hrefs.length).toBeGreaterThan(0);
  expect(hrefs).toEqual(steps.map((s) => s.href).filter((h, i, all) => h && all.indexOf(h) === i));
  for (const href of hrefs) {
    const res = await page.request.get(href);
    expect(res.status(), href).toBe(200);
  }

  // The proof weeks: the project step used to send Today's one bold button to "not found".
  const project = steps.findIndex((s) => s.kind === 'build' && /project/.test(s.title));
  expect(project).toBeGreaterThan(0);
  for (const step of steps.slice(0, project)) {
    const done = await call(page, `/api/path/plans/${plan.id}/steps/${step.id}`, {
      method: 'PATCH',
      json: { status: 'done' },
    });
    expect(done.status).toBe(200);
  }
  const today = await call<{ nextStep: { stepId: string; href: string } }>(page, '/api/today');
  expect(today.body.nextStep.stepId).toBe(steps[project]!.id);
  // From somewhere else, as from Today (a link to the page already open would not reload it).
  await page.goto('/goals');
  const opened = await page.goto(today.body.nextStep.href);
  expect(opened?.status()).toBe(200);
  await expect(page.getByText("This page doesn't exist")).toHaveCount(0);
  // The step itself, on the plan (the link carries its anchor).
  await expect(page.locator(`#step-${steps[project]!.id}`)).toContainText(steps[project]!.title);
  // Without a chosen role the step has wording of its own, not a sentence with a hole in it.
  expect(steps[project]!.title).toBe('Make a small project that shows what you can do');
});

/** This page's own data refresh after a save (its server component request), once answered. */
const refreshOf = (page: Page) => {
  const path = new URL(page.url()).pathname;
  return page.waitForResponse(
    (r) =>
      r.request().method() === 'GET' &&
      new URL(r.url()).pathname === path &&
      r.url().includes('_rsc='),
  );
};

test('a goal or a weekly review that suggests danger brings the support card', async ({
  page,
}, testInfo) => {
  await startAsGuest(page, 'Nia');
  await page.goto('/goals');
  await page.getByLabel('What do you want to do?').fill('Get through this month');
  await page.getByLabel('Why does it matter to you?').fill(DANGER);
  // Saving refreshes the page's data; the test reloads only once that answer is in, as a
  // person would. (A reload that cuts the refresh off is logged as an error in Firefox.)
  let refreshed = refreshOf(page);
  await page.getByRole('button', { name: 'Save goal' }).click();
  const card = page.getByRole('region', { name: CARD });
  await expect(card).toBeVisible();
  await expect(card.locator('a[href^="tel:"]').first()).toBeVisible();
  // The goal is saved all the same: nobody is refused for what they wrote.
  await expect(page.getByText('Get through this month')).toBeVisible();
  expect(await noSidewaysScroll(page)).toBe(true);
  await snap(page, testInfo, 'goal-support-card');

  // A fresh look at the page: the weekly review is read the same way.
  await refreshed;
  await page.reload();
  await expect(page.getByRole('region', { name: CARD })).toHaveCount(0);
  await page.getByLabel('What went well?').fill('I asked for help');
  await page.getByLabel('What got in the way?').fill(DANGER);
  refreshed = refreshOf(page);
  await page.getByRole('button', { name: 'Save review' }).click();
  await expect(page.getByRole('region', { name: CARD })).toBeVisible();
  // An ordinary review gets the ordinary answer.
  await refreshed;
  await page.reload();
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('What got in the way?').fill('The bus was late twice');
  await page.getByRole('button', { name: 'Save review' }).click();
  await expect(page.getByText('Review saved. See you next week.')).toBeVisible();
  await expect(page.getByRole('region', { name: CARD })).toHaveCount(0);
});

test('a guest adds trusted contacts and reaches them with one tap from the support card', async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  await startAsGuest(page, 'Amina');
  await page.goto('/settings/privacy');

  // Only choices that change something are offered: no report exists, so no such switch.
  await expect(page.getByRole('switch', { name: EN.consents.memory as string })).toBeVisible();
  await expect(
    page.getByRole('switch', { name: EN.consents.research_aggregates as string }),
  ).toHaveCount(0);

  // A contact with a phone number, typed the way people type numbers.
  await page.getByRole('button', { name: 'Add a trusted contact' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Asha');
  await page.getByRole('textbox', { name: 'Phone' }).fill('+254 (700) 000-001');
  await page.getByRole('textbox', { name: 'Relationship' }).fill('sister');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Asha', { exact: true })).toBeVisible();
  // Saving a contact is not the same as choosing to see them on the card: the page says so.
  const choice = EN.consents.trusted_contact as string;
  const hint = (EN.settings.trustedOff as string).replace('{setting}', choice);
  await expect(page.getByText(hint)).toBeVisible();
  await page.getByText(choice, { exact: true }).click();
  await expect(page.getByText('Choice saved')).toBeVisible();
  await expect(page.getByText(hint)).toHaveCount(0);

  // A second contact with only an email address.
  await page.getByRole('button', { name: 'Add a trusted contact' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Baraka');
  await page.getByRole('textbox', { name: 'Email' }).fill('baraka@example.org');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Baraka', { exact: true })).toBeVisible();

  // The moment it is for: a message that needs the support card.
  await page.goto('/ask');
  await page.getByLabel('Your message').fill(DANGER);
  await page.getByRole('button', { name: 'Send' }).click();
  const card = page.getByRole('region', { name: CARD });
  await expect(card).toBeVisible();
  const message = encodeURIComponent(EN.support.contactMessage as string);
  const text = card.getByRole('link', { name: 'Text Asha' });
  await expect(text).toBeVisible();
  // The phone's own messaging app, the contact's own number, a calm message to edit or send.
  await expect(text).toHaveAttribute('href', `sms:+254700000001?&body=${message}`);
  await expect(card.getByRole('link', { name: 'Call Asha' })).toHaveAttribute(
    'href',
    'tel:+254700000001',
  );
  await expect(card.getByRole('link', { name: 'Email Baraka' })).toHaveAttribute(
    'href',
    `mailto:baraka@example.org?subject=${encodeURIComponent(
      EN.support.contactSubject as string,
    )}&body=${message}`,
  );
  await expect(card.getByRole('link', { name: 'Text Baraka' })).toHaveCount(0);
  await expect(card.getByText(EN.support.contactNote as string)).toBeVisible();
  // Nothing clinical in the words someone else will read.
  expect(EN.support.contactMessage).not.toMatch(/suicid|crisis|emergency|danger|harm/i);
  // Big enough to hit with a thumb, and nothing pushed off the screen.
  for (const name of ['Text Asha', 'Call Asha', 'Email Baraka']) {
    const box = await card.getByRole('link', { name }).boundingBox();
    expect(box?.height ?? 0, name).toBeGreaterThanOrEqual(44);
  }
  expect(await noSidewaysScroll(page)).toBe(true);
  // The help lines still come first.
  await expect(card.locator('a[href^="tel:"]').first()).not.toHaveAttribute(
    'href',
    'tel:+254700000001',
  );
  // The card alone: on a full-page picture the message box, which stays in view, covers it.
  await card.screenshot({ path: testInfo.outputPath('support-card-contacts.png') });

  // In the person's own language: the same card in Spanish.
  const ES = messages('es');
  expect(
    (await call(page, '/api/me/profile', { method: 'PATCH', json: { locale: 'es' } })).status,
  ).toBe(200);
  await context.addCookies([{ name: 'NEXT_LOCALE', value: 'es', url: baseURL ?? '' }]);
  await page.goto('/ask');
  await page.getByLabel(ES.ask.inputLabel).fill('Quiero suicidarme esta noche');
  await page.getByRole('button', { name: ES.ask.send }).click();
  const escribir = page.getByRole('link', { name: ES.a11y.text.replace('{name}', 'Asha') });
  await expect(escribir).toBeVisible();
  await expect(escribir).toHaveAttribute(
    'href',
    `sms:+254700000001?&body=${encodeURIComponent(ES.support.contactMessage as string)}`,
  );
  await expect(page.getByText(ES.support.contactNote as string)).toBeVisible();
});

test('Privacy shows what Waypoint remembers, and says what switching memory off does', async ({
  page,
}, testInfo) => {
  await startAsGuest(page, 'Otieno');
  await page.goto('/settings/privacy');
  const panel = page.getByRole('region', { name: EN.settings.memoryTitle as string });
  await expect(panel).toBeVisible();
  await expect(panel.getByText(EN.settings.memoryLead as string)).toBeVisible();
  // Nothing was ever remembered for a new guest, and the page says so instead of a blank.
  await expect(panel.getByText(EN.settings.memoryEmpty as string)).toBeVisible();
  await expect(
    panel.getByRole('button', { name: EN.settings.memoryForgetAll as string }),
  ).toHaveCount(0);
  // The list is the person's own, from the same place the panel reads.
  const mine = await call<unknown[]>(page, '/api/me/memories');
  expect(mine).toEqual({ status: 200, body: [] });

  // Memory is off to begin with. The panel says plainly what "off" means: nothing new is
  // saved or used, and what is listed stays until the person deletes it.
  const choice = EN.consents.memory as string;
  const off = (EN.settings.memoryOff as string).replace('{setting}', choice);
  await expect(panel.getByText(off)).toBeVisible();
  await page.getByText(choice, { exact: true }).click();
  await expect(page.getByText('Choice saved')).toBeVisible();
  await expect(panel.getByText(off)).toHaveCount(0);
  await page.getByText(choice, { exact: true }).click();
  await expect(panel.getByText(off)).toBeVisible();
  expect(await noSidewaysScroll(page)).toBe(true);
  await snap(page, testInfo, 'privacy-memory');

  // The public notice lists the choices that are offered (no trend reports: there are none)
  // and says where memories can be seen and deleted.
  await page.goto('/privacy');
  const notice = page.getByRole('article');
  await expect(notice.getByText(choice, { exact: true })).toBeVisible();
  await expect(notice.getByText(EN.consents.research_aggregates as string)).toHaveCount(0);
  await expect(notice.getByText(/trend reports/i)).toHaveCount(0);
  await expect(
    notice.getByText(/Settings → Privacy & data → What Waypoint remembers/),
  ).toBeVisible();
});
