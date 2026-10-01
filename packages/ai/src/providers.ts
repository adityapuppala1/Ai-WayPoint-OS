/**
 * Model providers. Waypoint works with any of Anthropic, OpenAI, Google or a local Ollama
 * server — or none (offline mode). The first healthy provider in AI_PROVIDER_ORDER is used;
 * a provider that keeps failing is skipped for a while (circuit breaker).
 *
 * Two tiers: `small` (fast, cheap: classification, tagging, short replies) and `large`
 * (careful reasoning: plans, sensitive conversations).
 */
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { getEnv, onConsoleSettingsChange } from '@waypoint/core/env';
import type { EmbeddingModel, LanguageModel } from 'ai';
import type { JUDGE_PROVIDER } from './judge-client';

export type ProviderId = 'anthropic' | 'openai' | 'google' | 'ollama';
export type Tier = 'small' | 'large';

export interface ModelChoice {
  provider: ProviderId;
  modelId: string;
  model: LanguageModel;
  /** True for providers that run on infrastructure you control (no data leaves your servers). */
  local: boolean;
}

interface ProviderEntry {
  id: ProviderId;
  local: boolean;
  model: (tier: Tier) => { model: LanguageModel; modelId: string };
}

/**
 * Whose failures are counted. The judge (see judge.ts) has an entry of its own here, but is
 * deliberately not a ProviderId: that list is the models that can write an answer, and it
 * decides what Ask uses, whether "AI YES" is offered by text and what the privacy notice says.
 */
type BreakerId = ProviderId | typeof JUDGE_PROVIDER;

const breaker = new Map<BreakerId, { failures: number; openUntil: number }>();
const OPEN_MS = 60_000;

export function reportProviderFailure(id: BreakerId): void {
  const s = breaker.get(id) ?? { failures: 0, openUntil: 0 };
  s.failures += 1;
  if (s.failures >= 3) s.openUntil = Date.now() + OPEN_MS * Math.min(10, s.failures - 2);
  breaker.set(id, s);
}

export function reportProviderSuccess(id: BreakerId): void {
  breaker.delete(id);
}

/** False while a provider is being left alone after failing three times or more in a row. */
export function providerHealthy(id: BreakerId): boolean {
  const s = breaker.get(id);
  return !s || s.openUntil < Date.now();
}

let cache: ProviderEntry[] | undefined;
// Keys or models changed in the platform console: build the providers again from them.
onConsoleSettingsChange(() => {
  cache = undefined;
});

/** Providers that have credentials configured, in the configured order. */
export function configuredProviders(): ProviderEntry[] {
  if (cache) return cache;
  const env = getEnv();
  const entries: Partial<Record<ProviderId, ProviderEntry>> = {};
  if (env.ANTHROPIC_API_KEY) {
    const p = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
    entries.anthropic = {
      id: 'anthropic',
      local: false,
      model: (tier) => {
        const modelId =
          tier === 'small' ? env.AI_MODEL_ANTHROPIC_SMALL : env.AI_MODEL_ANTHROPIC_LARGE;
        return { model: p(modelId), modelId };
      },
    };
  }
  if (env.OPENAI_API_KEY) {
    const p = createOpenAI({ apiKey: env.OPENAI_API_KEY });
    entries.openai = {
      id: 'openai',
      local: false,
      model: (tier) => {
        const modelId = tier === 'small' ? env.AI_MODEL_OPENAI_SMALL : env.AI_MODEL_OPENAI_LARGE;
        return { model: p(modelId), modelId };
      },
    };
  }
  if (env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const p = createGoogle({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY });
    entries.google = {
      id: 'google',
      local: false,
      model: (tier) => {
        const modelId = tier === 'small' ? env.AI_MODEL_GOOGLE_SMALL : env.AI_MODEL_GOOGLE_LARGE;
        return { model: p(modelId), modelId };
      },
    };
  }
  if (env.OLLAMA_BASE_URL) {
    const p = createOpenAICompatible({
      name: 'ollama',
      baseURL: `${env.OLLAMA_BASE_URL.replace(/\/$/, '')}/v1`,
      includeUsage: true,
    });
    entries.ollama = {
      id: 'ollama',
      local: true,
      model: (tier) => {
        const modelId = tier === 'small' ? env.AI_MODEL_OLLAMA_SMALL : env.AI_MODEL_OLLAMA_LARGE;
        return { model: p.languageModel(modelId), modelId };
      },
    };
  }
  const order = env.AI_PROVIDER_ORDER.split(',').map((s) => s.trim()) as ProviderId[];
  cache = order.map((id) => entries[id]).filter((e): e is ProviderEntry => Boolean(e));
  return cache;
}

export function aiAvailable(): boolean {
  return (testModels?.length ?? 0) > 0 || configuredProviders().length > 0;
}

/**
 * Pick models to try, best first. `localOnly` restricts to self-hosted models — used when
 * the person has not consented to sending (redacted) text to external AI providers.
 */
let testModels: ModelChoice[] | null = null;

/** Test helper: use these models instead of configured providers (null to reset). */
export function overrideModelsForTests(models: ModelChoice[] | null): void {
  testModels = models;
}

export function modelCandidates(tier: Tier, opts: { localOnly?: boolean } = {}): ModelChoice[] {
  if (testModels) return testModels.filter((m) => !opts.localOnly || m.local);
  const all = configuredProviders().filter((p) => !opts.localOnly || p.local);
  const ordered = [
    ...all.filter((p) => providerHealthy(p.id)),
    ...all.filter((p) => !providerHealthy(p.id)),
  ];
  return ordered.map((p) => ({ provider: p.id, local: p.local, ...p.model(tier) }));
}

export function pickModel(tier: Tier, opts: { localOnly?: boolean } = {}): ModelChoice | null {
  return modelCandidates(tier, opts)[0] ?? null;
}

/** Embedding model at 768 dimensions (matches the database column), or null when disabled. */
export function embeddingModel(): {
  model: EmbeddingModel;
  modelId: string;
  providerOptions?: Record<string, Record<string, number>>;
} | null {
  const env = getEnv();
  switch (env.AI_EMBEDDING_PROVIDER) {
    case 'openai':
      if (!env.OPENAI_API_KEY) return null;
      return {
        model: createOpenAI({ apiKey: env.OPENAI_API_KEY }).embedding('text-embedding-3-small'),
        modelId: 'text-embedding-3-small',
        providerOptions: { openai: { dimensions: 768 } },
      };
    case 'google':
      if (!env.GOOGLE_GENERATIVE_AI_API_KEY) return null;
      return {
        model: createGoogle({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY }).embedding(
          'gemini-embedding-001',
        ),
        modelId: 'gemini-embedding-001',
        providerOptions: { google: { outputDimensionality: 768 } },
      };
    case 'ollama':
      if (!env.OLLAMA_BASE_URL) return null;
      return {
        model: createOpenAICompatible({
          name: 'ollama',
          baseURL: `${env.OLLAMA_BASE_URL.replace(/\/$/, '')}/v1`,
        }).embeddingModel('nomic-embed-text'),
        modelId: 'nomic-embed-text',
      };
    default:
      return null;
  }
}

/** Test helper. */
export function resetProvidersForTests(): void {
  cache = undefined;
  breaker.clear();
}
