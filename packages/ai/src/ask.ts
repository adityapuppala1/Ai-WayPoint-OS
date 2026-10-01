/**
 * Ask: the conversational companion.
 *
 * Every turn follows the same order:
 *  1. Crisis check on the person's words (deterministic, all languages, no AI needed).
 *     Tier 3 or a medical emergency → show local emergency help and do not generate a reply.
 *     Tier 2 → show support first, then a short, safe-mode reply.
 *  2. Choose a model: external providers only with consent (and text redacted), otherwise a
 *     local model, otherwise guided mode.
 *  3. Stream the reply with tools; anything that saves data waits for the person's approval.
 */
import { getCountry } from '@waypoint/content';
import {
  assessCrisis,
  type CrisisAssessment,
  type CrisisResponsePlan,
  planCrisisResponse,
} from '@waypoint/core';
import { devSecret, getEnv } from '@waypoint/core/env';
import { newId } from '@waypoint/core/ids';
import { redactPII } from '@waypoint/core/privacy';
import type { Database } from '@waypoint/db';
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  type ModelMessage,
  streamText,
  type UIMessage,
} from 'ai';
import { guidedIntent, offlineReply } from './offline';
import { companionInstructions } from './prompts';
import { aiAvailable, pickModel, reportProviderFailure, reportProviderSuccess } from './providers';
import { companionTools } from './tools';
import {
  abandonUsage,
  checkBudget,
  estimateTokens,
  failUsage,
  recordUsage,
  reserveUsage,
  settleUsage,
} from './usage';

export type AskMode = 'ai' | 'safe' | 'guided';

export type AskDataParts = {
  crisis: CrisisResponsePlan;
  mode: { mode: AskMode; reason?: string; model?: string };
};

export type AskUIMessage = UIMessage<{ createdAt?: string }, AskDataParts>;

export interface AskInput {
  db: Database;
  user: { id: string; isGuest: boolean };
  profile: {
    locale: string;
    country?: string | null;
    situation?: string | null;
    lifeStage?: string | null;
  };
  consents: { aiExternal: boolean; memory: boolean };
  context?: {
    goals?: string[];
    currentPlan?: string | null;
    memories?: string[];
    hasTrustedContact?: boolean;
    inCircle?: boolean;
  };
  messages: AskUIMessage[];
  abortSignal?: AbortSignal;
  /**
   * Asked once, just before a model would be used: false sends the answer to guided mode.
   * The API uses it to give each visitor address a daily allowance of AI answers, so free
   * guest sessions cannot be used to spend the budget.
   */
  aiGate?: () => Promise<boolean>;
  onCrisis?: (assessment: CrisisAssessment, plan: CrisisResponsePlan) => Promise<void>;
  onFinish?: (
    messages: AskUIMessage[],
    meta: { crisisTier: number; mode: AskMode; model?: string },
  ) => Promise<void>;
}

function textOf(message: AskUIMessage | undefined): string {
  if (!message) return '';
  return message.parts
    .map((p) => (p.type === 'text' ? p.text : ''))
    .join(' ')
    .trim();
}

/** Highest crisis tier across the person's recent messages, so the protocol stays on. */
export function conversationCrisis(messages: AskUIMessage[]): {
  latest: CrisisAssessment;
  activeTier: number;
} {
  const userMessages = messages.filter((m) => m.role === 'user');
  const latest = assessCrisis(textOf(userMessages.at(-1)));
  let activeTier: number = latest.tier;
  const prior = userMessages.slice(-6, -1);
  prior.forEach((m, i) => {
    const t = assessCrisis(textOf(m)).tier;
    const recent = i >= prior.length - 2; // the two messages before this one
    if (t >= 2) activeTier = Math.max(activeTier, recent ? 2 : 1);
    else if (t === 1) activeTier = Math.max(activeTier, 1);
  });
  return { latest, activeTier };
}

