import type { KeyMode, ModeName, PitchClass } from '@/domain/music';
import { MODE_NAMES, chroma, pitchClass } from '@/domain/music';
import { keyModeOf } from './rollup';
import type { LoggedRep, PracticeDay } from './types';

/** Finished passes per `"Bb dorian"` over some days. */
export function keyModeCounts(days: readonly PracticeDay[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const day of days) {
    for (const [keyMode, n] of Object.entries(day.keyModes))
      out[keyMode] = (out[keyMode] ?? 0) + n;
  }
  return out;
}

/**
 * Counts as a grid: a row per mode, a column per pitch (C = 0). Keyed by pitch
 * rather than spelling, so A# dorian and Bb dorian are the same cell.
 */
export function keyModeGrid(counts: Record<string, number>): Record<ModeName, number[]> {
  const grid = Object.fromEntries(
    MODE_NAMES.map((m) => [m, Array<number>(12).fill(0)]),
  ) as Record<ModeName, number[]>;
  for (const [keyMode, n] of Object.entries(counts)) {
    const [tonic, mode] = keyMode.split(' ') as [string, ModeName];
    const row = grid[mode];
    if (!row || !tonic) continue;
    row[chroma(pitchClass(tonic))] = (row[chroma(pitchClass(tonic))] ?? 0) + n;
  }
  return grid;
}

/** The key and mode of the most recent pass that had both. */
export function lastKeyMode(reps: readonly LoggedRep[]): KeyMode | null {
  const latest = [...reps]
    .filter((r) => keyModeOf(r.axes) !== null)
    .sort((a, b) => b.startedAt - a.startedAt)[0];
  if (!latest) return null;
  return { tonic: latest.axes.key as PitchClass, mode: latest.axes.mode as ModeName };
}

/**
 * How much a theory drill should lean toward each subject (`"key:Eb"`):
 * `(1 + 2 × misses) ÷ (1 + times seen)`. A subject never seen weighs 1; one
 * you keep getting right sinks below it; one you miss rises above.
 */
export function answerWeights(reps: readonly LoggedRep[]): Record<string, number> {
  const seen: Record<string, number> = {};
  const missed: Record<string, number> = {};
  for (const rep of reps) {
    for (const answer of rep.answers ?? []) {
      const subject = answer.subject;
      seen[subject] = (seen[subject] ?? 0) + 1;
      if (!answer.correct) missed[subject] = (missed[subject] ?? 0) + 1;
    }
  }
  return Object.fromEntries(
    Object.keys(seen).map((s) => [s, (1 + 2 * (missed[s] ?? 0)) / (1 + seen[s]!)]),
  );
}
