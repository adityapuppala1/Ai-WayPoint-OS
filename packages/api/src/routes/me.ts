import { createRoute, z } from '@hono/zod-openapi';
import { errors, IdParam, jsonBody, jsonContent, OkSchema, router } from '../lib/openapi';
import { badRequest } from '../lib/problem';
import { limit, noStore, requireUser } from '../middleware';
import {
  addTrustedContact,
  ConsentsSchema,
  getMe,
  listTrustedContacts,
  MeSchema,
  markOnboarded,
  ProfilePatchSchema,
  ProfileSchema,
  removeTrustedContact,
  setConsents,
  TrustedContactInputSchema,
  TrustedContactSchema,
  updateProfile,
} from '../services/me';
import { SkillsInputSchema, setUserSkills } from '../services/path';
import {
  deleteAccount,
  exportData,
  forgetAllMemories,
  forgetMemory,
  listMemories,
  MemorySchema,
} from '../services/privacy';

const app = router();
app.use('/me', requireUser, noStore);
app.use('/me/*', requireUser, noStore);

app.openapi(
  createRoute({
    method: 'get',
    path: '/me',
    tags: ['You'],
    summary: 'The signed-in person, their profile and consents',
    responses: { 200: jsonContent(MeSchema), 401: errors[401] },
  }),
  async (c) => c.json(await getMe(c.get('db'), c.get('user')!), 200),
);

app.openapi(
  createRoute({
    method: 'patch',
    path: '/me/profile',
    tags: ['You'],
    summary: 'Update profile fields',
    request: jsonBody(ProfilePatchSchema),
    responses: { 200: jsonContent(ProfileSchema), 401: errors[401] },
  }),
  async (c) =>
    c.json(await updateProfile(c.get('db'), c.get('user')!.id, c.req.valid('json')), 200),
);

const OnboardingSchema = z
  .object({
    profile: ProfilePatchSchema,
    consents: ConsentsSchema.partial(),
    skills: SkillsInputSchema.shape.skills.optional(),
  })
  .openapi('Onboarding');

app.openapi(
  createRoute({
    method: 'post',
    path: '/me/onboarding',
    tags: ['You'],
    summary: 'Save the answers from onboarding',
    request: jsonBody(OnboardingSchema),
    responses: { 200: jsonContent(MeSchema), 401: errors[401] },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user')!;
    const body = c.req.valid('json');
    await updateProfile(db, user.id, body.profile);
    await setConsents(db, user.id, body.consents, 'onboarding');
    if (body.skills?.length) await setUserSkills(db, user.id, { skills: body.skills });
    await markOnboarded(db, user.id);
    return c.json(await getMe(db, user), 200);
  },
);

app.openapi(
  createRoute({
    method: 'put',
    path: '/me/consents',
    tags: ['You'],
    summary: 'Turn purpose-specific consents on or off',
    request: jsonBody(ConsentsSchema.partial()),
    responses: { 200: jsonContent(ConsentsSchema), 401: errors[401] },
  }),
  async (c) => c.json(await setConsents(c.get('db'), c.get('user')!.id, c.req.valid('json')), 200),
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/me/trusted-contacts',
    tags: ['You'],
    summary: 'Trusted contacts (decrypted for you only)',
    responses: { 200: jsonContent(z.array(TrustedContactSchema)), 401: errors[401] },
  }),
  async (c) => c.json(await listTrustedContacts(c.get('db'), c.get('user')!.id), 200),
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/me/trusted-contacts',
    tags: ['You'],
    summary: 'Add a trusted contact (up to three)',
    request: jsonBody(TrustedContactInputSchema),
    responses: { 201: jsonContent(TrustedContactSchema, 'Created'), 401: errors[401] },
  }),
  async (c) =>
    c.json(await addTrustedContact(c.get('db'), c.get('user')!.id, c.req.valid('json')), 201),
);

app.openapi(
  createRoute({
    method: 'delete',
    path: '/me/trusted-contacts/{id}',
    tags: ['You'],
    summary: 'Remove a trusted contact',
    request: { params: IdParam },
    responses: { 200: jsonContent(OkSchema), 404: errors[404] },
  }),
  async (c) => {
    await removeTrustedContact(c.get('db'), c.get('user')!.id, c.req.valid('param').id);
    return c.json({ ok: true as const }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/me/memories',
    tags: ['You'],
    summary: 'What the assistant was asked to remember (decrypted for you only)',
    responses: { 200: jsonContent(z.array(MemorySchema)), 401: errors[401] },
  }),
  async (c) => c.json(await listMemories(c.get('db'), c.get('user')!.id), 200),
);

app.openapi(
  createRoute({
    method: 'delete',
    path: '/me/memories/{id}',
    tags: ['You'],
    summary: 'Delete one thing Waypoint remembers',
    request: { params: IdParam },
    responses: { 200: jsonContent(OkSchema), 401: errors[401], 404: errors[404] },
  }),
  async (c) => {
    await forgetMemory(c.get('db'), c.get('user')!.id, c.req.valid('param').id);
    return c.json({ ok: true as const }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'delete',
    path: '/me/memories',
    tags: ['You'],
    summary: 'Forget everything: delete all that Waypoint remembers about you',
    responses: {
      200: jsonContent(z.object({ ok: z.literal(true), deleted: z.number().int() })),
      401: errors[401],
    },
  }),
  async (c) => {
    const deleted = await forgetAllMemories(c.get('db'), c.get('user')!.id);
    return c.json({ ok: true as const, deleted }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/me/export',
    tags: ['You'],
    summary: 'Download everything Waypoint stores about you (JSON)',
    middleware: [limit('export', 5, 3600)] as const,
    responses: {
      200: jsonContent(z.record(z.string(), z.unknown())),
      401: errors[401],
      429: errors[429],
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user')!;
    // Not written to the activity log: that records staff and organisation actions only,
    // never what people do with their own data.
    const data = await exportData(db, user.id);
    const stamp = new Date().toISOString().slice(0, 10);
    return c.json(data, 200, {
      'Content-Disposition': `attachment; filename="waypoint-export-${stamp}.json"`,
    });
  },
);

app.openapi(
  createRoute({
    method: 'delete',
    path: '/me',
    tags: ['You'],
    summary: 'Delete your account and all your data, permanently',
    request: jsonBody(z.object({ confirm: z.literal('DELETE') })),
    responses: { 200: jsonContent(OkSchema), 400: errors[400], 401: errors[401] },
  }),
  async (c) => {
    if (c.req.valid('json').confirm !== 'DELETE') throw badRequest('Type DELETE to confirm.');
    await deleteAccount(c.get('db'), c.get('user')!.id);
    // Expire the session cookies (the session rows are already gone).
    const res = c.json({ ok: true as const }, 200);
    for (const name of [
      'waypoint.session_token',
      '__Secure-waypoint.session_token',
      'waypoint.session_data',
      '__Secure-waypoint.session_data',
    ]) {
      res.headers.append(
        'Set-Cookie',
        `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${name.startsWith('__Secure') ? '; Secure' : ''}`,
      );
    }
    return res;
  },
);

export default app;
