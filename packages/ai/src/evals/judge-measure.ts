/**
 * Measuring the judge (TypeSafe's Jev) on Scam Shield's golden set, language by language.
 *
 * `pnpm eval` checks what Waypoint guarantees whatever the judge answers, with a stand-in.
 * It cannot say whether the real judge is any good. This does, and it is the only way a
 * language gets switched on for the judge (AI_JUDGE_LOCALES): every message in
 * evals/datasets/scam.jsonl is rated by the rules, then by the rules plus the real judge, and
 * the two release gates are worked out both ways for each language.
 *
 * The judge can only raise a level, so it cannot make the first gate worse (scams rated
 * high). What it can do is raise an ordinary message to "high": the second gate (at most 10%
 * of legitimate messages rated high) is the one that decides.
 *
 * This file is the arithmetic, with no service and no database in it, so it can be tested
 * with a stub. judge-cli.ts runs it for real.
 */
import {
  type AiOpinion,
  checkMessage,
  LEVEL_ORDER,
  mergeAiOpinion,
  type RiskLevel,
  type ShieldResult,
} from '@waypoint/core';
import { judgeCouldRaise } from '../judge-shield';

export interface ScamCase {
  text: string;
  lang: string;
  label: 'scam' | 'legit';
  country?: string;
}

/** What the judge said about one message: its opinion, and the score the level came from. */
export interface JudgeReading {
  opinion: AiOpinion;
  /** The warning signs it saw, added up: 0 to 1 (readShieldSigns). */
  score: number;
}

/** Asks the judge about one message. Null (or a throw): no answer, and the rules' level stands. */
export type AskJudge = (
  c: ScamCase,
  rules: ShieldResult,
  index: number,
) => Promise<JudgeReading | null>;

export interface MeasuredCase {
  lang: string;
  label: 'scam' | 'legit';
  /** The level from the rules alone. */
  rules: RiskLevel;
  /** The level after the judge's opinion went through the raise-only merge. */
  withJudge: RiskLevel;
  /**
   * False when the rules already said high or above, which is as much as the judge can say:
   * the app does not ask then, so nor does this.
   */
  asked: boolean;
  answered: boolean;
  score: number | null;
}

/** The release gates, as in docs/SAFETY.md and the main evaluation. */
export const GATES = { scamsHigh: 0.9, legitHigh: 0.1 } as const;

/**
 * A language counts as measured only when the judge answered at least this share of what it
 * was asked. Otherwise "with the judge" is mostly the rules alone, and would pass by default.
 */
export const MIN_ANSWERED = 0.9;

const isHigh = (level: RiskLevel) => LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf('high');

/** Rate every case by the rules and then with the judge, a few at a time, in order. */
export async function measure(
  cases: ScamCase[],
  ask: AskJudge,
  opts: { atOnce?: number; onDone?: (done: number, total: number) => void } = {},
): Promise<MeasuredCase[]> {
  const rows: MeasuredCase[] = new Array(cases.length);
  let next = 0;
  let done = 0;
  const one = async (i: number) => {
    const c = cases[i]!;
    const rules = checkMessage({ text: c.text, country: c.country });
    const row: MeasuredCase = {
      lang: c.lang,
      label: c.label,
      rules: rules.level,
      withJudge: rules.level,
      asked: judgeCouldRaise(rules.level),
      answered: false,
      score: null,
    };
    if (row.asked) {
      const reading = await ask(c, rules, i).catch(() => null);
      if (reading) {
        row.answered = true;
        row.score = reading.score;
        // The same merge the app uses: whatever the judge said, the level cannot go down.
        row.withJudge = mergeAiOpinion(rules, reading.opinion, c.country).level;
      }
    }
    rows[i] = row;
    done += 1;
    opts.onDone?.(done, cases.length);
  };
  const worker = async () => {
    while (next < cases.length) await one(next++);
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.atOnce ?? 1) }, worker));
  return rows;
}

interface GateNumbers {
  scamsHigh: number;
  legitHigh: number;
  /** Share of scams rated high or above (null: the language has no scams in the set). */
  scamRate: number | null;
  /** Share of legitimate messages rated high or above. */
  legitRate: number | null;
  pass: boolean;
}

