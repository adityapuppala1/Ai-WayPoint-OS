import { createRoute, z } from '@hono/zod-openapi';
import { MODULE_IDS } from '@waypoint/core';
import { isStaffRole } from '@waypoint/core/console';
import { redactPII } from '@waypoint/core/privacy';
import { dbReady, eq, feedback, profiles, schemaCurrent, sql } from '@waypoint/db';
import { errors, jsonBody, jsonContent, router } from '../lib/openapi';
import { moduleOfPath, recordUse } from '../lib/usage';
import { limit } from '../middleware';

import { PlatformNoticeSchema, platformNotice } from '../services/maintenance';

const app = router();

app.openapi(
  createRoute({
    method: 'get',
    path: '/platform',
    tags: ['System'],
    summary: 'Whether Waypoint is in maintenance, and any announcement for everyone',
    responses: { 200: jsonContent(PlatformNoticeSchema) },
  }),
  (c) => {
    c.header('Cache-Control', 'public, max-age=30');
    return c.json(platformNotice(), 200);
  },
);

const started = Date.now();

app.openapi(
  createRoute({
    method: 'get',
    path: '/health',
    tags: ['System'],
    summary: 'Liveness: the process is up',
    responses: {
      200: jsonContent(z.object({ status: z.literal('ok'), uptimeSeconds: z.number() })),
    },
  }),
  (c) =>
    c.json(
      { status: 'ok' as const, uptimeSeconds: Math.round((Date.now() - started) / 1000) },
      200,
      { 'Cache-Control': 'no-store' },
    ),
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/ready',
    tags: ['System'],
    summary: 'Readiness: the database answers and its schema is the one this code needs',
    responses: {
      200: jsonContent(z.object({ status: z.literal('ready') })),
      503: jsonContent(z.object({ status: z.enum(['unavailable', 'migrating']) }), 'Not ready'),
    },
  }),
  async (c) => {
    const no = { 'Cache-Control': 'no-store' };
    try {
      await dbReady();
      await c.get('db').execute(sql`select 1`);
    } catch {
      return c.json({ status: 'unavailable' as const }, 503, no);
    }
    // Newer code than schema (a release in progress): wait for the migrations to finish.
    if (!(await schemaCurrent(c.get('db'))))
      return c.json({ status: 'migrating' as const }, 503, no);
    // Anyone can call this: it says whether the server is ready, not what it runs on.
    return c.json({ status: 'ready' as const }, 200, no);
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/feedback',
    tags: ['System'],
    summary: 'Tell us what worked or what did not',
    middleware: [limit('feedback', 20, 3600)] as const,
    request: jsonBody(
      z.object({
        module: z.enum([...MODULE_IDS, 'support', 'settings', 'other']),
        page: z.string().max(200).optional(),
        rating: z.number().int().min(1).max(5).optional(),
        message: z.string().trim().max(2000).optional(),
        wantsReply: z.boolean().optional(),
      }),
    ),
    responses: { 201: jsonContent(z.object({ ok: z.literal(true) }), 'Thanks'), 429: errors[429] },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    await c
      .get('db')
      .insert(feedback)
      .values({
        userId: user?.id ?? null,
        module: body.module,
        page: body.page?.split('?')[0] ?? null,
        rating: body.rating ?? null,
        message: body.message ? redactPII(body.message).text : null,
        wantsReply: Boolean(body.wantsReply && user && !user.isGuest),
      });
    return c.json({ ok: true as const }, 201);
  },
);

/** Browsers that ask not to be tracked (Global Privacy Control, Do Not Track). */
const asksNotToBeCounted = (headers: Headers) =>
  headers.get('sec-gpc') === '1' || headers.get('dnt') === '1';

app.openapi(
  createRoute({
    method: 'post',
    path: '/activity',
    tags: ['System'],
    summary: 'A page or screen was opened: counted for the analytics, with nobody attached',
    description:
      'Records that the signed-in person used Waypoint today (not what they did), and adds one to an anonymous count for the part of Waypoint, hour, platform, kind of visitor, country and language. Nothing is counted for staff, or when the browser sends Global Privacy Control or Do Not Track.',
    middleware: [limit('activity', 900, 3600)] as const,
    request: jsonBody(z.object({ path: z.string().max(300) })),
    responses: { 204: { description: 'Counted, or deliberately not' }, 429: errors[429] },
  }),
  async (c) => {
    const user = c.get('user');
    const module = moduleOfPath(c.req.valid('json').path);
    if (!module || asksNotToBeCounted(c.req.raw.headers) || isStaffRole(user?.role))
      return c.body(null, 204);
    const [profile] = user
      ? await c
          .get('db')
          .select({ country: profiles.country, locale: profiles.locale })
          .from(profiles)
          .where(eq(profiles.userId, user.id))
      : [];
    recordUse({
      userId: user?.id ?? null,
      platform: c.req.header('x-waypoint-client') === 'phone' ? 'phone' : 'web',
      view: {
        module,
        audience: user ? (user.isGuest ? 'guest' : 'account') : 'visitor',
        country: profile?.country ?? null,
        locale: profile?.locale ?? c.get('locale'),
      },
    });
    return c.body(null, 204);
  },
);

export default app;
