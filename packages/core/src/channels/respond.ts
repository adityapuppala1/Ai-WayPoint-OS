/**
 * The whole conversation by text message, decided without AI: safety first, then commands,
 * then scam checks, then — only if the person allowed it and a model is available — a
 * question for the AI, which the caller answers separately. Pure: the caller stores what
 * changed, records crisis events (never the words) and sends the replies.
 */
import {
  type CountryCode,
  getEmergency,
  getSupportResources,
  normalizeCountry,
  type SupportResource,
} from '@waypoint/content';
import { assessCrisis, planCrisisResponse } from '../crisis';
import { checkMessage } from '../shield/engine';
import { detectLanguage } from '../text/normalize';
import {
  type CrisisAssessment,
  type CrisisResponsePlan,
  LOCALES,
  type Locale,
  type ShieldResult,
} from '../types';
import { CHANNEL_COPY, type ChannelCopy } from './copy';
import { keywordLanguage, parseCommand } from './keywords';
import { fitSms, gsmLatin, numbersInOrder, plainPunctuation } from './sms';

export type ChannelKind = 'sms' | 'whatsapp';

export interface ChannelPerson {
  /** The language to reply in, once known. */
  locale: Locale | null;
  country: CountryCode | null;
  optedOut: boolean;
  /** They allowed their (redacted) messages to go to an external AI provider. */
  aiAllowed: boolean;
  /** This is the first message from this number. */
  isNew: boolean;
}

export interface ChannelSetup {
  channel: ChannelKind;
  /** Where the website is, for "visit …" (host only, e.g. `waypoint.example`). */
  site: string;
  /** An external AI provider is configured (so asking for consent makes sense). */
  externalAi: boolean;
  /** A self-hosted model runs: it may answer without consent, as in the web app. */
  localAi: boolean;
}

export type ChannelIntent =
  | 'crisis'
  | 'help'
  | 'check'
  | 'menu'
  | 'stop'
  | 'start'
  | 'language'
  | 'country'
  | 'ai'
  | 'ask'
  | 'guided'
  | 'ignored';

export interface ChannelReply {
  intent: ChannelIntent;
  /** Messages to send back now, in order, already shortened for the channel. */
  messages: string[];
  /** The language the conversation is in. */
  locale: Locale;
  /** What to remember about the person (only things they asked to change, or the language). */
  update?: {
    locale?: Locale;
    country?: CountryCode;
    optedOut?: boolean;
    aiAllowed?: boolean;
  };
  /** Record this (tier, categories, rule ids — never the words). */
  crisis?: { assessment: CrisisAssessment; plan: CrisisResponsePlan };
  /** Answer this with AI, then send the answer (labelled as AI). */
  ask?: { text: string; safe: boolean; external: boolean };
}

const fill = (template: string, vars: Record<string, string | undefined>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');

export function countryName(country: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([locale, 'en'], { type: 'region' }).of(country) ?? country;
  } catch {
    return country;
  }
}

/** Keep a reply within what the channel carries well. */
export function fitForChannel(text: string, channel: ChannelKind, important = false): string {
  const ordered = numbersInOrder(text);
  if (channel === 'whatsapp') return ordered.length > 1500 ? `${ordered.slice(0, 1499)}…` : ordered;
  return fitSms(gsmLatin(plainPunctuation(ordered)), important ? 5 : 3);
}

/** The sign-in code message, in plain SMS punctuation. */
export function otpText(locale: Locale, code: string): string {
  return gsmLatin(CHANNEL_COPY[locale].otp.replace('{code}', code.replace(/\D/g, '').slice(0, 12)));
}

const dialable = (href: string) =>
  decodeURIComponent(href.replace(/^(?:tel|sms):/, '').split('?')[0] ?? '');

/** "Name: number", or just the name when it already says the number ("Line 1199"). */
const named = (name: string, number: string) =>
  name.replace(/\s/g, '').includes(number.replace(/\s/g, '')) ? name : `${name}: ${number}`;

