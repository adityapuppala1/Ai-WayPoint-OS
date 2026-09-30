import { describe, expect, it } from 'vitest';
import {
  CHANNEL_COPY,
  type ChannelPerson,
  type ChannelSetup,
  channelReply,
  countryOfNumber,
  fitSms,
  gsmLatin,
  numbersInOrder,
  otpText,
  parseCommand,
  plainPunctuation,
  smsEncoding,
  smsParts,
  toE164,
  USSD_MAX,
  ussdReply,
} from '../src/channels';
import { LOCALES } from '../src/types';

const person = (over: Partial<ChannelPerson> = {}): ChannelPerson => ({
  locale: 'en',
  country: 'KE',
  optedOut: false,
  aiAllowed: false,
  isNew: false,
  ...over,
});
const sms: ChannelSetup = {
  channel: 'sms',
  site: 'waypoint.example',
  externalAi: false,
  localAi: false,
};

describe('phone numbers from providers', () => {
  it('are read in every provider format and matched to a country', () => {
    expect(toE164('+447700900123')).toBe('+447700900123');
    expect(toE164('whatsapp:+254711000000')).toBe('+254711000000');
    expect(toE164('254711000000')).toBe('+254711000000');
    expect(toE164('0044 20 7946 0000')).toBe('+442079460000');
    expect(toE164('12345')).toBeNull();
    expect(toE164('')).toBeNull();
    expect(countryOfNumber('+447700900123')).toBe('GB');
    expect(countryOfNumber('+254711000000')).toBe('KE');
    expect(countryOfNumber('+919876543210')).toBe('IN');
    expect(countryOfNumber('+15551234567')).toBe('US');
    expect(countryOfNumber('+9991234567')).toBeNull();
  });
});

describe('SMS length', () => {
  it('knows the cheap alphabet from the expensive one', () => {
    expect(smsEncoding('Hello, Café!')).toBe('gsm7');
    expect(smsEncoding('Não')).toBe('ucs2');
    expect(smsEncoding('नमस्ते')).toBe('ucs2');
    expect(smsParts('a'.repeat(160)).parts).toBe(1);
    expect(smsParts('a'.repeat(161)).parts).toBe(2);
    expect(smsParts('€'.repeat(80)).units).toBe(160);
    expect(plainPunctuation('It’s — “fine”…')).toBe('It\'s - "fine"...');
  });

  it('keeps Latin-script texts in the cheap alphabet, trading only the accents it lacks', () => {
    expect(gsmLatin('Tu código de verificación')).toBe('Tu codigo de verificacion');
    expect(gsmLatin('Qué pequeña ayuda')).toBe('Qué pequeña ayuda'); // é and ñ are in it
    expect(gsmLatin('Não é possível, cœur')).toBe('Nao é possivel, coeur');
    expect(smsEncoding(gsmLatin('Você está bloqueado às 22h – ação necessária'))).toBe('gsm7');
    // Hindi and Arabic need the other alphabet anyway, so nothing is changed.
    expect(gsmLatin('कोड: 123 – ठीक')).toBe('कोड: 123 – ठीक');
    expect(gsmLatin('رمز: 123')).toBe('رمز: 123');
  });

  it('keeps numbers in order inside Arabic text, and leaves other text alone', () => {
    const lrm = String.fromCharCode(0x200e);
    expect(numbersInOrder('اتصل على +254 722 178 177 الآن')).toBe(
      `اتصل على ${lrm}+254 722 178 177${lrm} الآن`,
    );
    expect(numbersInOrder('اطلب *384*1234#')).toBe(`اطلب ${lrm}*384*1234#${lrm}`);
    expect(numbersInOrder('Call +254 722 178 177')).toBe('Call +254 722 178 177');
    const help = channelReply('HELP', person({ locale: 'ar', country: 'KE' }), sms).messages.join(
      '\n',
    );
    expect(help).toContain(lrm);
  });

  it('cuts long texts to fit, at a sensible place', () => {
    const long = Array.from({ length: 60 }, (_, i) => `Sentence number ${i}.`).join(' ');
    const cut = fitSms(long, 3);
    expect(smsParts(cut).parts).toBeLessThanOrEqual(3);
    expect(cut.endsWith('...')).toBe(true);
    expect(fitSms('short', 1)).toBe('short');
    const hindi = 'मदद '.repeat(200);
    expect(smsParts(fitSms(hindi, 2)).parts).toBeLessThanOrEqual(2);
  });
});

