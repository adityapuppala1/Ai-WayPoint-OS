/**
 * Measure the real judge (TypeSafe's Jev) on Scam Shield's golden set, language by language.
 *
 *   pnpm --filter @waypoint/ai eval:judge
 *
 * It sends every message in evals/datasets/scam.jsonl that the rules rate low or unclear to
 * TypeSafe (they were written for testing and hold no real person's words), exactly as the app
 * would: the same questions, the same arithmetic, the same raise-only merge. It
 * prints the two release gates per language with and without the judge and how well the
 * judge's score matches reality, writes the numbers to evals/results/, and exits non-zero
 * when a language listed in AI_JUDGE_LOCALES fails.
 *
 * Run it before adding a language to AI_JUDGE_LOCALES, and again before changing
 * AI_JUDGE_MODEL or any threshold in judge-shield.ts. It needs TYPESAFE_API_KEY and costs a
 * few cents; without a key it says so and exits 0, so it can sit in a pipeline that has none.
 *
 * All seven languages are asked, whatever AI_JUDGE_LOCALES says: the point is to find out
 * which could be switched on. Nothing is written to the real database.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findRepoRoot, getEnv, resetEnvForTests } from '@waypoint/core/env';
import { failingLanguages, formatReport, measure, type ScamCase, summarise } from './judge-measure';

const ALL_LANGUAGES = ['en', 'hi', 'es', 'fr', 'pt', 'ar', 'sw'];
/** Calls in flight at once: far under the 40 requests a second TypeSafe allows. */
const AT_ONCE = 4;

// What this installation is set to, before anything is changed for the run.
const configured = getEnv();
const enabled = configured.AI_JUDGE_LOCALES;
const model = configured.AI_JUDGE_MODEL;

if (!configured.TYPESAFE_API_KEY) {
  console.log(
    [
      '',
      'The judge was not measured: TYPESAFE_API_KEY is not set.',
      '',
      'This run sends Scam Shield’s golden set to TypeSafe’s Jev and needs a key. Set',
      'TYPESAFE_API_KEY in .env.local and run it again. Until a language passes here it must',
      `not be added to AI_JUDGE_LOCALES (now: ${enabled.join(', ')}).`,
      '',
    ].join('\n'),
  );
  process.exit(0);
}

// A throwaway embedded database for the usage rows, no language model, a budget that cannot
// stop the run, and every language switched on. The key is the only thing kept.
const dir = mkdtempSync(join(tmpdir(), 'waypoint-eval-judge-'));
Object.assign(process.env, {
  WAYPOINT_DATA_DIR: dir,
  DATABASE_URL: '',
  ANTHROPIC_API_KEY: '',
  OPENAI_API_KEY: '',
  GOOGLE_GENERATIVE_AI_API_KEY: '',
  OLLAMA_BASE_URL: '',
  TYPESAFE_API_KEY: configured.TYPESAFE_API_KEY,
  AI_JUDGE_MODEL: model,
  AI_JUDGE_LOCALES: ALL_LANGUAGES.join(','),
  AI_MONTHLY_BUDGET_USD: '1000',
  LOG_LEVEL: 'silent',
});
resetEnvForTests();

const root = findRepoRoot();
const cases = readFileSync(join(root, 'evals', 'datasets', 'scam.jsonl'), 'utf8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as ScamCase);

const db = await import('@waypoint/db');
const { askShieldJudge } = await import('./judge-ask');
const { monthSpendUsd } = await import('../usage');
await db.dbReady();

let exitCode = 0;
try {
  console.log(
    `\nAsking ${model} about ${cases.length} messages in ${ALL_LANGUAGES.length} languages…`,
  );
  const rows = await measure(cases, askShieldJudge(db.getDb()), {
    atOnce: AT_ONCE,
    onDone: (done, total) => {
      if (done % 40 === 0 || done === total) console.log(`  ${done} of ${total}`);
    },
  });
  const report = summarise(rows);
  console.log(`\n${formatReport(report, { model, enabled })}`);

  const failing = failingLanguages(report, enabled);
  const couldAdd = report.languages
    .filter((l) => !enabled.includes(l.lang) && l.measured && l.judged.pass)
    .map((l) => l.lang);
  console.log(`\nSwitched on now (AI_JUDGE_LOCALES): ${enabled.join(', ')}`);
  if (couldAdd.length)
    console.log(
      `Passed both gates here and not switched on: ${couldAdd.join(', ')}. Read the failures above and the size of each set before adding one.`,
    );
  for (const f of failing) console.log(`  ✗ ${f.lang}: ${f.why}`);
  console.log(
    failing.length
      ? `\n${failing.length} language(s) the judge is switched on in did not pass. Take them out of AI_JUDGE_LOCALES, or fix the thresholds in packages/ai/src/judge-shield.ts and measure again.\n`
      : '\nEvery language the judge is switched on in passed.\n',
  );
  exitCode = failing.length ? 1 : 0;

  const outDir = join(root, 'evals', 'results');
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(
    join(outDir, `judge-${stamp}.json`),
    // Numbers only: the messages themselves are in the dataset.
    JSON.stringify(
      {
        at: new Date().toISOString(),
        model,
        enabled,
        costUsd: await monthSpendUsd(db.getDb()).catch(() => null),
        ...report,
        failing,
      },
      null,
      2,
    ),
  );
} finally {
  await db.closeDb().catch(() => undefined);
  rmSync(dir, { recursive: true, force: true });
}
process.exitCode = exitCode;
