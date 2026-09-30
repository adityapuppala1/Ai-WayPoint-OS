import { createRoute, z } from '@hono/zod-openapi';
import { errors, IdParam, jsonBody, jsonContent, OkSchema, router } from '../lib/openapi';
import { limit, noStore, requireUser } from '../middleware';
import { getProfile } from '../services/me';
import {
  addCheckin,
  addEntry,
  deleteCheckin,
  deleteEntry,
  JournalEntrySchema,
  JournalInputSchema,
  MindViewSchema,
  MoodCheckinInputSchema,
  MoodCheckinSchema,
  mindOverview,
  ScreeningSchema,
  updateEntry,
} from '../services/mind';

const app = router();
app.use('/mind', requireUser, noStore);
app.use('/mind/*', requireUser, noStore);

app.openapi(
  createRoute({
    method: 'get',
    path: '/mind',
    tags: ['Mind'],
    summary: 'Your last two weeks of check-ins, the trend, and your journal',
    responses: { 200: jsonContent(MindViewSchema), 401: errors[401] },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user')!;
    return c.json(await mindOverview(db, user.id, await getProfile(db, user.id)), 200);
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/mind/checkins',
    tags: ['Mind'],
    summary: 'Check in: mood, energy, what it’s about, and an optional private note',
    description:
      'Notes are encrypted and screened for signs of danger as they are saved; if needed the response includes the same support card Ask shows.',
    middleware: [limit('mind-checkin', 60, 3600)] as const,
    request: jsonBody(MoodCheckinInputSchema),
    responses: {
      201: jsonContent(
        z.object({ checkin: MoodCheckinSchema, screening: ScreeningSchema }),
        'Created',
      ),
      401: errors[401],
      429: errors[429],
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user')!;
    const profile = await getProfile(db, user.id);
    return c.json(await addCheckin(db, user.id, profile, c.req.valid('json')), 201);
  },
);

app.openapi(
  createRoute({
    method: 'delete',
    path: '/mind/checkins/{id}',
    tags: ['Mind'],
    summary: 'Delete a check-in',
    request: { params: IdParam },
    responses: { 200: jsonContent(OkSchema), 401: errors[401], 404: errors[404] },
  }),
  async (c) => {
    await deleteCheckin(c.get('db'), c.get('user')!.id, c.req.valid('param').id);
    return c.json({ ok: true as const }, 200);
  },
);

const EntryResult = z.object({ entry: JournalEntrySchema, screening: ScreeningSchema });

app.openapi(
  createRoute({
    method: 'post',
    path: '/mind/journal',
    tags: ['Mind'],
    summary: 'Write a private journal entry (encrypted)',
    middleware: [limit('mind-journal', 120, 3600)] as const,
    request: jsonBody(JournalInputSchema),
    responses: { 201: jsonContent(EntryResult, 'Created'), 401: errors[401], 429: errors[429] },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user')!;
    const profile = await getProfile(db, user.id);
    return c.json(await addEntry(db, user.id, profile, c.req.valid('json')), 201);
  },
);

app.openapi(
  createRoute({
    method: 'patch',
    path: '/mind/journal/{id}',
    tags: ['Mind'],
    summary: 'Edit a journal entry',
    request: {
      params: IdParam,
      ...jsonBody(z.object({ body: z.string().trim().min(1).max(20_000) })),
    },
    responses: { 200: jsonContent(EntryResult), 401: errors[401], 404: errors[404] },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user')!;
    const profile = await getProfile(db, user.id);
    return c.json(
      await updateEntry(db, user.id, profile, c.req.valid('param').id, c.req.valid('json').body),
      200,
    );
  },
);

app.openapi(
  createRoute({
    method: 'delete',
    path: '/mind/journal/{id}',
    tags: ['Mind'],
    summary: 'Delete a journal entry',
    request: { params: IdParam },
    responses: { 200: jsonContent(OkSchema), 401: errors[401], 404: errors[404] },
  }),
  async (c) => {
    await deleteEntry(c.get('db'), c.get('user')!.id, c.req.valid('param').id);
    return c.json({ ok: true as const }, 200);
  },
);

export default app;
