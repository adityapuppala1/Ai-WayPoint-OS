import { createRoute, z } from '@hono/zod-openapi';
import { errors, IdParam, jsonBody, jsonContent, OkSchema, router } from '../lib/openapi';
import { noStore, requireUser } from '../middleware';
import { getConsents, getProfile } from '../services/me';
import { getUserSkills } from '../services/path';
import {
  relevantSignals,
  SignalSchema,
  SignalStateInputSchema,
  setSignalState,
} from '../services/signals';

const app = router();
app.use('/signals/*', noStore);

app.openapi(
  createRoute({
    method: 'get',
    path: '/signals',
    tags: ['Signals'],
    summary: 'What is changing, ranked for you, with the reasons each item is shown',
    request: {
      query: z.object({
        q: z.string().max(120).optional(),
        topic: z.string().max(40).optional(),
        days: z.coerce.number().int().min(1).max(730).default(180),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      }),
    },
    responses: { 200: jsonContent(z.array(SignalSchema)) },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    const q = c.req.valid('query');
    if (!user) {
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
    return c.json(
      await relevantSignals(
        db,
        {
          userId: user.id,
          profile,
          skillIds: skills.map((s) => s.skillId),
          matching: consents.foresight_matching,
        },
        { query: q.q, topic: q.topic, days: q.days, limit: q.limit },
      ),
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

export default app;
