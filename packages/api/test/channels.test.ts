/**
 * Texting Waypoint end to end: provider webhooks prove who sent them, replies go back in the
 * person's language, nothing anyone texts is stored, and queued messages go out through the
 * configured providers — here a stand-in network that records what would have been sent.
 */
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'waypoint-channels-'));
const SITE = 'https://waypoint.example';
const env: Record<string, string> = {
  WAYPOINT_DATA_DIR: dir,
  WAYPOINT_URL: SITE,
  LOG_LEVEL: 'silent',
  TWILIO_ACCOUNT_SID: 'ACtest',
  TWILIO_AUTH_TOKEN: 'twilio-auth-token',
  TWILIO_SMS_FROM: '+15550001111',
  TWILIO_WHATSAPP_FROM: 'whatsapp:+15550002222',
  WHATSAPP_VERIFY_TOKEN: 'verify-me-please',
  WHATSAPP_APP_SECRET: 'meta-app-secret',
  WHATSAPP_ACCESS_TOKEN: 'meta-access-token',
  WHATSAPP_PHONE_NUMBER_ID: '123456789',
  AFRICASTALKING_USERNAME: 'sandbox',
  AFRICASTALKING_API_KEY: 'at-api-key',
  AFRICASTALKING_WEBHOOK_KEY: 'a-long-random-webhook-key-0123456789',
  WAYPOINT_SMS_NUMBER: '+1 555 000 1111',
  WAYPOINT_WHATSAPP_NUMBER: '+1 555 000 2222',
  WAYPOINT_USSD_CODE: '*384*1234#',
  RESEND_API_KEY: 're_test_key',
  EMAIL_FROM: 'Waypoint <hello@waypoint.example>',
};
Object.assign(process.env, env);
for (const k of [
  'DATABASE_URL',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'OLLAMA_BASE_URL',
  'TWILIO_MESSAGING_SERVICE_SID',
  'AFRICASTALKING_SENDER_ID',
  'SMTP_URL',
])
  delete process.env[k];

type Sent = { url: string; headers: Headers; body: string };
const sent: Sent[] = [];
const network: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const body =
    init?.body instanceof URLSearchParams ? init.body.toString() : String(init?.body ?? '');
  sent.push({ url, headers: new Headers(init?.headers), body });
  if (url.includes('africastalking'))
    return Response.json({
      SMSMessageData: { Recipients: [{ status: 'Success', statusCode: 101 }] },
    });
  return Response.json({ id: 'msg_1' }, { status: 201 });
};

let app: ReturnType<typeof import('../src').createApp>;
let db: typeof import('@waypoint/db');
let api: typeof import('../src');
let providers: typeof import('../src/channels/providers');
let service: typeof import('../src/channels/service');

beforeAll(async () => {
  db = await import('@waypoint/db');
  await db.dbReady();
  api = await import('../src');
  providers = await import('../src/channels/providers');
  service = await import('../src/channels/service');
  providers.setOutboundFetch(network);
  app = api.createApp();
}, 120_000);

afterAll(async () => {
  await service.dispatchSettled();
  providers.setOutboundFetch(null);
  await db.closeDb();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  sent.length = 0;
});

// ─────────────────────────────── helpers ───────────────────────────────

/** Twilio's signature, written out from its documentation (not from the code under test). */
function twilioSign(url: string, params: Record<string, string>): string {
  let data = url;
  for (const key of Object.keys(params).sort()) data += key + params[key];
  return createHmac('sha1', env.TWILIO_AUTH_TOKEN as string)
    .update(data)
    .digest('base64');
}

