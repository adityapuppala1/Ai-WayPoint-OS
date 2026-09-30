import { describe, expect, it } from 'vitest';
import { addDays, localDate, moodSummary, weekStartOf } from '../src/mind';

const at = (iso: string) => new Date(iso);

describe('mind', () => {
  it('uses the person’s own calendar day', () => {
    // 23:30 UTC on the 1st is already the 2nd in Kolkata.
    expect(localDate(at('2026-09-01T23:30:00Z'), 'Asia/Kolkata')).toBe('2026-09-02');
    expect(localDate(at('2026-09-01T23:30:00Z'), 'UTC')).toBe('2026-09-01');
    expect(localDate(at('2026-09-01T23:30:00Z'), 'Not/AZone')).toBe('2026-09-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('starts weeks on Monday', () => {
    expect(weekStartOf(at('2026-09-29T10:00:00Z'))).toBe('2026-09-28'); // Tuesday
    expect(weekStartOf(at('2026-09-28T10:00:00Z'))).toBe('2026-09-28'); // Monday
    expect(weekStartOf(at('2026-10-04T10:00:00Z'))).toBe('2026-09-28'); // Sunday
  });

  it('summarises the last two weeks and keeps the latest check-in of each day', () => {
    const now = at('2026-09-29T12:00:00Z');
    const s = moodSummary(
      [
        { mood: 2, at: at('2026-09-29T08:00:00Z') },
        { mood: 4, at: at('2026-09-29T11:00:00Z') }, // later the same day wins
        { mood: 3, at: at('2026-09-27T09:00:00Z') },
        { mood: 5, at: at('2026-09-10T09:00:00Z') }, // outside the window
      ],
      now,
    );
    expect(s.days).toHaveLength(14);
    expect(s.days.at(-1)).toEqual({ date: '2026-09-29', mood: 4 });
    expect(s.days[0]?.date).toBe('2026-09-16');
    expect(s.average7).toBe(3.5);
    expect(s.suggestSupport).toBe(false);
  });

  it('gently offers support after several low days', () => {
    const now = at('2026-09-29T12:00:00Z');
    const low = ['2026-09-27', '2026-09-28', '2026-09-29'].map((d) => ({
      mood: 1,
      at: at(`${d}T09:00:00Z`),
    }));
    const s = moodSummary(low, now);
    expect(s.lowStreak).toBe(3);
    expect(s.lowDays7).toBe(3);
    expect(s.suggestSupport).toBe(true);
    // A good day breaks the streak, but three low days this week still count.
    const mixed = moodSummary([...low, { mood: 4, at: at('2026-09-29T20:00:00Z') }], now);
    expect(mixed.lowStreak).toBe(0);
    expect(mixed.lowDays7).toBe(2);
    expect(mixed.suggestSupport).toBe(false);
  });
});
