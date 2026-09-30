import { createRoute, z } from '@hono/zod-openapi';
import { REACTIONS, REPORT_REASONS } from '@waypoint/core';
import { errors, IdParam, jsonBody, jsonContent, OkSchema, router } from '../lib/openapi';
import { limit, noStore, requireAccount, requireUser } from '../middleware';
import {
  AliasInputSchema,
  CirclesViewSchema,
  CircleViewSchema,
  circlesOverview,
  circleView,
  createPost,
  deletePost,
  JoinInputSchema,
  joinCircle,
  LeaveInputSchema,
  leaveCircle,
  PostInputSchema,
  PostResultSchema,
  reportPost,
  setAlias,
  setMuted,
  toggleReaction,
} from '../services/circles';
import { getConsents, getProfile } from '../services/me';

const app = router();
app.use('/circles', requireUser, noStore);
app.use('/circles/*', requireUser, noStore);

const PostParam = z.object({
  postId: z.uuid().openapi({ param: { name: 'postId', in: 'path' } }),
});

app.openapi(
  createRoute({
    method: 'get',
    path: '/circles',
    tags: ['Circles'],
    summary: 'Your circles, suggestions (with consent) and circles in your language',
    responses: { 200: jsonContent(CirclesViewSchema), 401: errors[401] },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user')!;
    const [profile, consents] = await Promise.all([
      getProfile(db, user.id),
      getConsents(db, user.id),
    ]);
    return c.json(await circlesOverview(db, user.id, profile, consents, c.get('locale')), 200);
  },
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/circles/{id}',
    tags: ['Circles'],
    summary: 'A circle: description for everyone, posts for members',
    request: { params: IdParam },
    responses: { 200: jsonContent(CircleViewSchema), 401: errors[401], 404: errors[404] },
  }),
  async (c) =>
    c.json(await circleView(c.get('db'), c.get('user')!.id, c.req.valid('param').id), 200),
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/circles/{id}/join',
    tags: ['Circles'],
    summary:
      'Join (accepting the guidelines); if it is full you join a new circle on the same topic',
    middleware: [requireAccount, limit('circle-join', 20, 3600)] as const,
    request: { params: IdParam, ...jsonBody(JoinInputSchema) },
    responses: {
      200: jsonContent(z.object({ circleId: z.string() })),
      401: errors[401],
      403: errors[403],
      404: errors[404],
      409: errors[409],
      422: errors[422],
    },
  }),
  async (c) =>
    c.json(
      await joinCircle(
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
    method: 'post',
    path: '/circles/{id}/leave',
    tags: ['Circles'],
    summary:
      'Leave a circle. Posts stay (shown as from a former member) unless you ask to delete them',
    request: {
      params: IdParam,
      body: {
        content: { 'application/json': { schema: LeaveInputSchema } },
        required: false,
      },
    },
    responses: { 200: jsonContent(OkSchema), 401: errors[401], 404: errors[404] },
  }),
  async (c) => {
    const body = (c.req.valid('json') as { deletePosts?: boolean } | undefined) ?? {};
    await leaveCircle(c.get('db'), c.get('user')!.id, c.req.valid('param').id, {
      deletePosts: body.deletePosts === true,
    });
    return c.json({ ok: true as const }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'put',
    path: '/circles/{id}/name',
    tags: ['Circles'],
    summary: 'Change the name others see in this circle (empty for "Member 1234")',
    middleware: [limit('circle-name', 20, 3600)] as const,
    request: { params: IdParam, ...jsonBody(AliasInputSchema) },
    responses: {
      200: jsonContent(OkSchema),
      401: errors[401],
      404: errors[404],
      422: errors[422],
    },
  }),
  async (c) => {
    await setAlias(
      c.get('db'),
      c.get('user')!.id,
      c.req.valid('param').id,
      c.req.valid('json').name,
    );
    return c.json({ ok: true as const }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'put',
    path: '/circles/{id}/mute',
    tags: ['Circles'],
    summary: 'Mute or unmute reminders from a circle',
    request: { params: IdParam, ...jsonBody(z.object({ muted: z.boolean() })) },
    responses: { 200: jsonContent(OkSchema), 401: errors[401], 404: errors[404] },
  }),
  async (c) => {
    await setMuted(
      c.get('db'),
      c.get('user')!.id,
      c.req.valid('param').id,
      c.req.valid('json').muted,
    );
    return c.json({ ok: true as const }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/circles/{id}/posts',
    tags: ['Circles'],
    summary: 'Post or reply. Checked first: personal numbers are masked; danger and scams are held',
    middleware: [requireAccount, limit('circle-post', 30, 3600)] as const,
    request: { params: IdParam, ...jsonBody(PostInputSchema) },
    responses: {
      201: jsonContent(PostResultSchema, 'Created'),
      401: errors[401],
      403: errors[403],
      404: errors[404],
      429: errors[429],
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user')!;
    const profile = await getProfile(db, user.id);
    return c.json(
      await createPost(db, user.id, profile, c.req.valid('param').id, c.req.valid('json')),
      201,
    );
  },
);

app.openapi(
  createRoute({
    method: 'delete',
    path: '/circles/posts/{postId}',
    tags: ['Circles'],
    summary: 'Delete your post (hosts and moderators can remove any post)',
    request: { params: PostParam },
    responses: { 200: jsonContent(OkSchema), 401: errors[401], 403: errors[403], 404: errors[404] },
  }),
  async (c) => {
    await deletePost(c.get('db'), c.get('user')!.id, c.req.valid('param').postId);
    return c.json({ ok: true as const }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/circles/posts/{postId}/reactions',
    tags: ['Circles'],
    summary: 'Add or remove a reaction',
    middleware: [limit('circle-react', 300, 3600)] as const,
    request: { params: PostParam, ...jsonBody(z.object({ kind: z.enum(REACTIONS) })) },
    responses: {
      200: jsonContent(z.object({ on: z.boolean() })),
      401: errors[401],
      404: errors[404],
    },
  }),
  async (c) =>
    c.json(
      await toggleReaction(
        c.get('db'),
        c.get('user')!.id,
        c.req.valid('param').postId,
        c.req.valid('json').kind,
      ),
      200,
    ),
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/circles/posts/{postId}/report',
    tags: ['Circles'],
    summary: 'Report a post. Three reports hide it until it is reviewed',
    middleware: [limit('circle-report', 30, 3600)] as const,
    request: { params: PostParam, ...jsonBody(z.object({ reason: z.enum(REPORT_REASONS) })) },
    responses: {
      200: jsonContent(z.object({ hidden: z.boolean() })),
      400: errors[400],
      401: errors[401],
      404: errors[404],
    },
  }),
  async (c) =>
    c.json(
      await reportPost(
        c.get('db'),
        c.get('user')!.id,
        c.req.valid('param').postId,
        c.req.valid('json').reason,
      ),
      200,
    ),
);

export default app;
