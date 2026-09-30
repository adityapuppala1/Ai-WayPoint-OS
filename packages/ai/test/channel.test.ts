import { describe, expect, it } from 'vitest';
import { plainChannelText } from '../src/features';
import { channelInstructions } from '../src/prompts';

describe('answers by text message', () => {
  it('are plain, short and never carry phone numbers or links', () => {
    const raw =
      '**Good question!** Try these:\n* Visit [the job centre](https://example.org/jobs)\n* Call +254 722 178 177 for advice\n\n\n\nApplications for 2025-2026 open in May.';
    const out = plainChannelText(raw, 300);
    expect(out).not.toMatch(/[*#[\]]|https?:|722 178/);
    expect(out).toContain('the job centre');
    expect(out).toContain('2025-2026');
    expect(out).toContain('- Call … for advice');
    const long = plainChannelText('A sentence here. '.repeat(40), 120);
    expect(long.length).toBeLessThanOrEqual(120);
    expect(long.endsWith('…')).toBe(true);
  });

  it('are asked for in the person’s language, with no numbers and no pretending', () => {
    const prompt = channelInstructions({
      locale: 'sw',
      countryName: 'Kenya',
      maxChars: 450,
      safe: true,
      today: '2026-09-29',
    });
    expect(prompt).toContain('Swahili');
    expect(prompt).toContain('Never give any phone number');
    expect(prompt).toContain('never pretend to be a person');
    expect(prompt).toContain('At most 450');
    expect(prompt).toContain('They are in Kenya.');
    expect(prompt).toContain('something very heavy');
  });
});
