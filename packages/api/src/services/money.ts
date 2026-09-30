/**
 * Money: how long savings last, how stretched the month is, and the next sensible step.
 * The numbers are the person's own and are stored encrypted with their data key; the maths is
 * deterministic (@waypoint/core/money) — no AI, no product sales, no credit scores.
 */
import { z } from '@hono/zod-openapi';
import {
  conservativeIncome,
  MONEY_SUGGESTIONS,
  type MoneySuggestionId,
  runway,
  toMonthly,
} from '@waypoint/core';
import { openFor, SEALED, sealFor } from '@waypoint/core/privacy';
import { type Database, eq, moneySnapshots } from '@waypoint/db';
import { userDek } from './me';

export const ESSENTIALS = [
  'housing',
  'food',
  'utilities',
  'transport',
  'health',
  'phone',
  'childcare',
  'other',
] as const;
export type EssentialKey = (typeof ESSENTIALS)[number];

export const INCOME_PERIODS = ['week', 'fortnight', 'month'] as const;
export const INCOME_MODES = ['regular', 'irregular', 'none'] as const;
export const MONEY_STRESS = ['stable', 'watch', 'tight', 'critical'] as const;

const Amount = z.number().min(0).max(1e12);

export const MoneyInputSchema = z
  .object({
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .openapi({ example: 'INR' }),
    income: z.object({
      mode: z.enum(INCOME_MODES),
      /** Regular income: the amount per `period`. */
      amount: Amount.optional(),
      period: z.enum(INCOME_PERIODS).optional(),
      /** Irregular income: what came in over recent months (up to 6). */
      months: z.array(Amount).max(6).optional(),
    }),
    /** Monthly essentials by kind; leave out what doesn't apply. */
    essentials: z.partialRecord(z.enum(ESSENTIALS), Amount),
    /** Monthly non-essential spending. */
    other: Amount,
    /** Monthly debt repayments (loans, cards, buy-now-pay-later). */
    debt: Amount,
    /** Savings you could use if you had to. */
    savings: Amount,
  })
  .openapi('MoneyInput');

export type MoneyInput = z.infer<typeof MoneyInputSchema>;

export const MoneyResultSchema = z
  .object({
    monthlyIncome: z.number(),
    essentialsMonthly: z.number(),
    outgoingsMonthly: z.number(),
    monthsOfRunway: z.number().nullable(),
    monthlyGap: z.number(),
    essentialsCoverMonths: z.number().nullable(),
    debtToIncome: z.number().nullable(),
    stress: z.enum(MONEY_STRESS),
    /** Suggestion ids in order; the English text is included as a fallback for any client. */
    suggestions: z.array(z.object({ id: z.string(), title: z.string(), detail: z.string() })),
  })
  .openapi('MoneyResult');

export const MoneyViewSchema = z
  .object({
    input: MoneyInputSchema.nullable(),
    result: MoneyResultSchema.nullable(),
    updatedAt: z.string().nullable(),
  })
  .openapi('Money');

export type MoneyResult = z.infer<typeof MoneyResultSchema>;
export type MoneyView = z.infer<typeof MoneyViewSchema>;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Income per month as Waypoint plans with it: cautious for irregular earners. */
export function monthlyIncomeOf(input: MoneyInput): number {
  const { income } = input;
  if (income.mode === 'regular') return toMonthly(income.amount ?? 0, income.period ?? 'month');
  if (income.mode === 'irregular') return conservativeIncome(income.months ?? []) ?? 0;
  return 0;
}

export function computeMoney(input: MoneyInput): MoneyResult {
  const monthlyIncome = monthlyIncomeOf(input);
  const essentialsMonthly = round2(
    ESSENTIALS.reduce((sum, k) => sum + (input.essentials[k] ?? 0), 0),
  );
  const r = runway({
    currency: input.currency,
    monthlyIncome,
    essentialExpenses: essentialsMonthly,
    otherExpenses: input.other,
    debtMonthly: input.debt,
    savings: input.savings,
  });
  return {
    monthlyIncome,
    essentialsMonthly,
    outgoingsMonthly: round2(essentialsMonthly + input.other + input.debt),
    monthsOfRunway: r.monthsOfRunway,
    monthlyGap: r.monthlyGap,
    essentialsCoverMonths: r.essentialsCoverMonths,
    debtToIncome: r.debtToIncome,
    stress: r.stress,
    suggestions: r.suggestions.map((s) => ({
      id: s.id,
      title: MONEY_SUGGESTIONS[s.id as MoneySuggestionId]?.title ?? s.title,
      detail: MONEY_SUGGESTIONS[s.id as MoneySuggestionId]?.detail ?? s.detail,
    })),
  };
}

/** The saved numbers, decrypted — or null if the person hasn't added any. */
export async function getMoneyInput(
  db: Database,
  userId: string,
): Promise<{ input: MoneyInput; updatedAt: Date } | null> {
  const [row] = await db.select().from(moneySnapshots).where(eq(moneySnapshots.userId, userId));
  if (!row) return null;
  const dek = await userDek(db, userId);
  const parsed = MoneyInputSchema.safeParse(
    JSON.parse(openFor(dek, row.dataCt, SEALED.money, userId)),
  );
  return parsed.success ? { input: parsed.data, updatedAt: row.updatedAt } : null;
}

export async function getMoney(db: Database, userId: string): Promise<MoneyView> {
  const saved = await getMoneyInput(db, userId);
  if (!saved) return { input: null, result: null, updatedAt: null };
  return {
    input: saved.input,
    result: computeMoney(saved.input),
    updatedAt: saved.updatedAt.toISOString(),
  };
}

export async function saveMoney(
  db: Database,
  userId: string,
  input: MoneyInput,
): Promise<MoneyView> {
  const dek = await userDek(db, userId);
  const dataCt = sealFor(dek, JSON.stringify(input), SEALED.money, userId);
  const now = new Date();
  await db
    .insert(moneySnapshots)
    .values({ userId, currency: input.currency, dataCt })
    .onConflictDoUpdate({
      target: moneySnapshots.userId,
      set: { currency: input.currency, dataCt, updatedAt: now },
    });
  return { input, result: computeMoney(input), updatedAt: now.toISOString() };
}

export async function clearMoney(db: Database, userId: string): Promise<void> {
  await db.delete(moneySnapshots).where(eq(moneySnapshots.userId, userId));
}

/** A one-line summary for Today: only the level and runway, never amounts. */
export async function moneySummary(
  db: Database,
  userId: string,
): Promise<{ stress: MoneyResult['stress']; monthsOfRunway: number | null } | null> {
  const saved = await getMoneyInput(db, userId).catch(() => null);
  if (!saved) return null;
  const r = computeMoney(saved.input);
  return { stress: r.stress, monthsOfRunway: r.monthsOfRunway };
}
