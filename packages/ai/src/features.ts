/**
 * Structured AI features: Shield second opinion, plan wording, signal digests and embeddings.
 * Each one degrades gracefully to the deterministic engine when AI is unavailable. There is
 * nothing here for forecasts, on purpose: no model writes, publishes or changes one.
 */
import type { ScamCategory } from '@waypoint/content/types';
import {
  type AiOpinion,
  LEVEL_ORDER,
  LOCALES,
  type Locale,
  type PlanDraft,
  type RiskLevel,
  shieldSignalTitle,
} from '@waypoint/core';
import { redactPII } from '@waypoint/core/privacy';
import type { Database } from '@waypoint/db';
import { embed, generateText, Output } from 'ai';
import { z } from 'zod';
import { judgeAvailable, judgeBarredByCrisis, judgeReads, runJudge } from './judge';
import { PLAN_REWRITE_CHECKS, planRewriteFlagged, REPLY_CHECKS, replyFlags } from './judge-checks';
import { judgeCouldRaise, readShieldSigns, SHIELD_SIGNS } from './judge-shield';
import {
  channelInstructions,
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
  /** Asked once before a model is used; false means this visitor's allowance is used up. */
  gate?: () => Promise<boolean>;
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
  if (answer.length < 2) return null;
  // No answer is an answer the caller already has: it sends Waypoint's own guided text.
  if (await replyFlagged(ctx, { reply: answer, question: input.text, locale: input.locale }))
    return null;
  return answer;
}

/**
 * A second look, by the judge, at an answer a model wrote for a text message: does it give a
 * diagnosis or a dose, say what a court will decide, pick a financial product, promise an
 * outcome or describe a method of self-harm? The prompt forbids all five, but a prompt is a
 * request. True means "do not send this".
 *
 * Only ever adds caution: with no judge, no consent, a language that is not switched on or a
 * failure, the answer goes out exactly as it did before. The judge sees the answer (with
 * personal details removed), never the question.
 */
async function replyFlagged(
  ctx: CallerContext,
  input: { reply: string; question: string; locale: string },
): Promise<boolean> {
  if (judgeBarredByCrisis(input.question) || !judgeReads(input.reply, input.locale)) return false;
  const out = await runJudge(
    {
      db: ctx.db,
      userId: ctx.userId,
      isGuest: ctx.isGuest,
      allowExternal: ctx.allowExternal,
      locale: input.locale,
      feature: 'judge-reply',
      // Nobody is waiting on a page: the answer is sent when it is ready.
      pace: 'background',
    },
    { reply: input.reply },
    REPLY_CHECKS,
  );
  return out.ok && replyFlags(out.answers).length > 0;
}

interface ShieldOpinionInput {
  text: string;
  country?: string | null;
  locale: string;
  /**
   * What the rules found. When they are already certain nobody is asked, and a reason the
   * rules already gave is not given twice.
   */
  rules?: { level: RiskLevel; signals: ReadonlyArray<{ id: string }> };
}

/**
 * A second opinion on a message, for the raise-only merge (`mergeAiOpinion`). Text is
 * redacted before it leaves Waypoint.
 *
 * The judge is asked first when it may be (a key, consent, a language that is switched on)
 * and when it could raise the level: "high" is the most it says, so a message the rules
 * already rate high goes straight to the language model, as before. The language model is
 * asked when there is no judge, when the judge fails, and when the judge is unsure; with
 * both, the higher level stands. Whoever answered is named in `model`.
 *
 * When the judge is sure (it found a clear scam, or every sign clearly absent) the language
 * model is not asked: that is the saving, and its cost is that a scam only the language
 * model would have caught is then rated by the rules alone.
 */
export async function shieldOpinion(
  ctx: CallerContext,
  input: ShieldOpinionInput,
): Promise<AiOpinion | null> {
  if (input.rules?.level === 'very-high') return null;
  const judged = await shieldJudgeOpinion(ctx, input);
  if (judged && !judged.unsure) return judged.opinion;
  const written = await shieldModelOpinion(ctx, input);
  if (!judged || !written) return judged?.opinion ?? written;
  // Both answered. Neither can take away what the other saw: the higher level stands, and its
  // reasons come first.
  const [first, second] =
    LEVEL_ORDER.indexOf(written.level) > LEVEL_ORDER.indexOf(judged.opinion.level)
      ? [written, judged.opinion]
      : [judged.opinion, written];
  return {
    level: first.level,
    categories: [...new Set([...first.categories, ...second.categories])].slice(0, 3),
    reasons: [...first.reasons, ...second.reasons],
    model: `${judged.opinion.model}+${written.model}`,
  };
}

const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);

/**
 * The judge's opinion, or nothing when it may not be asked or gives no usable answer. Exported
 * for the measurement run (evals/judge-cli.ts), which needs the score behind the level; the
 * app goes through `shieldOpinion`.
 */
