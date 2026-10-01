/**
 * "What's next?": forecasts and the public record of how they turned out. Reading needs no
 * account. Publishing, changing a chance and judging are for platform staff, and every one of
 * those actions is written to the audit log.
 */
import { createRoute, z } from '@hono/zod-openapi';
import { getEnv } from '@waypoint/core/env';
import type { Context } from 'hono';
import { errors, IdParam, jsonBody, jsonContent, OkSchema, router } from '../lib/openapi';
import { ipHash } from '../lib/request';
import { limit, noStore, requireArea } from '../middleware';
import {
  ADMIN_FORECAST_FILTERS,
  AdminForecastDetailSchema,
  AdminForecastListSchema,
  adminForecast,
  adminForecasts,
  ChanceInputSchema,
  ConfirmInputSchema,
  confirmVerdict,
  editForecast,
  ForecastInputSchema,
  ForecastListSchema,
  ForecastPatchSchema,
  ForecastRecordSchema,
  forecastRecord,
  JudgeInputSchema,
  judgeForecast,
  listForecasts,
  publishForecast,
  updateChance,
} from '../services/forecasts';
import { getConsents, getProfile } from '../services/me';
import type { AppEnv } from '../types';

const app = router();

app.openapi(
  createRoute({
    method: 'get',
    path: '/forecasts',
    tags: ['Forecasts'],
    summary: 'What may happen next: each forecast with its chance, sources and judgement date',
    description:
      'Public. Forecasts are published by staff, never generated: the lists are empty until real ones exist. Signed in, the ones about your country (and, with consent, your sector) come first. Judged forecasts come a page at a time, newest first; every one stays reachable.',
    request: {
      query: z.object({
        page: z.coerce.number().int().min(1).max(100_000).optional(),
        locale: z.string().optional(),
      }),
    },
    responses: { 200: jsonContent(ForecastListSchema), 422: errors[422] },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    const [profile, consents] = user
      ? await Promise.all([getProfile(db, user.id), getConsents(db, user.id)])
      : [null, null];
    const list = await listForecasts(
      db,
      { profile, matching: consents?.foresight_matching ?? false },
      // Example rows exist only after `pnpm db:seed --demo`, which production refuses.
      {
        locale: c.get('locale'),
        includeExamples: !getEnv().isProd,
        judgedPage: c.req.valid('query').page,
      },
    );
    return c.json(list, 200, {
      'Cache-Control': user ? 'private, no-store' : 'public, max-age=120',
      Vary: 'Cookie, Accept-Language',
    });
  },
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/forecasts/record',
    tags: ['Forecasts'],
    summary: 'The public record: how many forecasts were judged, the score, and calibration',
    description:
      'Public. A score is shown only once enough forecasts have been judged, and calibration only with more still; annulled forecasts are counted but not scored. Example data never counts.',
    responses: { 200: jsonContent(ForecastRecordSchema) },
  }),
  async (c) =>
    c.json(await forecastRecord(c.get('db')), 200, { 'Cache-Control': 'public, max-age=300' }),
);

// ─────────────────────────────── Staff ───────────────────────────────

app.use('/admin/forecasts', requireArea('forecasts'), noStore);
app.use('/admin/forecasts/*', requireArea('forecasts'), noStore);

const actor = (c: Context<AppEnv>) => ({
  userId: c.get('user')!.id,
  ipHash: ipHash(c.req.raw.headers),
});

