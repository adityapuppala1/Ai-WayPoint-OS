/**
 * USSD (e.g. *384*123#): menus on any phone, no data, no credit needed in many countries.
 * Africa's Talking sends everything typed so far joined with `*` ("", "2", "2*message");
 * each answer is one screen of at most 182 characters, continued with CON or finished
 * with END.
 */
import type { CountryCode } from '@waypoint/content';
import { checkMessage } from '../shield/engine';
import { LOCALES, type Locale } from '../types';
import { CHANNEL_COPY } from './copy';
import { helpText, shieldText } from './respond';
import { numbersInOrder } from './sms';

export const USSD_MAX = 182;

export interface UssdReply {
  /** False while the menu continues (CON), true when the session ends (END). */
  end: boolean;
  text: string;
  update?: { locale?: Locale };
  intent: 'menu' | 'help' | 'check' | 'language' | 'invalid';
}

const LANGUAGE_MENU = [
  '1 English',
  '2 हिन्दी',
  '3 Español',
  '4 Français',
  '5 Português',
  '6 العربية',
  '7 Kiswahili',
].join('\n');

/** Cut to one screen, keeping whole lines where possible. */
export function fitUssd(raw: string): string {
  const text = numbersInOrder(raw);
  if (text.length <= USSD_MAX) return text;
  const lines = text.split('\n');
  let out = '';
  for (const line of lines) {
    const next = out ? `${out}\n${line}` : line;
    if (next.length > USSD_MAX - 1) break;
    out = next;
  }
  return out || `${text.slice(0, USSD_MAX - 1)}…`;
}

export function ussdReply(
  input: string,
  who: { locale: Locale | null; country: CountryCode | null },
): UssdReply {
  const locale = who.locale ?? 'en';
  const copy = CHANNEL_COPY[locale];
  const [choice = '', ...rest] = input.split('*');
  const more = rest.join('*').trim();
  const menu = (): UssdReply => ({
    end: false,
    text: ['Waypoint', ...copy.ussd.menu].join('\n'),
    intent: 'menu',
  });

  if (!input.trim()) return menu();
  switch (choice.trim()) {
    case '1':
      return { end: true, text: fitUssd(helpText(who.country, locale)), intent: 'help' };
    case '2': {
      if (!more) return { end: false, text: copy.ussd.typeMessage, intent: 'check' };
      const result = checkMessage({ text: more, country: who.country ?? undefined, locale });
      return { end: true, text: fitUssd(shieldText(result, locale)), intent: 'check' };
    }
    case '3': {
      if (!more) return { end: false, text: LANGUAGE_MENU, intent: 'language' };
      const picked = LOCALES[Number(more) - 1];
      if (!/^[1-7]$/.test(more) || !picked)
        return { end: true, text: copy.ussd.invalid, intent: 'invalid' };
      return {
        end: true,
        text: CHANNEL_COPY[picked].languageSet,
        update: { locale: picked },
        intent: 'language',
      };
    }
    default:
      return { end: true, text: copy.ussd.invalid, intent: 'invalid' };
  }
}
