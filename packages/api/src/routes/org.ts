import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { errors, IdParam, jsonBody, jsonContent, OkSchema, router } from '../lib/openapi';
import { ipHash } from '../lib/request';
import { limit, noStore, requireAccount, requireUser } from '../middleware';
import {
  cancelInvitation,
  changeMemberRole,
  createOrganisation,
  createProgramme,
  deleteOrganisation,
  deleteProgramme,
  InvitationViewSchema,
  InviteInputSchema,
  invitationView,
  inviteMember,
  JoinInputSchema,
  JoinPreviewSchema,
  joinPreview,
  joinProgramme,
  leaveProgramme,
  MyProgrammesSchema,
  myProgrammes,
  newProgrammeCode,
  OrgHomeSchema,
  OrgInputSchema,
  OrgPatchSchema,
  OrgViewSchema,
  orgHome,
  orgView,
  ProgrammeCountInputSchema,
  ProgrammeInputSchema,
  ProgrammePatchSchema,
  ProgrammeViewSchema,
  programmeView,
  RoleInputSchema,
  removeMember,
  respondToInvitation,
  setProgrammeCounted,
  updateOrganisation,
  updateProgramme,
} from '../services/org';
import type { AppEnv } from '../types';

const app = router();
app.use('/org', requireAccount, noStore);
app.use('/org/*', requireAccount, noStore);
app.use('/invitations/*', noStore);
app.use('/join/*', noStore);
app.use('/me/programmes', requireUser, noStore);
app.use('/me/programmes/*', requireUser, noStore);

const actor = (c: Context<AppEnv>) => ({
  userId: c.get('user')!.id,
  ipHash: ipHash(c.req.raw.headers),
});

const uuidParam = (name: string) =>
  z
    .uuid()
    .openapi({ param: { name, in: 'path' }, example: '0199a3c4-7b1e-7cc0-9f00-3b4c5d6e7f80' });
const ProgrammeParams = z.object({ id: uuidParam('id'), programmeId: uuidParam('programmeId') });
const MemberParams = z.object({
  id: uuidParam('id'),
  memberId: z
    .string()
    .min(1)
    .max(64)
    .openapi({ param: { name: 'memberId', in: 'path' } }),
});
const InvitationParams = z.object({
  id: uuidParam('id'),
  invitationId: z
    .string()
    .min(1)
    .max(64)
    .openapi({ param: { name: 'invitationId', in: 'path' } }),
});
const InvitationIdParam = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .openapi({ param: { name: 'id', in: 'path' } }),
});
const CodeParam = z.object({
  code: z
    .string()
    .min(4)
    .max(40)
    .openapi({ param: { name: 'code', in: 'path' }, example: 'K7QM3WXA' }),
});

// ─────────────────────────────── Organisations ───────────────────────────────

app.openapi(
  createRoute({
    method: 'get',
    path: '/org',
    tags: ['Organisations'],
    summary: 'Organisations you are part of, and invitations waiting for you',
    responses: { 200: jsonContent(OrgHomeSchema), 401: errors[401], 403: errors[403] },
  }),
  async (c) => {
    const user = c.get('user')!;
    return c.json(await orgHome(c.get('db'), user.id, user.email), 200);
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/org',
    tags: ['Organisations'],
    summary: 'Set up an organisation (you become its owner)',
    middleware: [limit('org-create', 10, 86_400)] as const,
    request: jsonBody(OrgInputSchema),
    responses: {
      201: jsonContent(z.object({ id: z.string() })),
      401: errors[401],
      403: errors[403],
      409: errors[409],
      422: errors[422],
      429: errors[429],
    },
  }),
  async (c) => c.json(await createOrganisation(c.get('db'), actor(c), c.req.valid('json')), 201),
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/org/{id}',
    tags: ['Organisations'],
    summary: 'An organisation: programmes (with k-anonymous totals), team and settings',
    request: { params: IdParam },
    responses: { 200: jsonContent(OrgViewSchema), 401: errors[401], 404: errors[404] },
  }),
  async (c) =>
    c.json(
      await orgView(c.get('db'), c.get('user')!.id, c.req.valid('param').id, c.get('locale')),
      200,
    ),
);

