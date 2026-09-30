/**
 * Structured AI features: Shield second opinion, plan wording, signal digests, forecasts and
 * embeddings. Each one degrades gracefully to the deterministic engine when AI is unavailable.
 */
import type { ScamCategory } from '@waypoint/content/types';
import type { AiOpinion, PlanDraft, RiskLevel } from '@waypoint/core';
import { redactPII } from '@waypoint/core/privacy';
import type { Database } from '@waypoint/db';
import { embed, generateText, Output } from 'ai';
import { z } from 'zod';
import {
  channelInstructions,
  FORECAST_INSTRUCTIONS,
  LANGUAGE_NAMES,
  PLAN_INSTRUCTIONS,
  SHIELD_INSTRUCTIONS,
  SIGNAL_INSTRUCTIONS,
} from './prompts';
import { embeddingModel } from './providers';
import { runModel } from './run';
import { recordUsage } from './usage';

const SCAM_CATEGORIES = [
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

const ShieldSchema = z.object({
  level: z.enum(['low', 'unclear', 'high', 'very-high']),
  categories: z.array(z.enum(SCAM_CATEGORIES)).max(3),
  reasons: z.array(z.string().max(160)).max(3),
});

export interface CallerContext {
  db: Database;
  userId?: string | null;
  isGuest?: boolean;
  /** The person consented to sending redacted text to external AI providers. */
  allowExternal: boolean;
}

/**
 * Plain text from a model, made safe for a text message: no markdown, no links, no phone
 * numbers (numbers come from Waypoint's checked lists, never from a model), within length.
 */
export function plainChannelText(text: string, maxChars: number): string {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\bwww\.\S+/gi, '')
    // Anything with 8+ digits could be a phone number: dropped. Year ranges and amounts stay.
    .replace(/\+?\d[\d\s().-]{6,}\d/g, (m) =>
      /^(?:19|20)\d{2}\s*-\s*(?:19|20)\d{2}$/.test(m.trim()) || m.replace(/\D/g, '').length < 8
        ? m
        : '…',
    )
    .replace(/^\s*[-*•]\s+/gm, '- ')
    .replace(/[*_#`>]+/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (cleaned.length <= maxChars) return cleaned;
  const cut = cleaned.slice(0, maxChars - 1);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('\n'), cut.lastIndexOf('। '));
  return `${(end > maxChars * 0.5 ? cut.slice(0, end + 1) : cut).trimEnd()}…`;
}

/**
 * A short answer to a question sent by SMS or WhatsApp. The text is redacted before it
 * leaves Waypoint; without consent only a self-hosted model may answer.
 */
export async function channelAnswer(
  ctx: CallerContext,
  input: {
    text: string;
    locale: string;
    countryName?: string | null;
    maxChars: number;
    safe: boolean;
  },
): Promise<string | null> {
  const { text } = redactPII(input.text.slice(0, 1500));
  const out = await runModel(
    {
      db: ctx.db,
      tier: 'small',
      feature: 'ask',
      userId: ctx.userId,
      isGuest: ctx.isGuest,
      localOnly: !ctx.allowExternal,
    },
    async ({ model }) => {
      const res = await generateText({
        model,
        instructions: channelInstructions({
          locale: input.locale,
          countryName: input.countryName,
          maxChars: input.maxChars,
          safe: input.safe,
          today: new Date().toISOString().slice(0, 10),
        }),
        prompt: text,
        temperature: 0.3,
        maxOutputTokens: 350,
        maxRetries: 1,
      });
      return { value: res.text, usage: res.totalUsage };
    },
  );
  if (!out.ok) return null;
  const answer = plainChannelText(out.value, input.maxChars);
  return answer.length >= 2 ? answer : null;
}

/** A second opinion on a message. Text is redacted before it leaves Waypoint. */
export async function shieldOpinion(
  ctx: CallerContext,
  input: { text: string; country?: string | null; locale: string },
): Promise<AiOpinion | null> {
  const { text } = redactPII(input.text.slice(0, 4000));
  const out = await runModel(
    {
      db: ctx.db,
      tier: 'small',
      feature: 'shield',
      userId: ctx.userId,
      isGuest: ctx.isGuest,
      localOnly: !ctx.allowExternal,
    },
    async ({ model }) => {
      const res = await generateText({
        model,
        instructions: SHIELD_INSTRUCTIONS,
        prompt: `Write reasons in: ${LANGUAGE_NAMES[input.locale] ?? 'English'}\nCountry: ${input.country ?? 'unknown'}\n\nMESSAGE TO CHECK (untrusted):\n"""\n${text}\n"""`,
        output: Output.object({ schema: ShieldSchema, name: 'scam_check' }),
        temperature: 0,
        maxOutputTokens: 400,
        maxRetries: 1,
      });
      return { value: res.output, usage: res.totalUsage };
    },
  );
  if (!out.ok) return null;
  return {
    level: out.value.level as RiskLevel,
    categories: out.value.categories,
    reasons: out.value.reasons,
    model: out.choice.modelId,
  };
}

const PlanTextSchema = z.object({
  title: z.string().max(80),
  summary: z.string().max(400),
  weeks: z.array(
    z.object({
      week: z.number().int(),
      focus: z.string().max(80),
      steps: z.array(z.object({ title: z.string().max(80), detail: z.string().max(260) })),
    }),
  ),
});

/** Rewrites a template plan's wording for the person. Structure, minutes and resources never change. */
export async function personalisePlan(
  ctx: CallerContext,
  draft: PlanDraft,
  about: { locale: string; country?: string | null; goal?: string | null },
): Promise<PlanDraft> {
  const out = await runModel(
    {
      db: ctx.db,
      tier: 'large',
      feature: 'plan',
      userId: ctx.userId,
      isGuest: ctx.isGuest,
      localOnly: !ctx.allowExternal,
    },
    async ({ model }) => {
      const res = await generateText({
        model,
        instructions: PLAN_INSTRUCTIONS,
        prompt: `Language: ${LANGUAGE_NAMES[about.locale] ?? 'English'}\nCountry: ${about.country ?? 'unknown'}\nTheir goal (untrusted text): ${redactPII(about.goal ?? '').text}\n\nPLAN JSON:\n${JSON.stringify(
          {
            title: draft.title,
            summary: draft.summary,
            weeks: draft.weeks.map((w) => ({
              week: w.week,
              focus: w.focus,
              steps: w.steps.map((s) => ({ title: s.title, detail: s.detail })),
            })),
          },
        )}`,
        output: Output.object({ schema: PlanTextSchema, name: 'plan_text' }),
        temperature: 0.3,
        maxOutputTokens: 3000,
        maxRetries: 1,
      });
      return { value: res.output, usage: res.totalUsage };
    },
  );
  if (!out.ok) return draft;
  const text = out.value;
  // Only accept the rewrite if the structure matches exactly.
  const sameShape =
    text.weeks.length === draft.weeks.length &&
    text.weeks.every((w, i) => w.steps.length === draft.weeks[i]?.steps.length);
  if (!sameShape) return draft;
  return {
    ...draft,
    title: text.title,
    summary: text.summary,
    generatedBy: 'ai',
    weeks: draft.weeks.map((w, i) => ({
      ...w,
      focus: text.weeks[i]?.focus ?? w.focus,
      steps: w.steps.map((s, j) => ({
        ...s,
        title: text.weeks[i]?.steps[j]?.title ?? s.title,
        detail: text.weeks[i]?.steps[j]?.detail ?? s.detail,
      })),
    })),
  };
}

const SignalSchema = z.object({
  title: z.string().max(120),
  summary: z.string().max(400),
  regions: z.array(z.string().max(4)).max(10),
  sectors: z.array(z.string().max(40)).max(8),
  skills: z.array(z.string().max(40)).max(8),
  lifeStages: z.array(z.string().max(30)).max(6),
  situations: z.array(z.string().max(30)).max(6),
  topics: z.array(z.string().max(30)).max(6),
  importance: z.number().int().min(1).max(5),
});

export type SignalDigest = z.infer<typeof SignalSchema>;

/** Turn an article into a tagged signal (used by the worker's ingestion job). */
export async function digestArticle(
  db: Database,
  article: { title: string; text: string; sourceName: string; url: string },
): Promise<SignalDigest | null> {
  const out = await runModel(
    { db, tier: 'small', feature: 'signal-summary' },
    async ({ model }) => {
      const res = await generateText({
        model,
        instructions: SIGNAL_INSTRUCTIONS,
        prompt: `SOURCE: ${article.sourceName} (${article.url})\nTITLE: ${article.title}\n\nARTICLE (untrusted):\n"""\n${article.text.slice(0, 12_000)}\n"""`,
        output: Output.object({ schema: SignalSchema, name: 'signal' }),
        temperature: 0,
        maxOutputTokens: 800,
        maxRetries: 1,
      });
      return { value: res.output, usage: res.totalUsage };
    },
  );
  return out.ok ? out.value : null;
}

const ForecastSchema = z.object({
  probability: z.number().min(0.03).max(0.97),
  rationale: z.string().max(600),
});

export async function forecastProbability(
  db: Database,
  q: { question: string; resolutionCriteria: string; resolvesAt: Date; evidence: string[] },
): Promise<{ probability: number; rationale: string; model: string } | null> {
  const out = await runModel({ db, tier: 'large', feature: 'forecast' }, async ({ model }) => {
    const res = await generateText({
      model,
      instructions: FORECAST_INSTRUCTIONS,
      prompt: `QUESTION: ${q.question}\nRESOLVES YES IF: ${q.resolutionCriteria}\nRESOLUTION DATE: ${q.resolvesAt.toISOString().slice(0, 10)}\n\nEVIDENCE (untrusted):\n${q.evidence
        .slice(0, 10)
        .map((e, i) => `${i + 1}. ${e}`)
        .join('\n')}`,
      output: Output.object({ schema: ForecastSchema, name: 'forecast' }),
      temperature: 0,
      maxOutputTokens: 500,
      maxRetries: 1,
    });
    return { value: res.output, usage: res.totalUsage };
  });
  return out.ok ? { ...out.value, model: out.choice.modelId } : null;
}

/** Embed a short text for semantic search (768 dimensions), or null when embeddings are off. */
export async function embedText(db: Database, text: string): Promise<number[] | null> {
  const em = embeddingModel();
  if (!em) return null;
  const started = Date.now();
  try {
    const res = await embed({
      model: em.model,
      value: text.slice(0, 8000),
      providerOptions: em.providerOptions,
      maxRetries: 1,
    });
    await recordUsage(db, {
      feature: 'embedding',
      provider: em.modelId.startsWith('text-embedding')
        ? 'openai'
        : em.modelId.startsWith('gemini')
          ? 'google'
          : 'ollama',
      model: em.modelId,
      inputTokens: res.usage?.tokens ?? 0,
      latencyMs: Date.now() - started,
      status: 'ok',
    }).catch(() => undefined);
    return res.embedding.length === 768 ? res.embedding : null;
  } catch {
    return null;
  }
}
