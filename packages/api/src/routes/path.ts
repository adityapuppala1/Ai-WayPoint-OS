import { createRoute, z } from '@hono/zod-openapi';
import { errors, IdParam, jsonBody, jsonContent, router } from '../lib/openapi';
import { limit, noStore, requireUser } from '../middleware';
import { getConsents, getProfile } from '../services/me';
import {
  CatalogSchema,
  CreatePlanInputSchema,
  catalog,
  createPlan,
  getPlan,
  getUserSkills,
  listPlans,
  PathOverviewSchema,
  PlanSchema,
  PlanStatusSchema,
  PlanSummarySchema,
  pathOverview,
  RoleDetailSchema,
  RoleSuggestionSchema,
  roleDetail,
  SkillsInputSchema,
  StepUpdateSchema,
  setPlanStatus,
  setUserSkills,
  suggestionsFor,
  UserSkillSchema,
  updateStep,
} from '../services/path';

const app = router();
for (const p of ['/path', '/path/skills', '/path/suggestions', '/path/plans', '/path/plans/*'])
  app.use(p, requireUser, noStore);

app.openapi(
  createRoute({
    method: 'get',
    path: '/path/catalog',
    tags: ['Path'],
    summary: 'All skills and roles Waypoint knows about',
    responses: { 200: jsonContent(CatalogSchema) },
  }),
  (c) =>
    c.json(catalog(c.get('locale')), 200, {
      'Cache-Control': 'public, max-age=3600',
      Vary: 'Accept-Language, Cookie',
    }),
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/path/roles/{id}',
    tags: ['Path'],
    summary: 'A role: what it involves, the skills it needs, AI exposure and where to learn',
    request: {
      params: z.object({
        id: z
          .string()
          .max(80)
          .openapi({ param: { name: 'id', in: 'path' } }),
      }),
    },
    responses: { 200: jsonContent(RoleDetailSchema), 404: errors[404] },
  }),
  async (c) => {
    const user = c.get('user');
    const db = c.get('db');
    const locale = c.get('locale');
    if (!user) return c.json(roleDetail(c.req.valid('param').id, { locale }), 200);
    const [profile, skills] = await Promise.all([
      getProfile(db, user.id),
      getUserSkills(db, user.id),
    ]);
    return c.json(
      roleDetail(c.req.valid('param').id, {
        skills,
        languages: profile.languages.length ? profile.languages : [profile.locale],
        country: profile.country,
        budget: profile.learningBudget,
        locale,
      }),
      200,
      { 'Cache-Control': 'private, no-store' },
    );
  },
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/path',
    tags: ['Path'],
    summary: 'Your skills, active plan, next step and role suggestions',
    responses: { 200: jsonContent(PathOverviewSchema), 401: errors[401] },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user')!;
    return c.json(
      await pathOverview(db, user.id, await getProfile(db, user.id), c.get('locale')),
      200,
    );
  },
);

app.openapi(
  createRoute({
    method: 'put',
    path: '/path/skills',
    tags: ['Path'],
    summary: 'Set your skill levels (0 removes a skill)',
    request: jsonBody(SkillsInputSchema),
    responses: { 200: jsonContent(z.array(UserSkillSchema)), 401: errors[401] },
  }),
  async (c) =>
    c.json(await setUserSkills(c.get('db'), c.get('user')!.id, c.req.valid('json')), 200),
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/path/suggestions',
    tags: ['Path'],
    summary: 'Roles that fit you, with reasons',
    request: { query: z.object({ limit: z.coerce.number().int().min(1).max(10).default(5) }) },
    responses: { 200: jsonContent(z.array(RoleSuggestionSchema)), 401: errors[401] },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user')!;
    const [profile, skills] = await Promise.all([
      getProfile(db, user.id),
      getUserSkills(db, user.id),
    ]);
    return c.json(
      suggestionsFor(profile, skills, c.req.valid('query').limit, c.get('locale')),
      200,
    );
  },
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/path/plans',
    tags: ['Path'],
    summary: 'Your plans',
    responses: { 200: jsonContent(z.array(PlanSummarySchema)), 401: errors[401] },
  }),
  async (c) => c.json(await listPlans(c.get('db'), c.get('user')!.id, c.get('locale')), 200),
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/path/plans',
    tags: ['Path'],
    summary: 'Make a week-by-week plan (becomes your active plan)',
    middleware: [limit('plan-create', 20, 3600)] as const,
    request: jsonBody(CreatePlanInputSchema),
    responses: {
      201: jsonContent(PlanSchema, 'Created'),
      400: errors[400],
      401: errors[401],
      429: errors[429],
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user')!;
    const [profile, consents] = await Promise.all([
      getProfile(db, user.id),
      getConsents(db, user.id),
    ]);
    const plan = await createPlan(
      db,
      { userId: user.id, isGuest: user.isGuest },
      profile,
      consents,
      c.req.valid('json'),
      c.get('locale'),
    );
    return c.json(plan, 201);
  },
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/path/plans/{id}',
    tags: ['Path'],
    summary: 'A plan with every step',
    request: { params: IdParam },
    responses: { 200: jsonContent(PlanSchema), 404: errors[404] },
  }),
  async (c) =>
    c.json(
      await getPlan(c.get('db'), c.get('user')!.id, c.req.valid('param').id, c.get('locale')),
      200,
    ),
);

app.openapi(
  createRoute({
    method: 'patch',
    path: '/path/plans/{id}',
    tags: ['Path'],
    summary: 'Pause, resume or archive a plan',
    request: { params: IdParam, ...jsonBody(PlanStatusSchema) },
    responses: { 200: jsonContent(PlanSummarySchema), 404: errors[404] },
  }),
  async (c) =>
    c.json(
      await setPlanStatus(
        c.get('db'),
        c.get('user')!.id,
        c.req.valid('param').id,
        c.req.valid('json').status,
        c.get('locale'),
      ),
      200,
    ),
);

app.openapi(
  createRoute({
    method: 'patch',
    path: '/path/plans/{id}/steps/{stepId}',
    tags: ['Path'],
    summary: 'Mark a step done, skipped or back to do',
    request: {
      params: IdParam.extend({
        stepId: z.uuid().openapi({ param: { name: 'stepId', in: 'path' } }),
      }),
      ...jsonBody(StepUpdateSchema),
    },
    responses: { 200: jsonContent(PlanSchema), 404: errors[404] },
  }),
  async (c) => {
    const { id, stepId } = c.req.valid('param');
    return c.json(
      await updateStep(
        c.get('db'),
        c.get('user')!.id,
        id,
        stepId,
        c.req.valid('json'),
        c.get('locale'),
      ),
      200,
    );
  },
);

export default app;
