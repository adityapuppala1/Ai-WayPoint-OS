/**
 * "What's next?" — forecasts people can check us on.
 *
 * A forecast is a yes-or-no question about the near future with a date on which it will be
 * judged, the chance Waypoint gives it (a number and words, never 0 % or 100 %), where that
 * chance comes from, and what someone can do about it either way. Staff publish them and
 * judge them; nothing here is generated or invented, so until staff publish one there is
 * nothing to show. Every forecast that is judged goes on the public record, right or wrong.
 */
import { z } from '@hono/zod-openapi';
import {
  clampForecast,
  FORECAST_BOUNDS,
  forecastScore,
  type JudgedForecast,
  LOCALES,
  type Locale,
  type ProbabilityWord,
  probabilityWords,
  type RelevanceReason,
  relevance,
  SCOREBOARD,
  scoreboard,
} from '@waypoint/core';
import { safeExternalHref } from '@waypoint/core/paths';
import {
  and,
  asc,
  auditLog,
  type Database,
  desc,
  eq,
  type ForecastSource,
  type ForecastTranslation,
  forecastPredictions,
  forecasts,
  inArray,
  notInArray,
  sql,
} from '@waypoint/db';
import { type Actor, audit } from '../lib/audit';
import { ApiError, notFound } from '../lib/problem';
import type { Profile } from './me';

export const FORECAST_CATEGORIES = [
  'jobs',
  'prices',
  'money',
  'safety',
  'health',
  'climate',
  'technology',
  'rules',
  'other',
] as const;

/** open: still ahead · awaiting: the date has passed, not judged yet · resolved · annulled */
export const FORECAST_STATES = ['open', 'awaiting', 'resolved', 'annulled'] as const;
export type ForecastState = (typeof FORECAST_STATES)[number];

/**
 * What staff can list in the console: the four states, and the verdicts still waiting for a
 * second member of staff to confirm them.
 */
export const ADMIN_FORECAST_FILTERS = [
  'open',
  'awaiting',
  'unchecked',
  'resolved',
  'annulled',
] as const;
export type AdminForecastFilter = (typeof ADMIN_FORECAST_FILTERS)[number];

const PREDICTOR = 'waypoint';
const DAY = 86_400_000;

/**
 * Who recorded a verdict and who confirmed it is read from the audit log, which already
 * records every staff action on a forecast and is never rewritten.
 */
const VERDICT_ACTIONS = ['forecast.resolved', 'forecast.annulled'];
const CONFIRMED_ACTION = 'forecast.verdict-confirmed';

// ─────────────────────────────── What people see ───────────────────────────────

const SourceSchema = z.object({ name: z.string(), url: z.string() });

export const ForecastSchema = z
  .object({
    id: z.string(),
    question: z.string(),
    /** Why it matters, in a few sentences (may be empty). */
    description: z.string(),
    whatToDo: z.string(),
    resolutionCriteria: z.string(),
    /** The language these words are in, and whether that is a translation by staff. */
    language: z.enum(LOCALES),
    translated: z.boolean(),
    category: z.string(),
    regions: z.array(z.string()),
    /** The chance shown now (or when it closed): 0.01 to 0.99. */
    probability: z.number(),
    words: z.string(),
    /** How often this kind of thing usually happens, when staff gave it. */
    baseRate: z.number().nullable(),
    rationale: z.string().nullable(),
    sources: z.array(SourceSchema),
    publishedAt: z.string(),
    /** When the chance was last changed. */
    updatedAt: z.string(),
    /** Every chance it has shown, oldest first. */
    history: z.array(z.object({ probability: z.number(), at: z.string() })),
    /** The date it will be judged. */
    resolvesAt: z.string(),
    state: z.enum(FORECAST_STATES),
    outcome: z.enum(['yes', 'no']).nullable(),
    resolvedAt: z.string().nullable(),
    resolutionNote: z.string().nullable(),
    resolutionSourceUrl: z.string().nullable(),
    /**
     * Once judged: whether a second member of staff, not the one who recorded the outcome,
     * has confirmed it. Null while there is no outcome to check.
     */
    doubleChecked: z.boolean().nullable(),
    /** Its score once judged: 0 is perfect, 0.25 is what saying 50 % would score. */
    score: z.number().nullable(),
    isDemo: z.boolean(),
    /** Why it is shown to this person (their country, their sector…); empty when it is not. */
    reasons: z.array(z.string()),
  })
  .openapi('Forecast');

export type ForecastView = z.infer<typeof ForecastSchema>;

