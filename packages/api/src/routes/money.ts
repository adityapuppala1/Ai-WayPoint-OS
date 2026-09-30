import { createRoute } from '@hono/zod-openapi';
import { errors, jsonBody, jsonContent, OkSchema, router } from '../lib/openapi';
import { limit, noStore, requireUser } from '../middleware';
import {
  clearMoney,
  getMoney,
  MoneyInputSchema,
  MoneyViewSchema,
  saveMoney,
} from '../services/money';

const app = router();
app.use('/money', requireUser, noStore);

app.openapi(
  createRoute({
    method: 'get',
    path: '/money',
    tags: ['Money'],
    summary: 'Your saved numbers and what they mean: runway, stress level and next steps',
    responses: { 200: jsonContent(MoneyViewSchema), 401: errors[401] },
  }),
  async (c) => c.json(await getMoney(c.get('db'), c.get('user')!.id), 200),
);

app.openapi(
  createRoute({
    method: 'put',
    path: '/money',
    tags: ['Money'],
    summary: 'Save your numbers (stored encrypted) and get your runway',
    middleware: [limit('money-save', 60, 3600)] as const,
    request: jsonBody(MoneyInputSchema),
    responses: {
      200: jsonContent(MoneyViewSchema),
      401: errors[401],
      429: errors[429],
    },
  }),
  async (c) => c.json(await saveMoney(c.get('db'), c.get('user')!.id, c.req.valid('json')), 200),
);

app.openapi(
  createRoute({
    method: 'delete',
    path: '/money',
    tags: ['Money'],
    summary: 'Delete your saved numbers',
    responses: { 200: jsonContent(OkSchema), 401: errors[401] },
  }),
  async (c) => {
    await clearMoney(c.get('db'), c.get('user')!.id);
    return c.json({ ok: true as const }, 200);
  },
);

export default app;
