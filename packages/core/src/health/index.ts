/**
 * Health: everyday routines and reminders, never diagnosis. Pure helpers shared by the API,
 * the web app and (later) mobile: what people can log, and when a reminder is next due in
 * their own time zone.
 */
import { addDays, localDate } from '../mind';

/** What people can log for a day. The UI translates the ids. */
export const HEALTH_METRICS = ['sleep', 'activity', 'water'] as const;
export type HealthMetric = (typeof HEALTH_METRICS)[number];

/** Sensible bounds and steps, so a slip of the thumb can't record 90 hours of sleep. */
export const METRIC_BOUNDS: Record<HealthMetric, { min: number; max: number; step: number }> = {
  /** hours */
  sleep: { min: 0, max: 16, step: 0.5 },
  /** minutes of movement that raised the heart rate a little or more */
  activity: { min: 0, max: 600, step: 5 },
  /** glasses of water */
  water: { min: 0, max: 30, step: 1 },
};

export function clampMetric(metric: HealthMetric, value: number): number {
  const b = METRIC_BOUNDS[metric];
  const stepped = Math.round(value / b.step) * b.step;
  return Math.min(b.max, Math.max(b.min, Number(stepped.toFixed(2))));
}

export interface DayLog {
  date: string;
  sleep: number | null;
  activity: number | null;
  water: number | null;
}

export interface HealthWeek {
  /** The last 7 days, oldest first (today last). */
  days: DayLog[];
  /** Minutes of activity over the 7 days (WHO suggests 150–300 a week for adults). */
  activityTotal: number;
  /** Average sleep over the days that have a value. */
  sleepAverage: number | null;
  /** Days with anything logged. */
  loggedDays: number;
}

export function healthWeek(
  logs: Array<{ kind: string; value: number | null; date: string }>,
  today: string,
): HealthWeek {
  const days: DayLog[] = Array.from({ length: 7 }, (_, i) => ({
    date: addDays(today, i - 6),
    sleep: null,
    activity: null,
    water: null,
  }));
  const byDate = new Map(days.map((d) => [d.date, d]));
  for (const l of logs) {
    const day = byDate.get(l.date);
    if (!day || l.value === null || !(HEALTH_METRICS as readonly string[]).includes(l.kind))
      continue;
    day[l.kind as HealthMetric] = l.value;
  }
  const sleeps = days.map((d) => d.sleep).filter((v): v is number => v !== null);
  return {
    days,
    activityTotal: days.reduce((sum, d) => sum + (d.activity ?? 0), 0),
    sleepAverage: sleeps.length
      ? Math.round((sleeps.reduce((a, b) => a + b, 0) / sleeps.length) * 10) / 10
      : null,
    loggedDays: days.filter((d) => d.sleep !== null || d.activity !== null || d.water !== null)
      .length,
  };
}

// ───────────────────────────── Reminders ─────────────────────────────

export const REMINDER_REPEATS = [
  'once',
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'half-yearly',
  'yearly',
] as const;
export type ReminderRepeat = (typeof REMINDER_REPEATS)[number];

/** Suggestions people can start from. Titles only — Waypoint never says how often to test. */
export const REMINDER_IDEAS = [
  'medicine',
  'refill',
  'blood-pressure',
  'dental',
  'eyes',
  'vaccination',
  'screening',
] as const;
export type ReminderIdea = (typeof REMINDER_IDEAS)[number];

export interface ReminderSchedule {
  repeat: ReminderRepeat;
  /** First (or only) day, YYYY-MM-DD, in the person's time zone. */
  date: string;
  /** Time of day, HH:MM (24-hour), in the person's time zone. */
  time: string;
}

const MONTHS: Partial<Record<ReminderRepeat, number>> = {
  monthly: 1,
  quarterly: 3,
  'half-yearly': 6,
  yearly: 12,
};

/** Store schedules as a small RRULE-style string, e.g. `DTSTART=20261001T0900;REPEAT=monthly`. */
export function formatSchedule(s: ReminderSchedule): string {
  return `DTSTART=${s.date.replaceAll('-', '')}T${s.time.replace(':', '')};REPEAT=${s.repeat}`;
}

export function parseSchedule(rule: string): ReminderSchedule | null {
  const m = /^DTSTART=(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2});REPEAT=([a-z-]+)$/.exec(rule);
  if (!m) return null;
  const repeat = m[6] as ReminderRepeat;
  if (!(REMINDER_REPEATS as readonly string[]).includes(repeat)) return null;
  return { repeat, date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` };
}

/** Minutes the zone is ahead of UTC at a given instant (e.g. +330 for India). */
function offsetMinutes(at: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(at);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
    return Math.round((asUtc - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
  } catch {
    return 0;
  }
}

/**
 * The instant a wall-clock time happens in a zone. A time that doesn't exist on the day clocks
 * go forward lands an hour away; everything else is exact.
 */
export function zonedTime(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [h, min] = time.split(':').map(Number) as [number, number];
  const wall = Date.UTC(y, m - 1, d, h, min);
  let guess = wall - offsetMinutes(new Date(wall), timeZone) * 60_000;
  // A second pass settles instants near a daylight-saving change.
  guess = wall - offsetMinutes(new Date(guess), timeZone) * 60_000;
  return new Date(guess);
}

/** Add calendar months, keeping the day where it exists (31 Jan + 1 month → 28/29 Feb). */
function addMonths(date: string, months: number, anchorDay: number): string {
  const [y, m] = date.split('-').map(Number) as [number, number];
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const day = Math.min(anchorDay, last);
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * When a reminder is next due, strictly after `after`. `null` once a one-off reminder has
 * passed. Occurrences follow the person's wall clock, so 9:00 stays 9:00 across time changes.
 */
export function nextOccurrence(
  schedule: ReminderSchedule,
  after: Date,
  timeZone = 'UTC',
): Date | null {
  const first = zonedTime(schedule.date, schedule.time, timeZone);
  if (first > after) return first;
  if (schedule.repeat === 'once') return null;

  const anchorDay = Number(schedule.date.slice(8, 10));
  const months = MONTHS[schedule.repeat];
  if (months) {
    // Jump close to `after`, then step forward.
    const [ay, am] = localDate(after, timeZone).split('-').map(Number) as [number, number];
    const [sy, sm] = schedule.date.split('-').map(Number) as [number, number];
    const elapsed = (ay - sy) * 12 + (am - sm);
    let n = Math.max(0, Math.floor(elapsed / months) - 1);
    for (let guard = 0; guard < 400; guard++, n++) {
      const date = addMonths(schedule.date, n * months, anchorDay);
      const at = zonedTime(date, schedule.time, timeZone);
      if (at > after) return at;
    }
    return null;
  }

  const stepDays = schedule.repeat === 'weekly' ? 7 : 1;
  const [ty, tm, td] = localDate(after, timeZone).split('-').map(Number) as [
    number,
    number,
    number,
  ];
  const [sy, sm, sd] = schedule.date.split('-').map(Number) as [number, number, number];
  const since = Math.floor((Date.UTC(ty, tm - 1, td) - Date.UTC(sy, sm - 1, sd)) / 86_400_000);
  let n = Math.max(0, Math.floor(since / stepDays) - 1);
  for (let guard = 0; guard < 10; guard++, n++) {
    const at = zonedTime(addDays(schedule.date, n * stepDays), schedule.time, timeZone);
    if (at > after) return at;
  }
  return null;
}
