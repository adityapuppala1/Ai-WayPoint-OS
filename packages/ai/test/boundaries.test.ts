/**
 * Things the AI package must not be able to do at all, checked by what it contains.
 */
import { describe, expect, it } from 'vitest';

describe('forecasts', () => {
  it('cannot be written or changed by a model: there is no code for it', async () => {
    expect(await import('../src')).not.toHaveProperty('forecastProbability');
    expect(await import('../src/features')).not.toHaveProperty('forecastProbability');
    expect(await import('../src/prompts')).not.toHaveProperty('FORECAST_INSTRUCTIONS');
  });
});

describe('the evaluations', () => {
  it('blank every outside key, the judge’s included, so a run can never call out', async () => {
    const { evalEnvironment } = await import('../src/evals/guardrails');
    const sealed = evalEnvironment('some-folder');
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

  it('leave the judge switched off for the whole run', async () => {
    const { evalEnvironment } = await import('../src/evals/guardrails');
    const { resetEnvForTests } = await import('@waypoint/core/env');
    const { judgeAvailable, judgeConfigured } = await import('../src');
    const before = process.env.TYPESAFE_API_KEY;
    try {
      process.env.TYPESAFE_API_KEY = 'ts_key_from_this_machine';
      resetEnvForTests();
      expect(judgeConfigured()).toBe(true);
      // Only the keys: the throwaway database is set up by the run itself.
      process.env.TYPESAFE_API_KEY = evalEnvironment('unused').TYPESAFE_API_KEY;
      resetEnvForTests();
      expect(judgeConfigured()).toBe(false);
      expect(judgeAvailable()).toBe(false);
    } finally {
      if (before === undefined) delete process.env.TYPESAFE_API_KEY;
      else process.env.TYPESAFE_API_KEY = before;
      resetEnvForTests();
    }
  });
});
