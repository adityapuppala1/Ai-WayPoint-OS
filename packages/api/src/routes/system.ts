import { createRoute, z } from '@hono/zod-openapi';
import { aiAvailable } from '@waypoint/ai';
import { MODULE_IDS } from '@waypoint/core';
import { redactPII } from '@waypoint/core/privacy';
import { dbKind, feedback, sql } from '@waypoint/db';
import { errors, jsonBody, jsonContent, router } from '../lib/openapi';
import { limit } from '../middleware';

const app = router();

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
    summary: 'Readiness: the database answers',
    responses: {
      200: jsonContent(
        z.object({ status: z.literal('ready'), database: z.string(), ai: z.boolean() }),
      ),
      503: jsonContent(z.object({ status: z.literal('unavailable') }), 'Not ready'),
    },
  }),
  async (c) => {
    try {
      await c.get('db').execute(sql`select 1`);
      return c.json({ status: 'ready' as const, database: dbKind(), ai: aiAvailable() }, 200, {
        'Cache-Control': 'no-store',
      });
    } catch {
      return c.json({ status: 'unavailable' as const }, 503, { 'Cache-Control': 'no-store' });
    }
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

export default app;
