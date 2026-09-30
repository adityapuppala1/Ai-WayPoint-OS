import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assessCrisis, planCrisisResponse } from '../src/crisis';

interface Case {
  text: string;
  lang: string;
  tier: number;
  max: number;
  other?: boolean;
  cat?: string;
}

const cases: Case[] = readFileSync(join(__dirname, '../../../evals/datasets/crisis.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));

describe('crisis classifier — golden dataset', () => {
  const results = cases.map((c) => ({ c, a: assessCrisis(c.text) }));
  const failures = results.filter(
    ({ c, a }) =>
      a.tier < c.tier ||
      a.tier > c.max ||
      (c.other !== undefined && a.aboutOther !== c.other) ||
      (c.cat && !a.categories.includes(c.cat as never)),
  );

  it('meets the recall gate for tier ≥ 2 (≥ 0.95)', () => {
    const positives = results.filter(({ c }) => c.tier >= 2);
    const caught = positives.filter(({ a }) => a.tier >= 2);
    const recall = caught.length / positives.length;
    if (recall < 1)
      console.log(
        'Missed:',
        positives.filter(({ a }) => a.tier < 2).map(({ c, a }) => `${c.text} → ${a.tier}`),
      );
    expect(recall).toBeGreaterThanOrEqual(0.95);
  });

  it('never under-triages imminent danger below tier 2', () => {
    const imminent = results.filter(({ c }) => c.tier === 3);
    expect(imminent.filter(({ a }) => a.tier < 2).map(({ c }) => c.text)).toEqual([]);
  });

  it('keeps figurative language quiet (no negative above its allowed max)', () => {
    const negatives = results.filter(({ c }) => c.tier === 0);
    const noisy = negatives.filter(({ c, a }) => a.tier > c.max);
    expect(noisy.map(({ c, a }) => `${c.text} → ${a.tier} [${a.matched.join(',')}]`)).toEqual([]);
  });

  it('passes every case exactly', () => {
    expect(
      failures.map(
        ({ c, a }) =>
          `${c.lang} "${c.text}" → tier ${a.tier} (want ${c.tier}-${c.max}) other=${a.aboutOther} cats=${a.categories.join('/')} rules=${a.matched.join(',')}`,
      ),
    ).toEqual([]);
  });
});

describe('spelling variants in a crisis', () => {
  // Arabic letters with a hamza seat (ؤ, ئ) and Hindi letters with a nukta (ज़, ख़) can be
  // typed with or without the mark: each spelling must be heard the same way.
  it('hears Arabic self-harm and overdose however they are spelled', () => {
    for (const text of ['أريد أن أؤذي نفسي', 'اريد ان اوذي نفسي', 'أَخَذْتُ جُرْعَةً زَائِدَةً'])
      expect(assessCrisis(text).tier, text).toBeGreaterThanOrEqual(2);
    expect(assessCrisis('أخذت جرعة زائدة').tier).toBe(3);
  });

  it('hears Hindi with or without nukta, and with mixed spellings', () => {
    for (const text of [
      'ज़िंदगी ख़त्म करना चाहता हूँ',
      'जिंदगी खत्म करना चाहता हूं',
      'ज़िंदगी खत्म करना चाहती हूं',
    ])
      expect(assessCrisis(text).tier, text).toBeGreaterThanOrEqual(2);
  });
});

describe('crisis response plan', () => {
  it('never needs a model and always offers a way to keep talking or call', () => {
    const plan = planCrisisResponse(assessCrisis('I want to die'), { country: 'ZZ', locale: 'en' });
    expect(plan.tier).toBe(2);
    expect(plan.safeMode).toBe(true);
    expect(plan.suppressAiReply).toBe(false);
    expect(plan.actions.some((a) => a.kind === 'stay')).toBe(true);
    expect(plan.message.length).toBeGreaterThan(20);
  });

  it('suppresses the AI reply for imminent danger and medical emergencies', () => {
    expect(planCrisisResponse(assessCrisis('I have taken 30 pills'), {}).suppressAiReply).toBe(
      true,
    );
    expect(planCrisisResponse(assessCrisis('I can not breathe'), {}).suppressAiReply).toBe(true);
  });

  it('answers in the language the person wrote in when no locale is set', () => {
    const plan = planCrisisResponse(assessCrisis('quiero morir'), {});
    expect(plan.locale).toBe('es');
    expect(plan.headline).toMatch(/Gracias/);
  });

  it('uses the person’s chosen locale over detection', () => {
    const plan = planCrisisResponse(assessCrisis('I want to die'), { locale: 'hi' });
    expect(plan.locale).toBe('hi');
  });

  it('is calm for tier 0 and has no follow-up', () => {
    const plan = planCrisisResponse(assessCrisis('Can you help me with my CV?'), {});
    expect(plan.tier).toBe(0);
    expect(plan.followUpHours).toBeNull();
  });
});

describe('crisis response with real directory data', () => {
  it('points people in India to Tele MANAS and 112', () => {
    const plan = planCrisisResponse(assessCrisis('I want to end my life'), {
      country: 'IN',
      locale: 'en',
    });
    expect(plan.emergencyNumber).toBe('112');
    const call = plan.actions.find((a) => a.kind === 'call');
    expect(call?.href).toBe('tel:14416');
    expect(call?.resourceId).toBe('in-tele-manas');
  });

  it('keeps star codes dialable (Chile *4141)', () => {
    const plan = planCrisisResponse(assessCrisis('quiero morirme'), {
      country: 'CL',
      locale: 'es',
    });
    expect(plan.actions.find((a) => a.kind === 'call')?.href).toBe('tel:*4141');
  });

  it('falls back to global directories where no national line is verified', () => {
    const plan = planCrisisResponse(assessCrisis('I want to kill myself'), { country: 'ET' });
    expect(plan.actions.some((a) => a.kind === 'web' && a.href?.includes('findahelpline'))).toBe(
      true,
    );
  });
});
