import { addDays, daysBetween, weekStart } from './days';
import type { DayKey, PracticeDay } from './types';

export type Intensity = 0 | 1 | 2 | 3;

/** None, under 15 minutes, 15–29, 30 or more. */
export function intensity(seconds: number): Intensity {
  if (seconds <= 0) return 0;
  if (seconds < 15 * 60) return 1;
  if (seconds < 30 * 60) return 2;
  return 3;
}

export interface HeatmapCell {
  date: DayKey;
  seconds: number;
  intensity: Intensity;
  /** Later this week than today: drawn empty, not as a missed day. */
  future: boolean;
}

function byDate(days: readonly PracticeDay[]): Map<DayKey, PracticeDay> {
  return new Map(days.map((day) => [day.date, day]));
}

/**
 * Whole weeks, Monday to Sunday, ending with the current one — so the grid's
 * last column is this week and every row is a weekday. Oldest first.
 */
export function practiceHeatmap(
  days: readonly PracticeDay[],
  today: DayKey,
  weeks = 4,
): HeatmapCell[] {
  const found = byDate(days);
  const from = addDays(weekStart(today), -7 * (weeks - 1));
  return daysBetween(from, addDays(weekStart(today), 6)).map((date) => {
    const seconds = found.get(date)?.seconds ?? 0;
    return { date, seconds, intensity: intensity(seconds), future: date > today };
  });
}

/** Seconds per day across a range, zeros included, oldest first. */
export function timeByDay(
  days: readonly PracticeDay[],
  from: DayKey,
  to: DayKey,
): { date: DayKey; seconds: number }[] {
  const found = byDate(days);
  return daysBetween(from, to).map((date) => ({
    date,
    seconds: found.get(date)?.seconds ?? 0,
  }));
}

export function secondsBetween(days: readonly PracticeDay[], from: DayKey, to: DayKey): number {
  return days
    .filter((day) => day.date >= from && day.date <= to)
    .reduce((sum, day) => sum + day.seconds, 0);
}

/**
 * Consecutive days with a finished pass or set. Today not practiced yet does
 * not break the streak — it is still yesterday's until tomorrow.
 */
export function streak(
  days: readonly PracticeDay[],
  today: DayKey,
): { current: number; longest: number } {
  const practiced = new Set(days.filter((d) => d.passes > 0).map((d) => d.date));

  let current = 0;
  let day = practiced.has(today) ? today : addDays(today, -1);
  while (practiced.has(day)) {
    current += 1;
    day = addDays(day, -1);
  }

  let longest = 0;
  let run = 0;
  let previous: DayKey | null = null;
  for (const date of [...practiced].sort()) {
    run = previous !== null && addDays(previous, 1) === date ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }

  return { current, longest };
}
