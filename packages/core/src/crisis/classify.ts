import { detectLanguage, foldText, unleet } from '../text/normalize';
import type { CrisisAssessment, CrisisCategory, CrisisTier } from '../types';
import {
  CRISIS_RULES,
  type CrisisRule,
  IDIOMS,
  NEGATION_BEFORE,
  NEGATION_NEAR,
  TRIGGER_WORDS,
} from './lexicon';

interface Hit {
  rule: CrisisRule;
  negated: boolean;
}

const IDEATION: CrisisCategory[] = ['suicidal-ideation', 'suicidal-plan', 'self-harm'];

function matchRule(
  rule: CrisisRule,
  variants: string[],
): { index: number; text: string; source: string } | null {
  for (const source of variants) {
    const m = rule.re.exec(source);
    if (m) return { index: m.index, text: m[0], source };
  }
  return null;
}

/**
 * "I would never kill myself", "I don't want to die (I'm scared of surgery)" — negation
 * right before the intent word cancels ideation (the person still gets a gentle check-in).
 * Rules whose wording already contains the negation ("don't want to live") are exempt.
 */
function isNegated(rule: CrisisRule, m: { index: number; text: string; source: string }): boolean {
  if (!IDEATION.includes(rule.category) || rule.escalator || rule.other || rule.noNeg) return false;
  const before = m.source.slice(Math.max(0, m.index - 30), m.index);
  if (NEGATION_BEFORE.test(before)) return true;
  const end = m.index + m.text.length;
  const upto = m.source.slice(0, end);
  let last = -1;
  for (const t of upto.matchAll(TRIGGER_WORDS)) {
    if ((t.index ?? -1) >= m.index) {
      last = t.index ?? -1;
      break; // the first intent word inside the match governs ("want" in "want to die")
    }
  }
  if (last < 0) return false;
  const window = m.source.slice(Math.max(0, last - 20), last);
  // Only look inside the same clause: "I don't know, I want to die" is not negated.
  const clause = window.split(/[,.;:!?]/).pop() ?? window;
  return NEGATION_NEAR.test(clause);
}

/**
 * Deterministic crisis assessment. Runs on every message before any AI model, on every
 * channel (app, SMS, USSD, voice transcripts). Fast (<1ms typical) and dependency-free.
 */
export function assessCrisis(text: string): CrisisAssessment {
  const folded = foldText(text);
  const variants = [folded];
  const leet = unleet(folded);
  if (leet !== folded) variants.push(leet);

  const hits: Hit[] = [];
  for (const rule of CRISIS_RULES) {
    const m = matchRule(rule, variants);
    if (!m) continue;
    // Figurative speech ("this traffic is killing me") never triggers a response.
    const windowStart = Math.max(0, m.index - 12);
    const window = m.source.slice(windowStart, m.index + m.text.length + 16);
    if (IDIOMS.test(window) && rule.category !== 'medical-emergency') continue;
    hits.push({ rule, negated: isNegated(rule, m) });
  }

  const language = detectLanguage(text);
  if (!hits.length) {
    return { tier: 0, categories: [], matched: [], language, confidence: 0.9, aboutOther: false };
  }

  const self = hits.filter((h) => !h.rule.other && !h.negated);
  const other = hits.filter((h) => h.rule.other);
  const negated = hits.filter((h) => h.negated);

  const direct = self.filter((h) => !h.rule.escalator);
  const escalators = self.filter((h) => h.rule.escalator);
  const ideation = direct.filter((h) => IDEATION.includes(h.rule.category) && h.rule.tier >= 2);

  let tier: CrisisTier = 0;
  const categories = new Set<CrisisCategory>();
  for (const h of direct) {
    if (h.rule.tier > tier) tier = h.rule.tier;
    categories.add(h.rule.category);
  }

  // Thoughts of suicide or self-harm plus a plan, means or timeline → imminent.
  if (ideation.length && escalators.length) {
    tier = 3;
    categories.add('suicidal-plan');
  } else if (!ideation.length && escalators.length) {
    // Plan cues without explicit words about dying ("I bought rope, tonight is the night").
    // Having acquired lethal means plus a timeline gets real support first (tier 2); having
    // acquired means alone gets a gentle check-in (tier 1). A timeline plus an everyday word
    // like "hang" or "jump" alone is ignored ("I'm going to hang the pictures tonight").
    const kinds = new Set(escalators.map((h) => h.rule.id.split('.').pop()));
    if (kinds.has('have-plan') && kinds.has('timeline')) {
      if (tier < 2) tier = 2;
      categories.add('suicidal-plan');
    } else if (kinds.has('have-plan') && kinds.has('means') && tier < 1) {
      tier = 1;
      categories.add('distress');
    }
  }

  // Worried about someone else: medical words don't say who is at risk, so only the
  // person's own thoughts of suicide, self-harm or abuse make it "about me".
  const selfPersonal = direct.filter(
    (h) => h.rule.category !== 'medical-emergency' && h.rule.tier >= 2,
  );
  let aboutOther = false;
  if (other.length && !selfPersonal.length) {
    aboutOther = true;
    for (const h of other) {
      if (h.rule.tier > tier) tier = h.rule.tier;
      categories.add(h.rule.category);
    }
  }

  // "I'm not suicidal, just exhausted" → still a gentle check-in, never silence.
  if (tier === 0 && negated.length) {
    tier = 1;
    categories.add('distress');
  }

  const matched = [...new Set(hits.map((h) => h.rule.id))];
  const strongest = direct.length + other.length;
  const onlyMentions = hits.every((h) => h.rule.id.endsWith('mention'));
  const base = tier === 3 ? 0.9 : tier === 2 ? 0.8 : tier === 1 ? 0.55 : 0.5;
  const confidence = Math.min(
    0.97,
    (onlyMentions ? 0.45 : base) + Math.max(0, strongest - 1) * 0.04,
  );

  return {
    tier,
    categories: [...categories],
    matched,
    language,
    confidence: Math.round(confidence * 100) / 100,
    aboutOther,
  };
}