export interface LanguageReport {
  lang: string;
  scams: number;
  legit: number;
  asked: number;
  answered: number;
  measured: boolean;
  rules: GateNumbers;
  judged: GateNumbers;
  /** Expected calibration error of the judge's score in this language (null: no answers). */
  ece: number | null;
}

export interface Reliability {
  /** Messages the judge answered about. */
  n: number;
  bins: Array<{ from: number; to: number; n: number; meanScore: number; scamRate: number }>;
  /**
   * Expected calibration error: the gap between the score and the share of messages that
   * really were scams, averaged over ten bands of score and weighted by how many messages
   * fall in each. 0 is perfect; 0.2 means the score is off by 20 points on average.
   */
  ece: number | null;
}

export interface JudgeReport {
  languages: LanguageReport[];
  reliability: Reliability;
}

const round = (x: number) => Math.round(x * 10_000) / 10_000;

function gates(rows: MeasuredCase[], level: (r: MeasuredCase) => RiskLevel): GateNumbers {
  const scams = rows.filter((r) => r.label === 'scam');
  const legit = rows.filter((r) => r.label === 'legit');
  const scamsHigh = scams.filter((r) => isHigh(level(r))).length;
  const legitHigh = legit.filter((r) => isHigh(level(r))).length;
  const scamRate = scams.length ? scamsHigh / scams.length : null;
  const legitRate = legit.length ? legitHigh / legit.length : null;
  return {
    scamsHigh,
    legitHigh,
    scamRate,
    legitRate,
    pass:
      (scamRate === null || scamRate >= GATES.scamsHigh) &&
      (legitRate === null || legitRate <= GATES.legitHigh),
  };
}

/**
 * How well the judge's score matches reality. The score is a sum of weighted warning signs,
 * not a probability anyone promised; this shows how far it is from being readable as one.
 */
export function reliability(rows: MeasuredCase[]): Reliability {
  const answered = rows.filter((r) => r.answered && r.score !== null);
  const bands = Array.from({ length: 10 }, () => ({ n: 0, score: 0, scams: 0 }));
  for (const r of answered) {
    const band = bands[Math.min(9, Math.max(0, Math.floor((r.score ?? 0) * 10)))]!;
    band.n += 1;
    band.score += r.score ?? 0;
    if (r.label === 'scam') band.scams += 1;
  }
  const gap = bands.reduce(
    (sum, b) => (b.n ? sum + b.n * Math.abs(b.scams / b.n - b.score / b.n) : sum),
    0,
  );
  return {
    n: answered.length,
    bins: bands.map((b, i) => ({
      from: i / 10,
      to: (i + 1) / 10,
      n: b.n,
      meanScore: b.n ? round(b.score / b.n) : 0,
      scamRate: b.n ? round(b.scams / b.n) : 0,
    })),
    ece: answered.length ? gap / answered.length : null,
  };
}

const ORDER = ['en', 'hi', 'es', 'fr', 'pt', 'ar', 'sw'];

export function summarise(rows: MeasuredCase[]): JudgeReport {
  const langs = [...new Set(rows.map((r) => r.lang))].sort(
    (a, b) =>
      (ORDER.includes(a) ? ORDER.indexOf(a) : ORDER.length) -
        (ORDER.includes(b) ? ORDER.indexOf(b) : ORDER.length) || a.localeCompare(b),
  );
  return {
    languages: langs.map((lang) => {
      const mine = rows.filter((r) => r.lang === lang);
      const asked = mine.filter((r) => r.asked).length;
      const answered = mine.filter((r) => r.answered).length;
      return {
        lang,
        scams: mine.filter((r) => r.label === 'scam').length,
        legit: mine.filter((r) => r.label === 'legit').length,
        asked,
        answered,
        measured: asked === 0 || answered / asked >= MIN_ANSWERED,
        rules: gates(mine, (r) => r.rules),
        judged: gates(mine, (r) => r.withJudge),
        ece: reliability(mine).ece,
      };
    }),
    reliability: reliability(rows),
  };
}