function supportLine(r: SupportResource, copy: ChannelCopy): string | null {
  const hours = r.hours ? ` (${r.hours})` : '';
  if (r.phone) return `${named(r.name, r.phone)}${hours}`;
  if (r.sms)
    return r.smsKeyword
      ? fill(copy.lineText, { name: r.name, keyword: r.smsKeyword, number: r.sms })
      : `${r.name}: ${r.sms}${hours}`;
  return null;
}

/** Help lines for the person's country: the emergency number, then up to three services. */
export function helpText(country: CountryCode | null, locale: Locale): string {
  const copy = CHANNEL_COPY[locale];
  const c = normalizeCountry(country);
  if (!c) return copy.helpNoCountry;
  const em = getEmergency(c);
  const number = em?.general ?? em?.ambulance ?? em?.police;
  const services = getSupportResources(c, {
    kinds: ['crisis-line', 'text-line', 'mental-health', 'domestic-violence'],
    language: locale,
    includeGlobal: false,
  })
    .map((r) => supportLine(r, copy))
    .filter((l): l is string => Boolean(l))
    .slice(0, 3);
  const directory = getSupportResources(c, { kinds: ['directory'] }).find((r) => r.url);
  return [
    fill(copy.helpIntro, { country: countryName(c, locale) }),
    number ? fill(copy.emergency, { number }) : null,
    ...services,
    services.length === 0 && directory?.url ? `${directory.name}: ${directory.url}` : null,
    copy.helpOutro,
  ]
    .filter(Boolean)
    .join('\n');
}

/** The crisis card as text: the calm message and the concrete numbers, nothing to tap. */
export function crisisText(plan: CrisisResponsePlan, locale: Locale): string {
  const lines = [plan.headline, plan.message];
  for (const a of plan.actions) {
    if (!a.href) continue;
    if (a.kind === 'emergency') lines.push(a.label);
    else if (a.kind === 'call' || a.kind === 'text') lines.push(named(a.label, dialable(a.href)));
    else if (a.kind === 'chat' || a.kind === 'web') lines.push(`${a.label}: ${a.href}`);
  }
  lines.push(CHANNEL_COPY[locale].crisisOutro);
  return lines.filter(Boolean).join('\n');
}

/** A Shield verdict as a few short lines. */
export function shieldText(result: ShieldResult, locale: Locale): string {
  const copy = CHANNEL_COPY[locale];
  const lines = [copy.verdict[result.level]];
  if (result.level === 'low') lines.push(copy.lowNote);
  else {
    // What to do comes before the signs: on a basic phone a long text may be cut short.
    if (result.advice[0]) lines.push(fill(copy.todo, { advice: result.advice[0] }));
    const signs = result.signals.slice(0, 2).map((s) => s.title);
    if (signs.length) lines.push(fill(copy.signs, { signs: signs.join('; ') }));
    const report = result.report.find((r) => r.phone || r.url);
    if (report && (result.level === 'high' || result.level === 'very-high'))
      lines.push(
        fill(copy.report, { channel: `${report.name} ${report.phone ?? report.url ?? ''}`.trim() }),
      );
  }
  return lines.join('\n');
}

const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);

/** Forwarded messages with a link, or a clear scam, are checked without being asked. */
function looksForwarded(result: ShieldResult): boolean {
  return result.urls.length > 0 || result.level === 'high' || result.level === 'very-high';
}