export const ForecastListSchema = z
  .object({
    /** Still ahead, the most relevant and the soonest first. */
    open: z.array(ForecastSchema),
    /** The date has passed and staff have not judged it yet. */
    awaiting: z.array(ForecastSchema),
    /** Judged or withdrawn, newest first: one page of them. */
    judged: z.array(ForecastSchema),
    /** How many have been judged or withdrawn in all, and how many are on a page. */
    judgedTotal: z.number().int(),
    judgedPerPage: z.number().int(),
  })
  .openapi('ForecastList');

/** Judged forecasts are listed a page at a time; every one stays reachable. */
export const JUDGED_PER_PAGE = 20;
/** More open forecasts than this at once would be a wall nobody reads. */
const OPEN_AT_ONCE = 200;
const JUDGED = ['resolved', 'annulled'];

export const ForecastRecordSchema = z
  .object({
    open: z.number().int(),
    awaiting: z.number().int(),
    judged: z.number().int(),
    annulled: z.number().int(),
    /** Of those judged or withdrawn: how many no second member of staff has confirmed yet. */
    unchecked: z.number().int(),
    /** How many came true, of those judged. */
    happened: z.number().int(),
    /** Mean score, or null until `minForScore` forecasts have been judged. */
    brier: z.number().nullable(),
    /** What always giving the overall rate would have scored. */
    reference: z.number().nullable(),
    /** Per band of chance: how often things really happened. Null until `minForCalibration`. */
    calibration: z
      .array(
        z.object({
          from: z.number(),
          to: z.number(),
          n: z.number().int(),
          meanPredicted: z.number(),
          observed: z.number(),
        }),
      )
      .nullable(),
    minForScore: z.number().int(),
    minForCalibration: z.number().int(),
    /** When the first forecast on the record was judged. */
    since: z.string().nullable(),
  })
  .openapi('ForecastRecord');

export type ForecastRecord = z.infer<typeof ForecastRecordSchema>;

type Row = typeof forecasts.$inferSelect;
type Chance = { probability: number; rationale: string | null; createdAt: Date };

const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);

function stateOf(row: Row, now: Date): ForecastState {
  if (row.status === 'resolved' || row.status === 'annulled') return row.status;
  return row.resolvesAt.getTime() <= now.getTime() ? 'awaiting' : 'open';
}

/** The words in the reader's language when staff wrote them; otherwise as first written. */
function wordsFor(row: Row, locale: string) {
  const original = isLocale(row.language) ? row.language : 'en';
  const t: ForecastTranslation | undefined =
    locale !== original ? row.translations?.[locale] : undefined;
  if (t && isLocale(locale))
    return {
      question: t.question,
      description: t.description ?? row.description,
      whatToDo: t.whatToDo,
      resolutionCriteria: t.resolutionCriteria,
      language: locale,
      translated: true,
    };
  return {
    question: row.question,
    description: row.description,
    whatToDo: row.whatToDo,
    resolutionCriteria: row.resolutionCriteria,
    language: original,
    translated: false,
  };
}

/** When a forecast stops being open to changes: its date, or the moment it was judged early. */
function closedAt(row: Row): Date {
  const judged = row.resolvedAt?.getTime() ?? Number.POSITIVE_INFINITY;
  return new Date(Math.min(row.closesAt.getTime(), judged));
}

function scoreOf(row: Row, chances: Chance[]) {
  if (row.status !== 'resolved' || (row.outcome !== 0 && row.outcome !== 1)) return null;
  return forecastScore(
    chances.map((c) => ({ p: c.probability, at: c.createdAt })),
    row.opensAt,
    closedAt(row),
    row.outcome,
  );
}