async function twilio(
  channel: 'sms' | 'whatsapp',
  from: string,
  body: string,
  sign = true,
  sid = `SM${crypto.randomUUID().replace(/-/g, '')}`,
) {
  const path = `/api/channels/twilio/${channel}`;
  const params = {
    From: channel === 'whatsapp' ? `whatsapp:${from}` : from,
    To: '+15550001111',
    Body: body,
    NumMedia: '0',
    MessageSid: sid,
  };
  const res = await app.request(`${SITE}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...(sign ? { 'x-twilio-signature': twilioSign(`${SITE}${path}`, params) } : {}),
    },
    body: new URLSearchParams(params).toString(),
  });
  return { res, xml: await res.text() };
}

const replies = (xml: string) =>
  [...xml.matchAll(/<Message>([\s\S]*?)<\/Message>/g)].map((m) =>
    (m[1] ?? '')
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&'),
  );

async function rows<T>(query: ReturnType<typeof db.sql>): Promise<T[]> {
  return (await db.getDb().execute(query)).rows as T[];
}

// ─────────────────────────────── where to text ───────────────────────────────

describe('where people can text', () => {
  it('lists each channel that is set up, with a link that opens the right app', async () => {
    const res = await app.request(`${SITE}/api/channels`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      sms: { shown: '+1 555 000 1111', href: 'sms:+15550001111' },
      whatsapp: { shown: '+1 555 000 2222', href: 'https://wa.me/15550002222' },
      ussd: { shown: '*384*1234#', href: 'tel:*384*1234%23' },
    });
  });
});

// ─────────────────────────────── Twilio ───────────────────────────────

describe('SMS through Twilio', () => {
  it('matches the signature example in Twilio’s documentation', () => {
    const params = {
      CallSid: 'CA1234567890ABCDE',
      Caller: '+12349013030',
      Digits: '1234',
      From: '+12349013030',
      To: '+18005551212',
    };
    const url = 'https://mycompany.com/myapp.php?foo=1&bar=2';
    expect(providers.twilioSignature(url, params, '12345')).toBe('0/KCTR6DLpKmkAf8muzZqo1nDgQ=');
    expect(providers.validTwilioRequest(url, params, '0/KCTR6DLpKmkAf8muzZqo1nDgQ=', '12345')).toBe(
      true,
    );
    expect(
      providers.validTwilioRequest(
        url,
        { ...params, Digits: '9' },
        '0/KCTR6DLpKmkAf8muzZqo1nDgQ=',
        '12345',
      ),
    ).toBe(false);
  });

  it('refuses anything Twilio did not sign', async () => {
    const { res } = await twilio('sms', '+15557770001', 'HELLO', false);
    expect(res.status).toBe(403);
    const forged = await app.request(`${SITE}/api/channels/twilio/sms`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-twilio-signature': twilioSign(`${SITE}/api/channels/twilio/sms`, {
          From: '+1',
          Body: 'x',
        }),
      },
      body: new URLSearchParams({ From: '+15557770001', Body: 'HELLO' }).toString(),
    });
    expect(forged.status).toBe(403);
  });

  it('welcomes a new number, answers in its language, and keeps no words', async () => {
    const number = '+15557770002';
    const first = await twilio('sms', number, 'HELLO');
    expect(first.res.status).toBe(200);
    expect(first.res.headers.get('content-type')).toContain('text/xml');
    const welcome = replies(first.xml).join('\n');
    expect(welcome).toContain('Waypoint');
    expect(welcome).toContain('HELP');

    const lang = await twilio('sms', number, 'LANG 3');
    expect(replies(lang.xml).join(' ')).toMatch(/español/i);
    const help = await twilio('sms', number, 'AYUDA');
    expect(help.res.status).toBe(200);
    expect(replies(help.xml).join(' ')).toMatch(/COUNTRY|emergencia/i);

    // The number is kept sealed and looked up by a keyed hash; the words are not kept at all.
    const stored = await rows<Record<string, unknown>>(
      db.sql`select * from channel_identities where channel = 'sms'`,
    );
    const everything = JSON.stringify(stored);
    expect(everything).not.toContain('5557770002');
    expect(everything).not.toMatch(/AYUDA|HELLO/);
    expect(stored.some((r) => r.locale === 'es')).toBe(true);
    // Only counts: channel, direction, kind, day.
    const stats = await rows<{ direction: string; intent: string; n: number }>(
      db.sql`select direction, intent, n from channel_stats where channel = 'sms'`,
    );
    expect(stats.find((s) => s.direction === 'in' && s.intent === 'help')?.n).toBeGreaterThan(0);
    expect(stats.find((s) => s.direction === 'out' && s.intent === 'reply')?.n).toBeGreaterThan(0);
  });

  it('puts safety first for someone in crisis, and records only what the rules found', async () => {
    const before = await rows<{ n: number }>(
      db.sql`select count(*)::int as n from crisis_events where channel = 'sms'`,
    );
    const { res, xml } = await twilio('sms', '+15557770003', 'I want to end my life tonight');
    expect(res.status).toBe(200);
    const text = replies(xml).join('\n');
    expect(text.length).toBeGreaterThan(20);
    expect(text).not.toMatch(/^AI:/m);
    const after = await rows<{ n: number; categories: string[] }>(
      db.sql`select count(*)::int as n from crisis_events where channel = 'sms'`,
    );
    expect(after[0]?.n).toBe((before[0]?.n ?? 0) + 1);
    const events = JSON.stringify(
      await rows(db.sql`select * from crisis_events where channel = 'sms'`),
    );
    expect(events).not.toMatch(/end my life|tonight/);
  });

  it('asks a number sending too much to slow down once, then goes quiet', async () => {
    const number = '+15557770004';
    let slowDowns = 0;
    let silent = 0;
    for (let i = 0; i < 33; i++) {
      const { xml } = await twilio('sms', number, 'MENU');
      const r = replies(xml);
      if (r.some((m) => /a lot of messages/i.test(m))) slowDowns++;
      if (r.length === 0) silent++;
    }
    expect(slowDowns).toBe(1);
    expect(silent).toBe(2);
  });

  it('still answers someone in danger whose number is over its limit', async () => {
    const number = '+15557770014';
    for (let i = 0; i < 31; i++) await twilio('sms', number, 'MENU');
    const before = await rows<{ n: number }>(
      db.sql`select count(*)::int as n from crisis_events where channel = 'sms'`,
    );
    const { xml } = await twilio('sms', number, 'I want to end my life tonight');
    const text = replies(xml).join(' ');
    expect(text).toMatch(/988|911/);
    expect(text).not.toMatch(/a lot of messages/i);
    const after = await rows<{ n: number }>(
      db.sql`select count(*)::int as n from crisis_events where channel = 'sms'`,
    );
    expect(after[0]?.n).toBe((before[0]?.n ?? 0) + 1);
    // The extra allowance is small, so it cannot be used to make Waypoint send without end.
    let answered = 0;
    for (let i = 0; i < 8; i++)
      if (replies((await twilio('sms', number, 'I want to end my life tonight')).xml).length)
        answered++;
    expect(answered).toBe(4);
  });

  it('answers a message the provider delivers twice only once', async () => {
    const sid = 'SM0123456789abcdef0123456789abcdef';
    const first = await twilio('sms', '+15557770015', 'HELP', true, sid);
    expect(replies(first.xml).length).toBeGreaterThan(0);
    const replay = await twilio('sms', '+15557770015', 'HELP', true, sid);
    expect(replay.res.status).toBe(200);
    expect(replies(replay.xml)).toHaveLength(0);
  });

  it('does not reply to numbers outside the countries it serves, except to someone in danger', async () => {
    const elsewhere = '+8881234567'; // no country Waypoint has help lines for
    const menu = await twilio('sms', elsewhere, 'HELLO');
    expect(menu.res.status).toBe(200);
    expect(replies(menu.xml)).toHaveLength(0);
    const known = await rows<{ n: number }>(
      db.sql`select count(*)::int as n from channel_identities where address_hash = ${service.addressHash(elsewhere)}`,
    );
    expect(known[0]?.n).toBe(0);
    const danger = await twilio('sms', elsewhere, 'I want to kill myself tonight');
    expect(replies(danger.xml).join(' ').length).toBeGreaterThan(20);
  });

  it('stops replying when the hourly ceiling for the whole service is reached, except to someone in danger', async () => {
    const { resetEnvForTests } = await import('@waypoint/core/env');
    await db.getDb().execute(db.sql`delete from rate_limits where key like 'api:ch-out%'`);
    process.env.WAYPOINT_TEXT_REPLIES_PER_HOUR = '3';
    resetEnvForTests();
    try {
      let answered = 0;
      for (let i = 0; i < 6; i++)
        if (replies((await twilio('sms', `+1555777002${i}`, 'HELP')).xml).length) answered++;
      expect(answered).toBe(3);
      const danger = await twilio('sms', '+15557770029', 'I want to end my life tonight');
      expect(replies(danger.xml).join(' ')).toMatch(/988|911/);
    } finally {
      delete process.env.WAYPOINT_TEXT_REPLIES_PER_HOUR;
      resetEnvForTests();
      await db.getDb().execute(db.sql`delete from rate_limits where key like 'api:ch-out%'`);
    }
  });
});

// ─────────────────────────────── WhatsApp Cloud API ───────────────────────────────

describe('WhatsApp through the Cloud API', () => {
  const metaBody = (from: string, text: string) =>
    JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                messages: [
                  {
                    from,
                    id: `wamid.${crypto.randomUUID()}`,
                    timestamp: '1',
                    type: 'text',
                    text: { body: text },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
  const sign = (raw: string, secret = env.WHATSAPP_APP_SECRET as string) =>
    `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;

  it('reads messages, and ignores reactions, system notices and delivery reports', () => {
    const value = (messages: unknown[]) => ({ entry: [{ changes: [{ value: { messages } }] }] });
    expect(
      providers.parseMetaWebhook(
        value([
          { from: '15557770030', id: 'wamid.a', type: 'reaction', reaction: { emoji: '👍' } },
          { from: '15557770030', id: 'wamid.b', type: 'system', system: { body: 'changed' } },
          { from: '15557770030', id: 'wamid.c', type: 'unsupported' },
          { from: '15557770030', id: 'wamid.d', type: 'audio', audio: { id: 'x' } },
          { from: '15557770030', id: 'wamid.e', type: 'text', text: { body: 'HELP' } },
        ]),
      ),
    ).toEqual([
      { from: '15557770030', id: 'wamid.d', text: null },
      { from: '15557770030', id: 'wamid.e', text: 'HELP' },
    ]);
    expect(
      providers.parseMetaWebhook({ entry: [{ changes: [{ value: { statuses: [{}] } }] }] }),
    ).toEqual([]);
  });

  it('answers a redelivered WhatsApp message once', async () => {
    const raw = metaBody('15557770031', 'HELP');
    for (let i = 0; i < 2; i++) {
      const res = await app.request(`${SITE}/api/channels/whatsapp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hub-signature-256': sign(raw) },
        body: raw,
      });
      expect(res.status).toBe(200);
      await service.dispatchSettled();
    }
    const toNumber = sent.filter((s) => s.body.includes('15557770031'));
    expect(toNumber).toHaveLength(1);
  });

  it('answers Meta’s verification only with the right token', async () => {
    const ok = await app.request(
      `${SITE}/api/channels/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me-please&hub.challenge=1158201444`,
    );
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe('1158201444');
    const wrong = await app.request(
      `${SITE}/api/channels/whatsapp?hub.mode=subscribe&hub.verify_token=guess&hub.challenge=1`,
    );
    expect(wrong.status).toBe(403);
  });

  it('refuses a body that was not signed with the app secret', async () => {
    const raw = metaBody('15557770005', 'HELP');
    for (const signature of [undefined, sign(raw, 'someone-else'), sign(`${raw} `)]) {
      const res = await app.request(`${SITE}/api/channels/whatsapp`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(signature ? { 'x-hub-signature-256': signature } : {}),
        },
        body: raw,
      });
      expect(res.status).toBe(403);
    }
    expect(sent).toHaveLength(0);
  });

  it('replies through the API, not in the webhook answer', async () => {
    const raw = metaBody(
      '15557770005',
      'CHECK Your parcel is on hold. Pay the 1.99 delivery fee today or it will be returned: parcel-help.info/pay',
    );
    const res = await app.request(`${SITE}/api/channels/whatsapp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': sign(raw) },
      body: raw,
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('OK');
    await service.dispatchSettled();
    const toMeta = sent.filter((s) => s.url.startsWith('https://graph.facebook.com/'));
    expect(toMeta.length).toBeGreaterThan(0);
    expect(toMeta[0]?.url).toContain('/123456789/messages');
    expect(toMeta[0]?.headers.get('authorization')).toBe('Bearer meta-access-token');
    const payload = JSON.parse(toMeta[0]?.body ?? '{}') as {
      to: string;
      type: string;
      text: { body: string };
    };
    expect(payload.to).toBe('15557770005');
    expect(payload.type).toBe('text');
    expect(toMeta.map((m) => m.body).join(' ')).toMatch(/scam/i);
    // Sent messages keep only their kind.
    const leftovers = await rows<{ payload: Record<string, unknown>; status: string }>(
      db.sql`select payload, status from outbox where channel = 'whatsapp'`,
    );
    expect(leftovers.length).toBeGreaterThan(0);
    for (const row of leftovers) {
      expect(row.status).toBe('sent');
      expect(row.payload).toEqual({ template: 'text' });
    }
  });
});

// ─────────────────────────────── Africa's Talking ───────────────────────────────

describe("SMS and USSD through Africa's Talking", () => {
  const key = env.AFRICASTALKING_WEBHOOK_KEY as string;
  const form = (fields: Record<string, string>) => ({
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });

  it('needs the secret key in the callback address', async () => {
    for (const q of ['', '?key=wrong']) {
      const res = await app.request(
        `${SITE}/api/channels/africastalking/sms${q}`,
        form({ from: '+254711000001', text: 'HELP' }),
      );
      expect(res.status).toBe(403);
    }
  });

  it('replies by SMS through the API, in Swahili when asked', async () => {
    const res = await app.request(
      `${SITE}/api/channels/africastalking/sms?key=${key}`,
      form({ from: '+254711000001', to: '22384', text: 'MSAADA', id: 'ATXid_1' }),
    );
    expect(res.status).toBe(200);
    await service.dispatchSettled();
    const out = sent.filter((s) => s.url.includes('africastalking.com/version1/messaging'));
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]?.url).toContain('api.sandbox.africastalking.com');
    expect(out[0]?.headers.get('apikey')).toBe('at-api-key');
    const params = new URLSearchParams(out[0]?.body);
    expect(params.get('username')).toBe('sandbox');
    expect(params.get('to')).toBe('+254711000001');
    // A Kenyan number gets Kenya's lines without having to say so.
    expect(out.map((o) => new URLSearchParams(o.body).get('message')).join(' ')).toMatch(
      /Kenya|999|112/,
    );
  });

  it('walks a USSD menu that fits one screen', async () => {
    const start = await app.request(
      `${SITE}/api/channels/africastalking/ussd?key=${key}`,
      form({
        sessionId: 'ATUid_1',
        serviceCode: '*384*1234#',
        phoneNumber: '+254711000002',
        text: '',
      }),
    );
    const menu = await start.text();
    expect(menu.startsWith('CON ')).toBe(true);
    expect(menu.length - 4).toBeLessThanOrEqual(182);
    const help = await app.request(
      `${SITE}/api/channels/africastalking/ussd?key=${key}`,
      form({
        sessionId: 'ATUid_1',
        serviceCode: '*384*1234#',
        phoneNumber: '+254711000002',
        text: '1',
      }),
    );
    const lines = await help.text();
    expect(lines.startsWith('END ')).toBe(true);
    expect(lines.length - 4).toBeLessThanOrEqual(182);
  });
});

