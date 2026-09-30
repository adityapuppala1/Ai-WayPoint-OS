/**
 * "Get help now" for one country: its emergency numbers, checked support services and the
 * global directories, with ready-to-use links for call, text and WhatsApp buttons. Pure data
 * and lookups, so the same answer is available on the server, on the web and offline in the
 * mobile app.
 */
import { getCountry, getEmergency, getSupportResources, normalizeCountry } from './lookup';
import { whatsappLink } from './phone';
import type { SourceRef, SupportKind, SupportResource } from './types';

export interface SupportResourceView extends SupportResource {
  /** Ready-to-use links for buttons. */
  telHref?: string;
  smsHref?: string;
  whatsappHref?: string;
}

export interface SupportDirectoryView {
  country: string | null;
  countryName: string | null;
  emergency: {
    general?: string;
    police?: string;
    ambulance?: string;
    fire?: string;
    notes?: string;
    sources: SourceRef[];
  } | null;
  services: SupportResourceView[];
  directories: SupportResourceView[];
}

/** Digits, + * #, with # escaped: what a tel: or sms: link needs. */
const dialable = (n: string) => n.replace(/[^\d+*#]/g, '').replace(/#/g, '%23');

export function toView(r: SupportResource): SupportResourceView {
  return {
    ...r,
    telHref: r.phone ? `tel:${dialable(r.phone)}` : undefined,
    smsHref: r.sms
      ? `sms:${dialable(r.sms)}${r.smsKeyword ? `?&body=${encodeURIComponent(r.smsKeyword)}` : ''}`
      : undefined,
    whatsappHref: r.whatsapp ? whatsappLink(r.whatsapp, r.country) : undefined,
  };
}

export function supportDirectory(
  country: string | null | undefined,
  opts: { kinds?: SupportKind[]; language?: string } = {},
): SupportDirectoryView {
  const code = normalizeCountry(country) ?? null;
  const all = getSupportResources(code, { kinds: opts.kinds, language: opts.language });
  const em = getEmergency(code);
  return {
    country: code,
    countryName: code ? (getCountry(code)?.name ?? null) : null,
    emergency: em
      ? {
          general: em.general,
          police: em.police,
          ambulance: em.ambulance,
          fire: em.fire,
          notes: em.notes,
          sources: em.sources,
        }
      : null,
    services: all.filter((r) => r.kind !== 'directory' && r.country !== 'ZZ').map(toView),
    directories: all.filter((r) => r.kind === 'directory' || r.country === 'ZZ').map(toView),
  };
}