function redactMessages(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((m) => {
    if (m.role === 'user' && typeof m.content === 'string')
      return { ...m, content: redactPII(m.content).text };
    if (m.role === 'user' && Array.isArray(m.content)) {
      return {
        ...m,
        content: m.content.map((p) =>
          p.type === 'text' ? { ...p, text: redactPII(p.text).text } : p,
        ),
      };
    }
    return m;
  });
}

let approvalSecret: string | undefined;
function toolApprovalSecret(): string {
  if (approvalSecret) return approvalSecret;
  const env = getEnv();
  approvalSecret =
    env.AI_TOOL_APPROVAL_SECRET ?? env.BETTER_AUTH_SECRET ?? devSecret('AI_TOOL_APPROVAL_SECRET');
  return approvalSecret;
}

export async function askResponse(input: AskInput): Promise<Response> {
  const { db, user, profile } = input;
  const locale = profile.locale;
  const { latest, activeTier } = conversationCrisis(input.messages);
  const crisisPlan =
    latest.tier > 0
      ? planCrisisResponse(latest, {
          country: profile.country,
          locale,
          hasTrustedContact: input.context?.hasTrustedContact,
          inCircle: input.context?.inCircle,
        })
      : null;

  const tier = Math.max(latest.tier, activeTier);
  const lastText = textOf(input.messages.filter((m) => m.role === 'user').at(-1));

  const stream = createUIMessageStream<AskUIMessage>({
    originalMessages: input.messages,
    // Message ids are UUIDs so they can be stored as primary keys.
    generateId: newId,
    onError: () => 'Sorry — something went wrong on our side. Please try again in a moment.',
    execute: async ({ writer }) => {
      if (crisisPlan && latest.tier >= 1) {
        writer.write({ type: 'data-crisis', id: 'crisis', data: crisisPlan });
        if (latest.tier >= 2 && input.onCrisis)
          await input.onCrisis(latest, crisisPlan).catch(() => undefined);
      }

      const writeText = (text: string) => {
        const id = crypto.randomUUID();
        writer.write({ type: 'text-start', id });
        writer.write({ type: 'text-delta', id, delta: text });
        writer.write({ type: 'text-end', id });
      };

      // Imminent danger or a medical emergency: the support card is the whole answer.
      if (crisisPlan?.suppressAiReply) {
        writer.write({ type: 'data-mode', id: 'mode', data: { mode: 'safe', reason: 'crisis' } });
        writeText(`${crisisPlan.headline} ${crisisPlan.message}`);
        return;
      }

      /** Waypoint's own guidance, when no model can or may answer. */
      const guided = async (reason: string | undefined) => {
        writer.write({ type: 'data-mode', id: 'mode', data: { mode: 'guided', reason } });
        // Keywords first. Only when they find nothing, and only with consent, may the judge
        // say which part of Waypoint the question is about; it writes none of the words.
        const intent = await guidedIntent(
          {
            db,
            userId: user.id,
            isGuest: user.isGuest,
            allowExternal: input.consents.aiExternal,
            locale,
            signal: input.abortSignal,
          },
          lastText,
          { crisisTier: tier, country: profile.country },
        );
        writeText(
          offlineReply(lastText, { locale, country: profile.country, crisisTier: tier, intent }),
        );
        await recordUsage(db, {
          userId: user.id,
          feature: 'ask',
          provider: 'none',
          model: 'guided',
          status: 'offline',
        }).catch(() => undefined);
      };

      const budget = await checkBudget(db, { userId: user.id, isGuest: user.isGuest });
      const choice = budget.ok
        ? pickModel(tier >= 1 ? 'large' : 'small', { localOnly: !input.consents.aiExternal })
        : null;
      if (!choice)
        return guided(
          !budget.ok
            ? budget.reason
            : !aiAvailable() || input.consents.aiExternal
              ? 'no-provider'
              : 'no-consent',
        );
      // The visitor's own allowance is drawn on only now that a model would really be used.
      if (input.aiGate && !(await input.aiGate())) return guided('daily-limit');

      const safe = tier >= 2;
      const modelMessages = await convertToModelMessages(input.messages.slice(-24), {
        ignoreIncompleteToolCalls: true,
      });
      // What Waypoint knows about the person goes to an outside provider with personal
      // details removed, exactly like their messages. A model on Waypoint's own servers
      // sees it whole.
      const shared = (text: string) => (choice.local ? text : redactPII(text).text);
      const instructions = companionInstructions({
        locale,
        country: profile.country,
        countryName: getCountry(profile.country)?.name,
        situation: profile.situation,
        lifeStage: profile.lifeStage,
        currentPlan: input.context?.currentPlan ? shared(input.context.currentPlan) : null,
        goals: input.context?.goals?.map(shared),
        memories: input.consents.memory ? input.context?.memories?.map(shared) : undefined,
        crisisTier: tier,
        today: new Date().toISOString().slice(0, 10),
      });
      const messages = choice.local ? modelMessages : redactMessages(modelMessages);
      const maxOutputTokens = safe ? 400 : 1000;

      // Counted before the call, at what it could cost: a burst of requests cannot overshoot
      // the budget, and an answer that is cut off is still counted.
      const reservation = await reserveUsage(db, {
        userId: user.id,
        isGuest: user.isGuest,
        feature: 'ask',
        provider: choice.provider,
        model: choice.modelId,
        inputTokens: estimateTokens(instructions) + estimateTokens(JSON.stringify(messages)),
        outputTokens: maxOutputTokens,
      });
      if (!reservation.ok) return guided(reservation.reason);

      writer.write({
        type: 'data-mode',
        id: 'mode',
        data: { mode: safe ? 'safe' : 'ai', model: choice.modelId },
      });

      const started = Date.now();
      const result = streamText({
        model: choice.model,
        instructions,
        messages,
        tools: companionTools({
          db,
          userId: user.id,
          isGuest: user.isGuest,
          country: profile.country,
          locale,
          situation: profile.situation,
          canRemember: input.consents.memory,
        }),
        toolApproval: {
          create_goal: 'user-approval',
          save_memory: 'user-approval',
          draft_plan: 'user-approval',
        },
        experimental_toolApprovalSecret: toolApprovalSecret(),
        stopWhen: isStepCount(safe ? 2 : 5),
        temperature: safe ? 0.2 : 0.5,
        maxOutputTokens,
        abortSignal: input.abortSignal,
        onEnd: async (event) => {
          reportProviderSuccess(choice.provider);
          await settleUsage(db, reservation.id, {
            provider: choice.provider,
            model: choice.modelId,
            inputTokens: event.totalUsage.inputTokens ?? 0,
            outputTokens: event.totalUsage.outputTokens ?? 0,
            latencyMs: Date.now() - started,
            status: 'ok',
          }).catch(() => undefined);
        },
        onError: async () => {
          reportProviderFailure(choice.provider);
          await failUsage(db, reservation.id, {
            provider: choice.provider,
            model: choice.modelId,
            latencyMs: Date.now() - started,
          }).catch(() => undefined);
        },
        // The person left before the answer finished: what was generated was still paid
        // for, so the estimate stands.
        onAbort: async () => {
          await abandonUsage(db, reservation.id, Date.now() - started).catch(() => undefined);
        },
      });
      writer.merge(result.toUIMessageStream({ sendReasoning: false, sendSources: true }));
    },
    onEnd: async ({ messages }) => {
      if (!input.onFinish) return;
      const modeInfo = messages
        .at(-1)
        ?.parts.find(
          (p): p is { type: 'data-mode'; id?: string; data: AskDataParts['mode'] } =>
            p.type === 'data-mode',
        );
      await input.onFinish(messages, {
        crisisTier: tier,
        mode: modeInfo?.data.mode ?? 'ai',
        model: modeInfo?.data.model,
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
