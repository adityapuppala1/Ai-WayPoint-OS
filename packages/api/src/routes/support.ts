import { createRoute, z } from '@hono/zod-openapi';
import { assessCrisis, LOCALES, planCrisisResponse } from '@waypoint/core';
import { CountryQuery, errors, jsonBody, jsonContent, router } from '../lib/openapi';
import { limit } from '../middleware';
import { getProfile } from '../services/me';
import { SUPPORT_KINDS, SupportDirectorySchema, supportDirectory } from '../services/support';

const app = router();

app.openapi(
  createRoute({
    method: 'get',
    path: '/support',
    tags: ['Support'],
    summary: 'Emergency numbers and verified support services for a country',
    description:
      'Public. Falls back to global directories when a country has no verified national service.',
    request: {
      query: z.object({
        country: CountryQuery,
        kinds: z
          .string()
          .optional()
          .transform((v) =>
            v
              ? v
                  .split(',')
                  .filter((k): k is (typeof SUPPORT_KINDS)[number] =>
                    (SUPPORT_KINDS as readonly string[]).includes(k),
                  )
              : undefined,
          ),
        language: z.string().max(10).optional(),
      }),
    },
    responses: { 200: jsonContent(SupportDirectorySchema) },
  }),
  async (c) => {
    const q = c.req.valid('query');
    const user = c.get('user');
    let country = q.country ?? null;
    let language = q.language;
    if (!country && user) {
      const p = await getProfile(c.get('db'), user.id);
      country = p.country;
      language ??= p.locale;
    }
    const body = supportDirectory(country, { kinds: q.kinds, language });
    return c.json(body, 200, {
      'Cache-Control': user ? 'private, max-age=300' : 'public, max-age=3600',
    });
  },
);

const CrisisPlanSchema = z
  .object({
    tier: z.number().int(),
    categories: z.array(z.string()),
    headline: z.string(),
    message: z.string(),
    actions: z.array(
      z.object({
        kind: z.string(),
        label: z.string(),
        href: z.string().optional(),
        resourceId: z.string().optional(),
      }),
    ),
    emergencyNumber: z.string().optional(),
    safeMode: z.boolean(),
    suppressAiReply: z.boolean(),
  })
  .openapi('CrisisPlan');

app.openapi(
  createRoute({
    method: 'post',
    path: '/support/check',
    tags: ['Support'],
    summary:
      'Check a piece of text for signs someone may be in danger (used by Circles and the channels)',
    description: 'Deterministic, multilingual and private: the text is not stored.',
    middleware: [limit('support-check', 60, 60)] as const,
    request: jsonBody(
      z.object({
        text: z.string().min(1).max(4000),
        country: CountryQuery,
        locale: z.enum(LOCALES).optional(),
      }),
    ),
    responses: {
      200: jsonContent(z.object({ tier: z.number().int(), plan: CrisisPlanSchema.nullable() })),
      429: errors[429],
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const a = assessCrisis(body.text);
    const plan =
      a.tier > 0
        ? planCrisisResponse(a, { country: body.country, locale: body.locale ?? 'en' })
        : null;
    return c.json(
      {
        tier: a.tier,
        plan: plan
          ? {
              tier: plan.tier,
              categories: plan.categories,
              headline: plan.headline,
              message: plan.message,
              actions: plan.actions,
              emergencyNumber: plan.emergencyNumber,
              safeMode: plan.safeMode,
              suppressAiReply: plan.suppressAiReply,
            }
          : null,
      },
      200,
      { 'Cache-Control': 'no-store' },
    );
  },
);

export default app;
