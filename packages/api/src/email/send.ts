/**
 * Sending email through whichever provider is configured: Resend (RESEND_API_KEY) or any
 * SMTP server (SMTP_URL). Both need EMAIL_FROM.
 */
import { getEnv } from '@waypoint/core/env';
import nodemailer, { type Transporter } from 'nodemailer';
import { outboundFetch } from '../channels/providers';
import type { RenderedEmail } from './render';

type Fetch = typeof fetch;

export function emailReady(): boolean {
  const env = getEnv();
  return Boolean(env.EMAIL_FROM && (env.RESEND_API_KEY || env.SMTP_URL));
}

let smtp: { url: string; transport: Transporter } | undefined;

export async function sendEmail(
  to: string,
  mail: RenderedEmail,
  fetchImpl: Fetch = outboundFetch(),
): Promise<void> {
  const env = getEnv();
  const from = env.EMAIL_FROM;
  if (!from) throw new Error('EMAIL_FROM is not set');
  if (env.RESEND_API_KEY) {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok)
      throw new Error(`Resend answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return;
  }
  if (env.SMTP_URL) {
    if (smtp?.url !== env.SMTP_URL)
      smtp = { url: env.SMTP_URL, transport: nodemailer.createTransport(env.SMTP_URL) };
    await smtp.transport.sendMail({
      from,
      to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    return;
  }
  throw new Error('No email provider is configured');
}
