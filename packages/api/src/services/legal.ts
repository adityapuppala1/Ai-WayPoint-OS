/**
 * What the public privacy notice and terms say about THIS installation: who runs it, how to
 * reach them, where the data lives, and which outside services actually receive anything.
 * Read from the configuration, so the notice never names a service that isn't used or leaves
 * out one that is.
 */
import { configuredProviders, judgeConfigured } from '@waypoint/ai';
import { getEnv } from '@waypoint/core/env';
import { africasTalkingReady, metaReady, twilioReady } from '../channels/providers';

export interface LegalFacts {
  /** Who runs this Waypoint (name and address), when configured. */
  operator: string | null;
  contactEmail: string | null;
  /** Where the servers and database are. */
  dataLocation: string | null;
  /** How long backups are kept, when the operator keeps them and says so. */
  backupDays: number | null;
  /** The smallest group an organisation can ever see. */
  k: number;
  /**
   * Outside AI services that receive redacted text, for people who allow it: the providers
   * that write answers, and TypeSafe when its judge is set up to give second opinions.
   */
  aiProviders: string[];
  /** A model on the operator's own servers, used when outside AI is off. */
  privateModel: boolean;
  /** Services that carry texts and WhatsApp messages. */
  textingProviders: string[];
  /** The service that sends email: a provider's name, or the SMTP server's host name. */
  emailProvider: string | null;
}

const AI_NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
};

/** The host of an SMTP address, never its user name or password. */
export function smtpHost(url: string): string | null {
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

export function legalFacts(): LegalFacts {
  const env = getEnv();
  const providers = configuredProviders();
  const texting = [
    twilioReady('sms') || twilioReady('whatsapp') ? 'Twilio' : null,
    metaReady() ? 'Meta (WhatsApp)' : null,
    africasTalkingReady() ? 'Africa’s Talking' : null,
  ].filter((name): name is string => Boolean(name));
  return {
    operator: env.WAYPOINT_OPERATOR ?? null,
    contactEmail: env.WAYPOINT_CONTACT_EMAIL ?? null,
    dataLocation: env.WAYPOINT_DATA_LOCATION ?? null,
    backupDays: env.WAYPOINT_BACKUP_DAYS ?? null,
    k: env.WAYPOINT_K_ANON_MIN,
    aiProviders: [
      ...providers.filter((p) => !p.local).map((p) => AI_NAMES[p.id] ?? p.id),
      // The judge writes no answers and is not in the list above, but it is an outside service
      // all the same: named whenever its key is set, even when it is the only one.
      ...(judgeConfigured() ? ['TypeSafe'] : []),
    ],
    privateModel: providers.some((p) => p.local),
    textingProviders: texting,
    // Resend wins when both are set (see email/send.ts).
    emailProvider: !env.EMAIL_FROM
      ? null
      : env.RESEND_API_KEY
        ? 'Resend'
        : env.SMTP_URL
          ? smtpHost(env.SMTP_URL)
          : null,
  };
}
