import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  analyzeUrl,
  checkMessage,
  extractUrls,
  LEVEL_ORDER,
  lookalikeOf,
  mergeAiOpinion,
} from '../src/shield';
import { LOCALES, type RiskLevel } from '../src/types';

interface Case {
  text: string;
  lang: string;
  label: 'scam' | 'legit';
  min?: RiskLevel;
  max?: RiskLevel;
  cat?: string;
  country?: string;
}

const cases: Case[] = readFileSync(join(__dirname, '../../../evals/datasets/scam.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const rank = (l: RiskLevel) => LEVEL_ORDER.indexOf(l);

describe('Scam Shield — golden dataset', () => {
  const results = cases.map((c) => ({ c, r: checkMessage({ text: c.text, country: c.country }) }));
  const scams = results.filter(({ c }) => c.label === 'scam');
  const legit = results.filter(({ c }) => c.label === 'legit');

  it('flags ≥ 90% of high-confidence scams as high or very high', () => {
    const strong = scams.filter(({ c }) => (c.min ?? 'high') !== 'unclear');
    const caught = strong.filter(({ r }) => rank(r.level) >= rank('high'));
    const rate = caught.length / strong.length;
    if (rate < 1)
      console.log(
        'Under-rated scams:',
        strong
          .filter(({ r }) => rank(r.level) < rank('high'))
          .map(({ c, r }) => `${r.level} ${r.score} ${c.text.slice(0, 70)}`),
      );
    expect(rate).toBeGreaterThanOrEqual(0.9);
  });

  it('keeps ≤ 10% of legitimate messages at high or above', () => {
    const noisy = legit.filter(({ r }) => rank(r.level) >= rank('high'));
    expect(noisy.length / legit.length).toBeLessThanOrEqual(0.1);
  });

  it('meets every case’s bounds', () => {
    const fails = results.filter(
      ({ c, r }) =>
        (c.min && rank(r.level) < rank(c.min)) ||
        (c.max && rank(r.level) > rank(c.max)) ||
        (c.cat && !r.categories.includes(c.cat as never)),
    );
    expect(
      fails.map(
        ({ c, r }) =>
          `${c.label} ${r.level}/${r.score} cats=${r.categories.join(',')} signals=${r.signals.map((s) => s.id).join(',')} :: ${c.text.slice(0, 80)}`,
      ),
    ).toEqual([]);
  });

  it('always explains itself and gives advice', () => {
    for (const { r } of results) {
      expect(r.advice.length).toBeGreaterThan(0);
      if (r.level !== 'low') expect(r.signals.length).toBeGreaterThan(0);
    }
  });

  // A scam written in Swahili or Arabic must be caught as surely as one in English.
  for (const lang of LOCALES) {
    it(`works in ${lang}: enough cases, ≥ 90% of scams caught, no alarms on everyday messages`, () => {
      const mine = results.filter(({ c }) => c.lang === lang);
      const scamsHere = mine.filter(({ c }) => c.label === 'scam');
      const legitHere = mine.filter(({ c }) => c.label === 'legit');
      expect(scamsHere.length, `${lang} scam cases`).toBeGreaterThanOrEqual(15);
      expect(legitHere.length, `${lang} everyday cases`).toBeGreaterThanOrEqual(7);
      const strong = scamsHere.filter(({ c }) => (c.min ?? 'high') !== 'unclear');
      const caught = strong.filter(({ r }) => rank(r.level) >= rank('high'));
      expect(caught.length / strong.length).toBeGreaterThanOrEqual(0.9);
      expect(
        legitHere.filter(({ r }) => rank(r.level) >= rank('high')).map(({ c }) => c.text),
      ).toEqual([]);
    });
  }
});

describe('spelling variants', () => {
  it('matches Arabic written with or without hamza seats and vowel marks', () => {
    const plain = checkMessage({ text: 'لقد ربحت جايزه كبيره' });
    const marked = checkMessage({ text: 'لَقَدْ رَبِحْتَ جائزةً كبيرة' });
    expect(marked.signals.map((s) => s.id)).toEqual(plain.signals.map((s) => s.id));
    expect(marked.signals.some((s) => s.id === 'prize')).toBe(true);
  });

  it('matches Hindi written with or without nukta and chandrabindu', () => {
    const a = checkMessage({ text: 'गारंटीड मुनाफ़ा! अपना पैसा डबल करें, अभी जुड़ें' });
    const b = checkMessage({ text: 'गारंटीड मुनाफा! अपना पैसा डबल करें, अभी जुडें' });
    expect(a.level).toBe(b.level);
    expect(a.signals.some((s) => s.id === 'guaranteed-returns')).toBe(true);
  });

  it('knows a global brand’s own country sites from imitations', () => {
    for (const host of ['www.amazon.es', 'amazon.com.br', 'google.co.ke', 'dhl.de'])
      expect(lookalikeOf(host), host).toBeUndefined();
    for (const host of ['amazon-es.top', 'amazon.xyz', 'paypal-support.help'])
      expect(lookalikeOf(host), host).toBeTruthy();
    expect(lookalikeOf('laposte-suivi.info')).toBe('laposte.fr');
    expect(lookalikeOf('impots.gouv.fr')).toBeUndefined();
  });
});

describe('link analysis', () => {
  it('finds bare domains and ignores file names and abbreviations', () => {
    expect(extractUrls('visit sbi-kyc.in/verify now')).toEqual(['sbi-kyc.in/verify']);
    expect(extractUrls('see photo.jpg and e.g. this')).toEqual([]);
  });

  it('detects look-alikes but never flags the official domain', () => {
    expect(lookalikeOf('paypa1.com')).toBe('paypal.com');
    expect(lookalikeOf('netf1ix-billing.com')).toBeDefined();
    expect(lookalikeOf('sbi-kyc-update.top')).toBe('sbi.co.in');
    expect(lookalikeOf('www.paypal.com')).toBeUndefined();
    expect(lookalikeOf('onlinesbi.sbi')).toBeUndefined();
    expect(lookalikeOf('mail.google.com')).toBeUndefined();
    expect(lookalikeOf('appleid.apple.com.verify-account.top')).toBe('apple.com');
  });

  it('flags risky link shapes', () => {
    expect(analyzeUrl('http://192.168.1.1/login').flags).toContain('ip-host');
    expect(analyzeUrl('https://bit.ly/abc').flags).toContain('shortener');
    expect(analyzeUrl('https://example.xyz/app.apk').flags).toEqual(
      expect.arrayContaining(['suspicious-tld', 'file-download']),
    );
    expect(analyzeUrl('https://xn--pypal-4ve.com').flags).toContain('punycode');
  });
});

describe('AI second opinion', () => {
  it('can raise concern but never lowers the rules’ verdict', () => {
    const base = checkMessage({ text: 'Share the OTP to stop the transaction', country: 'IN' });
    const lowered = mergeAiOpinion(
      base,
      { level: 'low', categories: [], reasons: [], model: 'mock' },
      'IN',
    );
    expect(lowered.level).toBe(base.level);
    const quiet = checkMessage({ text: 'Hello, is this the right number for Anita?' });
    const raised = mergeAiOpinion(
      quiet,
      {
        level: 'high',
        categories: ['romance'],
        reasons: ['Unsolicited contact with a vague pretext'],
        model: 'mock',
      },
      'IN',
    );
    expect(raised.level).toBe('high');
    expect(raised.engine.ai?.agreed).toBe(false);
  });
});
