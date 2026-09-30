/**
 * Shared test set-up: every page is watched for script errors and failed requests, so a
 * broken page fails its test even when what the test looks at still renders.
 */
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test as base, expect, type Page, type TestInfo } from '@playwright/test';

/** Browser noise that says nothing about Waypoint itself. */
const IGNORED = [
  /net::ERR_ABORTED/, // a navigation cancelled a request in flight
  // Refusals the tests ask for on purpose (a guest's 401, someone else's 404) are checked
  // where they happen; the browser also logs each one.
  /Failed to load resource: the server responded with a status of 4\d\d/,
  /Download the React DevTools/,
  /\[Fast Refresh\]/,
];

export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const text = message.text();
        if (!IGNORED.some((re) => re.test(text))) problems.push(`console: ${text}`);
      });
      page.on('response', (response) => {
        // Expected refusals (401 for a guest, 404 for someone else's things) are tested
        // directly; a server error anywhere is a bug.
        if (response.status() >= 500) problems.push(`${response.status()} ${response.url()}`);
      });
      await use(problems);
      expect(problems, 'errors while the test ran').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** A full-page screenshot saved with the test's results, for looking over by eye. */
export async function snap(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

/**
 * The first visit as a guest: welcome → getting started (all five steps, nothing required) →
 * Today. Returns once the guest session exists.
 */
export async function startAsGuest(page: Page, name = 'Amani'): Promise<void> {
  await page.goto('/welcome');
  await page.getByRole('link', { name: 'Get started' }).first().click();
  await expect(page).toHaveURL(/\/start/);
  await page.getByLabel('What should we call you?').fill(name);
  for (let step = 0; step < 4; step++) {
    await page.getByRole('button', { name: 'Continue' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Your choices' })).toBeVisible();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
}

/** The file the test server's mail catcher writes to (set in playwright.config.ts). */
const mailFile = () =>
  process.env.E2E_MAIL_FILE ??
  join(tmpdir(), `waypoint-e2e-mail-${Number(process.env.E2E_PORT ?? 3100)}.jsonl`);

/** Quoted-printable (how email bodies wrap long lines) back to plain text. */
const unwrap = (raw: string) =>
  raw
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));

/**
 * Waits for an email to `to` whose link contains `pathPart`, and returns that link — as a
 * person would find it in their inbox. Only emails caught by the test server's mail catcher.
 */
export async function linkFromEmail(to: string, pathPart: string): Promise<string> {
  let found: string | undefined;
  await expect
    .poll(
      () => {
        const file = mailFile();
        if (!existsSync(file)) return undefined;
        const mails = readFileSync(file, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line) as { to: string[]; raw: string })
          .filter((m) => m.to.includes(to.toLowerCase()));
        for (const mail of mails.reverse()) {
          const links = unwrap(mail.raw).match(/https?:\/\/[^\s"<>]+/g) ?? [];
          found = links.find((l) => l.includes(pathPart));
          if (found) return found;
        }
        return undefined;
      },
      { message: `an email to ${to} with a ${pathPart} link`, timeout: 30_000 },
    )
    .toBeTruthy();
  return (found as string).replace(/&amp;/g, '&');
}