describe('keywords', () => {
  it('are understood in every language', () => {
    expect(parseCommand('HELP')).toEqual({ kind: 'help' });
    expect(parseCommand('ayuda')).toEqual({ kind: 'help' });
    expect(parseCommand('मदद')).toEqual({ kind: 'help' });
    expect(parseCommand('Msaada!')).toEqual({ kind: 'help' });
    expect(parseCommand('STOP')).toEqual({ kind: 'stop' });
    expect(parseCommand('arrêt')).toEqual({ kind: 'stop' });
    expect(parseCommand('stop calling me about the loan')).toMatchObject({ kind: 'text' });
    expect(parseCommand('LANG 3')).toEqual({ kind: 'language', value: 'es' });
    expect(parseCommand('lugha kiswahili')).toEqual({ kind: 'language', value: 'sw' });
    expect(parseCommand('LANG')).toEqual({ kind: 'language', value: null });
    expect(parseCommand('COUNTRY ke')).toMatchObject({ kind: 'country', value: 'KE' });
    expect(parseCommand('country uk')).toMatchObject({ kind: 'country', value: 'GB' });
    expect(parseCommand('country zz')).toMatchObject({ kind: 'country', value: null });
    expect(parseCommand('CHECK you won a prize')).toEqual({
      kind: 'check',
      text: 'you won a prize',
    });
    expect(parseCommand('AI YES')).toEqual({ kind: 'ai', on: true });
    expect(parseCommand('ia sí')).toEqual({ kind: 'ai', on: true });
    expect(parseCommand('AI نعم')).toEqual({ kind: 'ai', on: true });
    expect(parseCommand('AI NO')).toEqual({ kind: 'ai', on: false });
    expect(parseCommand('Hola')).toEqual({ kind: 'menu' });
    expect(parseCommand('hola necesito un trabajo urgente ahora')).toMatchObject({
      kind: 'text',
    });
  });
});

