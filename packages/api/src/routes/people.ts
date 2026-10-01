/**
 * People in the console (accounts, staff and invitations, admins only), and the invitee's own
 * side of a staff invitation (anyone signed in with the invited address).
 */
import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { errors, jsonBody, jsonContent, OkSchema, router } from '../lib/openapi';
import { ipHash } from '../lib/request';
import { limit, noStore, requireAccount, requireArea } from '../middleware';
import {
  AccountActionSchema,
  AccountDetailSchema,
  AccountListSchema,
  AccountQuerySchema,
  AnswerInvitationSchema,
  accountDetail,
  actOnAccount,
  answerStaffInvitation,
  InviteStaffSchema,
  inviteStaff,
  listAccounts,
  revokeStaffInvitation,
  StaffInvitationSchema,
  StaffSchema,
  staffInvitation,
  staffView,
} from '../services/people';
import type { AppEnv } from '../types';

const app = router();
app.use('/admin/users', requireArea('users'), noStore);
app.use('/admin/users/*', requireArea('users'), noStore);
app.use('/admin/staff', requireArea('staff'), noStore);
app.use('/admin/staff/*', requireArea('staff'), noStore);
app.use('/staff-invitations/*', requireAccount, noStore);

const actor = (c: Context<AppEnv>) => ({
  userId: c.get('user')!.id,
  ipHash: ipHash(c.req.raw.headers),
});

/** Account ids are the auth library's own random strings, not UUIDs. */
const AccountParam = z.object({
  id: z
    .string()
    .regex(/^[\w-]{8,64}$/)
    .openapi({ param: { name: 'id', in: 'path' }, example: 'f3Kq9xLmA2bC7dEe' }),
});
const InvitationParam = z.object({
  id: z.uuid().openapi({ param: { name: 'id', in: 'path' } }),
});

app.openapi(
  createRoute({
    method: 'get',
    path: '/admin/users',
    tags: ['Admin'],
    summary: 'Find accounts: by name, address or number, kind, state and country, sorted and paged',
    request: { query: AccountQuerySchema },
    responses: { 200: jsonContent(AccountListSchema), 401: errors[401], 403: errors[403] },
  }),
  async (c) => c.json(await listAccounts(c.get('db'), c.req.valid('query')), 200),
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/admin/users/{id}',
    tags: ['Admin'],
    summary:
      'One account as the platform holds it (never what the person wrote); opening it is recorded',
    request: { params: AccountParam },
    responses: {
      200: jsonContent(AccountDetailSchema),
      401: errors[401],
      403: errors[403],
      404: errors[404],
    },
  }),
  async (c) => c.json(await accountDetail(c.get('db'), actor(c), c.req.valid('param').id), 200),
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/admin/users/{id}',
    tags: ['Admin'],
    summary:
      'Hold an account back or release it, sign it out everywhere, change its role, or delete it',
    middleware: [limit('admin-account', 300, 3600)] as const,
    request: { params: AccountParam, ...jsonBody(AccountActionSchema) },
    responses: {
      200: jsonContent(OkSchema),
      400: errors[400],
      401: errors[401],
      403: errors[403],
      404: errors[404],
      409: errors[409],
    },
  }),
  async (c) => {
    await actOnAccount(c.get('db'), actor(c), c.req.valid('param').id, c.req.valid('json'));
    return c.json({ ok: true as const }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/admin/staff',
    tags: ['Admin'],
    summary: 'The staff, and invitations to join them',
    responses: { 200: jsonContent(StaffSchema), 401: errors[401], 403: errors[403] },
  }),
  async (c) => c.json(await staffView(c.get('db')), 200),
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/admin/staff/invitations',
    tags: ['Admin'],
    summary: 'Invite someone by email to join the staff',
    middleware: [limit('admin-staff-invite', 60, 3600)] as const,
    request: jsonBody(InviteStaffSchema),
    responses: {
      200: jsonContent(z.object({ id: z.string() })),
      400: errors[400],
      401: errors[401],
      403: errors[403],
      409: errors[409],
      429: errors[429],
    },
  }),
  async (c) =>
    c.json(await inviteStaff(c.get('db'), actor(c), c.req.valid('json'), c.get('locale')), 200),
);

app.openapi(
  createRoute({
    method: 'delete',
    path: '/admin/staff/invitations/{id}',
    tags: ['Admin'],
    summary: 'Withdraw an invitation that has not been answered',
    request: { params: InvitationParam },
    responses: { 200: jsonContent(OkSchema), 401: errors[401], 403: errors[403], 404: errors[404] },
  }),
  async (c) => {
    await revokeStaffInvitation(c.get('db'), actor(c), c.req.valid('param').id);
    return c.json({ ok: true as const }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/staff-invitations/{id}',
    tags: ['Staff'],
    summary:
      'An invitation to the staff, as its invitee sees it (signed in with the invited address)',
    request: { params: InvitationParam },
    responses: {
      200: jsonContent(StaffInvitationSchema),
      401: errors[401],
      403: errors[403],
      404: errors[404],
    },
  }),
  async (c) =>
    c.json(await staffInvitation(c.get('db'), c.req.valid('param').id, c.get('user')!.id), 200),
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/staff-invitations/{id}',
    tags: ['Staff'],
    summary: 'Accept or decline an invitation to the staff',
    middleware: [limit('staff-invitation-answer', 30, 3600)] as const,
    request: { params: InvitationParam, ...jsonBody(AnswerInvitationSchema) },
    responses: { 200: jsonContent(OkSchema), 401: errors[401], 403: errors[403], 404: errors[404] },
  }),
  async (c) => {
    const { answer } = c.req.valid('json');
    await answerStaffInvitation(c.get('db'), c.req.valid('param').id, c.get('user')!.id, answer);
    const res = c.json({ ok: true as const }, 200);
    // The session's cached copy carries the old role: forget it, so the new one applies now.
    if (answer === 'accept')
      for (const name of ['waypoint.session_data', '__Secure-waypoint.session_data'])
        res.headers.append(
          'Set-Cookie',
          `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${name.startsWith('__Secure') ? '; Secure' : ''}`,
        );
    return res;
  },
);

export default app;
