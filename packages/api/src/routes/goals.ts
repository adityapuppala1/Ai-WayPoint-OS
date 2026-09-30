import { createRoute } from '@hono/zod-openapi';
import { errors, IdParam, jsonBody, jsonContent, OkSchema, router } from '../lib/openapi';
import { limit, noStore, requireUser } from '../middleware';
import {
  createGoal,
  deleteGoal,
  GoalInputSchema,
  GoalPatchSchema,
  GoalSchema,
  GoalsViewSchema,
  goalsOverview,
  ReviewInputSchema,
  ReviewSchema,
  saveReview,
  updateGoal,
} from '../services/goals';
import { getProfile } from '../services/me';

const app = router();
app.use('/goals', requireUser, noStore);
app.use('/goals/*', requireUser, noStore);

app.openapi(
  createRoute({
    method: 'get',
    path: '/goals',
    tags: ['Goals'],
    summary: 'Your goals and weekly reviews',
    responses: { 200: jsonContent(GoalsViewSchema), 401: errors[401] },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user')!;
    const profile = await getProfile(db, user.id);
    return c.json(await goalsOverview(db, user.id, profile.timezone), 200);
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/goals',
    tags: ['Goals'],
    summary: 'Add a goal (its words are stored encrypted)',
    middleware: [limit('goal-create', 60, 3600)] as const,
    request: jsonBody(GoalInputSchema),
    responses: {
      201: jsonContent(GoalSchema, 'Created'),
      401: errors[401],
      409: errors[409],
      429: errors[429],
    },
  }),
  async (c) => c.json(await createGoal(c.get('db'), c.get('user')!.id, c.req.valid('json')), 201),
);

app.openapi(
  createRoute({
    method: 'put',
    path: '/goals/review',
    tags: ['Goals'],
    summary: 'Save this week’s review (encrypted); saving again updates it',
    request: jsonBody(ReviewInputSchema),
    responses: { 200: jsonContent(ReviewSchema), 401: errors[401] },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user')!;
    const profile = await getProfile(db, user.id);
    return c.json(await saveReview(db, user.id, profile.timezone, c.req.valid('json')), 200);
  },
);

app.openapi(
  createRoute({
    method: 'patch',
    path: '/goals/{id}',
    tags: ['Goals'],
    summary: 'Update a goal: words, progress or status',
    request: { params: IdParam, ...jsonBody(GoalPatchSchema) },
    responses: { 200: jsonContent(GoalSchema), 401: errors[401], 404: errors[404] },
  }),
  async (c) =>
    c.json(
      await updateGoal(
        c.get('db'),
        c.get('user')!.id,
        c.req.valid('param').id,
        c.req.valid('json'),
      ),
      200,
    ),
);

app.openapi(
  createRoute({
    method: 'delete',
    path: '/goals/{id}',
    tags: ['Goals'],
    summary: 'Delete a goal',
    request: { params: IdParam },
    responses: { 200: jsonContent(OkSchema), 401: errors[401], 404: errors[404] },
  }),
  async (c) => {
    await deleteGoal(c.get('db'), c.get('user')!.id, c.req.valid('param').id);
    return c.json({ ok: true as const }, 200);
  },
);

export default app;
