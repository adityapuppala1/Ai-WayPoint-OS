import { createRoute, z } from '@hono/zod-openapi';
import { CountryQuery, errors, jsonBody, jsonContent, router } from '../lib/openapi';
import { limit, noStore } from '../middleware';
import { ReportedScamsSchema, reportedScams } from '../services/admin';
import { getConsents, getProfile } from '../services/me';
import {
  createScamReport,
  runShieldCheck,
  SCAM_CATEGORIES,
  ScamReportInputSchema,
  ShieldCheckInputSchema,
  ShieldCheckSchema,
  ShieldLibrarySchema,
  shieldLibrary,
} from '../services/shield';

const app = router();
app.use('/shield/check', noStore);
app.use('/shield/reports', noStore);

app.openapi(
  createRoute({
    method: 'post',
    path: '/shield/check',
    tags: ['Shield'],
    summary: 'Check a message, link, phone number or offer for scam signs',
    description:
      'Works without an account. The rules engine runs first; an AI second opinion (redacted, with consent) can only raise the level. The text is never stored.',
    middleware: [limit('shield', 30, 600)] as const,
    request: jsonBody(ShieldCheckInputSchema),
    responses: { 200: jsonContent(ShieldCheckSchema), 422: errors[400], 429: errors[429] },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    const body = c.req.valid('json');
    let country = body.country;
    let aiExternal = false;
    if (user) {
      const [profile, consents] = await Promise.all([
        getProfile(db, user.id),
        getConsents(db, user.id),
      ]);
      country ??= profile.country ?? undefined;
      aiExternal = consents.ai_external;
    }
    const result = await runShieldCheck(db, {
      ...body,
      country,
      userId: user?.id ?? null,
      isGuest: user?.isGuest ?? true,
      channel: 'web',
      aiExternalConsent: aiExternal,
    });
    return c.json(result, 200);
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/shield/reports',
    tags: ['Shield'],
    summary: 'Report a scam so others can be warned',
    description:
      'Descriptions are redacted before storage; phone numbers and payment ids are kept only as keyed hashes.',
    middleware: [limit('scam-report', 10, 3600)] as const,
    request: jsonBody(ScamReportInputSchema),
    responses: { 201: jsonContent(z.object({ id: z.string() }), 'Created'), 429: errors[429] },
  }),
  async (c) =>
    c.json(
      await createScamReport(c.get('db'), c.get('user')?.id ?? null, c.req.valid('json')),
      201,
    ),
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/shield/library',
    tags: ['Shield'],
    summary: 'How common scams work, with red flags and what to do, plus where to report',
    request: {
      query: z.object({ country: CountryQuery, category: z.enum(SCAM_CATEGORIES).optional() }),
    },
    responses: { 200: jsonContent(ShieldLibrarySchema) },
  }),
  (c) => {
    const q = c.req.valid('query');
    return c.json(shieldLibrary({ category: q.category, country: q.country }), 200, {
      'Cache-Control': 'public, max-age=3600',
    });
  },
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/shield/reported',
    tags: ['Shield'],
    summary: 'Scams people reported in a country in the last 90 days (checked by a moderator)',
    request: { query: z.object({ country: CountryQuery }) },
    responses: { 200: jsonContent(ReportedScamsSchema) },
  }),
  async (c) =>
    c.json(await reportedScams(c.get('db'), c.req.valid('query').country ?? null), 200, {
      'Cache-Control': 'public, max-age=600',
    }),
);

export default app;
