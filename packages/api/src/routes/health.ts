import { createRoute, z } from '@hono/zod-openapi';
import { errors, IdParam, jsonBody, jsonContent, OkSchema, router } from '../lib/openapi';
import { limit, noStore, requireUser } from '../middleware';
import {
  createReminder,
  deleteReminder,
  HealthDayInputSchema,
  HealthDaySchema,
  HealthViewSchema,
  healthOverview,
  ReminderInputSchema,
  ReminderPatchSchema,
  ReminderSchema,
  saveDay,
  updateReminder,
} from '../services/health';
import { getProfile } from '../services/me';
import { ScreeningSchema } from '../services/mind';

// `/health` is the service liveness check (routes/system.ts); the Health module lives under
// `/wellbeing` so the two can never collide.
const app = router();
app.use('/wellbeing', requireUser, noStore);
app.use('/wellbeing/*', requireUser, noStore);

app.openapi(
  createRoute({
    method: 'get',
    path: '/wellbeing',
    tags: ['Health'],
    summary: 'Today’s routines, your week, your reminders and where to get care',
    description:
      'Waypoint does not diagnose. Care options are only services checked against a source.',
    responses: { 200: jsonContent(HealthViewSchema), 401: errors[401] },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user')!;
    return c.json(await healthOverview(db, user.id, await getProfile(db, user.id)), 200);
  },
);

app.openapi(
  createRoute({
    method: 'put',
    path: '/wellbeing/day',
    tags: ['Health'],
    summary: 'Save a day: sleep, movement, water and a private note (null clears a value)',
    description:
      'Notes are encrypted and screened for signs of danger as they are saved; if needed the response includes the support card.',
    middleware: [limit('health-day', 120, 3600)] as const,
    request: jsonBody(HealthDayInputSchema),
    responses: {
      200: jsonContent(z.object({ day: HealthDaySchema, screening: ScreeningSchema })),
      401: errors[401],
      422: errors[422],
      429: errors[429],
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user')!;
    const profile = await getProfile(db, user.id);
    return c.json(await saveDay(db, user.id, profile, c.req.valid('json')), 200);
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/wellbeing/reminders',
    tags: ['Health'],
    summary: 'Add a private reminder (the words are encrypted)',
    middleware: [limit('health-reminder', 60, 3600)] as const,
    request: jsonBody(ReminderInputSchema),
    responses: {
      201: jsonContent(ReminderSchema, 'Created'),
      401: errors[401],
      409: errors[409],
      422: errors[422],
      429: errors[429],
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user')!;
    const profile = await getProfile(db, user.id);
    return c.json(await createReminder(db, user.id, profile, c.req.valid('json')), 201);
  },
);

app.openapi(
  createRoute({
    method: 'patch',
    path: '/wellbeing/reminders/{id}',
    tags: ['Health'],
    summary: 'Change a reminder, or turn it off and on',
    request: { params: IdParam, ...jsonBody(ReminderPatchSchema) },
    responses: {
      200: jsonContent(ReminderSchema),
      401: errors[401],
      404: errors[404],
      422: errors[422],
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user')!;
    const profile = await getProfile(db, user.id);
    return c.json(
      await updateReminder(db, user.id, profile, c.req.valid('param').id, c.req.valid('json')),
      200,
    );
  },
);

app.openapi(
  createRoute({
    method: 'delete',
    path: '/wellbeing/reminders/{id}',
    tags: ['Health'],
    summary: 'Delete a reminder',
    request: { params: IdParam },
    responses: { 200: jsonContent(OkSchema), 401: errors[401], 404: errors[404] },
  }),
  async (c) => {
    await deleteReminder(c.get('db'), c.get('user')!.id, c.req.valid('param').id);
    return c.json({ ok: true as const }, 200);
  },
);

export default app;