export async function shieldJudgeOpinion(
  ctx: CallerContext,
  input: ShieldOpinionInput,
  pace: 'interactive' | 'background' = 'interactive',
): Promise<{ opinion: AiOpinion; unsure: boolean; score: number } | null> {
  const text = input.text.slice(0, 4000);
  // Not when its answer could change nothing: the rules already say as much as it can.
  if (input.rules && !judgeCouldRaise(input.rules.level)) return null;
  if (judgeBarredByCrisis(text) || !judgeReads(text, input.locale)) return null;
  const out = await runJudge(
    {
      db: ctx.db,
      userId: ctx.userId,
      isGuest: ctx.isGuest,
      allowExternal: ctx.allowExternal,
      locale: input.locale,
      feature: 'judge-shield',
      pace,
    },
    { message: text },
    SHIELD_SIGNS,
  );
  if (!out.ok) return null;
  const judged = readShieldSigns(out.answers);
  const known = new Set(input.rules?.signals.map((s) => s.id));
  const locale = isLocale(input.locale) ? input.locale : 'en';
  return {
    unsure: judged.unsure,
    score: judged.score,
    opinion: {
      level: judged.level,
      categories: judged.categories.slice(0, 3),
      // Jev writes nothing: a reason is the title of the warning sign it saw, as translated.
      reasons: judged.seen
        .filter((rule) => !known.has(rule))
        .flatMap((rule) => shieldSignalTitle(rule, locale) ?? [])
        .slice(0, 3),
      model: out.model,
    },
  };
}

/** The language model's opinion: it reads the whole message and writes its own reasons. */
async function shieldModelOpinion(
  ctx: CallerContext,
  input: ShieldOpinionInput,
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
      gate: ctx.gate,
      estimate: { inputTokens: 600 + Math.ceil(text.length / 3), outputTokens: 400 },
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

/** How many pieces of a plan are checked by the judge at once (it allows 40 requests a second). */
const PLAN_CHECKS_AT_ONCE = 6;

/**
 * Whether the judge finds, in any piece of a rewritten plan, a promise the template did not
 * make or a course, site, organisation or number it did not name. One flag refuses the whole
 * rewrite: the template's wording is plainer, and it is known.
 *
 * Each step is asked about on its own, next to its own original, because Jev compares two
 * short texts far better than it searches a long one. The person's goal is not sent: the
 * questions are about the wording, not about them.
 *
 * Only ever adds caution: with no judge, no consent, a language that is not switched on or a
 * failure, the rewrite is accepted exactly as it was before.
 */
async function rewriteFlagged(
  ctx: CallerContext,
  draft: PlanDraft,
  text: z.infer<typeof PlanTextSchema>,
  about: { locale: string; goal?: string | null },
): Promise<boolean> {
  if (!judgeAvailable() || !ctx.allowExternal) return false;
  const lines = (...parts: string[]) => parts.join('\n');
  const all = [
    // The plan's own title and summary, and the heading of each week.
    {
      original: lines(draft.title, draft.summary, ...draft.weeks.map((w) => w.focus)),
      rewritten: lines(text.title, text.summary, ...text.weeks.map((w) => w.focus)),
    },
    ...draft.weeks.flatMap((w, i) =>
      w.steps.map((s, j) => ({
        original: lines(s.title, s.detail),
        rewritten: lines(
          text.weeks[i]?.steps[j]?.title ?? '',
          text.weeks[i]?.steps[j]?.detail ?? '',
        ),
      })),
    ),
  ];
  // Wording the model left alone is the planner's own: there is nothing to check in it.
  const pieces = all.filter((p) => p.rewritten.trim() && p.rewritten !== p.original);
  const rewritten = pieces.map((p) => p.rewritten).join('\n');
  if (judgeBarredByCrisis(about.goal) || !judgeReads(rewritten, about.locale)) return false;
  for (let i = 0; i < pieces.length; i += PLAN_CHECKS_AT_ONCE) {
    const answers = await Promise.all(
      pieces.slice(i, i + PLAN_CHECKS_AT_ONCE).map((piece) =>
        runJudge(
          {
            db: ctx.db,
            userId: ctx.userId,
            isGuest: ctx.isGuest,
            allowExternal: ctx.allowExternal,
            locale: about.locale,
            feature: 'judge-plan',
          },
          piece,
          PLAN_REWRITE_CHECKS,
        ),
      ),
    );
    if (answers.some((out) => out.ok && planRewriteFlagged(out.answers))) return true;
  }
  return false;
}

/**
 * Rewrites a template plan's wording for the person. Structure, minutes and resources never
 * change, and where the judge is available the new wording is checked before it is used.
 */
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
  // The shape says nothing about the words. Where the judge may be asked, a rewrite that
  // promises a result, or names a course or a site the planner did not, is not used.
  if (await rewriteFlagged(ctx, draft, text, about)) return draft;
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