export function channelReply(text: string, who: ChannelPerson, setup: ChannelSetup): ChannelReply {
  const detected = detectLanguage(text);
  const locale: Locale =
    who.locale ?? keywordLanguage(text) ?? (isLocale(detected) ? detected : 'en');
  const learned = who.locale ? {} : { locale };
  const copy = CHANNEL_COPY[locale];
  const cmd = parseCommand(text);
  // Who may answer a question: an external model only with the person's consent; a model
  // running on Waypoint's own servers, as in the web app, without it.
  const external = setup.externalAi && who.aiAllowed;
  const canAsk = external || setup.localAi;
  const out = (
    intent: ChannelIntent,
    messages: string[],
    extra: Partial<ChannelReply> = {},
    important = false,
  ): ChannelReply => ({
    intent,
    locale: extra.update?.locale ?? locale,
    messages: messages.map((m) => fitForChannel(m, setup.channel, important)),
    ...extra,
    update: { ...learned, ...extra.update },
  });

  if (cmd.kind === 'stop') return out('stop', [copy.stopped], { update: { optedOut: true } });
  if (cmd.kind === 'start') return out('start', [copy.started], { update: { optedOut: false } });

  // Safety first, whatever the first word was: "hi im suicidal" is not a request for the
  // menu, and a command word in front of a cry for help must not hide it. Someone in danger
  // is answered even after STOP: they wrote to us. A message sent with CHECK is mostly
  // someone else's words, so only clear danger (tier 2+) puts the support card first there —
  // and a warning about the message still follows.
  const assessment = assessCrisis(text);
  if (cmd.kind === 'check' ? assessment.tier >= 2 : assessment.tier > 0) {
    const plan = planCrisisResponse(assessment, { country: who.country, locale });
    // A "nothing suspicious" verdict would read oddly under the support card: leave it out.
    const checked =
      cmd.kind === 'check' && cmd.text.trim()
        ? checkMessage({ text: cmd.text, country: who.country ?? undefined, locale })
        : null;
    const verdict = checked && checked.level !== 'low' ? [shieldText(checked, locale)] : [];
    return out(
      'crisis',
      [crisisText(plan, plan.locale), ...verdict],
      {
        crisis: { assessment, plan },
        ...(!plan.suppressAiReply && canAsk && !who.optedOut && cmd.kind === 'text'
          ? { ask: { text, safe: true, external } }
          : {}),
      },
      true,
    );
  }
  if (cmd.kind === 'help') return out('help', [helpText(who.country, locale)], {}, true);
  if (who.optedOut) return out('ignored', []);

  switch (cmd.kind) {
    case 'menu':
      return out('menu', [who.isNew ? copy.welcome : copy.menu]);
    case 'language': {
      if (!cmd.value) return out('language', [copy.languagePick]);
      return out('language', [CHANNEL_COPY[cmd.value].languageSet], {
        update: { locale: cmd.value },
      });
    }
    case 'country': {
      if (!cmd.value) return out('country', [copy.countryUnknown]);
      return out('country', [fill(copy.countrySet, { country: countryName(cmd.value, locale) })], {
        update: { country: cmd.value },
      });
    }
    case 'ai': {
      if (cmd.on === true) {
        if (!setup.externalAi) return out('ai', [copy.unavailable]);
        return out('ai', [copy.aiOn], { update: { aiAllowed: true } });
      }
      if (cmd.on === false) return out('ai', [copy.aiOff], { update: { aiAllowed: false } });
      return out('ai', [setup.externalAi ? copy.aiOffer : copy.unavailable]);
    }
    case 'check': {
      if (!cmd.text.trim()) return out('check', [copy.checkEmpty]);
      const result = checkMessage({ text: cmd.text, country: who.country ?? undefined, locale });
      return out('check', [shieldText(result, locale)], {}, result.level !== 'low');
    }
    default:
      break;
  }

  // Free text: a forwarded message is checked; anything else is a question.
  const plain = cmd.kind === 'text' ? cmd.text : text;
  const result = checkMessage({ text: plain, country: who.country ?? undefined, locale });
  if (looksForwarded(result))
    return out('check', [shieldText(result, locale)], {}, result.level !== 'low');
  if (canAsk) return out('ask', [], { ask: { text: plain, safe: false, external } });
  const guided = fill(copy.guided, { site: setup.site });
  return out(
    'guided',
    who.isNew ? [copy.welcome] : setup.externalAi ? [guided, copy.aiOffer] : [guided],
  );
}
