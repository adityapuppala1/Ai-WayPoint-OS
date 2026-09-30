/**
 * Get help now: verified emergency numbers and support services for a country.
 * Public (no account needed) and cache-friendly — this must work for anyone, instantly.
 */
import { z } from '@hono/zod-openapi';
import type { SupportKind } from '@waypoint/content';

export const SUPPORT_KINDS = [
  'crisis-line',
  'text-line',
  'chat',
  'mental-health',
  'domestic-violence',
  'child-helpline',
  'elder-abuse',
  'poison',
  'directory',
] as const satisfies readonly SupportKind[];

const SourceSchema = z.object({ url: z.string(), title: z.string(), checkedAt: z.string() });

export const SupportResourceSchema = z
  .object({
    id: z.string(),
    country: z.string(),
    kind: z.enum(SUPPORT_KINDS),
    name: z.string(),
    phone: z.string().optional(),
    sms: z.string().optional(),
    smsKeyword: z.string().optional(),
    url: z.string().optional(),
    hours: z.string().optional(),
    languages: z.array(z.string()).optional(),
    free: z.boolean().optional(),
    audience: z.string().optional(),
    sources: z.array(SourceSchema),
    /** Ready-to-use links for buttons. */
    telHref: z.string().optional(),
    smsHref: z.string().optional(),
    whatsapp: z.string().optional(),
    whatsappHref: z.string().optional(),
  })
  .openapi('SupportResource');

export const SupportDirectorySchema = z
  .object({
    country: z.string().nullable(),
    countryName: z.string().nullable(),
    emergency: z
      .object({
        general: z.string().optional(),
        police: z.string().optional(),
        ambulance: z.string().optional(),
        fire: z.string().optional(),
        notes: z.string().optional(),
        sources: z.array(SourceSchema),
      })
      .nullable(),
    services: z.array(SupportResourceSchema),
    directories: z.array(SupportResourceSchema),
  })
  .openapi('SupportDirectory');

export type SupportDirectory = z.infer<typeof SupportDirectorySchema>;
export type SupportResourceView = z.infer<typeof SupportResourceSchema>;

/** The directory itself is built in @waypoint/content, so the mobile app can show it offline. */
export { supportDirectory, supportResourceView as toView } from '@waypoint/content';
