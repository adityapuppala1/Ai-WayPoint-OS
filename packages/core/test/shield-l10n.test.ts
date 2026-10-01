import { describe, expect, it } from 'vitest';
import {
  ADVICE,
  AI_SIGNALS,
  checkMessage,
  mergeAiOpinion,
  SHIELD_RULES,
  SHIELD_SIGNAL_IDS,
  SHIELD_TEXT,
  shieldSignalTitle,
  URL_SIGNALS,
} from '../src/shield';
import { LOCALES } from '../src/types';

const translated = LOCALES.filter((l) => l !== 'en');

describe('Scam Shield translations', () => {
  it('covers every signal the engine can raise', () => {
    // Rules, combos, links and sender checks all have an English entry.
    for (const flag of Object.keys(URL_SIGNALS))
      expect(SHIELD_SIGNAL_IDS).toContain(`link-${flag}`);
    expect(SHIELD_SIGNAL_IDS).toContain('free-mail-official');
    expect(SHIELD_SIGNAL_IDS).toContain('foreign-number');
  });

  for (const locale of translated) {
    it(`${locale}: translates every signal and piece of advice, and nothing else`, () => {
      const t = SHIELD_TEXT[locale];
      expect(Object.keys(t.signals).sort()).toEqual([...SHIELD_SIGNAL_IDS].sort());
      expect(Object.keys(t.advice).sort()).toEqual(Object.keys(ADVICE).sort());
      for (const [id, s] of Object.entries(t.signals)) {
        expect(s.title.trim(), `${locale} ${id} title`).not.toBe('');
        expect(s.explanation.trim(), `${locale} ${id} explanation`).not.toBe('');
        expect(s.title, `${locale} ${id} is untranslated`).not.toBe(
          SHIELD_TEXT.en.signals[id]?.title,
        );
      }
      expect(t.signals['link-lookalike']?.titleBrand).toContain('{brand}');
      for (const [id, a] of Object.entries(t.advice)) {
        expect(a, `${locale} advice ${id} is untranslated`).not.toBe(ADVICE[id]);
      }
      expect(t.aiExplanation).not.toBe(SHIELD_TEXT.en.aiExplanation);
    });
  }

  it('returns the person’s language from the engine itself', () => {
    const text =
      'Congratulations! You are selected for a work from home job. Pay a registration fee of Rs 999 on WhatsApp to confirm your joining.';
    const en = checkMessage({ text, country: 'IN' });
    const hi = checkMessage({ text, country: 'IN', locale: 'hi' });
    expect(hi.level).toBe(en.level);
    expect(hi.score).toBe(en.score);
    expect(hi.signals.map((s) => s.id)).toEqual(en.signals.map((s) => s.id));
    expect(hi.signals[0]?.title).toBe(SHIELD_TEXT.hi.signals[hi.signals[0]?.id ?? '']?.title);
    expect(hi.advice).toHaveLength(en.advice.length);
    expect(hi.advice.join(' ')).toMatch(/[ऀ-ॿ]/); // Devanagari
  });

  it('names the imitated brand in every language', () => {
    const text = 'Your account is locked. Verify now at http://paypa1-secure-login.xyz/verify';
    for (const locale of LOCALES) {
      const r = checkMessage({ text, locale });
      const look = r.signals.find((s) => s.id === 'link-lookalike');
      if (!look) continue; // look-alike detection is covered by the link tests
      expect(look.title).toContain('paypal');
      expect(look.title).not.toContain('{brand}');
    }
  });

  it('localizes the AI second opinion too, and never lowers the level', () => {
    const rules = checkMessage({ text: 'hello, how are you?', locale: 'sw' });
    const merged = mergeAiOpinion(
      rules,
      {
        level: 'high',
        categories: ['romance'],
        reasons: ['Asks for money soon after meeting'],
        model: 'test',
      },
      'KE',
      'sw',
    );
    expect(merged.level).toBe('high');
    const ai = merged.signals.find((s) => s.id === 'ai-1');
    expect(ai?.explanation).toBe(SHIELD_TEXT.sw.aiExplanation);
    expect(merged.advice[0]).toBe(SHIELD_TEXT.sw.advice['cat-romance']);
  });

  it('gives a second opinion that cannot write its reasons in words people wrote', () => {
    // The judge answers yes or no about a warning sign; the reason shown is the sign's own
    // title, already translated, never text from a model.
    expect(shieldSignalTitle('share-otp')).toBe('Asks for a code, PIN or password');
    expect(shieldSignalTitle('share-otp', 'en')).toBe('Asks for a code, PIN or password');
    for (const locale of translated) {
      expect(shieldSignalTitle('share-otp', locale)).toBe(
        SHIELD_TEXT[locale].signals['share-otp']?.title,
      );
      expect(shieldSignalTitle('share-otp', locale)).not.toBe('Asks for a code, PIN or password');
    }
    // Not a sign: no words, rather than the id shown to a person.
    expect(shieldSignalTitle('made-up-sign', 'es')).toBeUndefined();
    expect(shieldSignalTitle('toString', 'es')).toBeUndefined();
  });

  it('has words in every language for the one sign only a second opinion can raise', () => {
    expect(Object.keys(AI_SIGNALS)).toEqual(['hidden-instructions']);
    expect(SHIELD_SIGNAL_IDS).toContain('hidden-instructions');
    for (const locale of LOCALES)
      expect(shieldSignalTitle('hidden-instructions', locale)).toBeTruthy();
    // No rule raises it: the rules have no pattern for text written at a checking tool.
    expect(SHIELD_RULES.map((r) => r.id)).not.toContain('hidden-instructions');
  });

  it('keeps English output unchanged', () => {
    const r = checkMessage({
      text: 'Share the OTP to stop your account being blocked',
      locale: 'en',
    });
    for (const s of r.signals) expect(s.title).toBe(SHIELD_TEXT.en.signals[s.id]?.title);
  });
});
