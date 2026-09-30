import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { errors, IdParam, jsonBody, jsonContent, OkSchema, router } from '../lib/openapi';
import { ipHash } from '../lib/request';
import { limit, noStore, requireAdmin } from '../middleware';
import {
  AdminOverviewSchema,
  AuditTrailSchema,
  adminOverview,
  auditTrail,
  FeedbackListSchema,
  feedbackList,
  ModerationInputSchema,
  ModerationQueueSchema,
  moderatePost,
  moderationQueue,
  reviewScamReport,
  SCAM_REPORT_STATUSES,
  ScamReportListSchema,
  ScamReviewInputSchema,
  scamReportList,
} from '../services/admin';
import type { AppEnv } from '../types';

const app = router();
app.use('/admin', requireAdmin, noStore);
app.use('/admin/*', requireAdmin, noStore);

const actor = (c: Context<AppEnv>) => ({
  userId: c.get('user')!.id,
  ipHash: ipHash(c.req.raw.headers),
});

app.openapi(
  createRoute({
    method: 'get',
    path: '/admin/overview',
    tags: ['Admin'],
    summary: 'People, safety, organisations, AI spend, delivery and data freshness at a glance',
    responses: { 200: jsonContent(AdminOverviewSchema), 401: errors[401], 403: errors[403] },
  }),
  async (c) => c.json(await adminOverview(c.get('db')), 200),
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/admin/moderation',
    tags: ['Admin'],
    summary:
      'Circle posts held as possible scams, hidden by reports, or reported (safety holds are only counted)',
    responses: { 200: jsonContent(ModerationQueueSchema), 401: errors[401], 403: errors[403] },
  }),
  async (c) => c.json(await moderationQueue(c.get('db')), 200),
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/admin/moderation/{id}',
    tags: ['Admin'],
    summary: 'Restore a post (it is fine) or remove it; the writer is told either way',
    middleware: [limit('admin-moderate', 600, 3600)] as const,
    request: { params: IdParam, ...jsonBody(ModerationInputSchema) },
    responses: {
      200: jsonContent(OkSchema),
      401: errors[401],
      403: errors[403],
      404: errors[404],
      409: errors[409],
    },
  }),
  async (c) => {
    await moderatePost(c.get('db'), actor(c), c.req.valid('param').id, c.req.valid('json').action);
    return c.json({ ok: true as const }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/admin/scam-reports',
    tags: ['Admin'],
    summary: 'Scam reports by review status (newest waiting first)',
    request: {
      query: z.object({ status: z.enum(SCAM_REPORT_STATUSES).optional() }),
    },
    responses: { 200: jsonContent(ScamReportListSchema), 401: errors[401], 403: errors[403] },
  }),
  async (c) => c.json(await scamReportList(c.get('db'), c.req.valid('query').status), 200),
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/admin/scam-reports/{id}',
    tags: ['Admin'],
    summary: 'Publish a report (it warns people in that country), reject it, or mark it reviewed',
    middleware: [limit('admin-scam-review', 600, 3600)] as const,
    request: { params: IdParam, ...jsonBody(ScamReviewInputSchema) },
    responses: {
      200: jsonContent(OkSchema),
      401: errors[401],
      403: errors[403],
      404: errors[404],
    },
  }),
  async (c) => {
    await reviewScamReport(
      c.get('db'),
      actor(c),
      c.req.valid('param').id,
      c.req.valid('json').status,
    );
    return c.json({ ok: true as const }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/admin/feedback',
    tags: ['Admin'],
    summary: 'What people told us worked or did not, newest first',
    description:
      'Personal details were removed from each message before it was stored. An address is given only for someone who asked for a reply; guests are never identified.',
    request: {
      query: z.object({
        before: z.iso.datetime().optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
      }),
    },
    responses: { 200: jsonContent(FeedbackListSchema), 401: errors[401], 403: errors[403] },
  }),
  async (c) => c.json(await feedbackList(c.get('db'), c.req.valid('query')), 200),
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/admin/audit',
    tags: ['Admin'],
    summary: 'Who did what: staff and organisation actions, newest first',
    request: {
      query: z.object({
        before: z.iso.datetime().optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
      }),
    },
    responses: { 200: jsonContent(AuditTrailSchema), 401: errors[401], 403: errors[403] },
  }),
  async (c) => c.json(await auditTrail(c.get('db'), c.req.valid('query')), 200),
);

export default app;