function view(
  row: Row,
  chances: Chance[],
  locale: string,
  reasons: RelevanceReason[],
  now: Date,
  /** The forecasts whose verdict a second person has confirmed. */
  checked: Set<string>,
): ForecastView | null {
  // The chance shown is the last one published before it closed.
  const close = closedAt(row).getTime();
  const shown = chances.filter((c) => c.createdAt.getTime() <= close);
  const current = shown.at(-1) ?? chances[0];
  if (!current) return null; // never published with a chance: not a forecast
  const score = scoreOf(row, chances);
  return {
    id: row.id,
    ...wordsFor(row, locale),
    category: row.category,
    regions: row.regions,
    // Shown between 1% and 99% whatever is stored: nothing about the future is certain.
    probability: clampForecast(current.probability),
    words: probabilityWords(clampForecast(current.probability)) satisfies ProbabilityWord,
    baseRate: row.baseRate ?? null,
    rationale: current.rationale,
    sources: row.sources.filter((s) => safeExternalHref(s.url)),
    publishedAt: row.opensAt.toISOString(),
    updatedAt: current.createdAt.toISOString(),
    history: shown.map((c) => ({
      probability: clampForecast(c.probability),
      at: c.createdAt.toISOString(),
    })),
    resolvesAt: row.resolvesAt.toISOString(),
    state: stateOf(row, now),
    outcome: row.status === 'resolved' ? (row.outcome === 1 ? 'yes' : 'no') : null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolutionNote: row.resolutionNote,
    resolutionSourceUrl: safeExternalHref(row.resolutionSourceUrl),
    // Example rows were never judged by anyone: there is no check to report on them.
    doubleChecked: JUDGED.includes(row.status) && !row.isDemo ? checked.has(row.id) : null,
    score: score?.brier ?? null,
    isDemo: row.isDemo,
    reasons,
  };
}

async function chancesFor(db: Database, ids: string[]): Promise<Map<string, Chance[]>> {
  const out = new Map<string, Chance[]>();
  if (!ids.length) return out;
  const rows = await db
    .select({
      forecastId: forecastPredictions.forecastId,
      probability: forecastPredictions.probability,
      rationale: forecastPredictions.rationale,
      createdAt: forecastPredictions.createdAt,
    })
    .from(forecastPredictions)
    .where(
      and(
        inArray(forecastPredictions.forecastId, ids),
        eq(forecastPredictions.predictor, PREDICTOR),
      ),
    )
    .orderBy(asc(forecastPredictions.createdAt));
  for (const r of rows) out.set(r.forecastId, [...(out.get(r.forecastId) ?? []), r]);
  return out;
}

/** Of these forecasts, the ones whose verdict a second member of staff has confirmed. */
async function confirmedAmong(db: Database, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await db
    .select({ id: auditLog.targetId })
    .from(auditLog)
    .where(and(eq(auditLog.action, CONFIRMED_ACTION), inArray(auditLog.targetId, ids)));
  return new Set(rows.map((r) => r.id).filter((id): id is string => id !== null));
}

/** A judged forecast that no second person has confirmed (as a condition on `forecasts`). */
const notConfirmed = sql`not exists (
  select 1 from audit_log c
  where c.action = ${CONFIRMED_ACTION} and c.target_id = ${forecasts.id}::text)`;

/** Example rows are shown only outside production, and always labelled. They are never scored. */
const realOnly = eq(forecasts.isDemo, false);

export async function listForecasts(
  db: Database,
  who: {
    profile: Profile | null;
    /** Consent `foresight_matching`: without it only the person's country is used. */
    matching: boolean;
  },
  opts: {
    locale: string;
    includeExamples?: boolean;
    now?: Date;
    /** Which page of judged forecasts (from 1), or `false` to leave them out (Today). */
    judgedPage?: number | false;
  } = { locale: 'en' },
): Promise<z.infer<typeof ForecastListSchema>> {
  const now = opts.now ?? new Date();
  const examples = opts.includeExamples ? undefined : realOnly;
  // Forecasts still ahead (or waiting for their verdict) and judged ones are read separately,
  // so years of judged forecasts can never push a new one off the list.
  const ahead = await db
    .select()
    .from(forecasts)
    .where(and(examples, notInArray(forecasts.status, JUDGED)))
    .orderBy(asc(forecasts.resolvesAt))
    .limit(OPEN_AT_ONCE);
  const page = opts.judgedPage === false ? null : Math.max(1, opts.judgedPage ?? 1);
  const past = page
    ? await db
        .select()
        .from(forecasts)
        .where(and(examples, inArray(forecasts.status, JUDGED)))
        .orderBy(sql`${forecasts.resolvedAt} desc nulls last`, desc(forecasts.id))
        .limit(JUDGED_PER_PAGE)
        .offset((page - 1) * JUDGED_PER_PAGE)
    : [];
  const [total] = page
    ? await db
        .select({ n: sql<number>`count(*)::int` })
        .from(forecasts)
        .where(and(examples, inArray(forecasts.status, JUDGED)))
    : [{ n: 0 }];
  const [chances, checked] = await Promise.all([
    chancesFor(
      db,
      [...ahead, ...past].map((r) => r.id),
    ),
    confirmedAmong(
      db,
      past.map((r) => r.id),
    ),
  ]);
  const p = who.profile;
  const profile = {
    country: p?.country ?? undefined,
    region: who.matching ? (p?.region ?? undefined) : undefined,
    lifeStage: undefined,
    situation: undefined,
    sectors: who.matching ? (p?.sectors ?? []) : [],
    skills: [],
    roles: [],
  };
  const shown = (rows: Row[]) =>
    rows
      .map((row) => {
        const rel = relevance(profile, {
          regions: row.regions,
          sectors: row.sectors,
          skills: [],
          lifeStages: [],
          situations: [],
        });
        // "Global" is not a reason worth saying; a country or a sector is.
        const reasons = rel.reasons.filter((r) => r !== 'global');
        return {
          row,
          score: rel.score,
          v: view(row, chances.get(row.id) ?? [], opts.locale, reasons, now, checked),
        };
      })
      .filter((x): x is typeof x & { v: ForecastView } => x.v !== null);
  const items = shown(ahead);
  const by = (state: ForecastState) => items.filter((x) => x.v.state === state);
  return {
    open: by('open')
      .sort((a, b) => b.score - a.score || a.row.resolvesAt.getTime() - b.row.resolvesAt.getTime())
      .map((x) => x.v),
    awaiting: by('awaiting').map((x) => x.v),
    judged: shown(past).map((x) => x.v),
    judgedTotal: Number(total?.n ?? 0),
    judgedPerPage: JUDGED_PER_PAGE,
  };
}

