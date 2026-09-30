/**
 * Scam Shield: deterministic rules first, optional AI second opinion (which can only raise
 * the level), and a record of the check that never contains what the person pasted.
 */
import { z } from '@hono/zod-openapi';
import { aiAvailable, modelCandidates, shieldOpinion } from '@waypoint/ai';
import {
  getReportChannels,
  getScamPatterns,
  SCAM_PATTERNS,
  type ScamCategory,
} from '@waypoint/content';
import {
  adviceFor,
  checkMessage,
  LOCALES,
  mergeAiOpinion,
  normalizeText,
  type ShieldResult,
} from '@waypoint/core';
import { redactPII } from '@waypoint/core/privacy';
import {
  and,
  count,
  type Database,
  eq,
  gte,
  isNull,
  ne,
  or,
  scamReports,
  shieldChecks,
} from '@waypoint/db';
import { keyedHash } from '../lib/request';

export const SCAM_CATEGORIES = [
  'job',
  'bank-kyc',
  'delivery',
  'investment',
  'crypto',
  'lottery-prize',
  'romance',
  'sextortion',
  'tech-support',
  'impersonation-authority',
  'digital-arrest',
  'loan-app',
  'utility-disconnection',
  'tax-refund',
  'government-scheme',
  'family-emergency',
  'marketplace',
  'rental',
  'charity',
  'phishing-link',
  'sim-swap-otp',
  'qr-code',
  'deepfake-voice',
  'other',
] as const satisfies readonly ScamCategory[];

const RiskLevelSchema = z.enum(['low', 'unclear', 'high', 'very-high']);
const SourceSchema = z.object({ url: z.string(), title: z.string(), checkedAt: z.string() });

export const ReportChannelSchema = z
  .object({
    country: z.string(),
    name: z.string(),
    phone: z.string().optional(),
    url: z.string().optional(),
    what: z.string(),
    timeCritical: z.boolean().optional(),
    sources: z.array(SourceSchema),
  })
  .openapi('ReportChannel');

export const ShieldResultSchema = z
  .object({
    level: RiskLevelSchema,
    score: z.number().int(),
    signals: z.array(
      z.object({
        id: z.string(),
        kind: z.string(),
        category: z.enum(SCAM_CATEGORIES).optional(),
        weight: z.number(),
        title: z.string(),
        explanation: z.string(),
      }),
    ),
    categories: z.array(z.enum(SCAM_CATEGORIES)),
    urls: z.array(
      z.object({
        url: z.string(),
        host: z.string(),
        flags: z.array(z.string()),
        lookalikeOf: z.string().optional(),
      }),
    ),
    advice: z.array(z.string()),
    report: z.array(ReportChannelSchema),
    engine: z.object({
      rules: z.string(),
      ai: z.object({ model: z.string(), level: RiskLevelSchema, agreed: z.boolean() }).optional(),
    }),
  })
  .openapi('ShieldResult');

export const ShieldCheckInputSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1)
      .max(4000)
      .openapi({ example: 'Your parcel is on hold. Pay the customs fee at http://bit.ly/abc' }),
    kind: z.enum(['message', 'url', 'phone', 'email']).optional(),
    country: z
      .string()
      .regex(/^[A-Za-z]{2}$/)
      .transform((v) => v.toUpperCase())
      .optional(),
    locale: z.enum(LOCALES).optional(),
    /** One-off permission to send a redacted copy to the AI provider for this check. */
    aiConsent: z.boolean().optional(),
  })
  .openapi('ShieldCheckInput');

export const ShieldCheckSchema = z
  .object({
    id: z.string(),
    result: ShieldResultSchema,
    adviceIds: z.array(z.string()),
    ai: z.object({
      used: z.boolean(),
      reason: z.enum(['used', 'skipped-certain', 'no-consent', 'unavailable']),
      model: z.string().optional(),
    }),
    /** How many other checks of this exact message in the last 90 days (only shown when 3+). */
    seenBefore: z.number().int().nullable(),
  })
  .openapi('ShieldCheck');

export type ShieldCheck = z.infer<typeof ShieldCheckSchema>;

