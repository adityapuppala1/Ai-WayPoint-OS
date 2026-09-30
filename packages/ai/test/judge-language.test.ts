/**
 * The judge's language gate: text goes to the judge only when it is clearly written in a
 * language switched on for it. Nothing is called here.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findRepoRoot, resetEnvForTests } from '@waypoint/core/env';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { judgeReads, judgeReadsWritten } from '../src/judge';

const before = process.env.AI_JUDGE_LOCALES;
const switchOn = (locales: string) => {
  process.env.AI_JUDGE_LOCALES = locales;
  resetEnvForTests();
};

beforeEach(() => switchOn('en'));
afterAll(() => {
  if (before === undefined) delete process.env.AI_JUDGE_LOCALES;
  else process.env.AI_JUDGE_LOCALES = before;
  resetEnvForTests();
});

const golden = readFileSync(join(findRepoRoot(), 'evals', 'datasets', 'scam.jsonl'), 'utf8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as { text: string; lang: string });

describe('what the judge may read, with only English switched on', () => {
  it('reads plain English', () => {
    expect(judgeReads('Hello, we saw your profile. We have a role for you.', 'en')).toBe(true);
    expect(judgeReads('Your parcel is waiting. Act now, this offer ends in 1 hour!', 'en')).toBe(
      true,
    );
    expect(judgeReads('No, I do not want to pay for it.', 'en')).toBe(true);
  });

  it('does not read a message in another language that has few of its common words', () => {
    // Each of these was read as English: no common word of any language was found, and
    // "nothing found" meant English.
    for (const text of [
      'Hola, tu cita en el banco es el lunes a las 9. Trae tu identificación.',
      'Olá! Seu pedido foi enviado e chega amanhã.',
      'Kikao cha kamati kitafanyika Jumamosi saa nne asubuhi.',
    ])
      expect(judgeReads(text, 'en'), text).toBe(false);
  });

  it('does not read Spanish that says “has”, nor Dutch or German, which share short words with English', () => {
    for (const text of [
      // "has" is Spanish too (haber), and a word said twice is still one word.
      '¿Has visto el correo? Ya has recibido la factura de este mes.',
      'Has ganado un premio. Has sido elegido entre miles de clientes.',
      'Has sido seleccionado. Has recibido un bono de 500 euros.',
      // "is", "we", "of", "was" and "am" are everyday Dutch and German words.
      'Uw pakket is onderweg. We hebben uw adres nodig, klik op de link of bel ons.',
      'Ihr Paket ist da. Was wollen Sie tun? Wir rufen Sie am Montag an.',
    ])
      expect(judgeReads(text, 'en'), text).toBe(false);
  });

  it('does not read a script it has no words for, whatever link or brand it carries', () => {
    for (const text of [
      'Ваш аккаунт заблокирован. Срочно перейдите по ссылке http://sberbank-secure.xyz',
      '您的账户已被冻结，请立即点击 http://icbc-verify.top 输入验证码',
      'Ваш аккаунт Sberbank заблокирован, срочно позвоните нам сегодня',
      'Ваш аккаунт заблокирован',
    ])
      expect(judgeReads(text, 'en'), text).toBe(false);
  });

  it('answers at once for text made to slow it down, such as a long run of "!" or "-"', () => {
    for (const text of [
      '!'.repeat(50_000),
      `a${'-'.repeat(50_000)}a`,
      `we ${'a-'.repeat(25_000)}`,
      `we are a${"'".repeat(50_000)}b`,
    ]) {
      const started = performance.now();
      judgeReads(text, 'en');
      expect(performance.now() - started, text.slice(0, 12)).toBeLessThan(250);
    }
  });

  it('does not count the words inside links, emails and web addresses, wherever they sit', () => {
    for (const text of [
      'www.we-are-the-bank.com you@are-the.one https://it-is.for/you/and/me',
      '(we-are-the-bank.com/login) "you-and-me.co.uk", it-is-for.you.',
    ])
      expect(judgeReads(text, 'en'), text).toBe(false);
    expect(judgeReads('We have sent it to you, see bank.com. It is on the way.', 'en')).toBe(true);
  });

  it('reads no message of the golden set that is not in English', () => {
    const sent = golden.filter((c) => c.lang !== 'en' && judgeReads(c.text, 'en'));
    expect(sent.map((c) => `${c.lang}: ${c.text}`)).toEqual([]);
  });

  it('still reads nearly every English message of the golden set', () => {
    const english = golden.filter((c) => c.lang === 'en');
    const read = english.filter((c) => judgeReads(c.text, 'en'));
    expect(read.length / english.length).toBeGreaterThanOrEqual(0.9);
  });

  it('never reads anything for a reader whose language is not switched on', () => {
    expect(judgeReads('Hello, we saw your profile. We have a role for you.', 'sw')).toBe(false);
  });
});

describe('what the judge may read of text Waypoint’s own model wrote', () => {
  // Told to write in the reader's language, a model's short answers can be too clipped to name
  // a language by their common words alone.
  const terse = [
    'Paracetamol 1g every 6 hours, max 4g daily. Rest, drink water. Clinic if fever lasts 3+ days.',
    'Likely malaria. Artemether-lumefantrine 4 tablets twice daily, 3 days. Clinic test first.',
  ];

  it('reads a terse answer written for its reader, which a pasted message would not be', () => {
    for (const text of terse) {
      expect(judgeReads(text, 'en'), text).toBe(false);
      expect(judgeReadsWritten(text, 'en'), text).toBe(true);
    }
  });

  it('does not read one that is clearly in another language, or in another script', () => {
    for (const text of [
      'Puede tomar paracetamol para la fiebre, pero no más de 4 g al día. Descanse hoy.',
      'Neem paracetamol voor de koorts. U kunt niet meer dan 4 gram per dag nemen.',
      'Примите парацетамол 1 г каждые 6 часов, не больше 4 г в день.',
    ])
      expect(judgeReadsWritten(text, 'en'), text).toBe(false);
  });

  it('never reads anything for a reader whose language is not switched on', () => {
    expect(judgeReadsWritten(terse[0] as string, 'sw')).toBe(false);
  });
});

describe('what the judge may read, with more languages switched on', () => {
  it('reads a language once it is switched on, and only when the text is clearly in it', () => {
    switchOn('en,es,hi');
    expect(
      judgeReads(
        'Su cuenta será bloqueada hoy. Usted tiene que pagar para no perder su dinero.',
        'es',
      ),
    ).toBe(true);
    expect(judgeReads('आपका खाता बंद हो जाएगा। अभी अपना कोड भेजें।', 'en')).toBe(true);
    // Portuguese is not switched on: it is not read as Spanish.
    expect(judgeReads('Olá! Seu pedido foi enviado e chega amanhã.', 'es')).toBe(false);
  });
});