describe('replies by text message', () => {
  it('gives local help lines, with the emergency number first', () => {
    const r = channelReply('HELP', person(), sms);
    expect(r.intent).toBe('help');
    expect(r.messages[0]).toMatch(/^Help lines for Kenya:\nEmergency: call \d+/);
    expect(smsParts(r.messages[0] ?? '').parts).toBeLessThanOrEqual(5);
    const nowhere = channelReply('HELP', person({ country: null }), sms);
    expect(nowhere.messages[0]).toContain('COUNTRY');
  });

  it('puts safety first, without AI, and records only what the rules found', () => {
    const r = channelReply('I want to kill myself tonight', person(), sms);
    expect(r.intent).toBe('crisis');
    expect(r.crisis?.assessment.tier).toBeGreaterThanOrEqual(2);
    expect(r.messages[0]).toMatch(/\d{3}/);
    expect(r.ask).toBeUndefined();
    // Someone who opted out is still answered when they are in danger.
    const stopped = channelReply('I want to end my life', person({ optedOut: true }), sms);
    expect(stopped.intent).toBe('crisis');
  });

  it('checks messages for scams, asked or forwarded', () => {
    const asked = channelReply(
      'CHECK Your parcel is held at customs. Pay the fee now: http://bit.ly/pay-now',
      person(),
      sms,
    );
    expect(asked.intent).toBe('check');
    expect(asked.messages[0]).toMatch(/risk/i);
    const forwarded = channelReply(
      'Dear customer your account is blocked, verify at http://secure-bank-login.xyz',
      person(),
      sms,
    );
    expect(forwarded.intent).toBe('check');
    expect(channelReply('CHECK', person(), sms).messages[0]).toBe(CHANNEL_COPY.en.checkEmpty);
  });

  it('answers questions with AI only when allowed, and says so', () => {
    const q = 'How do I find work as a driver near Nairobi?';
    expect(channelReply(q, person(), sms)).toMatchObject({ intent: 'guided' });
    const offered = channelReply(q, person(), { ...sms, externalAi: true });
    expect(offered.intent).toBe('guided');
    expect(offered.messages[1]).toContain('AI YES');
    const allowed = channelReply(q, person({ aiAllowed: true }), { ...sms, externalAi: true });
    expect(allowed).toMatchObject({ intent: 'ask', messages: [], ask: { external: true } });
    const local = channelReply(q, person(), { ...sms, localAi: true });
    expect(local.ask?.external).toBe(false);
    expect(channelReply('AI YES', person(), sms).messages[0]).toBe(CHANNEL_COPY.en.unavailable);
    expect(channelReply('AI YES', person(), { ...sms, externalAi: true }).update?.aiAllowed).toBe(
      true,
    );
  });

  it('stops when asked, and only help gets through until START', () => {
    expect(channelReply('STOP', person(), sms)).toMatchObject({
      intent: 'stop',
      update: { optedOut: true },
    });
    const quiet = channelReply('what jobs are there', person({ optedOut: true }), sms);
    expect(quiet).toMatchObject({ intent: 'ignored', messages: [] });
    expect(channelReply('HELP', person({ optedOut: true }), sms).intent).toBe('help');
    expect(channelReply('START', person({ optedOut: true }), sms).update?.optedOut).toBe(false);
  });

  it('speaks the person’s language and remembers it', () => {
    const spanish = channelReply(
      'hola, necesito ayuda para encontrar un trabajo',
      person({ locale: null }),
      sms,
    );
    expect(spanish.locale).toBe('es');
    expect(spanish.update?.locale).toBe('es');
    const switched = channelReply('LANG 7', person(), sms);
    expect(switched.update?.locale).toBe('sw');
    expect(switched.messages[0]).toBe(CHANNEL_COPY.sw.languageSet);
    const country = channelReply('COUNTRY IN', person({ locale: 'hi' }), sms);
    expect(country.update?.country).toBe('IN');
    expect(country.messages[0]).toContain('भारत');
  });

  it('answers a first command word in its own language', () => {
    const fresh = person({ locale: null, country: 'KE' });
    const sw = channelReply('MSAADA', fresh, sms);
    expect(sw.locale).toBe('sw');
    expect(sw.update?.locale).toBe('sw');
    expect(sw.messages.join(' ')).toContain('Kenya');
    expect(channelReply('AYUDA', fresh, sms).locale).toBe('es');
    expect(channelReply('मदद', fresh, sms).locale).toBe('hi');
    expect(channelReply('مساعدة', fresh, sms).locale).toBe('ar');
    // Shared words (HELP, STOP, MENU) and a chosen language are left as they are.
    expect(channelReply('HELP', fresh, sms).locale).toBe('en');
    expect(channelReply('MENU', fresh, sms).locale).toBe('en');
    expect(channelReply('Menú', fresh, sms).locale).toBe('en');
    expect(channelReply('AYUDA', person({ locale: 'fr' }), sms).locale).toBe('fr');
  });

  it('has every message in every language, with the same blanks to fill', () => {
    const blanks = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const walk = (en: unknown, other: unknown, path: string) => {
      if (typeof en === 'string') {
        expect(typeof other, path).toBe('string');
        expect((other as string).trim().length, path).toBeGreaterThan(0);
        expect(blanks(other as string), path).toEqual(blanks(en));
        return;
      }
      for (const [k, v] of Object.entries(en as Record<string, unknown>))
        walk(v, (other as Record<string, unknown>)[k], `${path}.${k}`);
    };
    for (const l of LOCALES) walk(CHANNEL_COPY.en, CHANNEL_COPY[l], l);
  });
});

describe('sign-in codes by SMS', () => {
  it('fit one message in every language and warn against sharing', () => {
    for (const l of LOCALES) {
      const text = otpText(l, '123456');
      expect(text, l).toContain('123456');
      expect(smsParts(text).parts, `${l}: ${text}`).toBe(1);
    }
    expect(smsEncoding(otpText('en', '123456'))).toBe('gsm7');
    expect(smsEncoding(otpText('fr', '123456'))).toBe('gsm7');
    expect(smsEncoding(otpText('sw', '123456'))).toBe('gsm7');
    // Only digits go into a code: nothing else can ride along in the message.
    expect(otpText('en', '12<b>34')).toContain('code is 1234.');
  });
});

describe('USSD menus', () => {
  it('fit one screen and walk through help, checks and language', () => {
    const who = { locale: 'en' as const, country: 'KE' as const };
    expect(ussdReply('', who)).toMatchObject({ end: false, intent: 'menu' });
    const help = ussdReply('1', who);
    expect(help.end).toBe(true);
    expect(help.text.length).toBeLessThanOrEqual(USSD_MAX);
    expect(help.text).toMatch(/\d{3}/);
    expect(ussdReply('2', who)).toMatchObject({ end: false });
    const check = ussdReply('2*You have won a prize! Send your M-PESA PIN to claim it', who);
    expect(check.end).toBe(true);
    expect(check.text.length).toBeLessThanOrEqual(USSD_MAX);
    expect(ussdReply('3*7', who).update?.locale).toBe('sw');
    expect(ussdReply('9', who).intent).toBe('invalid');
    for (const locale of LOCALES)
      expect(ussdReply('', { locale, country: 'KE' }).text.length).toBeLessThanOrEqual(USSD_MAX);
  });
});