export async function runShieldCheck(
  db: Database,
  input: z.infer<typeof ShieldCheckInputSchema> & {
    userId: string | null;
    isGuest: boolean;
    channel: 'web' | 'sms' | 'whatsapp' | 'ussd' | 'api';
    /** The person has the standing `ai_external` consent. */
    aiExternalConsent: boolean;
  },
): Promise<ShieldCheck> {
  let result: ShieldResult = checkMessage({
    text: input.text,
    kind: input.kind,
    country: input.country,
    locale: input.locale,
  });

  let ai: ShieldCheck['ai'] = { used: false, reason: 'unavailable' };
  if (result.level === 'very-high') {
    ai = { used: false, reason: 'skipped-certain' };
  } else {
    const allowExternal = input.aiExternalConsent || input.aiConsent === true;
    const opinion = await shieldOpinion(
      { db, userId: input.userId, isGuest: input.isGuest, allowExternal },
      { text: input.text, country: input.country, locale: input.locale ?? 'en' },
    ).catch(() => null);
    if (opinion) {
      result = mergeAiOpinion(result, opinion, input.country, input.locale);
      ai = { used: true, reason: 'used', model: opinion.model };
    } else {
      const anyModel = aiAvailable();
      const localModel = modelCandidates('small', { localOnly: true }).length > 0;
      ai = {
        used: false,
        reason: anyModel && !allowExternal && !localModel ? 'no-consent' : 'unavailable',
      };
    }
  }

  // A keyed fingerprint: someone who can read the database still can't test a guessed message
  // against it without the server's secret.
  const inputHash = keyedHash(normalizeText(input.text), 'shield');
  const since = new Date(Date.now() - 90 * 86_400_000);
  const [[seen], [row]] = await Promise.all([
    db
      .select({ n: count() })
      .from(shieldChecks)
      .where(
        and(
          eq(shieldChecks.inputHash, inputHash),
          gte(shieldChecks.createdAt, since),
          // Only other people's checks: someone re-checking their own message isn't a crowd.
          input.userId
            ? or(isNull(shieldChecks.userId), ne(shieldChecks.userId, input.userId))
            : undefined,
        ),
      ),
    db
      .insert(shieldChecks)
      .values({
        userId: input.userId,
        channel: input.channel,
        kind: input.kind ?? 'message',
        inputHash,
        country: input.country ?? null,
        level: result.level,
        score: result.score,
        categories: result.categories,
        signalIds: result.signals.map((s) => s.id),
        urlHosts: [...new Set(result.urls.map((u) => u.host))].slice(0, 10),
        rulesVersion: result.engine.rules,
        aiModel: result.engine.ai?.model ?? null,
        aiLevel: result.engine.ai?.level ?? null,
      })
      .returning({ id: shieldChecks.id }),
  ]);

  const others = Number(seen?.n ?? 0);
  return {
    id: row?.id ?? '',
    result: result as ShieldCheck['result'],
    adviceIds: adviceFor(result.level, result.categories),
    ai,
    seenBefore: others >= 3 ? others : null,
  };
}

// ───────────────────────────── Reports & library ─────────────────────────────

export const ScamReportInputSchema = z
  .object({
    category: z.enum(SCAM_CATEGORIES),
    description: z.string().trim().max(2000).optional(),
    country: z
      .string()
      .regex(/^[A-Za-z]{2}$/)
      .transform((v) => v.toUpperCase())
      .optional(),
    /** Links from the scam. Only the host names are kept. */
    urls: z.array(z.string().max(2000)).max(10).optional(),
    /** Phone numbers, payment ids or account handles the scammer used. Stored only as keyed hashes. */
    identifiers: z.array(z.string().trim().min(3).max(120)).max(10).optional(),
    amountLost: z.number().min(0).max(1e12).optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    reportedTo: z.array(z.string().max(80)).max(5).optional(),
  })
  .openapi('ScamReportInput');

function hostOf(url: string): string | null {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export async function createScamReport(
  db: Database,
  userId: string | null,
  input: z.infer<typeof ScamReportInputSchema>,
): Promise<{ id: string }> {
  const [row] = await db
    .insert(scamReports)
    .values({
      userId,
      country: input.country ?? null,
      category: input.category,
      descriptionRedacted: input.description ? redactPII(input.description).text : null,
      urlHosts: [...new Set((input.urls ?? []).map(hostOf).filter((h): h is string => Boolean(h)))],
      identifierHashes: (input.identifiers ?? []).map((v) =>
        keyedHash(v.replace(/[\s().-]/g, '').toLowerCase(), 'scam-identifier'),
      ),
      amountLost: input.amountLost !== undefined ? String(input.amountLost) : null,
      currency: input.currency ?? null,
      reportedTo: input.reportedTo ?? [],
    })
    .returning({ id: scamReports.id });
  return { id: row?.id ?? '' };
}

export const ScamPatternSchema = z
  .object({
    id: z.string(),
    category: z.enum(SCAM_CATEGORIES),
    title: z.string(),
    howItWorks: z.string(),
    redFlags: z.array(z.string()),
    whatToDo: z.array(z.string()),
    regions: z.array(z.string()).optional(),
    sources: z.array(SourceSchema),
  })
  .openapi('ScamPattern');

export const ShieldLibrarySchema = z
  .object({
    patterns: z.array(ScamPatternSchema),
    reportChannels: z.array(ReportChannelSchema),
    total: z.number().int(),
  })
  .openapi('ShieldLibrary');

export function shieldLibrary(filter: { category?: ScamCategory; country?: string | null }) {
  return {
    patterns: getScamPatterns(filter),
    reportChannels: getReportChannels(filter.country),
    total: SCAM_PATTERNS.length,
  };
}
