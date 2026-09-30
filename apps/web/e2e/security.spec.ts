/**
 * Security checks against the running server, the way an attacker would try them: no
 * session, someone else's session, requests from other sites, broken input, and looking for
 * files and secrets that must never be served.
 */
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';
import { expect, test } from './fixtures';

/** A separate person: their own cookie jar, signed in as a guest. */
async function guest(
  playwright: PlaywrightWorkerArgs['playwright'],
  baseURL: string,
): Promise<APIRequestContext> {
  const context = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { origin: baseURL },
  });
  const res = await context.post('/api/auth/sign-in/anonymous', { data: {} });
  expect(res.ok(), await res.text()).toBe(true);
  return context;
}

test.describe('the API @desktop', () => {
  test('personal data needs a session', async ({ request }) => {
    for (const path of ['/api/me', '/api/goals', '/api/ask/conversations', '/api/me/export']) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(401);
      expect(res.headers()['content-type'], path).toContain('application/problem+json');
      expect(res.headers()['cache-control'] ?? '', path).not.toContain('public');
    }
  });

  test('one person can never read, change or delete another person’s things', async ({
    playwright,
    baseURL,
  }) => {
    const a = await guest(playwright, baseURL as string);
    const b = await guest(playwright, baseURL as string);
    const created = await a.post('/api/goals', { data: { title: 'Finish my CV' } });
    expect(created.status()).toBe(201);
    const goal = (await created.json()) as { id: string };

    expect((await b.patch(`/api/goals/${goal.id}`, { data: { title: 'Hacked' } })).status()).toBe(
      404,
    );
    expect((await b.delete(`/api/goals/${goal.id}`)).status()).toBe(404);
    const theirs = (await (await b.get('/api/goals')).json()) as { goals: unknown[] };
    expect(theirs.goals).toEqual([]);
    const mine = (await (await a.get('/api/goals')).json()) as {
      goals: Array<{ id: string; title: string }>;
    };
    expect(mine.goals.find((g) => g.id === goal.id)?.title).toBe('Finish my CV');

    // The same holds for conversations: someone else's id is simply "not found".
    expect(
      (await b.get('/api/ask/conversations/0192f0c1-7a2b-7c3d-8e4f-5a6b7c8d9e0f')).status(),
    ).toBe(404);
    await a.dispose();
    await b.dispose();
  });

  test('requests made by forms on other sites are refused', async ({ request }) => {
    const res = await request.post('/api/shield/check', {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: 'https://evil.example',
      },
      data: 'text=hello',
    });
    expect(res.status()).toBe(403);
  });

  test('broken input gets a plain answer, never internals', async ({ request }) => {
    const res = await request.post('/api/shield/check', {
      headers: { 'content-type': 'application/json' },
      data: '{"text":',
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
    const body = await res.text();
    expect(body).not.toMatch(/node_modules|\bat \S+ \(|SELECT |stack/i);
  });

  test('the admin console does not exist for anyone else', async ({ page, baseURL }) => {
    const signIn = await page.request.post('/api/auth/sign-in/anonymous', {
      data: {},
      headers: { origin: baseURL as string },
    });
    expect(signIn.ok()).toBe(true);
    const res = await page.goto('/admin');
    expect(res?.status()).toBe(404);
    expect([403, 404]).toContain((await page.request.get('/api/admin/overview')).status());
  });
});

test.describe('what the server hands out @desktop', () => {
  test('no settings files, source code or local data', async ({ request }) => {
    for (const path of [
      '/.env',
      '/.env.local',
      '/.data/dev-secrets.json',
      '/package.json',
      '/next.config.ts',
      '/apps/web/next.config.ts',
      '/_next/../package.json',
    ]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(404);
    }
  });

  test('no secret reaches the browser', async ({ page }) => {
    const scripts: string[] = [];
    page.on('response', async (response) => {
      if (response.url().endsWith('.js')) scripts.push(await response.text().catch(() => ''));
    });
    for (const path of ['/welcome', '/start', '/shield', '/privacy']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
    }
    expect(scripts.length).toBeGreaterThan(3);
    const all = scripts.join('\n');
    // The secrets' values, and the server's configuration module (which names WAYPOINT_KEK):
    // neither may be bundled for the browser. (The auth library's client names its own
    // variables without values, so names alone are not checked.)
    for (const secret of [
      'e2e-only-secret-never-use-in-production',
      'MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE',
      'WAYPOINT_KEK',
    ])
      expect(all, secret).not.toContain(secret);
  });
});
