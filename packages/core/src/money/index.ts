/**
 * Money: calm, honest arithmetic. No product sales, no investment tips, no credit scores —
 * just how long savings last, what is essential, and the next sensible step.
 * Suggestion ids are stable so the UI can translate them; English text is the fallback.
 */
import type { MoneyStress, RunwayInput, RunwayResult } from '../types';

export type Period = 'day' | 'week' | 'fortnight' | 'month' | 'quarter' | 'year';

const PER_MONTH: Record<Period, number> = {
  day: 365.25 / 12,
  week: 52.1775 / 12,
  fortnight: 26.08875 / 12,
  month: 1,
  quarter: 1 / 3,
  year: 1 / 12,
};

/** Convert an amount paid per `period` into a monthly figure. */
export function toMonthly(amount: number, period: Period): number {
  return round2(amount * PER_MONTH[period]);
}

/**
 * A cautious monthly income for irregular earners (gig, seasonal, freelance): the
 * 25th percentile of recent months, so plans hold up in a lean month.
 */
export function conservativeIncome(months: number[]): number | null {
  const xs = months.filter((x) => Number.isFinite(x) && x >= 0).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  if (xs.length === 1) return xs[0] ?? null;
  const pos = (xs.length - 1) * 0.25;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = xs[lo] ?? 0;
  const b = xs[hi] ?? a;
  return round2(a + (b - a) * (pos - lo));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const nonNeg = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export interface MoneySuggestion {
  id: string;
  title: string;
  detail: string;
}

export const MONEY_SUGGESTIONS = {
  'protect-essentials': {
    title: 'Protect the essentials first',
    detail:
      'Rent, food, power, medicine and minimum debt payments come before everything else. List them and pay them first each month.',
  },
  'talk-to-lenders': {
    title: 'Talk to lenders before you miss a payment',
    detail:
      'Most banks and lenders have hardship options (a pause, lower payments or a longer term), and they are easier to get before a payment is missed.',
  },
  'avoid-high-cost-credit': {
    title: 'Avoid instant-loan apps and payday loans',
    detail:
      'They can charge very high fees and some use harassment to collect. If a lender pressures you, stop and check it in Shield.',
  },
  'check-benefits': {
    title: 'Check the support you are entitled to',
    detail:
      'Many people miss unemployment, food, housing or health support they qualify for. The Services checklist for your situation lists where to start.',
  },
  'trim-other': {
    title: 'Pause one non-essential cost this month',
    detail:
      'Pick the easiest one to pause, not the one you feel worst about. Small, reversible cuts are easier to keep.',
  },
  'income-step': {
    title: 'Add one income step to your plan',
    detail:
      'A short-term task, a few hours of paid work or selling something unused can buy time while your longer plan runs.',
  },
  'emergency-buffer': {
    title: 'Build a small buffer',
    detail:
      'Aim first for one month of essentials, set aside automatically on payday, even in small amounts.',
  },
  'grow-buffer': {
    title: 'Grow your buffer to three months',
    detail:
      'Three months of essentials gives you room to choose your next job rather than take the first one.',
  },
  'reduce-debt': {
    title: 'Bring debt payments down',
    detail:
      'Debt payments above about a third of income leave little room for surprises. Pay the highest-interest debt first, and never borrow to repay.',
  },
  'invest-in-skills': {
    title: 'Put a little towards your next skill',
    detail:
      'With essentials covered, a small, regular amount for learning or tools tends to pay back faster than most alternatives.',
  },
  'free-advice': {
    title: 'Get free, independent debt advice',
    detail:
      'Non-profit debt advice services can negotiate with lenders for you. Avoid anyone who charges upfront to "clear" your debt.',
  },
} as const satisfies Record<string, { title: string; detail: string }>;

export type MoneySuggestionId = keyof typeof MONEY_SUGGESTIONS;

function suggest(id: MoneySuggestionId): MoneySuggestion {
  return { id, ...MONEY_SUGGESTIONS[id] };
}

/**
 * How long savings last, how stretched the month is, and what to do next.
 * All amounts are monthly and in the same currency.
 */
export function runway(input: RunwayInput): RunwayResult {
  const income = nonNeg(input.monthlyIncome);
  const essential = nonNeg(input.essentialExpenses);
  const other = nonNeg(input.otherExpenses);
  const debt = nonNeg(input.debtMonthly);
  const savings = nonNeg(input.savings);

  const outgoings = essential + other + debt;
  const monthlyGap = round2(income - outgoings);
  const monthsOfRunway = monthlyGap >= 0 ? null : round1(savings / -monthlyGap);
  const essentials = essential + debt;
  const essentialsCoverMonths = essentials > 0 ? round1(savings / essentials) : null;
  const debtToIncome = income > 0 ? round2(debt / income) : debt > 0 ? null : 0;

  let stress: MoneyStress = 'stable';
  const essentialsGap = income - essentials; // can the income cover the essentials alone?
  if (
    (monthsOfRunway !== null && monthsOfRunway < 1) ||
    (debtToIncome !== null && debtToIncome > 0.5) ||
    (income === 0 && debt > 0 && savings < debt)
  ) {
    stress = 'critical';
  } else if (
    (monthsOfRunway !== null && monthsOfRunway < 3) ||
    (debtToIncome !== null && debtToIncome > 0.36) ||
    (essentialsGap < 0 && (essentialsCoverMonths ?? 0) < 3)
  ) {
    stress = 'tight';
  } else if (
    monthsOfRunway !== null ||
    (debtToIncome !== null && debtToIncome > 0.2) ||
    (essentialsCoverMonths !== null && essentialsCoverMonths < 3)
  ) {
    stress = 'watch';
  }

  const s: MoneySuggestion[] = [];
  if (stress === 'critical' || stress === 'tight') {
    // Order matters: only five are shown. Debt help comes before cost-cutting, and the warning
    // about predatory loans always makes the list, because people under pressure are targeted.
    s.push(suggest('protect-essentials'));
    if (debt > 0) s.push(suggest('talk-to-lenders'));
    if (debtToIncome !== null && debtToIncome > 0.36) s.push(suggest('free-advice'));
    if (essentialsGap < 0 || monthsOfRunway !== null) s.push(suggest('check-benefits'));
    s.push(suggest('avoid-high-cost-credit'));
    s.push(suggest('income-step'));
    if (other > 0) s.push(suggest('trim-other'));
  } else if (stress === 'watch') {
    if (monthsOfRunway !== null && other > 0) s.push(suggest('trim-other'));
    if (debtToIncome !== null && debtToIncome > 0.2) s.push(suggest('reduce-debt'));
    if ((essentialsCoverMonths ?? 0) < 1) s.push(suggest('emergency-buffer'));
    else if ((essentialsCoverMonths ?? 0) < 3) s.push(suggest('grow-buffer'));
    if (monthsOfRunway !== null) s.push(suggest('income-step'));
  } else {
    if (essentials > 0 && (essentialsCoverMonths ?? 0) < 6) s.push(suggest('grow-buffer'));
    s.push(suggest('invest-in-skills'));
  }

  return {
    monthsOfRunway,
    monthlyGap,
    essentialsCoverMonths,
    debtToIncome,
    stress,
    suggestions: s.slice(0, 5),
  };
}

/** Locale-aware currency formatting that never throws on an unknown currency code. */
export function formatMoney(amount: number, currency: string, locale = 'en'): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: Math.abs(amount) >= 1000 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${new Intl.NumberFormat(locale).format(amount)} ${currency}`;
  }
}
