import { createRoute, z } from '@hono/zod-openapi';
import type { LifeEvent } from '@waypoint/content';
import type { Context } from 'hono';
import { CountryQuery, errors, jsonBody, jsonContent, router } from '../lib/openapi';
import { noStore, requireUser } from '../middleware';
import {
  ChecklistSchema,
  CivicOverviewSchema,
  checklistFor,
  civicOverview,
  ItemStatusSchema,
  LIFE_EVENTS,
  setItemStatus,
} from '../services/civic';
import { getProfile } from '../services/me';
import type { AppEnv } from '../types';

const app = router();
app.use('/civic/*', noStore);

/** The country asked for, or the signed-in person's own country. */
async function countryFor(c: Context<AppEnv>, fromQuery?: string): Promise<string | null> {
  if (fromQuery) return fromQuery;
  const user = c.get('user');
  if (!user) return null;
  return (await getProfile(c.get('db'), user.id)).country;
}

app.openapi(
  createRoute({
    method: 'get',
    path: '/civic',
    tags: ['Services'],
    summary: 'Life-event checklists and official government services for a country',
    request: { query: z.object({ country: CountryQuery }) },
    responses: { 200: jsonContent(CivicOverviewSchema) },
  }),
  async (c) => {
    const country = await countryFor(c, c.req.valid('query').country);
    return c.json(await civicOverview(c.get('db'), c.get('user')?.id ?? null, country), 200, {
      'Cache-Control': 'private, no-store',
    });
  },
);

const EventParam = z.object({
  event: z.enum(LIFE_EVENTS).openapi({ param: { name: 'event', in: 'path' } }),
});

app.openapi(
  createRoute({
    method: 'get',
    path: '/civic/{event}',
    tags: ['Services'],
    summary: 'A life-event checklist, with your progress when signed in',
    request: { params: EventParam, query: z.object({ country: CountryQuery }) },
    responses: { 200: jsonContent(ChecklistSchema), 404: errors[404] },
  }),
  async (c) => {
    const country = await countryFor(c, c.req.valid('query').country);
    return c.json(
      await checklistFor(
        c.get('db'),
        c.get('user')?.id ?? null,
        c.req.valid('param').event as LifeEvent,
        country,
      ),
      200,
    );
  },
);

app.openapi(
  createRoute({
    method: 'put',
    path: '/civic/{event}/items/{itemId}',
    tags: ['Services'],
    summary: 'Mark a checklist item done, skipped or not applicable',
    middleware: [requireUser] as const,
    request: {
      params: EventParam.extend({
        itemId: z
          .string()
          .max(80)
          .openapi({ param: { name: 'itemId', in: 'path' } }),
      }),
      ...jsonBody(ItemStatusSchema),
    },
    responses: { 200: jsonContent(ChecklistSchema), 401: errors[401], 404: errors[404] },
  }),
  async (c) => {
    const { event, itemId } = c.req.valid('param');
    const body = c.req.valid('json');
    const country = await countryFor(c, body.country?.toUpperCase());
    return c.json(
      await setItemStatus(
        c.get('db'),
        c.get('user')!.id,
        event as LifeEvent,
        country,
        itemId,
        body.status,
      ),
      200,
    );
  },
);

export default app;
