import { getReportChannels, type ScamCategory } from '@waypoint/content';
import { foldText, unleet } from '../text/normalize';
import type {
  Locale,
  RiskLevel,
  ShieldInput,
  ShieldResult,
  ShieldSignal,
  UrlFinding,
} from '../types';
import { localizeShieldResult } from './l10n';
import { SHIELD_COMBOS, SHIELD_RULES, SHIELD_RULES_VERSION } from './rules';
import {
  ADVICE,
  AI_EXPLANATION,
  adviceFor,
  LOOKALIKE_TITLE,
  SENDER_SIGNALS,
  URL_SIGNALS,
} from './text';
import { analyzeUrl, extractUrls, isOfficialHost, PROTECTED_DOMAINS } from './url';

export { ADVICE, adviceFor } from './text';

const FREE_MAIL = new Set([
  'gmail.com',
  'yahoo.com',
  'yahoo.co.in',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'proton.me',
  'protonmail.com',
  'icloud.com',
  'aol.com',
  'rediffmail.com',
  'ymail.com',
  'mail.com',
  'gmx.com',
]);
const OFFICIAL_WORDS =
  /(?:support|care|helpdesk|help|official|admin|security|hr|recruit|careers?|jobs?|bank|kyc|verify|refund|customs|police|gov|irs|tax|service|team)/;
const BRAND_WORDS = [...new Set(PROTECTED_DOMAINS.map((d) => d.split('.')[0] ?? ''))].filter(
  (b) => b.length >= 3,
);

/** Country calling codes for the "unexpected international number" check. */
const CALLING_CODES: Record<string, string> = {
  IN: '91',
  PK: '92',
  BD: '880',
  NP: '977',
  LK: '94',
  ID: '62',
  PH: '63',
  VN: '84',
  TH: '66',
  MY: '60',
  SG: '65',
  CN: '86',
  JP: '81',
  KR: '82',
  AE: '971',
  SA: '966',
  EG: '20',
  TR: '90',
  MA: '212',
  NG: '234',
  KE: '254',
  GH: '233',
  ZA: '27',
  ET: '251',
  UG: '256',
  TZ: '255',
  RW: '250',
  GB: '44',
  IE: '353',
  DE: '49',
  FR: '33',
  ES: '34',
  IT: '39',
  NL: '31',
  PL: '48',
  SE: '46',
  US: '1',
  CA: '1',
  MX: '52',
  BR: '55',
  AR: '54',
  CO: '57',
  CL: '56',
  PE: '51',
  AU: '61',
  NZ: '64',
};

export const LEVEL_ORDER: RiskLevel[] = ['low', 'unclear', 'high', 'very-high'];

export function levelFromScore(score: number): RiskLevel {
  if (score >= 75) return 'very-high';
  if (score >= 45) return 'high';
  if (score >= 20) return 'unclear';
  return 'low';
}

const maxLevel = (a: RiskLevel, b: RiskLevel): RiskLevel =>
  LEVEL_ORDER.indexOf(a) >= LEVEL_ORDER.indexOf(b) ? a : b;

function noisyOr(weights: number[]): number {
  return 1 - weights.reduce((acc, w) => acc * (1 - Math.min(0.99, Math.max(0, w))), 1);
}

function senderSignals(text: string): ShieldSignal[] {
  const out: ShieldSignal[] = [];
  for (const m of text.matchAll(/\b([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})\b/gi)) {
    const local = (m[1] ?? '').toLowerCase();
    const domain = (m[2] ?? '').toLowerCase();
    if (
      FREE_MAIL.has(domain) &&
      (OFFICIAL_WORDS.test(local) || BRAND_WORDS.some((b) => local.includes(b)))
    ) {
      out.push({
        id: 'free-mail-official',
        kind: 'sender',
        ...SENDER_SIGNALS['free-mail-official'],
      });
      break;
    }
  }
  return out;
}

function phoneSignals(text: string, country?: string): ShieldSignal[] {
  const code = country ? CALLING_CODES[country.toUpperCase()] : undefined;
  if (!code) return [];
  const numbers = [...text.matchAll(/\+\s?(\d{1,3})[\s-]?\d[\d\s-]{6,14}/g)].map((m) => m[1] ?? '');
  const foreign = numbers.filter((cc) => !cc.startsWith(code) && !code.startsWith(cc));
  if (!foreign.length) return [];
  return [{ id: 'foreign-number', kind: 'sender', ...SENDER_SIGNALS['foreign-number'] }];
}

/**
 * Scam Shield's deterministic check. Explains every warning sign in plain language and
 * says what to do next. It never visits links and never stores the message text.
 */
