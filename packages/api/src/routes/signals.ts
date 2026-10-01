import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { errors, IdParam, jsonBody, jsonContent, OkSchema, router } from '../lib/openapi';
import { ipHash } from '../lib/request';
import { limit, noStore, requireArea, requireUser } from '../middleware';
import { getConsents, getProfile } from '../services/me';
import { getUserSkills } from '../services/path';
import {
  AdminSignalListSchema,
  adminSignals,
  publishSignal,
  relevantSignals,
  SignalInputSchema,
  SignalSchema,
  SignalStateInputSchema,
  savedSignals,
  setSignalState,
  withdrawSignal,
} from '../services/signals';
import type { AppEnv } from '../types';

const app = router();
app.use('/signals/*', noStore);

app.openapi(
  createRoute({
    method: 'get',
    path: '/signals',
    tags: ['Signals'],
    summary: 'What is changing, ranked for you, with the reasons each item is shown',
    description:
      'With `saved=true`: only what you saved, the one saved last first, however old it is. Without a session that list is empty.',
    request: {
      query: z.object({
        q: z.string().max(120).optional(),
        topic: z.string().max(40).optional(),
        days: z.coerce.number().int().min(1).max(730).default(180),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        saved: z.enum(['true', 'false']).optional(),
      }),
    },
    responses: { 200: jsonContent(z.array(SignalSchema)) },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    const q = c.req.valid('query');
    if (!user) {
      if (q.saved === 'true') return c.json([], 200, { 'Cache-Control': 'private, no-store' });
      return c.json(
        await relevantSignals(
          db,
          { userId: null, profile: null, skillIds: [], matching: false },
          { query: q.q, topic: q.topic, days: q.days, limit: q.limit },
        ),
        200,
      );
    }
    const [profile, consents, skills] = await Promise.all([
      getProfile(db, user.id),
      getConsents(db, user.id),
      getUserSkills(db, user.id),
    ]);
    const who = {
      userId: user.id,
      profile,
      skillIds: skills.map((s) => s.skillId),
      matching: consents.foresight_matching,
    };
    return c.json(
      q.saved === 'true'
        ? await savedSignals(db, who)
        : await relevantSignals(db, who, {
            query: q.q,
            topic: q.topic,
            days: q.days,
            limit: q.limit,
          }),
      200,
      { 'Cache-Control': 'private, no-store' },
    );
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/signals/{id}/state',
    tags: ['Signals'],
    summary: 'Save, dismiss or rate a signal',
    middleware: [requireUser] as const,
    request: { params: IdParam, ...jsonBody(SignalStateInputSchema) },
    responses: { 200: jsonContent(OkSchema), 401: errors[401], 404: errors[404] },
  }),
  async (c) => {
    await setSignalState(
      c.get('db'),
      c.get('user')!.id,
      c.req.valid('param').id,
      c.req.valid('json'),
    );
    return c.json({ ok: true as const }, 200);
  },
);

// ─────────────────────────────── Staff ───────────────────────────────

app.use('/admin/signals', requireArea('signals'), noStore);
app.use('/admin/signals/*', requireArea('signals'), noStore);

const actor = (c: Context<AppEnv>) => ({
  userId: c.get('user')!.id,
  ipHash: ipHash(c.req.raw.headers),
});

app.openapi(
  createRoute({
    method: 'get',
    path: '/admin/signals',
    tags: ['Admin'],
    summary: 'Every signal, the one added last first',
    responses: { 200: jsonContent(AdminSignalListSchema), 401: errors[401], 403: errors[403] },
  }),
  async (c) => c.json(await adminSignals(c.get('db')), 200),
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/admin/signals',
    tags: ['Admin'],
    summary: 'Publish a signal staff read somewhere, with the source it came from',
    description:
      'Signals are written by staff, never generated. One cannot be published without a source name and a full https:// address, or dated in the future.',
    middleware: [limit('admin-signal', 120, 3600)] as const,
    request: jsonBody(SignalInputSchema),
    responses: {
      201: jsonContent(z.object({ id: z.string() }), 'Published'),
      401: errors[401],
      403: errors[403],
      409: errors[409],
      422: errors[422],
    },
  }),
  async (c) => c.json(await publishSignal(c.get('db'), actor(c), c.req.valid('json')), 201),
);

app.openapi(
  createRoute({
    method: 'delete',
    path: '/admin/signals/{id}',
    tags: ['Admin'],
    summary: 'Withdraw a signal: it is no longer shown to anyone',
    middleware: [limit('admin-signal', 120, 3600)] as const,
    request: { params: IdParam },
    responses: { 200: jsonContent(OkSchema), 401: errors[401], 403: errors[403], 404: errors[404] },
  }),
  async (c) => {
    await withdrawSignal(c.get('db'), actor(c), c.req.valid('param').id);
    return c.json({ ok: true as const }, 200);
  },
);

export default app;