/** The public record of how forecasts turned out. Example rows never count. */
export async function forecastRecord(db: Database, now = new Date()): Promise<ForecastRecord> {
  const rows = await db.select().from(forecasts).where(realOnly).limit(5000);
  const chances = await chancesFor(
    db,
    rows.filter((r) => r.status === 'resolved').map((r) => r.id),
  );
  const judged: JudgedForecast[] = [];
  let since: Date | null = null;
  for (const row of rows) {
    const score = scoreOf(row, chances.get(row.id) ?? []);
    if (!score || score.brier === null || score.meanP === null) continue;
    judged.push({ brier: score.brier, meanP: score.meanP, outcome: row.outcome as 0 | 1 });
    if (row.resolvedAt && (!since || row.resolvedAt < since)) since = row.resolvedAt;
  }
  const board = scoreboard(judged);
  const count = (state: ForecastState) => rows.filter((r) => stateOf(r, now) === state).length;
  const [unchecked] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(forecasts)
    .where(and(realOnly, inArray(forecasts.status, JUDGED), notConfirmed));
  return {
    open: count('open'),
    awaiting: count('awaiting'),
    judged: board.judged,
    annulled: count('annulled'),
    unchecked: Number(unchecked?.n ?? 0),
    happened: judged.filter((j) => j.outcome === 1).length,
    brier: board.brier,
    reference: board.reference,
    calibration: board.calibration,
    minForScore: SCOREBOARD.minForScore,
    minForCalibration: SCOREBOARD.minForCalibration,
    since: since?.toISOString() ?? null,
  };
}

// ─────────────────────────────── Staff: publish and judge ───────────────────────────────

const Probability = z
  .number()
  .min(FORECAST_BOUNDS.min, 'Nothing about the future is certain: use 1 % to 99 %.')
  .max(FORECAST_BOUNDS.max, 'Nothing about the future is certain: use 1 % to 99 %.');

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
/** A country that exists, in its standard code: "uk" becomes GB; "QQ" and "ZZ" are refused. */
export const Region = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/)
  .transform((v) => new Intl.Locale(`und-${v}`).region ?? v.toUpperCase())
  .refine((code) => code !== 'ZZ' && regionNames.of(code) !== code, 'Use a country code.');

/**
 * A page anyone can open, stored as the browser will read it: "https:example.org" typed without
 * its slashes would otherwise become a link to a page on Waypoint itself.
 */
export const HttpsAddress = z
  .string()
  .trim()
  .max(500)
  .refine((u) => safeExternalHref(u) !== null, 'Use a full https:// address.')
  .transform((u) => safeExternalHref(u) as string);

const Source = z.object({ name: z.string().trim().min(2).max(120), url: HttpsAddress });

const Words = {
  question: z
    .string()
    .trim()
    .min(12)
    .max(240)
    .refine((q) => /[?؟]$/.test(q), 'Write it as a question that ends with a question mark.'),
  description: z.string().trim().max(1200),
  whatToDo: z.string().trim().min(12).max(800),
  resolutionCriteria: z.string().trim().min(12).max(800),
};

