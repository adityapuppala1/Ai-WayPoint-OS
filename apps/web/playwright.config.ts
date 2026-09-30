/**
 * End-to-end tests: the real app, in real browsers, at phone and desktop widths. Five
 * projects: `desktop` and `phone` (Chrome), `firefox`, and `safari` and `iphone` (WebKit, the
 * engine of Safari and of every browser on an iPhone).
 *
 *   pnpm --filter @waypoint/web build      # once (or E2E_DEV=1 to test `next dev` instead)
 *   pnpm --filter @waypoint/web exec playwright install      # once: the three browsers
 *   pnpm test:e2e                          # all five, or add --project=firefox for one
 *
 * The server starts with a fresh embedded database in the system temp folder (never your own
 * `.data/`), no AI provider or texting provider, and email caught by a local mail catcher, so
 * every run starts from the same place and nothing leaves the machine. Set E2E_BASE_URL to
 * test a server that is already running (for example a staging copy) instead.
 */
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { STAFF } from './e2e/staff';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const external = process.env.E2E_BASE_URL;
const BASE = external ?? `http://localhost:${PORT}`;
// A browser installed elsewhere (e.g. a system Chromium) instead of `playwright install`.
const executablePath = process.env.PW_CHROMIUM || undefined;
const chromium = executablePath ? { executablePath } : {};
/** Where the test server's mail catcher writes the emails it receives (see e2e/mailbox.mjs). */
const MAIL_FILE = join(tmpdir(), `waypoint-e2e-mail-${PORT}.jsonl`);
// The test workers read the same file (see linkFromEmail in e2e/fixtures.ts).
process.env.E2E_MAIL_FILE ??= MAIL_FILE;
const MAIL_PORT = PORT + 1000;

export default defineConfig({
  testDir: './e2e',
  // One server, one embedded database and shared rate limits: run the tests one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE,
    locale: 'en-GB',
    timezoneId: 'Africa/Nairobi',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        launchOptions: chromium,
      },
    },
    {
      // Long journeys run once per engine, on a desktop; the phones check the pages people
      // reach first.
      name: 'phone',
      use: { ...devices['Pixel 7'], launchOptions: chromium },
      grepInvert: /@desktop/,
    },
    // The same journeys in the other two browser engines: Firefox (Gecko) and Safari (WebKit,
    // which is also every browser on an iPhone).
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'safari',
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'iphone',
      use: { ...devices['iPhone 14'] },
      grepInvert: /@desktop/,
    },
  ],
  webServer: external
    ? undefined
    : {
        command: 'node e2e/server.mjs',
        url: `${BASE}/api/health`,
        reuseExistingServer: false,
        timeout: 300_000,
        stdout: 'ignore',
        stderr: 'pipe',
        env: {
          PORT: String(PORT),
          WAYPOINT_URL: BASE,
          WAYPOINT_DATA_DIR: join(tmpdir(), `waypoint-e2e-${PORT}`),
          // Test-only secrets (a production build refuses to start without them).
          BETTER_AUTH_SECRET: 'e2e-only-secret-never-use-in-production-0000000',
          WAYPOINT_KEK: 'MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=',
          // Empty values win over anything in .env.local: no real database, AI, email or texts.
          DATABASE_URL: '',
          ANTHROPIC_API_KEY: '',
          OPENAI_API_KEY: '',
          GOOGLE_GENERATIVE_AI_API_KEY: '',
          OLLAMA_BASE_URL: '',
          RESEND_API_KEY: '',
          // Email goes to the local mail catcher, never out of the machine.
          SMTP_URL: `smtp://127.0.0.1:${MAIL_PORT}`,
          EMAIL_FROM: 'Waypoint <hello@waypoint.test>',
          E2E_MAIL_PORT: String(MAIL_PORT),
          E2E_MAIL_FILE: process.env.E2E_MAIL_FILE,
          TWILIO_ACCOUNT_SID: '',
          WHATSAPP_ACCESS_TOKEN: '',
          AFRICASTALKING_API_KEY: '',
          // A staff account for the admin console tests, created in the throwaway database.
          WAYPOINT_ADMIN_EMAIL: STAFF.email,
          WAYPOINT_ADMIN_PASSWORD: STAFF.password,
          WAYPOINT_SECURITY_CONTACT: 'security@waypoint.test',
          WEB_ORIGINS: '',
          LOG_LEVEL: 'warn',
        },
      },
});