app.openapi(
  createRoute({
    method: 'patch',
    path: '/org/{id}',
    tags: ['Organisations'],
    summary: 'Change details or raise the privacy threshold (owners and admins; never lowered)',
    middleware: [limit('org-update', 30, 3600)] as const,
    request: { params: IdParam, ...jsonBody(OrgPatchSchema) },
    responses: {
      200: jsonContent(OkSchema),
      401: errors[401],
      403: errors[403],
      404: errors[404],
      409: errors[409],
      422: errors[422],
      429: errors[429],
    },
  }),
  async (c) => {
    await updateOrganisation(c.get('db'), actor(c), c.req.valid('param').id, c.req.valid('json'));
    return c.json({ ok: true as const }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'delete',
    path: '/org/{id}',
    tags: ['Organisations'],
    summary: 'Delete the organisation, its programmes and team (owners only)',
    request: { params: IdParam },
    responses: {
      200: jsonContent(OkSchema),
      401: errors[401],
      403: errors[403],
      404: errors[404],
    },
  }),
  async (c) => {
    await deleteOrganisation(c.get('db'), actor(c), c.req.valid('param').id);
    return c.json({ ok: true as const }, 200);
  },
);

// ─────────────────────────────── Programmes ───────────────────────────────

app.openapi(
  createRoute({
    method: 'post',
    path: '/org/{id}/programmes',
    tags: ['Organisations'],
    summary: 'Start a programme; people join it with its code or link',
    middleware: [limit('org-programme', 60, 3600)] as const,
    request: { params: IdParam, ...jsonBody(ProgrammeInputSchema) },
    responses: {
      201: jsonContent(z.object({ id: z.string(), joinCode: z.string() })),
      401: errors[401],
      403: errors[403],
      404: errors[404],
      409: errors[409],
      422: errors[422],
      429: errors[429],
    },
  }),
  async (c) =>
    c.json(
      await createProgramme(c.get('db'), actor(c), c.req.valid('param').id, c.req.valid('json')),
      201,
    ),
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/org/{id}/programmes/{programmeId}',
    tags: ['Organisations'],
    summary: 'A programme with totals for groups of at least k people who agreed to be counted',
    request: { params: ProgrammeParams },
    responses: { 200: jsonContent(ProgrammeViewSchema), 401: errors[401], 404: errors[404] },
  }),
  async (c) => {
    const { id, programmeId } = c.req.valid('param');
    return c.json(
      await programmeView(c.get('db'), c.get('user')!.id, id, programmeId, c.get('locale')),
      200,
    );
  },
);

app.openapi(
  createRoute({
    method: 'patch',
    path: '/org/{id}/programmes/{programmeId}',
    tags: ['Organisations'],
    summary: 'Edit, close or reopen a programme',
    middleware: [limit('org-programme-update', 60, 3600)] as const,
    request: { params: ProgrammeParams, ...jsonBody(ProgrammePatchSchema) },
    responses: {
      200: jsonContent(OkSchema),
      401: errors[401],
      403: errors[403],
      404: errors[404],
      422: errors[422],
      429: errors[429],
    },
  }),
  async (c) => {
    const { id, programmeId } = c.req.valid('param');
    await updateProgramme(c.get('db'), actor(c), id, programmeId, c.req.valid('json'));
    return c.json({ ok: true as const }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/org/{id}/programmes/{programmeId}/code',
    tags: ['Organisations'],
    summary: 'Replace the join code (the old code and link stop working)',
    middleware: [limit('org-code', 30, 3600)] as const,
    request: { params: ProgrammeParams },
    responses: {
      200: jsonContent(z.object({ joinCode: z.string() })),
      401: errors[401],
      403: errors[403],
      404: errors[404],
      429: errors[429],
    },
  }),
  async (c) => {
    const { id, programmeId } = c.req.valid('param');
    return c.json(await newProgrammeCode(c.get('db'), actor(c), id, programmeId), 200);
  },
);

