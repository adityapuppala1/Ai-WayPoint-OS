/**
 * Emails as plain text and simple, accessible HTML: one message, one button, the link
 * written out too, and a footer that says Waypoint never asks for passwords or payments.
 */
import { LOCALES, type Locale } from '@waypoint/core';
import { plainName } from '@waypoint/core/privacy';
import { EMAIL_COPY } from './copy';

export type EmailTemplate =
  | 'verify-email'
  | 'reset-password'
  | 'account-exists'
  | 'org-invite'
  | 'staff-invite';
export const EMAIL_TEMPLATES: readonly EmailTemplate[] = [
  'verify-email',
  'reset-password',
  'account-exists',
  'org-invite',
  'staff-invite',
];

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export const isEmailTemplate = (v: unknown): v is EmailTemplate =>
  typeof v === 'string' && (EMAIL_TEMPLATES as readonly string[]).includes(v);

export const toLocale = (v: unknown): Locale | null =>
  typeof v === 'string' && (LOCALES as readonly string[]).includes(v) ? (v as Locale) : null;

const fill = (template: string, vars: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

const NBSP = String.fromCharCode(0xa0);
/** French puts a no-break space before : ; ! and ?. */
const typography = (s: string, locale: Locale) =>
  locale === 'fr' ? s.replace(/ ([:;!?])/g, `${NBSP}$1`) : s;

/** Names that are placeholders, not a person's name. */
const PLACEHOLDER_NAMES = new Set(['guest', 'waypoint user', 'friend', 'administrator']);

export function renderEmail(
  template: EmailTemplate,
  payload: Record<string, unknown>,
  locale: Locale,
): RenderedEmail | null {
  const url = typeof payload.url === 'string' ? payload.url : '';
  if (!/^https?:\/\//.test(url)) return null;
  const copy = EMAIL_COPY[locale];
  const mail = {
    'verify-email': copy.verify,
    'reset-password': copy.reset,
    'account-exists': copy.exists,
    'org-invite': copy.invite,
    'staff-invite': copy.staffInvite,
  }[template];
  const name = plainName(typeof payload.name === 'string' ? payload.name : '', 40);
  const inviter = plainName(typeof payload.inviter === 'string' ? payload.inviter : '');
  const vars = {
    name,
    inviter: inviter && !PLACEHOLDER_NAMES.has(inviter.toLowerCase()) ? inviter : copy.someone,
    role: payload.role === 'admin' ? copy.roles.admin : copy.roles.staff,
    organisation: plainName(
      typeof payload.organization === 'string' ? payload.organization : '',
      80,
    ),
  };
  const t = (s: string) => typography(fill(s, vars), locale);
  const greeting =
    name && !PLACEHOLDER_NAMES.has(name.toLowerCase()) ? t(copy.greeting) : t(copy.greetingNoName);
  const subject = t(mail.subject);
  const body = t(mail.body);
  const note = t(mail.note);
  const footer = t(copy.footer);
  const fallback = t(copy.linkFallback);
  const button = t(mail.button);

  const text = [greeting, '', body, '', `${button}: ${url}`, '', note, '', '—', footer].join('\n');

  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const align = dir === 'rtl' ? 'right' : 'left';
  const href = escapeHtml(url);
  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f2ee;color:#1c2230;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e3ded4;">
<tr><td style="padding:28px 28px 8px;text-align:${align};">
<p style="margin:0 0 20px;font-size:18px;font-weight:700;letter-spacing:.2px;"><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#f2c230;margin-${dir === 'rtl' ? 'left' : 'right'}:8px;"></span>Waypoint</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.5;">${escapeHtml(greeting)}</p>
<p style="margin:0 0 24px;font-size:16px;line-height:1.5;">${escapeHtml(body)}</p>
<p style="margin:0 0 24px;"><a href="${href}" style="display:inline-block;background:#f2c230;color:#1c2230;text-decoration:none;font-weight:700;font-size:16px;padding:14px 22px;border-radius:10px;">${escapeHtml(button)}</a></p>
<p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#4a5163;">${escapeHtml(note)}</p>
<p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:#4a5163;">${escapeHtml(fallback)}</p>
<p style="margin:0 0 24px;font-size:13px;line-height:1.5;word-break:break-all;direction:ltr;text-align:${align};"><a href="${href}" style="color:#1c2230;">${href}</a></p>
</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #efebe3;text-align:${align};">
<p style="margin:0;font-size:12px;line-height:1.5;color:#6a7082;">${escapeHtml(footer)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return { subject, text, html };
}
