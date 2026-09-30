/**
 * With no connection: the service worker answers a page load with the offline page, and the
 * offline page still shows the help numbers saved the last time Waypoint was online. The same
 * test runs in every browser engine, so it only uses what a page itself can see
 * (`navigator.serviceWorker`, `caches`), never Playwright's Chromium-only worker tools.
 */
import { request as ask, createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Page } from '@playwright/test';
import { test as base, expect, startAsGuest } from './fixtures';

type Line = { origin: string; cut: () => Promise<void>; restore: () => Promise<void> };

/**
 * A connection that can be cut. The browser reaches the test server through this relay, and
 * closing the relay takes the network away from the page and from its service worker alike,
 * in every engine. Playwright's own offline switch (`context.setOffline`) does not: in Firefox
 * the worker still reaches the server, and in WebKit the worker is never asked at all.
 */
async function openLine(server: URL): Promise<Line> {
  let relay: Server | undefined;
  let port = 0;
  const open = () =>
    new Promise<void>((resolve, reject) => {
      const opened = createServer((req, res) => {
        const headers = { ...req.headers };
        // Waypoint only accepts changes sent from its own address: speak as that address.
        if (headers.origin) headers.origin = server.origin;
        const onward = ask(
          {
            host: server.hostname,
            port: server.port,
            path: req.url,
            method: req.method,
            headers,
          },
          (answer) => {
            res.writeHead(answer.statusCode ?? 502, answer.headers);
            answer.pipe(res);
          },
        );
        onward.on('error', () => res.destroy());
        req.pipe(onward);
      });
      opened.once('error', reject);
      // Port 0 the first time (any free port), the same port again after a cut.
      opened.listen(port, 'localhost', () => {
        port = (opened.address() as AddressInfo).port;
        relay = opened;
        resolve();
      });
    });
  const cut = () =>
    new Promise<void>((resolve) => {
      if (!relay) return resolve();
      relay.close(() => resolve());
      // Connections the browser keeps open would otherwise go on working.
      relay.closeAllConnections();
      relay = undefined;
    });
  await open();
  return { origin: `http://localhost:${port}`, cut, restore: open };
}

const test = base.extend<{ line: Line }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads what a fixture needs from this pattern
  line: async ({}, use, testInfo) => {
    const line = await openLine(new URL(testInfo.project.use.baseURL ?? ''));
    await use(line);
    await line.cut();
  },
  // Every page in this file is loaded through the line.
  baseURL: async ({ line }, use) => use(line.origin),
});

// What Chrome writes in the console for each request that finds no connection (Firefox and
// WebKit write nothing). Going offline is what this file is about, so here, and only here,
// that line is expected.
test.use({ allow: { console: [/^Failed to load resource: net::ERR_CONNECTION_REFUSED$/] } });

/**
 * The copy of the help numbers kept for the offline page, if there is one: its emergency
 * number, and the id of the answer it was saved from (a new id means a newer copy).
 */
const savedCopy = (page: Page) =>
  page.evaluate(async () => {
    const copy = await caches.match('/api/support', { ignoreVary: true });
    if (!copy) return null;
    const help = (await copy.json()) as { emergency?: { general?: string } | null };
    return { emergency: help.emergency?.general ?? null, id: copy.headers.get('x-request-id') };
  });

test('with no connection, the offline page shows the help numbers saved earlier', async ({
  page,
  line,
}) => {
  test.skip(
    !(test.info().project.use.baseURL ?? '').startsWith('http://'),
    'the line in front of the server is plain http: run against the local test server',
  );
  test.skip(Boolean(process.env.E2E_DEV), 'the worker is only registered in a built app');
  test.setTimeout(180_000);
  // Someone in Kenya (the test's time zone) sets up, and comes back another time.
  await startAsGuest(page);
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  // The worker has saved the help numbers for their country.
  await expect.poll(async () => (await savedCopy(page))?.emergency).toBe('999');
  const before = await savedCopy(page);

  await line.cut();
  await page.goto('/shield');
  await expect(page.getByRole('heading', { level: 1, name: 'You’re offline' })).toBeVisible();
  const help = page.getByRole('region', { name: 'If you need help right now' });
  await expect(help.getByRole('link', { name: '999', exact: true })).toHaveAttribute(
    'href',
    'tel:999',
  );
  // Support services too, each with a number that can be pressed to call.
  await expect(help.getByRole('listitem').first()).toBeVisible();
  await expect(help.getByRole('listitem').first().getByRole('link')).toHaveAttribute(
    'href',
    /^tel:\+?\d+$/,
  );

  // Back online, "Try again" brings the page that was asked for, and a newer copy is saved.
  await line.restore();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Scam Shield' })).toBeVisible();
  await expect.poll(async () => (await savedCopy(page))?.id).not.toBe(before?.id);

  // Signing out tells the worker to forget the saved numbers, so the next person to use the
  // device never sees where the last one was. Asked here the way the page asks it.
  await page.evaluate(() => navigator.serviceWorker.controller?.postMessage('forget'));
  await expect.poll(() => savedCopy(page)).toBeNull();
});
