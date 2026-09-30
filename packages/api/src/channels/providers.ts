/**
 * Messaging providers: checking that a webhook really came from the provider, reading what
 * it sent, and sending replies. Twilio (SMS and WhatsApp), the WhatsApp Cloud API (Meta) and
 * Africa's Talking (SMS and USSD). Any one is enough.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getEnv } from '@waypoint/core/env';

type Fetch = typeof fetch;

let outbound: Fetch | null = null;
/** Where messages go out: the network, or a stand-in during tests. */
export const outboundFetch = (): Fetch => outbound ?? fetch;
/** Tests replace the network with a stand-in (and pass null to put it back). */
export function setOutboundFetch(f: Fetch | null): void {
  outbound = f;
}

export type TextChannel = 'sms' | 'whatsapp';
export type Provider = 'twilio' | 'meta' | 'africastalking';
export const isProvider = (v: unknown): v is Provider =>
  v === 'twilio' || v === 'meta' || v === 'africastalking';

/** Compares secrets in constant time. */
export function sameSecret(a: string, b: string): boolean {
  return sameText(a, b);
}

function sameText(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// ─────────────────────────────── Twilio ───────────────────────────────

/**
 * Twilio signs every webhook: HMAC-SHA1, keyed with the auth token, over the full URL it
 * called followed by each POST parameter (sorted by name) as name then value; base64.
 */
export function twilioSignature(
  url: string,
  params: Record<string, string>,
  authToken: string,
): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
}

export function validTwilioRequest(
  url: string,
  params: Record<string, string>,
  signature: string | null | undefined,
  authToken: string,
): boolean {
  return Boolean(signature) && sameText(twilioSignature(url, params, authToken), signature ?? '');
}