app.openapi(
  createRoute({
    method: 'delete',
    path: '/org/{id}/programmes/{programmeId}',
    tags: ['Organisations'],
    summary: 'Delete a programme (people stay in Waypoint with all their own data)',
    request: { params: ProgrammeParams },
    responses: {
      200: jsonContent(OkSchema),
      401: errors[401],
      403: errors[403],
      404: errors[404],
    },
  }),
  async (c) => {
    const { id, programmeId } = c.req.valid('param');
    await deleteProgramme(c.get('db'), actor(c), id, programmeId);
    return c.json({ ok: true as const }, 200);
  },
);

// ─────────────────────────────── Team ───────────────────────────────

app.openapi(
  createRoute({
    method: 'post',
    path: '/org/{id}/invitations',
    tags: ['Organisations'],
    summary: 'Invite a colleague by email (the link can also be shared directly)',
    middleware: [limit('org-invite', 50, 3600)] as const,
    request: { params: IdParam, ...jsonBody(InviteInputSchema) },
    responses: {
      201: jsonContent(z.object({ id: z.string(), path: z.string() })),
      401: errors[401],
      403: errors[403],
      404: errors[404],
      409: errors[409],
      422: errors[422],
      429: errors[429],
    },
  }),
  async (c) =>
    c.json(
      await inviteMember(
        c.get('db'),
        actor(c),
        c.req.valid('param').id,
        c.req.valid('json'),
        c.get('locale'),
      ),
      201,
    ),
);

app.openapi(
  createRoute({
    method: 'delete',
    path: '/org/{id}/invitations/{invitationId}',
    tags: ['Organisations'],
    summary: 'Cancel an invitation',
    request: { params: InvitationParams },
    responses: {
      200: jsonContent(OkSchema),
      401: errors[401],
      403: errors[403],
      404: errors[404],
    },
  }),
  async (c) => {
    const { id, invitationId } = c.req.valid('param');
    await cancelInvitation(c.get('db'), actor(c), id, invitationId);
    return c.json({ ok: true as const }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'patch',
    path: '/org/{id}/members/{memberId}',
    tags: ['Organisations'],
    summary: 'Change a team member’s role (owners only)',
    request: { params: MemberParams, ...jsonBody(RoleInputSchema) },
    responses: {
      200: jsonContent(OkSchema),
      401: errors[401],
      403: errors[403],
      404: errors[404],
      409: errors[409],
    },
  }),
  async (c) => {
    const { id, memberId } = c.req.valid('param');
    await changeMemberRole(c.get('db'), actor(c), id, memberId, c.req.valid('json').role);
    return c.json({ ok: true as const }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'delete',
    path: '/org/{id}/members/{memberId}',
    tags: ['Organisations'],
    summary: 'Remove someone from the team, or leave it yourself',
    request: { params: MemberParams },
    responses: {
      200: jsonContent(OkSchema),
      401: errors[401],
      403: errors[403],
      404: errors[404],
      409: errors[409],
    },
  }),
  async (c) => {
    const { id, memberId } = c.req.valid('param');
    await removeMember(c.get('db'), actor(c), id, memberId);
    return c.json({ ok: true as const }, 200);
  },
);

// ─────────────────────────────── Invitations (for the invitee) ───────────────────────────────

app.openapi(
  createRoute({
    method: 'get',
    path: '/invitations/{id}',
    tags: ['Organisations'],
    summary: 'An invitation to join an organisation’s team',
    middleware: [limit('invitation-view', 60, 3600)] as const,
    request: { params: InvitationIdParam },
    responses: { 200: jsonContent(InvitationViewSchema), 404: errors[404], 429: errors[429] },
  }),
  async (c) => {
    const user = c.get('user');
    return c.json(
      await invitationView(
        c.get('db'),
        user ? { id: user.id, email: user.email, isGuest: user.isGuest } : null,
        c.req.valid('param').id,
      ),
      200,
    );
  },
);

