/**
 * Mind: calm, private reflection. Pure helpers for mood trends and dates in the person's own
 * time zone. Nothing here diagnoses; the only judgement it makes is when to gently point to
 * people who can help, and that errs on the side of offering.
 */

/** Tags people can add to a check-in. Stable ids; the UI translates them. */
export const MOOD_TAGS = [
  'sleep',
  'work',
  'money',
  'family',
  'friends',
  'health',
  'lonely',
  'study',
  'home',
  'news',
] as const;
export type MoodTag = (typeof MOOD_TAGS)[number];

/** Journal prompts. Stable ids; the UI translates them. `free` means no prompt. */
export const JOURNAL_PROMPTS = [
  'free',
  'went-well',
  'on-my-mind',
  'grateful',
  'kind-to-self',
  'next-step',
  'proud',
] as const;
export type JournalPrompt = (typeof JOURNAL_PROMPTS)[number];

/** A calendar date (YYYY-MM-DD) as the person sees it in their time zone. */
export function localDate(at: Date, timeZone = 'UTC'): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

/** Add days to a YYYY-MM-DD date (calendar arithmetic, no time zones involved). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The Monday that starts the week containing `at`, in the person's time zone. */
export function weekStartOf(at: Date, timeZone = 'UTC'): string {
  const today = localDate(at, timeZone);
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(today, -((dow + 6) % 7));
}

export interface MoodPoint {
  /** 1 (very low) … 5 (very good) */
  mood: number;
  at: Date;
}

export interface MoodSummary {
  /** The last 14 days, oldest first; the latest check-in of each day, or null. */
  days: Array<{ date: string; mood: number | null }>;
  /** Average of the days with a check-in in the last 7 days. */
  average7: number | null;
  /** Days in the last 7 whose check-in was low (1–2). */
  lowDays7: number;
  /** How many of the most recent check-in days in a row were low. */
  lowStreak: number;
  /** Offer people to talk to: several low days this week, or three low days running. */
  suggestSupport: boolean;
}

const LOW = 2;

export function moodSummary(points: MoodPoint[], now: Date, timeZone = 'UTC'): MoodSummary {
  const today = localDate(now, timeZone);
  const latest = new Map<string, { mood: number; at: number }>();
  for (const p of points) {
    if (!Number.isFinite(p.mood)) continue;
    const date = localDate(p.at, timeZone);
    const prev = latest.get(date);
    if (!prev || p.at.getTime() > prev.at) latest.set(date, { mood: p.mood, at: p.at.getTime() });
  }
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(today, i - 13);
    return { date, mood: latest.get(date)?.mood ?? null };
  });
  const week = days.slice(-7).filter((d): d is { date: string; mood: number } => d.mood !== null);
  const average7 = week.length
    ? Math.round((week.reduce((s, d) => s + d.mood, 0) / week.length) * 10) / 10
    : null;
  const lowDays7 = week.filter((d) => d.mood <= LOW).length;
  let lowStreak = 0;
  for (const d of [...days].reverse()) {
    if (d.mood === null) continue;
    if (d.mood <= LOW) lowStreak += 1;
    else break;
  }
  return {
    days,
    average7,
    lowDays7,
    lowStreak,
    suggestSupport: lowDays7 >= 3 || lowStreak >= 3,
  };
}