app.openapi(
  createRoute({
    method: 'get',
    path: '/admin/forecasts',
    tags: ['Admin'],
    summary: 'Forecasts by state, with how many are in each',
    description:
      '`state=unchecked` lists every verdict that no second member of staff has confirmed yet.',
    request: { query: z.object({ state: z.enum(ADMIN_FORECAST_FILTERS).optional() }) },
    responses: { 200: jsonContent(AdminForecastListSchema), 401: errors[401], 403: errors[403] },
  }),
  async (c) =>
    c.json(
      await adminForecasts(c.get('db'), c.req.valid('query').state, {
        locale: c.get('locale'),
        viewerId: c.get('user')!.id,
      }),
      200,
    ),
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/admin/forecasts/{id}',
    tags: ['Admin'],
    summary: 'One forecast as staff wrote it, in every language, for the edit screen',
    request: { params: IdParam },
    responses: {
      200: jsonContent(AdminForecastDetailSchema),
      401: errors[401],
      403: errors[403],
      404: errors[404],
    },
  }),
  async (c) => c.json(await adminForecast(c.get('db'), c.req.valid('param').id), 200),
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/admin/forecasts',
    tags: ['Admin'],
    summary: 'Publish a forecast: a question, a chance, its sources and the day it will be judged',
    middleware: [limit('admin-forecast', 120, 3600)] as const,
    request: jsonBody(ForecastInputSchema),
    responses: {
      201: jsonContent(z.object({ id: z.string() }), 'Published'),
      401: errors[401],
      403: errors[403],
      422: errors[422],
    },
  }),
  async (c) => c.json(await publishForecast(c.get('db'), actor(c), c.req.valid('json')), 201),
);

app.openapi(
  createRoute({
    method: 'patch',
    path: '/admin/forecasts/{id}',
    tags: ['Admin'],
    summary: 'Change the explanation, advice, sources or translations of an open forecast',
    description: 'The question, how it will be judged and the date are fixed once published.',
    middleware: [limit('admin-forecast', 120, 3600)] as const,
    request: { params: IdParam, ...jsonBody(ForecastPatchSchema) },
    responses: { 200: jsonContent(OkSchema), 404: errors[404], 409: errors[409], 422: errors[422] },
  }),
  async (c) => {
    await editForecast(c.get('db'), actor(c), c.req.valid('param').id, c.req.valid('json'));
    return c.json({ ok: true as const }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/admin/forecasts/{id}/chance',
    tags: ['Admin'],
    summary: 'Publish a new chance for an open forecast (every chance is kept and scored)',
    middleware: [limit('admin-forecast', 120, 3600)] as const,
    request: { params: IdParam, ...jsonBody(ChanceInputSchema) },
    responses: { 200: jsonContent(OkSchema), 404: errors[404], 409: errors[409], 422: errors[422] },
  }),
  async (c) => {
    await updateChance(c.get('db'), actor(c), c.req.valid('param').id, c.req.valid('json'));
    return c.json({ ok: true as const }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/admin/forecasts/{id}/judge',
    tags: ['Admin'],
    summary: 'Judge a forecast: it happened, it did not, or it cannot be judged',
    middleware: [limit('admin-forecast', 120, 3600)] as const,
    request: { params: IdParam, ...jsonBody(JudgeInputSchema) },
    responses: { 200: jsonContent(OkSchema), 404: errors[404], 409: errors[409], 422: errors[422] },
  }),
  async (c) => {
    await judgeForecast(c.get('db'), actor(c), c.req.valid('param').id, c.req.valid('json'));
    return c.json({ ok: true as const }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/admin/forecasts/{id}/confirm',
    tags: ['Admin'],
    summary: 'The second check: confirm a verdict that another member of staff recorded',
    description:
      'Refused for the person who recorded the verdict (403). Until a verdict is confirmed it is shown as judged and marked as not yet double-checked; confirming never changes it.',
    middleware: [limit('admin-forecast', 120, 3600)] as const,
    request: { params: IdParam, ...jsonBody(ConfirmInputSchema) },
    responses: {
      200: jsonContent(OkSchema),
      401: errors[401],
      403: errors[403],
      404: errors[404],
      409: errors[409],
    },
  }),
  async (c) => {
    await confirmVerdict(c.get('db'), actor(c), c.req.valid('param').id);
    return c.json({ ok: true as const }, 200);
  },
);

export default app;