const pct = (x: number | null) => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`);

/**
 * The languages that stop a release: those the judge is switched on in (AI_JUDGE_LOCALES)
 * that fail a gate with the judge, were not really measured, or have no cases at all.
 */
export function failingLanguages(
  report: JudgeReport,
  enabled: string[],
): Array<{ lang: string; why: string }> {
  const out: Array<{ lang: string; why: string }> = [];
  for (const lang of enabled) {
    const l = report.languages.find((x) => x.lang === lang);
    if (!l) {
      out.push({ lang, why: 'no cases in the golden set' });
      continue;
    }
    const why: string[] = [];
    if (!l.measured)
      why.push(`the judge answered ${l.answered} of ${l.asked} messages it was asked about`);
    if (l.judged.scamRate !== null && l.judged.scamRate < GATES.scamsHigh)
      why.push(`scams rated high: ${pct(l.judged.scamRate)} (gate ≥ 90%)`);
    if (l.judged.legitRate !== null && l.judged.legitRate > GATES.legitHigh)
      why.push(`everyday messages rated high: ${pct(l.judged.legitRate)} (gate ≤ 10%)`);
    if (why.length) out.push({ lang, why: why.join('; ') });
  }
  return out;
}

const cell = (text: string | number, width: number) => String(text).padStart(width);

export function formatReport(
  report: JudgeReport,
  about: { model: string; enabled: string[] },
): string {
  const lines: string[] = [];
  lines.push(`Scam Shield with the judge (${about.model}), per language`);
  lines.push(
    '  Gates: scams rated high or above ≥ 90%, legitimate messages rated high or above ≤ 10%.',
  );
  lines.push('');
  lines.push(
    `  ${'lang'.padEnd(5)}${cell('scams', 6)}${cell('legit', 6)}${cell('asked', 6)}${cell('answd', 6)}   rules alone: scams${cell('legit', 8)}  gates   with judge: scams${cell('legit', 8)}  gates${cell('ECE', 8)}`,
  );
  for (const l of report.languages) {
    const on = about.enabled.includes(l.lang);
    lines.push(
      `  ${l.lang.padEnd(5)}${cell(l.scams, 6)}${cell(l.legit, 6)}${cell(l.asked, 6)}${cell(l.answered, 6)}${cell(pct(l.rules.scamRate), 21)}${cell(pct(l.rules.legitRate), 8)}${cell(l.rules.pass ? 'pass' : 'FAIL', 7)}${cell(pct(l.judged.scamRate), 20)}${cell(pct(l.judged.legitRate), 8)}${cell(l.judged.pass && l.measured ? 'pass' : 'FAIL', 7)}${cell(l.ece === null ? 'n/a' : l.ece.toFixed(3), 8)}${on ? '  switched on' : ''}${l.measured ? '' : '  NOT MEASURED (too few answers)'}`,
    );
  }
  lines.push('');
  lines.push(
    '  "asked" leaves out messages the rules already rate high or above: the judge can say no',
  );
  lines.push(
    '  more than "high", so the app does not send it those. It is measured on what the rules',
  );
  lines.push(
    '  miss. The sets are small (a few dozen messages a language, fewer asked), so one message',
  );
  lines.push(
    '  moves a rate by several points: a pass here is a reason to look closer, not proof.',
  );
  lines.push('');
  const r = report.reliability;
  lines.push(`Reliability of the judge’s combined score (all languages, ${r.n} answers)`);
  lines.push(
    `  ${'score'.padEnd(11)}${cell('n', 6)}${cell('mean score', 13)}${cell('were scams', 13)}`,
  );
  for (const b of r.bins)
    lines.push(
      `  ${`${b.from.toFixed(1)}–${b.to.toFixed(1)}`.padEnd(11)}${cell(b.n, 6)}${cell(b.n ? b.meanScore.toFixed(2) : '-', 13)}${cell(b.n ? pct(b.scamRate) : '-', 13)}`,
    );
  lines.push(
    `  Expected calibration error: ${r.ece === null ? 'n/a (no answers)' : r.ece.toFixed(3)}`,
  );
  lines.push(
    '  (the average gap between the score and how often such messages really were scams; 0 is',
  );
  lines.push(
    '  perfect. The score adds up weighted warning signs: nobody promised it was a probability.)',
  );
  return lines.join('\n');
}
