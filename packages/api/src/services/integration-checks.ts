/**
 * Checking an outside service from the console: one harmless call with the settings in use,
 * and a short answer an admin can act on. Every check lists or reads something; none sends a
 * message, writes anything or (except the judge's, which costs a fraction of a cent) costs
 * money. Keys never appear in an answer.
 */
import { getEnv, type ServerEnv } from '@waypoint/core/env';
import nodemailer from 'nodemailer';
import { outboundFetch } from '../channels/providers';
import { smtpOptions } from '../email/send';

export interface CheckResult {
  ok: boolean;
  /** What the service said, in a few words: "Account active", "401: key refused". */
  detail: string;
  latencyMs: number;
  /** Models it offers, when it lists them. */
  models?: string[];
}

const TIMEOUT_MS = 10_000;

/** A service's own words for a refusal, shortened, with anything key-like taken out. */
function refusal(status: number, body: string): string {
  const said = body
    .replace(/(sk|re|AC|SK|AIza|pk|rk)[-_A-Za-z0-9]{8,}/g, '…')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
  const meaning =
    status === 401 || status === 403
      ? 'key refused'
      : status === 404
        ? 'not found (check the account or number id)'
        : status === 429
          ? 'too many requests, try again shortly'
          : status >= 500
            ? 'the service is having trouble'
            : 'request refused';
  return `${status}: ${meaning}${said ? ` (${said})` : ''}`;
}

