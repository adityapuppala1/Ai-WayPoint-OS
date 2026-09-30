import { createRoute, z } from '@hono/zod-openapi';
import { and, eq, nudges } from '@waypoint/db';
import { loadMessages } from '@waypoint/i18n';
import { errors, IdParam, jsonBody, jsonContent, OkSchema, router } from '../lib/openapi';
import { notFound } from '../lib/problem';
import { noStore, requireUser } from '../middleware';
import { getConsents, getProfile } from '../services/me';
import { type TodayCopy, TodaySchema, today } from '../services/today';

/** Today's generic next steps in the language of the request (the app, other clients). */
async function todayCopy(locale: Parameters<typeof loadMessages>[0]): Promise<TodayCopy> {
  const t = (await loadMessages(locale)).today;
  return {
    onboardTitle: t.onboardTitle,
    onboardDetail: t.onboardDetail,
    makePlanTitle: t.makePlanTitle,
    makePlanDetail: t.makePlanDetail,
    exploreTitle: t.exploreTitle,
    exploreDetail: t.exploreDetail,
  };
}

const app = router();
app.use('/today', requireUser, noStore);
app.use('/nudges/*', requireUser, noStore);

app.openapi(
  createRoute({
    method: 'get',
    path: '/today',
    tags: ['Today'],
    summary: 'Your next step, this week’s route and what changed for you',
    responses: { 200: jsonContent(TodaySchema), 401: errors[401] },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user')!;
    const locale = c.get('locale');
    const [profile, consents, copy] = await Promise.all([
      getProfile(db, user.id),
      getConsents(db, user.id),
      todayCopy(locale),
    ]);
    return c.json(
      await today(db, user.id, profile, { matching: consents.foresight_matching, copy, locale }),
      200,
    );
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/nudges/{id}',
    tags: ['Today'],
    summary: 'Mark a nudge as read, acted on or dismissed',
    request: {
      params: IdParam,
      ...jsonBody(z.object({ action: z.enum(['read', 'acted', 'dismissed']) })),
    },
    responses: { 200: jsonContent(OkSchema), 404: errors[404] },
  }),
  async (c) => {
    const { action } = c.req.valid('json');
    const res = await c
      .get('db')
      .update(nudges)
      .set({ status: action === 'dismissed' ? 'dropped' : action, readAt: new Date() })
      .where(and(eq(nudges.id, c.req.valid('param').id), eq(nudges.userId, c.get('user')!.id)))
      .returning({ id: nudges.id });
    if (!res.length) throw notFound('Nudge');
    return c.json({ ok: true as const }, 200);
  },
);

export default app;