const Translation = z.object({
  question: Words.question,
  description: Words.description.optional(),
  whatToDo: Words.whatToDo,
  resolutionCriteria: Words.resolutionCriteria,
});

const Translations = z
  .partialRecord(z.enum(LOCALES), Translation)
  .openapi({ description: 'The same words in other languages, written by staff' });

export const ForecastInputSchema = z
  .object({
    ...Words,
    description: Words.description.default(''),
    category: z.enum(FORECAST_CATEGORIES),
    /** ISO country codes; leave empty for "everywhere". */
    regions: z.array(Region).max(30).default([]),
    sectors: z.array(z.string().trim().min(2).max(40)).max(10).default([]),
    language: z.enum(LOCALES).default('en'),
    translations: Translations.default({}),
    probability: Probability,
    baseRate: Probability.nullish(),
    /** Why this chance: the reasoning, in plain words. */
    rationale: z.string().trim().min(12).max(1200),
    /** Where the evidence is. A forecast is never published without a source. */
    sources: z.array(Source).min(1).max(8),
    /** The day it will be judged (YYYY-MM-DD, in the future). */
    resolvesOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .openapi('ForecastInput');

export const ForecastPatchSchema = z
  .object({
    description: Words.description.optional(),
    whatToDo: Words.whatToDo.optional(),
    regions: z.array(Region).max(30).optional(),
    sectors: z.array(z.string().trim().min(2).max(40)).max(10).optional(),
    sources: z.array(Source).min(1).max(8).optional(),
    translations: Translations.optional(),
    baseRate: Probability.nullish(),
  })
  .openapi('ForecastPatch');

export const ChanceInputSchema = z
  .object({ probability: Probability, rationale: z.string().trim().min(12).max(1200) })
  .openapi('ForecastChanceInput');

export const JudgeInputSchema = z
  .object({
    outcome: z.enum(['yes', 'no', 'annulled']),
    /** What happened, or why the question could not be judged. */
    note: z.string().trim().min(8).max(800),
    /** Where anyone can check it (required for yes and no). */
    sourceUrl: z
      .string()
      .trim()
      .max(500)
      .refine((u) => safeExternalHref(u) !== null, 'Use a full https:// address.')
      .optional(),
  })
  .refine((v) => v.outcome === 'annulled' || Boolean(v.sourceUrl), {
    message: 'Say where the outcome can be checked.',
    path: ['sourceUrl'],
  })
  .openapi('ForecastJudgeInput');

/** Confirming a verdict takes no words: the second person either confirms it or does not. */
export const ConfirmInputSchema = z.object({}).openapi('ForecastConfirmInput');

export const AdminForecastListSchema = z
  .object({
    items: z.array(
      ForecastSchema.extend({
        /**
         * The staff member asking is the one who recorded this verdict, so the second check
         * cannot be theirs. Nobody's name is given: who did what is in the audit log.
         */
        judgedByYou: z.boolean(),
      }),
    ),
    counts: z.record(z.enum(ADMIN_FORECAST_FILTERS), z.number().int()),
  })
  .openapi('AdminForecastList');

const TranslationOut = z.object({
  question: z.string(),
  description: z.string().optional(),
  whatToDo: z.string(),
  resolutionCriteria: z.string(),
});

/** One forecast as staff wrote it, in every language written: what the edit screen starts from. */
export const AdminForecastDetailSchema = z
  .object({
    id: z.string(),
    state: z.enum(FORECAST_STATES),
    language: z.enum(LOCALES),
    category: z.string(),
    question: z.string(),
    description: z.string(),
    whatToDo: z.string(),
    resolutionCriteria: z.string(),
    regions: z.array(z.string()),
    sectors: z.array(z.string()),
    sources: z.array(SourceSchema),
    baseRate: z.number().nullable(),
    translations: z.record(z.string(), TranslationOut),
    resolvesAt: z.string(),
  })
  .openapi('AdminForecastDetail');

export type AdminForecastDetail = z.infer<typeof AdminForecastDetailSchema>;

async function forecastRow(db: Database, id: string): Promise<Row> {
  const [row] = await db.select().from(forecasts).where(eq(forecasts.id, id)).limit(1);
  if (!row || row.isDemo) throw notFound('Forecast');
  return row;
}

/** Who recorded each of these verdicts (the staff member's id), where the audit log says. */
async function judgesOf(db: Database, ids: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  if (!ids.length) return out;
  const rows = await db
    .select({ id: auditLog.targetId, by: auditLog.actorUserId })
    .from(auditLog)
    .where(and(inArray(auditLog.action, VERDICT_ACTIONS), inArray(auditLog.targetId, ids)))
    .orderBy(asc(auditLog.createdAt));
  for (const r of rows) if (r.id) out.set(r.id, r.by);
  return out;
}

/**
 * Staff list: everything in one state — or every verdict still waiting for its second check —
 * in the staff member's language where written.
 */
export async function adminForecasts(
  db: Database,
  filter: AdminForecastFilter = 'open',
  opts: { locale?: string; now?: Date /** The staff member looking. */; viewerId?: string } = {},
): Promise<z.infer<typeof AdminForecastListSchema>> {
  const now = opts.now ?? new Date();
  const rows = await db
    .select()
    .from(forecasts)
    .where(realOnly)
    .orderBy(desc(forecasts.createdAt))
    .limit(1000);
  const judged = rows.filter((r) => JUDGED.includes(r.status));
  const checked = await confirmedAmong(
    db,
    judged.map((r) => r.id),
  );
  const counts = { open: 0, awaiting: 0, unchecked: 0, resolved: 0, annulled: 0 };
  for (const r of rows) counts[stateOf(r, now)] += 1;
  counts.unchecked = judged.filter((r) => !checked.has(r.id)).length;
  const wanted = (
    filter === 'unchecked'
      ? judged.filter((r) => !checked.has(r.id))
      : rows.filter((r) => stateOf(r, now) === filter)
  ).slice(0, 200);
  const [chances, judges] = await Promise.all([
    chancesFor(
      db,
      wanted.map((r) => r.id),
    ),
    judgesOf(
      db,
      wanted.filter((r) => JUDGED.includes(r.status)).map((r) => r.id),
    ),
  ]);
  return {
    items: wanted
      .map((r) => {
        const v = view(r, chances.get(r.id) ?? [], opts.locale ?? 'en', [], now, checked);
        return v
          ? { ...v, judgedByYou: Boolean(opts.viewerId) && judges.get(r.id) === opts.viewerId }
          : null;
      })
      .filter((v): v is ForecastView & { judgedByYou: boolean } => v !== null),
    counts,
  };
}

/** One forecast with everything staff may still change, in every language it was written in. */
export async function adminForecast(
  db: Database,
  id: string,
  now = new Date(),
): Promise<AdminForecastDetail> {
  const row = await forecastRow(db, id);
  return {
    id: row.id,
    state: stateOf(row, now),
    language: isLocale(row.language) ? row.language : 'en',
    category: row.category,
    question: row.question,
    description: row.description,
    whatToDo: row.whatToDo,
    resolutionCriteria: row.resolutionCriteria,
    regions: row.regions,
    sectors: row.sectors,
    sources: row.sources,
    baseRate: row.baseRate ?? null,
    translations: row.translations ?? {},
    resolvesAt: row.resolvesAt.toISOString(),
  };
}

/** How many forecasts are past their date and waiting for staff to judge them. */
export async function forecastsToJudge(db: Database): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(forecasts)
    .where(and(realOnly, eq(forecasts.status, 'open'), sql`${forecasts.resolvesAt} <= now()`));
  return Number(row?.n ?? 0);
}

/**
 * How many verdicts this staff member could confirm: judged, not yet confirmed, and recorded
 * by someone else. With a single staff account this is always nought, so the console never
 * asks that person for a check they cannot give.
 */
export async function verdictsToCheck(db: Database, viewerId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(forecasts)
    .where(
      and(
        realOnly,
        inArray(forecasts.status, JUDGED),
        notConfirmed,
        sql`coalesce((
          select a.actor_user_id from audit_log a
          where a.target_id = ${forecasts.id}::text
            and a.action in ('forecast.resolved', 'forecast.annulled')
          order by a.created_at desc limit 1), '') <> ${viewerId}`,
      ),
    );
  return Number(row?.n ?? 0);
}

export async function publishForecast(
  db: Database,
  actor: Actor,
  input: z.infer<typeof ForecastInputSchema>,
  now = new Date(),
): Promise<{ id: string }> {
  const resolvesAt = new Date(`${input.resolvesOn}T00:00:00Z`);
  // 30 February is not a day: refuse it rather than let it become 2 March.
  if (
    Number.isNaN(resolvesAt.getTime()) ||
    resolvesAt.toISOString().slice(0, 10) !== input.resolvesOn
  )
    throw new ApiError(422, 'date-invalid', 'That day does not exist.');
  if (resolvesAt.getTime() < now.getTime() + DAY)
    throw new ApiError(422, 'date-past', 'Choose a day at least one day ahead.');
  if (resolvesAt.getTime() > now.getTime() + 3 * 366 * DAY)
    throw new ApiError(422, 'date-far', 'Choose a day within the next three years.');
  if (input.translations[input.language])
    throw new ApiError(
      422,
      'translation-same',
      'A translation must be in a different language from the forecast itself.',
    );
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(forecasts)
      .values({
        question: input.question,
        description: input.description,
        resolutionCriteria: input.resolutionCriteria,
        whatToDo: input.whatToDo,
        sources: input.sources as ForecastSource[],
        language: input.language,
        translations: input.translations as Record<string, ForecastTranslation>,
        baseRate: input.baseRate ?? null,
        category: input.category,
        regions: [...new Set(input.regions)],
        sectors: [...new Set(input.sectors)],
        createdBy: 'editor',
        opensAt: now,
        closesAt: resolvesAt,
        resolvesAt,
        status: 'open',
      })
      .returning({ id: forecasts.id });
    if (!row) throw new Error('Could not publish the forecast');
    await tx.insert(forecastPredictions).values({
      forecastId: row.id,
      predictor: PREDICTOR,
      probability: input.probability,
      rationale: input.rationale,
      createdAt: now,
    });
    await audit(tx, actor, {
      action: 'forecast.published',
      targetType: 'forecast',
      targetId: row.id,
      meta: { category: input.category, probability: input.probability },
    });
    return { id: row.id };
  });
}