const xmlEscape = (s: string) =>
  s.replace(
    /[<>&'"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] ?? c,
  );

/** A TwiML answer: the replies go back on the same request, no second call needed. */
export function twiml(messages: string[]): string {
  const body = messages.map((m) => `<Message>${xmlEscape(m)}</Message>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

export function twilioReady(channel: TextChannel): boolean {
  const env = getEnv();
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return false;
  return channel === 'sms'
    ? Boolean(env.TWILIO_SMS_FROM || env.TWILIO_MESSAGING_SERVICE_SID)
    : Boolean(env.TWILIO_WHATSAPP_FROM);
}

export async function sendTwilio(
  channel: TextChannel,
  to: string,
  body: string,
  fetchImpl: Fetch = outboundFetch(),
): Promise<void> {
  const env = getEnv();
  const sid = env.TWILIO_ACCOUNT_SID ?? '';
  const params = new URLSearchParams({
    To: channel === 'whatsapp' ? `whatsapp:${to}` : to,
    Body: body,
  });
  if (channel === 'whatsapp') {
    const from = env.TWILIO_WHATSAPP_FROM ?? '';
    params.set('From', from.startsWith('whatsapp:') ? from : `whatsapp:${from}`);
  } else if (env.TWILIO_MESSAGING_SERVICE_SID) {
    params.set('MessagingServiceSid', env.TWILIO_MESSAGING_SERVICE_SID);
  } else {
    params.set('From', env.TWILIO_SMS_FROM ?? '');
  }
  const res = await fetchImpl(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${env.TWILIO_AUTH_TOKEN ?? ''}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!res.ok)
    throw new Error(`Twilio answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

// ─────────────────────────────── WhatsApp Cloud API (Meta) ───────────────────────────────

/** Meta signs webhooks with HMAC-SHA256 of the raw body, keyed with the app secret. */
export function validMetaSignature(
  rawBody: string,
  header: string | null | undefined,
  appSecret: string,
): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')}`;
  return sameText(expected, header);
}

export interface InboundMessage {
  from: string;
  /** The text, or null for things we cannot read (voice notes, images, stickers…). */
  text: string | null;
}

/** Messages in a WhatsApp Cloud API webhook (delivery statuses and the rest are ignored). */
export function parseMetaWebhook(body: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  const entries = (body as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const messages = (change as { value?: { messages?: unknown[] } })?.value?.messages;
      if (!Array.isArray(messages)) continue;
      for (const m of messages) {
        const msg = m as {
          from?: unknown;
          type?: unknown;
          text?: { body?: unknown };
          button?: { text?: unknown };
          interactive?: { button_reply?: { title?: unknown }; list_reply?: { title?: unknown } };
        };
        if (typeof msg.from !== 'string') continue;
        const text =
          msg.type === 'text' && typeof msg.text?.body === 'string'
            ? msg.text.body
            : msg.type === 'button' && typeof msg.button?.text === 'string'
              ? msg.button.text
              : typeof msg.interactive?.button_reply?.title === 'string'
                ? msg.interactive.button_reply.title
                : typeof msg.interactive?.list_reply?.title === 'string'
                  ? msg.interactive.list_reply.title
                  : null;
        out.push({ from: msg.from, text });
      }
    }
  }
  return out;
}

export function metaReady(): boolean {
  const env = getEnv();
  return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
}

export async function sendWhatsAppCloud(
  to: string,
  body: string,
  fetchImpl: Fetch = outboundFetch(),
): Promise<void> {
  const env = getEnv();
  const res = await fetchImpl(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(env.WHATSAPP_PHONE_NUMBER_ID ?? '')}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to.replace(/^\+/, ''),
        type: 'text',
        text: { preview_url: false, body },
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!res.ok)
    throw new Error(`WhatsApp answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

// ─────────────────────────────── Africa's Talking ───────────────────────────────

/** Africa's Talking does not sign callbacks: the callback URL carries a long secret instead. */
export function validAfricasTalkingKey(given: string | null | undefined, key: string): boolean {
  return Boolean(given) && sameText(given ?? '', key);
}

export function africasTalkingReady(): boolean {
  const env = getEnv();
  return Boolean(env.AFRICASTALKING_USERNAME && env.AFRICASTALKING_API_KEY);
}

export async function sendAfricasTalkingSms(
  to: string,
  body: string,
  fetchImpl: Fetch = outboundFetch(),
): Promise<void> {
  const env = getEnv();
  const username = env.AFRICASTALKING_USERNAME ?? '';
  const host = username === 'sandbox' ? 'api.sandbox.africastalking.com' : 'api.africastalking.com';
  const params = new URLSearchParams({ username, to, message: body });
  if (env.AFRICASTALKING_SENDER_ID) params.set('from', env.AFRICASTALKING_SENDER_ID);
  const res = await fetchImpl(`https://${host}/version1/messaging`, {
    method: 'POST',
    headers: {
      apiKey: env.AFRICASTALKING_API_KEY ?? '',
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok)
    throw new Error(`Africa's Talking answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json().catch(() => null)) as {
    SMSMessageData?: { Recipients?: Array<{ status?: string; statusCode?: number }> };
  } | null;
  const recipient = data?.SMSMessageData?.Recipients?.[0];
  if (
    recipient &&
    recipient.statusCode !== 100 &&
    recipient.statusCode !== 101 &&
    recipient.statusCode !== 102
  )
    throw new Error(`Africa's Talking did not send: ${recipient.status ?? recipient.statusCode}`);
}

// ─────────────────────────────── Choosing a sender ───────────────────────────────

/** Who sends on a channel: the provider the message arrived through, else any that is set up. */
export function senderFor(channel: TextChannel, preferred?: Provider | null): Provider | null {
  const ready: Record<Provider, boolean> = {
    twilio: twilioReady(channel),
    meta: channel === 'whatsapp' && metaReady(),
    africastalking: channel === 'sms' && africasTalkingReady(),
  };
  if (preferred && ready[preferred]) return preferred;
  const order: Provider[] =
    channel === 'whatsapp' ? ['meta', 'twilio'] : ['twilio', 'africastalking'];
  return order.find((p) => ready[p]) ?? null;
}

export async function sendText(
  provider: Provider,
  channel: TextChannel,
  to: string,
  body: string,
  fetchImpl: Fetch = outboundFetch(),
): Promise<void> {
  if (provider === 'twilio') return sendTwilio(channel, to, body, fetchImpl);
  if (provider === 'meta') return sendWhatsAppCloud(to, body, fetchImpl);
  return sendAfricasTalkingSms(to, body, fetchImpl);
}

/** Which channels can receive and answer messages, for the website and the admin console. */
export function channelsReady(): { sms: boolean; whatsapp: boolean; ussd: boolean } {
  const env = getEnv();
  return {
    sms: Boolean(senderFor('sms')),
    whatsapp: Boolean(senderFor('whatsapp')),
    ussd: Boolean(env.AFRICASTALKING_WEBHOOK_KEY),
  };
}
