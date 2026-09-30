import { createRoute, z } from '@hono/zod-openapi';
import { addNotNow, localDayKey } from '@waypoint/core';
import { getEnv } from '@waypoint/core/env';
import { and, eq, nudges } from '@waypoint/db';
import { loadMessages } from '@waypoint/i18n';
import { getCookie } from 'hono/cookie';
import { errors, IdParam, jsonBody, jsonContent, OkSchema, router } from '../lib/openapi';
import { notFound } from '../lib/problem';
import { noStore, requireUser } from '../middleware';
import { getConsents, getProfile } from '../services/me';
import { NOT_NOW_COOKIE, TodaySchema, today, todayCopy } from '../services/today';

const app = router();
app.use('/today', requireUser, noStore);
app.use('/today/*', requireUser, noStore);
app.use('/nudges/*', requireUser, noStore);

/** A day and a half: long enough for any time zone. The day inside the value decides. */
const NOT_NOW_SECONDS = 129_600;

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
    const [profile, consents, messages] = await Promise.all([
      getProfile(db, user.id),
      getConsents(db, user.id),
      // The words for the step, in the language of the request (the app, other clients).
      loadMessages(locale),
    ]);
    return c.json(
      await today(db, user.id, profile, {
        matching: consents.foresight_matching,
        copy: todayCopy(messages),
        locale,
        // Steps the person set aside today (the website keeps them in a cookie).
        notNow: getCookie(c, NOT_NOW_COOKIE),
      }),
      200,
    );
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/today/not-now',
    tags: ['Today'],
    summary: 'Set Today’s step aside for the rest of the day',
    description:
      'Kept on this device only, in the wp-not-now cookie: the person’s local date and the keys Today gave the steps (keyed hashes that say nothing). The date is worked out when this is sent, not when the page was drawn, so a press after midnight counts for the new day, and what that day already holds is kept.',
    request: jsonBody(z.object({ key: z.string().regex(/^[\w-]{1,16}$/) })),
    responses: { 200: jsonContent(OkSchema), 401: errors[401], 422: errors[422] },
  }),
  async (c) => {
    const profile = await getProfile(c.get('db'), c.get('user')!.id);
    const day = localDayKey(new Date(), profile.timezone);
    const value = addNotNow(getCookie(c, NOT_NOW_COOKIE), day, c.req.valid('json').key);
    const secure = getEnv().WAYPOINT_URL.startsWith('https://') ? '; Secure' : '';
    // Written as it is (a date, then keys of letters, digits, "-" and "_"), the way pages read
    // it. HttpOnly: only the server reads it.
    c.header(
      'Set-Cookie',
      `${NOT_NOW_COOKIE}=${value}; Path=/; Max-Age=${NOT_NOW_SECONDS}; HttpOnly; SameSite=Lax${secure}`,
      { append: true },
    );
    return c.json({ ok: true as const }, 200);
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