async function call(
  url: string,
  init: RequestInit,
  read: (body: unknown) => { detail: string; models?: string[] },
): Promise<Omit<CheckResult, 'latencyMs'>> {
  const res = await outboundFetch()(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const text = await res.text();
  if (!res.ok) return { ok: false, detail: refusal(res.status, text) };
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { ok: true, ...read(body) };
}

const list = (body: unknown, key: string): Array<Record<string, unknown>> => {
  const items = (body as Record<string, unknown> | null)?.[key];
  return Array.isArray(items) ? (items as Array<Record<string, unknown>>) : [];
};

const modelNames = (names: unknown[]): string[] =>
  [...new Set(names.filter((n): n is string => typeof n === 'string'))].sort().slice(0, 200);

type Check = (env: ServerEnv) => Promise<Omit<CheckResult, 'latencyMs'>>;

const CHECKS: Record<string, Check> = {
  anthropic: (env) =>
    call(
      'https://api.anthropic.com/v1/models?limit=100',
      {
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY ?? '',
          'anthropic-version': '2023-06-01',
        },
      },
      (body) => {
        const models = modelNames(list(body, 'data').map((m) => m.id));
        return { detail: `Key accepted; ${models.length} models available`, models };
      },
    ),
  openai: (env) =>
    call(
      'https://api.openai.com/v1/models',
      { headers: { Authorization: `Bearer ${env.OPENAI_API_KEY ?? ''}` } },
      (body) => {
        const models = modelNames(list(body, 'data').map((m) => m.id));
        return { detail: `Key accepted; ${models.length} models available`, models };
      },
    ),
  google: (env) =>
    call(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',
      { headers: { 'x-goog-api-key': env.GOOGLE_GENERATIVE_AI_API_KEY ?? '' } },
      (body) => {
        const models = modelNames(
          list(body, 'models').map((m) => String(m.name ?? '').replace(/^models\//, '')),
        );
        return { detail: `Key accepted; ${models.length} models available`, models };
      },
    ),
  ollama: (env) =>
    call(`${(env.OLLAMA_BASE_URL ?? '').replace(/\/+$/, '')}/api/tags`, {}, (body) => {
      const models = modelNames(list(body, 'models').map((m) => m.name));
      return {
        detail: models.length
          ? `Reachable; ${models.length} models installed`
          : 'Reachable, but no model is installed yet (ollama pull …)',
        models,
      };
    }),
  typesafe: (env) =>
    call(
      'https://api.typesafe.ai/v1/systemone',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.TYPESAFE_API_KEY ?? ''}`,
          'Content-Type': 'application/json',
        },
        // The smallest real question there is: a few tokens, a fraction of a cent.
        body: JSON.stringify({
          state: 'The sky is blue.',
          model: env.AI_JUDGE_MODEL,
          questions: { check: { type: 'noul', instructions: 'Is the sky described as blue?' } },
        }),
      },
      (body) => {
        const model = String((body as Record<string, unknown> | null)?.model ?? env.AI_JUDGE_MODEL);
        return { detail: `Key accepted; ${model} answered` };
      },
    ),
  twilio: (env) => {
    const sid = env.TWILIO_ACCOUNT_SID ?? '';
    const auth = Buffer.from(`${sid}:${env.TWILIO_AUTH_TOKEN ?? ''}`).toString('base64');
    return call(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`,
      { headers: { Authorization: `Basic ${auth}` } },
      (body) => {
        const b = body as Record<string, unknown> | null;
        return {
          detail: `Account ${String(b?.status ?? 'found')} (${String(b?.type ?? 'Twilio')})`,
        };
      },
    );
  },
  whatsapp: (env) =>
    call(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(env.WHATSAPP_PHONE_NUMBER_ID ?? '')}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN ?? ''}` } },
      (body) => {
        const b = body as Record<string, unknown> | null;
        return {
          detail: `Number ${String(b?.display_phone_number ?? 'found')}${b?.verified_name ? ` (${String(b.verified_name)})` : ''}`,
        };
      },
    ),
  africastalking: (env) => {
    const username = env.AFRICASTALKING_USERNAME ?? '';
    const host =
      username === 'sandbox' ? 'api.sandbox.africastalking.com' : 'api.africastalking.com';
    return call(
      `https://${host}/version1/user?username=${encodeURIComponent(username)}`,
      { headers: { apiKey: env.AFRICASTALKING_API_KEY ?? '', Accept: 'application/json' } },
      (body) => {
        const balance = (body as { UserData?: { balance?: string } } | null)?.UserData?.balance;
        return { detail: `Account found${balance ? `; balance ${balance}` : ''}` };
      },
    );
  },
  resend: (env) =>
    call(
      'https://api.resend.com/domains',
      { headers: { Authorization: `Bearer ${env.RESEND_API_KEY ?? ''}` } },
      (body) => {
        const domains = list(body, 'data');
        const verified = domains.filter((d) => d.status === 'verified').length;
        return {
          detail: domains.length
            ? `Key accepted; ${verified} of ${domains.length} sending domains verified`
            : 'Key accepted, but no sending domain is set up yet',
        };
      },
    ),
  smtp: async (env) => {
    const transport = nodemailer.createTransport({
      ...smtpOptions(env.SMTP_URL ?? ''),
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout: TIMEOUT_MS,
    });
    try {
      await transport.verify();
      return { ok: true, detail: 'The mail server accepted the sign-in' };
    } finally {
      transport.close();
    }
  },
};

export const CHECKABLE = new Set(Object.keys(CHECKS));

/** Checks one service with the settings in use now. Never throws. */
export async function checkIntegration(id: string): Promise<CheckResult> {
  const check = CHECKS[id];
  const started = Date.now();
  if (!check) return { ok: false, detail: 'This service cannot be checked', latencyMs: 0 };
  try {
    const result = await check(getEnv());
    return { ...result, latencyMs: Date.now() - started };
  } catch (err) {
    const e = err as Error & { code?: string };
    const timedOut = e.name === 'TimeoutError' || e.name === 'AbortError';
    return {
      ok: false,
      detail: timedOut
        ? `No answer within ${TIMEOUT_MS / 1000} seconds`
        : `Could not reach it (${e.code ?? e.name ?? 'error'}${e.message ? `: ${e.message.slice(0, 120)}` : ''})`,
      latencyMs: Date.now() - started,
    };
  }
}