/**
 * Change what may change after publishing, and only while the forecast is still ahead: the
 * explanation, the advice, the sources, where it applies, and translations. The question, how
 * it is judged and the date are fixed once published — in the original and in every
 * translation, once that translation exists — otherwise the record would mean nothing. A wrong
 * question is withdrawn (annulled) and published again. After its date nothing changes any
 * more: by then the answer may be known.
 */
export async function editForecast(
  db: Database,
  actor: Actor,
  id: string,
  patch: z.infer<typeof ForecastPatchSchema>,
  now = new Date(),
): Promise<void> {
  const row = await forecastRow(db, id);
  if (stateOf(row, now) !== 'open')
    throw new ApiError(
      409,
      row.status === 'open' ? 'closed' : 'judged',
      'A forecast can only be changed before its date. After that it waits to be judged, and a judged forecast is never changed.',
    );
  const set: Partial<typeof forecasts.$inferInsert> = {};
  const meta: { fields: string[]; languagesAdded?: string[] } = { fields: [] };
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.whatToDo !== undefined) set.whatToDo = patch.whatToDo;
  if (patch.regions !== undefined) set.regions = [...new Set(patch.regions)];
  if (patch.sectors !== undefined) set.sectors = [...new Set(patch.sectors)];
  if (patch.sources !== undefined) set.sources = patch.sources as ForecastSource[];
  if (patch.translations !== undefined) {
    if (patch.translations[row.language as Locale])
      throw new ApiError(
        422,
        'translation-same',
        'A translation must be in a different language from the forecast itself.',
      );
    const next = patch.translations as Record<string, ForecastTranslation>;
    for (const [language, was] of Object.entries(row.translations ?? {})) {
      const now_ = next[language];
      if (
        !now_ ||
        now_.question !== was.question ||
        now_.resolutionCriteria !== was.resolutionCriteria
      )
        throw new ApiError(
          422,
          'translation-fixed',
          'A translation’s question and how it is judged cannot change or be removed once saved, like the original’s. Its explanation and advice can.',
        );
    }
    set.translations = next;
    const added = Object.keys(next).filter((l) => !row.translations?.[l]);
    if (added.length) meta.languagesAdded = added;
  }
  if (patch.baseRate !== undefined) set.baseRate = patch.baseRate;
  meta.fields = Object.keys(set);
  if (!meta.fields.length) return;
  await db.transaction(async (tx) => {
    // Still open and still before its date at the moment of writing (a judgement, or the
    // date itself, may have arrived since the check above).
    const done = await tx
      .update(forecasts)
      .set(set)
      .where(
        and(
          eq(forecasts.id, id),
          eq(forecasts.status, 'open'),
          sql`${forecasts.resolvesAt} > ${now.toISOString()}`,
        ),
      )
      .returning({ id: forecasts.id });
    if (!done.length) throw new ApiError(409, 'closed', 'This forecast can no longer be changed.');
    await audit(tx, actor, {
      action: 'forecast.edited',
      targetType: 'forecast',
      targetId: id,
      meta,
    });
  });
}

