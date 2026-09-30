/**
 * Scam Shield in the person's language. The rules engine works on ids; this swaps in the
 * translated title, explanation and advice for each id, falling back to English for anything
 * missing so a gap in a translation can never hide a warning.
 *
 * It runs on the server, so every channel (web, SMS, WhatsApp, guided Ask) gets the same text.
 */
import type { Locale, ShieldResult, ShieldSignal } from '../../types';
import { SHIELD_COMBOS, SHIELD_RULES } from '../rules';
import {
  ADVICE,
  AI_EXPLANATION,
  adviceFor,
  LOOKALIKE_TITLE,
  SENDER_SIGNALS,
  type SignalText,
  URL_SIGNALS,
} from '../text';
import { ar } from './ar';
import { es } from './es';
import { fr } from './fr';
import { hi } from './hi';
import { pt } from './pt';
import { sw } from './sw';

export interface LocalizedSignalText extends SignalText {
  /** Only for `link-lookalike`: the title when we know the brand, with a `{brand}` placeholder. */
  titleBrand?: string;
}

export interface ShieldText {
  signals: Record<string, LocalizedSignalText>;
  advice: Record<string, string>;
  aiExplanation: string;
}

function english(): ShieldText {
  const signals: Record<string, LocalizedSignalText> = {};
  for (const r of SHIELD_RULES) signals[r.id] = { title: r.title, explanation: r.explanation };
  for (const c of SHIELD_COMBOS) signals[c.id] = { title: c.title, explanation: c.explanation };
  for (const [flag, s] of Object.entries(URL_SIGNALS)) {
    signals[`link-${flag}`] = { title: s.title, explanation: s.explanation };
  }
  for (const [id, s] of Object.entries(SENDER_SIGNALS)) {
    signals[id] = { title: s.title, explanation: s.explanation };
  }
  signals['link-lookalike'] = {
    title: URL_SIGNALS.lookalike.title,
    explanation: URL_SIGNALS.lookalike.explanation,
    titleBrand: LOOKALIKE_TITLE,
  };
  return { signals, advice: { ...ADVICE }, aiExplanation: AI_EXPLANATION };
}

export const SHIELD_TEXT: Record<Locale, ShieldText> = {
  en: english(),
  hi,
  es,
  fr,
  pt,
  ar,
  sw,
};

/** Every signal id the engine can produce (except per-reason AI signals, `ai-1`…). */
export const SHIELD_SIGNAL_IDS = Object.keys(SHIELD_TEXT.en.signals);

function localizeSignal(s: ShieldSignal, t: ShieldText, brand: string | undefined): ShieldSignal {
  if (s.id.startsWith('ai-')) return { ...s, explanation: t.aiExplanation };
  const text = t.signals[s.id];
  if (!text) return s;
  const title =
    s.id === 'link-lookalike' && brand && text.titleBrand
      ? text.titleBrand.replace('{brand}', brand)
      : text.title;
  return { ...s, title, explanation: text.explanation };
}

/** Swap every piece of Shield text for the locale's version. English (or unknown) is a no-op. */
export function localizeShieldResult(result: ShieldResult, locale?: Locale | null): ShieldResult {
  if (!locale || locale === 'en') return result;
  const t = SHIELD_TEXT[locale];
  if (!t) return result;
  const en = SHIELD_TEXT.en;
  const brand = result.urls.find((u) => u.lookalikeOf)?.lookalikeOf;
  return {
    ...result,
    signals: result.signals.map((s) => localizeSignal(s, t, brand)),
    advice: adviceFor(result.level, result.categories).map(
      (id) => t.advice[id] ?? en.advice[id] ?? id,
    ),
  };
}
