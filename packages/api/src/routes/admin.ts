import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { errors, IdParam, jsonBody, jsonContent, OkSchema, router } from '../lib/openapi';
import { ipHash } from '../lib/request';
import { limit, noStore, requireArea, requireStaff } from '../middleware';
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
import {
  IntegrationCheckSchema,
  IntegrationsSchema,
  IntegrationUpdateSchema,
  integrationsView,
  saveIntegration,
  testIntegration,
} from '../services/integrations';
import {
  downloadBackup,
  HousekeepingResultSchema,
  HousekeepingSchema,
  housekeeping,
  MaintenanceUpdateSchema,
  MaintenanceViewSchema,
  maintenanceView,
  saveMaintenance,
} from '../services/maintenance';
import {
  actOnJob,
  actOnMessage,
  SystemSchema,
  systemView,
  WorkActionSchema,
} from '../services/system';
import type { AppEnv } from '../types';

const app = router();
app.use('/admin', requireStaff, noStore);
app.use('/admin/*', requireStaff, noStore);
// Each part of the console checks its own area (@waypoint/core/console): staff look after
// content and safety; only an admin sees the activity log.
for (const [path, area] of [
  ['/admin/overview', 'overview'],
  ['/admin/moderation', 'moderation'],
  ['/admin/scam-reports', 'reports'],
  ['/admin/feedback', 'feedback'],
  ['/admin/audit', 'audit'],
  ['/admin/integrations', 'integrations'],
  ['/admin/system', 'system'],
  ['/admin/jobs', 'system'],
  ['/admin/outbox', 'system'],
  ['/admin/maintenance', 'maintenance'],
] as const) {
  app.use(path, requireArea(area));
  app.use(`${path}/*`, requireArea(area));
}

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

// ───────────────────────────── Outside services ─────────────────────────────

const IntegrationParam = z.object({
  id: z
    .string()
    .regex(/^[a-z-]{2,40}$/)
    .openapi({ param: { name: 'id', in: 'path' }, example: 'anthropic' }),
});

app.openapi(
  createRoute({
    method: 'get',
    path: '/admin/integrations',
    tags: ['Admin'],
    summary: 'Outside services: what is set up, where each setting comes from, checks and usage',
    responses: { 200: jsonContent(IntegrationsSchema), 401: errors[401], 403: errors[403] },
  }),
  async (c) => c.json(await integrationsView(c.get('db')), 200),
);

app.openapi(
  createRoute({
    method: 'put',
    path: '/admin/integrations/{id}',
    tags: ['Admin'],
    summary:
      "Change a service's keys and options (a server value always wins and can't be changed here)",
    middleware: [limit('admin-integration', 120, 3600)] as const,
    request: { params: IntegrationParam, ...jsonBody(IntegrationUpdateSchema) },
    responses: {
      200: jsonContent(z.object({ ok: z.literal(true), dropped: z.array(z.string()) })),
      400: errors[400],
      401: errors[401],
      403: errors[403],
      404: errors[404],
    },
  }),
  async (c) => {
    const { dropped } = await saveIntegration(
      c.get('db'),
      actor(c),
      c.req.valid('param').id,
      c.req.valid('json').values,
    );
    return c.json({ ok: true as const, dropped }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/admin/integrations/{id}/check',
    tags: ['Admin'],
    summary: 'Check a service now with the settings in use (one harmless call)',
    middleware: [limit('admin-integration-check', 60, 3600)] as const,
    request: { params: IntegrationParam },
    responses: {
      200: jsonContent(IntegrationCheckSchema),
      400: errors[400],
      401: errors[401],
      403: errors[403],
      404: errors[404],
    },
  }),
  async (c) => c.json(await testIntegration(c.get('db'), actor(c), c.req.valid('param').id), 200),
);

// ───────────────────────────── System health ─────────────────────────────

app.openapi(
  createRoute({
    method: 'get',
    path: '/admin/system',
    tags: ['Admin'],
    summary: 'The API, the database, background work and this server, at a glance',
    responses: { 200: jsonContent(SystemSchema), 401: errors[401], 403: errors[403] },
  }),
  async (c) => c.json(await systemView(c.get('db')), 200),
);

for (const [path, act, what] of [
  ['/admin/jobs/{id}', actOnJob, 'a background job'],
  ['/admin/outbox/{id}', actOnMessage, 'a message waiting to be sent'],
] as const)
  app.openapi(
    createRoute({
      method: 'post',
      path,
      tags: ['Admin'],
      summary: `Retry or cancel ${what} that failed`,
      middleware: [limit('admin-work', 300, 3600)] as const,
      request: { params: IdParam, ...jsonBody(WorkActionSchema) },
      responses: {
        200: jsonContent(OkSchema),
        401: errors[401],
        403: errors[403],
        404: errors[404],
        409: errors[409],
      },
    }),
    async (c) => {
      await act(c.get('db'), actor(c), c.req.valid('param').id, c.req.valid('json').action);
      return c.json({ ok: true as const }, 200);
    },
  );

// ───────────────────────────── Maintenance ─────────────────────────────

app.openapi(
  createRoute({
    method: 'get',
    path: '/admin/maintenance',
    tags: ['Admin'],
    summary: 'Maintenance, the announcement, backups and housekeeping',
    responses: { 200: jsonContent(MaintenanceViewSchema), 401: errors[401], 403: errors[403] },
  }),
  async (c) => c.json(await maintenanceView(c.get('db')), 200),
);

app.openapi(
  createRoute({
    method: 'put',
    path: '/admin/maintenance',
    tags: ['Admin'],
    summary: 'Switch maintenance or the announcement on or off, or note the last backup',
    middleware: [limit('admin-maintenance', 120, 3600)] as const,
    request: jsonBody(MaintenanceUpdateSchema),
    responses: { 200: jsonContent(OkSchema), 400: errors[400], 401: errors[401], 403: errors[403] },
  }),
  async (c) => {
    await saveMaintenance(c.get('db'), actor(c), c.req.valid('json'));
    return c.json({ ok: true as const }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/admin/maintenance/backup',
    tags: ['Admin'],
    summary: 'Download a backup of the embedded database (.tar.gz); not available with Postgres',
    middleware: [limit('admin-backup', 12, 3600)] as const,
    responses: {
      200: {
        description: 'The data folder, compressed',
        content: { 'application/gzip': { schema: z.string() } },
      },
      401: errors[401],
      403: errors[403],
      404: errors[404],
    },
  }),
  // biome-ignore lint/suspicious/noExplicitAny: a file, not JSON
  (async (c: any) => {
    const blob = await downloadBackup(c.get('db'), actor(c));
    if (!blob)
      return c.json({ code: 'not-found', detail: 'Back up Postgres with its own tools.' }, 404);
    const name = `waypoint-backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.tar.gz`;
    return new Response(blob.stream(), {
      status: 200,
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'no-store',
      },
    });
  }) as never,
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/admin/maintenance/housekeeping',
    tags: ['Admin'],
    summary: 'Run housekeeping now: clean-up, clearing request limits, or re-sealing keys',
    middleware: [limit('admin-housekeeping', 30, 3600)] as const,
    request: jsonBody(HousekeepingSchema),
    responses: { 200: jsonContent(HousekeepingResultSchema), 401: errors[401], 403: errors[403] },
  }),
  async (c) => c.json(await housekeeping(c.get('db'), actor(c), c.req.valid('json').task), 200),
);

export default app;
