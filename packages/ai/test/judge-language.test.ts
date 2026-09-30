/**
 * The judge's language gate: text goes to the judge only when it is clearly written in a
 * language switched on for it. Nothing is called here.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findRepoRoot, resetEnvForTests } from '@waypoint/core/env';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { judgeReads } from '../src/judge';

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

  it('does not read a script it has no words for, whatever link or brand it carries', () => {
    for (const text of [
      'Ваш аккаунт заблокирован. Срочно перейдите по ссылке http://sberbank-secure.xyz',
      '您的账户已被冻结，请立即点击 http://icbc-verify.top 输入验证码',
      'Ваш аккаунт Sberbank заблокирован, срочно позвоните нам сегодня',
      'Ваш аккаунт заблокирован',
    ])
      expect(judgeReads(text, 'en'), text).toBe(false);
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