/** Publish a new chance for an open forecast. Every chance it ever showed is kept and scored. */
export async function updateChance(
  db: Database,
  actor: Actor,
  id: string,
  input: z.infer<typeof ChanceInputSchema>,
  now = new Date(),
): Promise<void> {
  const row = await forecastRow(db, id);
  if (stateOf(row, now) !== 'open')
    throw new ApiError(
      409,
      'closed',
      'The chance can only change while the forecast is open. After its date it waits to be judged.',
    );
  await db.transaction(async (tx) => {
    await tx.insert(forecastPredictions).values({
      forecastId: id,
      predictor: PREDICTOR,
      probability: input.probability,
      rationale: input.rationale,
      createdAt: now,
    });
    await audit(tx, actor, {
      action: 'forecast.chance-updated',
      targetType: 'forecast',
      targetId: id,
      meta: { probability: input.probability },
    });
  });
}

/**
 * Judge a forecast: it happened, it did not, or it cannot be judged (annulled — left out of
 * the score, but still listed with the reason). Done once; the record is not rewritten.
 */
export async function judgeForecast(
  db: Database,
  actor: Actor,
  id: string,
  input: z.infer<typeof JudgeInputSchema>,
  now = new Date(),
): Promise<void> {
  await forecastRow(db, id);
  const annulled = input.outcome === 'annulled';
  await db.transaction(async (tx) => {
    // Only a forecast that is still open is judged, once (two staff pressing at once).
    const done = await tx
      .update(forecasts)
      .set({
        status: annulled ? 'annulled' : 'resolved',
        outcome: annulled ? null : input.outcome === 'yes' ? 1 : 0,
        resolvedAt: now,
        resolutionNote: input.note,
        resolutionSourceUrl: input.sourceUrl ?? null,
      })
      .where(and(eq(forecasts.id, id), eq(forecasts.status, 'open')))
      .returning({ id: forecasts.id });
    if (!done.length) throw new ApiError(409, 'judged', 'This forecast has already been judged.');
    await audit(tx, actor, {
      action: annulled ? 'forecast.annulled' : 'forecast.resolved',
      targetType: 'forecast',
      targetId: id,
      meta: annulled ? {} : { outcome: input.outcome },
    });
  });
}