export function checkMessage(input: ShieldInput): ShieldResult {
  const raw = (input.text ?? '').slice(0, 6000);
  const folded = foldText(raw);
  const variants = [folded, unleet(folded)];
  const signals: ShieldSignal[] = [];
  const fired = new Set<string>();

  for (const rule of SHIELD_RULES) {
    const hit = variants.some(
      (v) => rule.all.every((re) => re.test(v)) && !(rule.none ?? []).some((re) => re.test(v)),
    );
    if (!hit) continue;
    fired.add(rule.id);
    signals.push({
      id: rule.id,
      kind: rule.kind,
      category: rule.category,
      weight: rule.weight,
      title: rule.title,
      explanation: rule.explanation,
    });
  }
  const urls: UrlFinding[] = extractUrls(raw).map(analyzeUrl);
  // Combinations can ask for "a link to somewhere other than a known official site".
  if (urls.some((u) => u.host && !isOfficialHost(u.host))) fired.add('link');
  for (const combo of SHIELD_COMBOS) {
    if (combo.requires.every((id) => fired.has(id))) {
      signals.push({
        id: combo.id,
        kind: 'category',
        category: combo.category,
        weight: combo.weight,
        title: combo.title,
        explanation: combo.explanation,
      });
    }
  }

  const urlFlags = new Set(urls.flatMap((u) => u.flags));
  for (const flag of urlFlags) {
    const s = URL_SIGNALS[flag];
    const lookalike =
      flag === 'lookalike' ? urls.find((u) => u.lookalikeOf)?.lookalikeOf : undefined;
    signals.push({
      id: `link-${flag}`,
      kind: 'link',
      category: flag === 'lookalike' ? 'phishing-link' : undefined,
      weight: s.weight,
      title: lookalike ? LOOKALIKE_TITLE.replace('{brand}', lookalike) : s.title,
      explanation: s.explanation,
    });
  }
  signals.push(...senderSignals(folded), ...phoneSignals(raw, input.country));

  const score = Math.round(noisyOr(signals.map((s) => s.weight)) * 100);
  const level = raw.trim().length < 3 ? 'low' : levelFromScore(score);

  // Rank categories by the total weight of their signals.
  const byCategory = new Map<ScamCategory, number>();
  for (const s of signals)
    if (s.category) byCategory.set(s.category, (byCategory.get(s.category) ?? 0) + s.weight);
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);

  signals.sort((a, b) => b.weight - a.weight);
  const adviceIds = adviceFor(level, categories);

  return localizeShieldResult(
    {
      level,
      score,
      signals,
      categories,
      urls,
      advice: adviceIds.map((id) => ADVICE[id] ?? id),
      report: level === 'low' ? [] : getReportChannels(input.country),
      engine: { rules: SHIELD_RULES_VERSION },
    },
    input.locale,
  );
}

export interface AiOpinion {
  level: RiskLevel;
  categories: ScamCategory[];
  reasons: string[];
  model: string;
}

/**
 * Combine the deterministic result with an AI second opinion. The AI can raise concern
 * and add explanations, but it can never lower the rules' verdict: recall comes first.
 */
export function mergeAiOpinion(
  rules: ShieldResult,
  ai: AiOpinion,
  country?: string | null,
  locale?: Locale | null,
): ShieldResult {
  const level = maxLevel(rules.level, ai.level);
  const aiSignals: ShieldSignal[] = ai.reasons.slice(0, 3).map((reason, i) => ({
    id: `ai-${i + 1}`,
    kind: 'category',
    category: ai.categories[0],
    weight: 0,
    title: reason.length > 90 ? `${reason.slice(0, 87)}…` : reason,
    explanation: AI_EXPLANATION,
  }));
  const categories = [...new Set([...rules.categories, ...ai.categories])];
  const raised = LEVEL_ORDER.indexOf(level) > LEVEL_ORDER.indexOf(rules.level);
  return localizeShieldResult(
    {
      ...rules,
      level,
      score: raised
        ? Math.max(rules.score, level === 'very-high' ? 75 : level === 'high' ? 50 : 25)
        : rules.score,
      signals: [...rules.signals, ...aiSignals],
      categories,
      advice: adviceFor(level, categories).map((id) => ADVICE[id] ?? id),
      report:
        level === 'low' ? [] : rules.report.length ? rules.report : getReportChannels(country),
      engine: {
        ...rules.engine,
        ai: { model: ai.model, level: ai.level, agreed: ai.level === rules.level },
      },
    },
    locale,
  );
}
