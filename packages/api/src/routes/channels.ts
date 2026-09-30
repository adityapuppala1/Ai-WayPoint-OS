/**
 * Texting Waypoint. `GET /channels` says where people can text; the rest are webhooks for
 * messaging providers. Each webhook proves it came from the provider (a signature, or a secret
 * in the callback address) before anything is read, and nothing anyone texts is stored. The
 * webhooks are not in the public API document: providers call them, people do not.
 */
import { createRoute } from '@hono/zod-openapi';
import { getEnv } from '@waypoint/core/env';
import type { Context } from 'hono';
import {
  parseMetaWebhook,
  sameSecret,
  twiml,
  validAfricasTalkingKey,
  validMetaSignature,
  validTwilioRequest,
} from '../channels/providers';
import { PublicChannelsSchema, publicChannels } from '../channels/public';
import { countMessage, dispatchSoon, handleText, handleUssd, queueText } from '../channels/service';
import { errorFields, log } from '../lib/log';
import { jsonContent, router } from '../lib/openapi';
import type { AppEnv } from '../types';

const app = router();

/** The address the provider called, as it saw it (behind proxies the request URL differs). */
function publicUrl(c: Context<AppEnv>): string {
  const url = new URL(c.req.url);
  return `${new URL(getEnv().WAYPOINT_URL).origin}${url.pathname}${url.search}`;
}

function runLater(later?: () => Promise<void>) {
  if (!later) return;
  void later().catch((err) => log.error('channel answer failed', errorFields(err)));
}

async function formFields(c: Context<AppEnv>): Promise<Record<string, string>> {
  const form = await c.req.parseBody();
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(form)) if (typeof v === 'string') out[k] = v;
  return out;
}

app.openapi(
  createRoute({
    method: 'get',
    path: '/channels',
    tags: ['Channels'],
    summary: 'Where people can text Waypoint',
    description:
      'Public. SMS, WhatsApp and USSD, each listed only when it is set up and has a number or code to show.',
    responses: { 200: jsonContent(PublicChannelsSchema) },
  }),
  (c) => c.json(publicChannels(), 200, { 'Cache-Control': 'public, max-age=300' }),
);

const notConfigured = (c: Context<AppEnv>) => c.text('Not configured', 404);
const forbidden = (c: Context<AppEnv>) => c.text('Forbidden', 403);

// ─────────────────────────────── Twilio: SMS and WhatsApp ───────────────────────────────

for (const channel of ['sms', 'whatsapp'] as const) {
  app.post(`/channels/twilio/${channel}`, async (c) => {
    const token = getEnv().TWILIO_AUTH_TOKEN;
    if (!token) return notConfigured(c);
    const fields = await formFields(c);
    if (!validTwilioRequest(publicUrl(c), fields, c.req.header('x-twilio-signature'), token))
      return forbidden(c);
    const db = c.get('db');
    const result = await handleText(db, {
      channel,
      provider: 'twilio',
      from: fields.From ?? '',
      text: fields.Body || (Number(fields.NumMedia ?? 0) > 0 ? null : ''),
    });
    // These replies go back in the answer itself, not through the outbox.
    await countMessage(db, channel, 'out', 'reply', result.replies.length).catch(() => undefined);
    runLater(result.later);
    return c.body(twiml(result.replies), 200, { 'Content-Type': 'text/xml; charset=utf-8' });
  });
}

// ─────────────────────────────── WhatsApp Cloud API (Meta) ───────────────────────────────

app.get('/channels/whatsapp', (c) => {
  const token = getEnv().WHATSAPP_VERIFY_TOKEN;
  if (!token) return notConfigured(c);
  const mode = c.req.query('hub.mode');
  const given = c.req.query('hub.verify_token') ?? '';
  const challenge = c.req.query('hub.challenge') ?? '';
  if (mode === 'subscribe' && sameSecret(given, token) && /^[\w-]{1,200}$/.test(challenge))
    return c.text(challenge, 200);
  return forbidden(c);
});

app.post('/channels/whatsapp', async (c) => {
  const secret = getEnv().WHATSAPP_APP_SECRET;
  if (!secret) return notConfigured(c);
  const raw = await c.req.text();
  if (!validMetaSignature(raw, c.req.header('x-hub-signature-256'), secret)) return forbidden(c);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return c.text('Bad request', 400);
  }
  const db = c.get('db');
  for (const message of parseMetaWebhook(body).slice(0, 10)) {
    const result = await handleText(db, {
      channel: 'whatsapp',
      provider: 'meta',
      from: message.from,
      text: message.text,
    });
    if (result.e164 && result.identityId)
      for (const reply of result.replies)
        await queueText(db, {
          channel: 'whatsapp',
          provider: 'meta',
          e164: result.e164,
          body: reply,
          identityId: result.identityId,
        });
    runLater(result.later);
  }
  dispatchSoon(db);
  // Meta only needs to hear that the webhook arrived; replies go out through the API.
  return c.text('OK', 200);
});

// ─────────────────────────────── Africa's Talking: SMS and USSD ───────────────────────────────

app.post('/channels/africastalking/sms', async (c) => {
  const key = getEnv().AFRICASTALKING_WEBHOOK_KEY;
  if (!key) return notConfigured(c);
  if (!validAfricasTalkingKey(c.req.query('key'), key)) return forbidden(c);
  const fields = await formFields(c);
  const db = c.get('db');
  const result = await handleText(db, {
    channel: 'sms',
    provider: 'africastalking',
    from: fields.from ?? '',
    text: fields.text ?? '',
  });
  if (result.e164 && result.identityId)
    for (const reply of result.replies)
      await queueText(db, {
        channel: 'sms',
        provider: 'africastalking',
        e164: result.e164,
        body: reply,
        identityId: result.identityId,
      });
  runLater(result.later);
  dispatchSoon(db);
  return c.text('OK', 200);
});

app.post('/channels/africastalking/ussd', async (c) => {
  const key = getEnv().AFRICASTALKING_WEBHOOK_KEY;
  if (!key) return notConfigured(c);
  if (!validAfricasTalkingKey(c.req.query('key'), key)) return forbidden(c);
  const fields = await formFields(c);
  const answer = await handleUssd(c.get('db'), {
    phoneNumber: fields.phoneNumber ?? '',
    text: fields.text ?? '',
  });
  return c.text(answer, 200, { 'Content-Type': 'text/plain; charset=utf-8' });
});

export default app;
