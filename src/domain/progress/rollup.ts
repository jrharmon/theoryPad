import { dayKey } from './days';
import { addCounts } from './frets';
import type { LoggedRep, PracticeDay } from './types';

export function repSeconds(rep: LoggedRep): number {
  if (rep.endedAt === null) return 0;
  return Math.max(0, (rep.endedAt - rep.startedAt) / 1000);
}

/** `"Bb dorian"`, when the pass had a key and a mode. */
export function keyModeOf(axes: Record<string, string>): string | null {
  return axes.key && axes.mode ? `${axes.key} ${axes.mode}` : null;
}

export function emptyDay(date: string): PracticeDay {
  return { date, seconds: 0, passes: 0, keyModes: {}, frets: {} };
}

/**
 * Fold one rep into its day. Pure — returns a new day. Unfinished passes are
 * time spent but add no coverage, the same rule the exercise stats follow.
 */
export function applyRepToDay(day: PracticeDay, rep: LoggedRep): PracticeDay {
  const next: PracticeDay = {
    date: day.date,
    seconds: day.seconds + repSeconds(rep),
    passes: day.passes,
    keyModes: { ...day.keyModes },
    frets: { ...day.frets },
  };
  if (rep.status !== 'completed') return next;

  next.passes += 1;
  const keyMode = keyModeOf(rep.axes);
  if (keyMode) next.keyModes[keyMode] = (next.keyModes[keyMode] ?? 0) + 1;
  if (rep.frets) {
    const counts = { ...(day.frets[rep.frets.strings] ?? {}) };
    addCounts(counts, rep.frets.counts);
    next.frets[rep.frets.strings] = counts;
  }
  return next;
}

/** Every day, recomputed from the log alone. Sorted by date. */
export function rollupDays(reps: readonly LoggedRep[]): PracticeDay[] {
  const byDay = new Map<string, PracticeDay>();
  for (const rep of reps) {
    const date = dayKey(rep.startedAt);
    byDay.set(date, applyRepToDay(byDay.get(date) ?? emptyDay(date), rep));
  }
  return [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}
