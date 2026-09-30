/**
 * Where people can text Waypoint, for the website and the app. A channel is listed only when
 * it can answer (a provider is set up) and has a number or code to show.
 */
import { z } from '@hono/zod-openapi';
import { getEnv } from '@waypoint/core/env';
import { channelsReady } from './providers';

const Reach = z.object({
  /** As it should be shown, e.g. "+254 711 000 000" or "22384". */
  shown: z.string(),
  /** A link that opens the right app: sms:, https://wa.me/… or tel: for USSD. */
  href: z.string(),
});

export const PublicChannelsSchema = z
  .object({
    sms: Reach.nullable(),
    whatsapp: Reach.nullable(),
    ussd: Reach.nullable(),
  })
  .openapi('PublicChannels');

export type PublicChannels = z.infer<typeof PublicChannelsSchema>;

/** A phone number or short code as configured, or null if it is not one. */
export function displayNumber(value: string | undefined): string | null {
  const v = value?.trim() ?? '';
  return /^\+?\d[\d ().-]{2,24}$/.test(v) && v.replace(/\D/g, '').length >= 3 ? v : null;
}

/** A USSD code such as *384*1234#. */
export function displayUssd(value: string | undefined): string | null {
  const v = value?.replace(/\s/g, '') ?? '';
  return /^\*\d[\d*]{0,20}#$/.test(v) ? v : null;
}

export function publicChannels(): PublicChannels {
  const env = getEnv();
  const ready = channelsReady();
  const sms = ready.sms ? displayNumber(env.WAYPOINT_SMS_NUMBER) : null;
  const whatsapp = ready.whatsapp ? displayNumber(env.WAYPOINT_WHATSAPP_NUMBER) : null;
  const ussd = ready.ussd ? displayUssd(env.WAYPOINT_USSD_CODE) : null;
  const dial = (n: string) => `${n.trim().startsWith('+') ? '+' : ''}${n.replace(/\D/g, '')}`;
  return {
    sms: sms ? { shown: sms, href: `sms:${dial(sms)}` } : null,
    // WhatsApp links take the full international number, digits only.
    whatsapp:
      whatsapp && whatsapp.replace(/\D/g, '').length >= 8
        ? { shown: whatsapp, href: `https://wa.me/${whatsapp.replace(/\D/g, '')}` }
        : null,
    ussd: ussd ? { shown: ussd, href: `tel:${ussd.replace(/#/g, '%23')}` } : null,
  };
}