/**
 * The second check: a member of staff other than the one who recorded a verdict confirms it.
 *
 * A verdict stands from the moment it is recorded — it is public, and it is scored — because
 * an installation with one member of staff must still be able to keep a record. Until someone
 * else confirms it, it is marked "not yet double-checked" wherever it is shown. Confirming
 * changes nothing about the verdict: the record is never rewritten. A second person who
 * disagrees does not confirm, and the mark stays for everyone to see.
 */
export async function confirmVerdict(db: Database, actor: Actor, id: string): Promise<void> {
  await forecastRow(db, id);
  await db.transaction(async (tx) => {
    // One at a time (two staff pressing at once), and only once there is a verdict.
    const [row] = await tx
      .select({ status: forecasts.status, outcome: forecasts.outcome })
      .from(forecasts)
      .where(eq(forecasts.id, id))
      .for('update');
    if (!row || !JUDGED.includes(row.status))
      throw new ApiError(409, 'not-judged', 'There is no outcome to confirm yet.');
    const entries = await tx
      .select({ action: auditLog.action, by: auditLog.actorUserId })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.targetId, id),
          inArray(auditLog.action, [...VERDICT_ACTIONS, CONFIRMED_ACTION]),
        ),
      )
      .orderBy(asc(auditLog.createdAt));
    if (entries.some((e) => e.action === CONFIRMED_ACTION))
      throw new ApiError(409, 'checked', 'A second person has already confirmed this outcome.');
    const judge = entries.filter((e) => VERDICT_ACTIONS.includes(e.action)).at(-1)?.by ?? null;
    if (judge === actor.userId)
      throw new ApiError(
        403,
        'same-person',
        'The second check has to come from a different member of staff than the one who recorded the outcome.',
      );
    await audit(tx, actor, {
      action: CONFIRMED_ACTION,
      targetType: 'forecast',
      targetId: id,
      meta:
        row.status === 'annulled'
          ? { outcome: 'annulled' }
          : { outcome: row.outcome === 1 ? 'yes' : 'no' },
    });
  });
}