// ─────────────────────────────── The outbox ───────────────────────────────

describe('sending queued messages', () => {
  it('never sends a later message to a number that texted STOP', async () => {
    const number = '+15557770006';
    const stop = await twilio('sms', number, 'STOP');
    expect(replies(stop.xml).join(' ')).toMatch(/no more texts/i);
    const [identity] = await rows<{ id: string }>(
      db.sql`select id from channel_identities where channel = 'sms' and opted_out_at is not null limit 1`,
    );
    expect(identity).toBeTruthy();
    await service.queueText(db.getDb(), {
      channel: 'sms',
      provider: 'twilio',
      e164: number,
      body: 'A later answer',
      identityId: identity?.id ?? '',
      respectOptOut: true,
    });
    await api.jobs.dispatchOutbox(db.getDb());
    expect(sent.filter((s) => s.body.includes('later'))).toHaveLength(0);
    const [row] = await rows<{ status: string; payload: Record<string, unknown> }>(
      db.sql`select status, payload from outbox where status = 'cancelled' order by created_at desc limit 1`,
    );
    expect(row?.status).toBe('cancelled');
    expect(JSON.stringify(row?.payload)).not.toContain('later');
  });

  it('sends everything that is waiting in one run, sign-in codes first', async () => {
    await api.jobs.dispatchOutbox(db.getDb());
    sent.length = 0;
    for (let i = 0; i < 45; i++)
      await service.queueText(db.getDb(), {
        channel: 'sms',
        provider: 'twilio',
        e164: '+15557770040',
        body: `Reply ${i}`,
        identityId: 'x',
      });
    // Queued last, behind a pile of replies: a code is only good for five minutes.
    const { sealWithKek } = await import('@waypoint/core/privacy');
    await db.enqueueMessage(db.getDb(), {
      channel: 'sms',
      recipientRef: sealWithKek('+15557770041', 'outbox'),
      payload: { template: 'otp', locale: 'en' },
      secret: { code: '123456' },
    });
    const handled = await api.jobs.dispatchOutbox(db.getDb());
    expect(handled).toBe(46);
    const to = sent.map((s) => new URLSearchParams(s.body).get('To'));
    expect(to).toHaveLength(46);
    expect(to[0]).toBe('+15557770041');
    // Nothing is left waiting, and a finished message keeps neither words nor recipient.
    const left = await rows<{ status: string; recipient_ref: string; payload: unknown }>(
      db.sql`select status, recipient_ref, payload from outbox where status <> 'queued'`,
    );
    expect(left.length).toBeGreaterThanOrEqual(46);
    for (const row of left) expect(row.recipient_ref).toBe('');
    const waiting = await rows<{ n: number }>(
      db.sql`select count(*)::int as n from outbox where status = 'queued'`,
    );
    expect(waiting[0]?.n).toBe(0);
  });

  it('keeps the words of a waiting message sealed', async () => {
    await service.queueText(db.getDb(), {
      channel: 'sms',
      provider: 'twilio',
      e164: '+15557770007',
      body: 'Private words',
      identityId: 'x',
    });
    const waiting = await rows<{ payload: Record<string, unknown>; recipient_ref: string }>(
      db.sql`select payload, recipient_ref from outbox where status = 'queued'`,
    );
    const raw = JSON.stringify(waiting);
    expect(raw).not.toContain('Private words');
    expect(raw).not.toContain('5557770007');
    await api.jobs.dispatchOutbox(db.getDb());
    const twilioCall = sent.find((s) => s.url.includes('api.twilio.com'));
    expect(twilioCall?.url).toBe('https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages.json');
    const params = new URLSearchParams(twilioCall?.body);
    expect(params.get('To')).toBe('+15557770007');
    expect(params.get('From')).toBe('+15550001111');
    expect(params.get('Body')).toBe('Private words');
  });

  it('sends a sign-in code by SMS in the language of the page, and drops stale ones', async () => {
    const res = await app.request(`${SITE}/api/auth/phone-number/send-otp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: SITE, cookie: 'NEXT_LOCALE=fr' },
      body: JSON.stringify({ phoneNumber: '+15557770008' }),
    });
    expect(res.status).toBe(200);
    const [queued] = await rows<{ payload: Record<string, unknown> }>(
      db.sql`select payload from outbox where status = 'queued' and payload->>'template' = 'otp'`,
    );
    expect(queued?.payload.code).toBeUndefined();
    expect(typeof queued?.payload.secret).toBe('string');
    await api.jobs.dispatchOutbox(db.getDb());
    const code = sent.find((s) => new URLSearchParams(s.body).get('To') === '+15557770008');
    const body = new URLSearchParams(code?.body).get('Body') ?? '';
    expect(body).toMatch(/^Votre code Waypoint : \d{6}\./);

    // A code that could not go out within five minutes is useless: it is dropped, not sent.
    await db.getDb().execute(db.sql`
      insert into outbox (id, channel, recipient_ref, payload, created_at)
      values (gen_random_uuid(), 'sms', 'x', '{"template":"otp"}'::jsonb, now() - interval '6 minutes')`);
    sent.length = 0;
    await api.jobs.dispatchOutbox(db.getDb());
    expect(sent).toHaveLength(0);
    const [stale] = await rows<{ status: string; last_error: string }>(
      db.sql`select status, last_error from outbox where status = 'cancelled' order by created_at limit 1`,
    );
    expect(stale).toMatchObject({ status: 'cancelled', last_error: 'Too old to be useful' });
  });

  it('sends the confirmation email through Resend, in the person’s language', async () => {
    const email = `ana-${crypto.randomUUID().slice(0, 8)}@example.org`;
    const res = await app.request(`${SITE}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: SITE,
        'accept-language': 'pt-BR,pt;q=0.9',
      },
      body: JSON.stringify({ email, password: 'correct horse battery', name: 'Ana' }),
    });
    expect(res.status).toBe(200);
    await api.jobs.dispatchOutbox(db.getDb());
    const mail = sent.find((s) => s.url === 'https://api.resend.com/emails');
    expect(mail?.headers.get('authorization')).toBe('Bearer re_test_key');
    const message = JSON.parse(mail?.body ?? '{}') as {
      from: string;
      to: string[];
      subject: string;
      text: string;
      html: string;
    };
    expect(message.from).toBe('Waypoint <hello@waypoint.example>');
    expect(message.to).toEqual([email]);
    expect(message.subject).toBe('Confirme seu endereço de e-mail');
    expect(message.text).toContain('Olá, Ana');
    expect(message.text).toMatch(/https:\/\/waypoint\.example\/api\/auth\/verify-email\?token=/);
    expect(message.html).toContain('lang="pt"');
    // Once sent, the link is gone from the database.
    const done = await rows<{ payload: Record<string, unknown> }>(
      db.sql`select payload from outbox where payload->>'template' = 'verify-email'`,
    );
    expect(done.every((r) => Object.keys(r.payload).join() === 'template')).toBe(true);
  });

  it('retries a message the provider refused, keeping no address in the error', async () => {
    providers.setOutboundFetch(
      async () => new Response('The number +15557770009 is not valid', { status: 400 }),
    );
    try {
      await service.queueText(db.getDb(), {
        channel: 'sms',
        provider: 'twilio',
        e164: '+15557770009',
        body: 'Hello',
        identityId: 'y',
      });
      await api.jobs.dispatchOutbox(db.getDb());
      const [row] = await rows<{ status: string; last_error: string; attempts: number }>(
        db.sql`select status, last_error, attempts from outbox where last_error like 'Twilio answered 400%'`,
      );
      expect(row?.status).toBe('queued');
      expect(row?.attempts).toBe(1);
      expect(row?.last_error).not.toContain('5557770009');
    } finally {
      providers.setOutboundFetch(network);
    }
  });
});

// ─────────────────────────────── Keeping little ───────────────────────────────

describe('what is kept', () => {
  it('forgets numbers that have been quiet for 180 days', async () => {
    await db.getDb().execute(db.sql`
      update channel_identities set last_seen_at = now() - interval '181 days'
      where channel = 'ussd'`);
    const result = await api.jobs.retention(db.getDb());
    expect(result.numbers).toBeGreaterThan(0);
    const [left] = await rows<{ n: number }>(
      db.sql`select count(*)::int as n from channel_identities where channel = 'ussd'`,
    );
    expect(left?.n).toBe(0);
  });

  it('shows staff counts only', async () => {
    const overview = await api.admin.adminOverview(db.getDb());
    expect(overview.channels.ready).toEqual({ sms: true, whatsapp: true, ussd: true, email: true });
    const sms = overview.channels.byChannel.find((c) => c.channel === 'sms');
    expect(sms?.in).toBeGreaterThan(0);
    expect(sms?.out).toBeGreaterThan(0);
    expect(overview.channels.byKind.safety).toBeGreaterThan(0);
    expect(overview.channels.codes).toBeGreaterThan(0);
    expect(JSON.stringify(overview.channels)).not.toMatch(/\+1555|5557770/);
  });
});
