/**
 * Things the AI package must not be able to do at all, checked by what it contains.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

let ai: typeof import('../src');
let features: typeof import('../src/features');
let prompts: typeof import('../src/prompts');
let guardrails: typeof import('../src/evals/guardrails');
let env: typeof import('@waypoint/core/env');

// Loading the whole package takes a while on a busy machine: not inside a test's own time.
beforeAll(async () => {
  ai = await import('../src');
  features = await import('../src/features');
  prompts = await import('../src/prompts');
  guardrails = await import('../src/evals/guardrails');
  env = await import('@waypoint/core/env');
}, 120_000);

describe('forecasts', () => {
  it('cannot be written or changed by a model: there is no code for it', () => {
    expect(ai).not.toHaveProperty('forecastProbability');
    expect(features).not.toHaveProperty('forecastProbability');
    expect(prompts).not.toHaveProperty('FORECAST_INSTRUCTIONS');
  });
});

describe('the evaluations', () => {
  it('blank every outside key, the judge’s included, so a run can never call out', () => {
    const sealed = guardrails.evalEnvironment('some-folder');
    for (const key of [
      'TYPESAFE_API_KEY',
      'ANTHROPIC_API_KEY',
      'OPENAI_API_KEY',
      'GOOGLE_GENERATIVE_AI_API_KEY',
      'OLLAMA_BASE_URL',
      'DATABASE_URL',
    ])
      expect(sealed[key], key).toBe('');
    expect(sealed.WAYPOINT_DATA_DIR).toBe('some-folder');
  });

  it('leave the judge switched off for the whole run', () => {
    const before = process.env.TYPESAFE_API_KEY;
    try {
      process.env.TYPESAFE_API_KEY = 'ts_key_from_this_machine';
      env.resetEnvForTests();
      expect(ai.judgeConfigured()).toBe(true);
      // Only the key: the throwaway database is set up by the run itself.
      process.env.TYPESAFE_API_KEY = guardrails.evalEnvironment('unused').TYPESAFE_API_KEY;
      env.resetEnvForTests();
      expect(ai.judgeConfigured()).toBe(false);
      expect(ai.judgeAvailable()).toBe(false);
    } finally {
      if (before === undefined) delete process.env.TYPESAFE_API_KEY;
      else process.env.TYPESAFE_API_KEY = before;
      env.resetEnvForTests();
    }
  });
});

describe('the browser tests', () => {
  it('start their server with every outside AI key blanked, the judge’s included', () => {
    // An empty value wins over a key in .env.local or the shell; a missing one does not.
    const config = readFileSync(
      join(env.findRepoRoot(), 'apps', 'web', 'playwright.config.ts'),
      'utf8',
    );
    for (const key of [
      'TYPESAFE_API_KEY',
      'AI_JUDGE_MODEL',
      'AI_JUDGE_LOCALES',
      'ANTHROPIC_API_KEY',
      'OPENAI_API_KEY',
      'GOOGLE_GENERATIVE_AI_API_KEY',
      'OLLAMA_BASE_URL',
    ])
      expect(config, key).toMatch(new RegExp(`^\\s*${key}: '',$`, 'm'));
  });
});
