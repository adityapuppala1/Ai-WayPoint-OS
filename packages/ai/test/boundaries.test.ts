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
