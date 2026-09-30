import { createRoute, z } from '@hono/zod-openapi';
import { errors, IdParam, jsonContent, OkSchema, router } from '../lib/openapi';
import { badRequest } from '../lib/problem';
import { limit, noStore, requireUser } from '../middleware';
import {
  AskRequestSchema,
  ConversationSchema,
  ConversationSummarySchema,
  deleteAllConversations,
  deleteConversation,
  getConversation,
  handleAsk,
  listConversations,
} from '../services/ask';
import { getConsents, getProfile } from '../services/me';

const app = router();
app.use('/ask', requireUser, noStore);
app.use('/ask/*', requireUser, noStore);

// Streaming endpoint: documented in OpenAPI, implemented as a plain route because the
// response is a Server-Sent Events stream (AI SDK UI message stream protocol).
app.openAPIRegistry.registerPath({
  method: 'post',
  path: '/ask',
  tags: ['Ask'],
  summary: 'Talk with Waypoint (streams an AI SDK UI message stream)',
  description:
    'Send the newest message only; history is loaded on the server. The crisis check runs before any AI call, and tools that save anything wait for your approval.',
  request: {
    body: { content: { 'application/json': { schema: AskRequestSchema } }, required: true },
  },
  responses: {
    200: {
      description: 'text/event-stream of UI message chunks',
      content: { 'text/event-stream': { schema: z.string() } },
    },
    401: errors[401],
    429: errors[429],
  },
});

app.post('/ask', limit('ask-minute', 12, 60), limit('ask-day', 300, 86_400), async (c) => {
  const parsed = AskRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw badRequest('That message could not be read.');
  const db = c.get('db');
  const user = c.get('user')!;
  const [profile, consents] = await Promise.all([
    getProfile(db, user.id),
    getConsents(db, user.id),
  ]);
  return handleAsk(db, { userId: user.id, isGuest: user.isGuest }, profile, consents, parsed.data, {
    abortSignal: c.req.raw.signal,
  });
});

app.openapi(
  createRoute({
    method: 'get',
    path: '/ask/conversations',
    tags: ['Ask'],
    summary: 'Your recent conversations',
    responses: { 200: jsonContent(z.array(ConversationSummarySchema)), 401: errors[401] },
  }),
  async (c) => c.json(await listConversations(c.get('db'), c.get('user')!.id), 200),
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/ask/conversations/{id}',
    tags: ['Ask'],
    summary: 'One conversation with its messages',
    request: { params: IdParam },
    responses: { 200: jsonContent(ConversationSchema), 404: errors[404] },
  }),
  async (c) =>
    c.json(await getConversation(c.get('db'), c.get('user')!.id, c.req.valid('param').id), 200),
);

app.openapi(
  createRoute({
    method: 'delete',
    path: '/ask/conversations/{id}',
    tags: ['Ask'],
    summary: 'Delete a conversation',
    request: { params: IdParam },
    responses: { 200: jsonContent(OkSchema), 404: errors[404] },
  }),
  async (c) => {
    await deleteConversation(c.get('db'), c.get('user')!.id, c.req.valid('param').id);
    return c.json({ ok: true as const }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'delete',
    path: '/ask/conversations',
    tags: ['Ask'],
    summary: 'Delete all your conversations',
    responses: { 200: jsonContent(z.object({ deleted: z.number().int() })), 401: errors[401] },
  }),
  async (c) =>
    c.json({ deleted: await deleteAllConversations(c.get('db'), c.get('user')!.id) }, 200),
);

export default app;
