// Starts Waypoint for the end-to-end tests on a fresh embedded database, so every run begins
// from the same empty state and never touches your own data. Playwright runs this (see
// playwright.config.ts) and stops it when the tests finish.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { startMailbox } from './mailbox.mjs';

const dataDir = process.env.WAYPOINT_DATA_DIR;
if (!dataDir) throw new Error('WAYPOINT_DATA_DIR must be set');
rmSync(dataDir, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });

// Emails (confirmation links, password resets) land in a file the tests read.
if (process.env.E2E_MAIL_PORT && process.env.E2E_MAIL_FILE)
  await startMailbox({ port: Number(process.env.E2E_MAIL_PORT), file: process.env.E2E_MAIL_FILE });

const mode = process.env.E2E_DEV ? 'dev' : 'start';
const child = spawn('pnpm', ['exec', 'next', mode, '--port', process.env.PORT ?? '3100'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
child.on('exit', (code) => {
  rmSync(dataDir, { recursive: true, force: true });
  process.exit(code ?? 0);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