for (const answer of ['accept', 'decline'] as const) {
  app.openapi(
    createRoute({
      method: 'post',
      path: `/invitations/{id}/${answer}`,
      tags: ['Organisations'],
      summary:
        answer === 'accept'
          ? 'Accept an invitation (signed in with the invited email)'
          : 'Decline an invitation',
      middleware: [requireAccount, limit('invitation-answer', 30, 3600)] as const,
      request: { params: InvitationIdParam },
      responses: {
        200: jsonContent(z.object({ organisationId: z.string() })),
        401: errors[401],
        403: errors[403],
        404: errors[404],
        409: errors[409],
        429: errors[429],
      },
    }),
    async (c) => {
      const user = c.get('user')!;
      return c.json(
        await respondToInvitation(
          c.get('db'),
          { ...actor(c), email: user.email },
          c.req.valid('param').id,
          answer === 'accept',
        ),
        200,
      );
    },
  );
}

// ─────────────────────────────── Joining a programme ───────────────────────────────

app.openapi(
  createRoute({
    method: 'get',
    path: '/join/{code}',
    tags: ['Programmes'],
    summary: 'What a programme is, who runs it and what they will (and will never) see',
    middleware: [limit('join-lookup', 60, 3600)] as const,
    request: { params: CodeParam },
    responses: { 200: jsonContent(JoinPreviewSchema), 404: errors[404], 429: errors[429] },
  }),
  async (c) =>
    c.json(
      await joinPreview(
        c.get('db'),
        c.get('user')?.id ?? null,
        c.req.valid('param').code,
        c.get('locale'),
      ),
      200,
    ),
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/join/{code}',
    tags: ['Programmes'],
    summary: 'Join a programme (guests too); choose whether you are counted in its totals',
    middleware: [requireUser, limit('join', 30, 3600)] as const,
    request: { params: CodeParam, ...jsonBody(JoinInputSchema) },
    responses: {
      200: jsonContent(z.object({ programmeId: z.string() })),
      401: errors[401],
      404: errors[404],
      409: errors[409],
      429: errors[429],
    },
  }),
  async (c) =>
    c.json(
      await joinProgramme(
        c.get('db'),
        c.get('user')!.id,
        c.req.valid('param').code,
        c.req.valid('json'),
      ),
      200,
    ),
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/me/programmes',
    tags: ['Programmes'],
    summary: 'Programmes you have joined',
    responses: { 200: jsonContent(MyProgrammesSchema), 401: errors[401] },
  }),
  async (c) => c.json(await myProgrammes(c.get('db'), c.get('user')!.id, c.get('locale')), 200),
);

app.openapi(
  createRoute({
    method: 'delete',
    path: '/me/programmes/{id}',
    tags: ['Programmes'],
    summary: 'Leave a programme (its next weekly totals no longer include you)',
    request: { params: IdParam },
    responses: { 200: jsonContent(OkSchema), 401: errors[401], 404: errors[404] },
  }),
  async (c) => {
    await leaveProgramme(c.get('db'), c.get('user')!.id, c.req.valid('param').id);
    return c.json({ ok: true as const }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'patch',
    path: '/me/programmes/{id}',
    tags: ['Programmes'],
    summary: 'Choose whether a programme counts you in its totals (from its next weekly update)',
    middleware: [limit('programme-count', 30, 3600)] as const,
    request: { params: IdParam, ...jsonBody(ProgrammeCountInputSchema) },
    responses: {
      200: jsonContent(OkSchema),
      401: errors[401],
      404: errors[404],
      429: errors[429],
    },
  }),
  async (c) => {
    await setProgrammeCounted(
      c.get('db'),
      c.get('user')!.id,
      c.req.valid('param').id,
      c.req.valid('json').counted,
    );
    return c.json({ ok: true as const }, 200);
  },
);

export default app;
