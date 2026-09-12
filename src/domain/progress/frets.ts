import type { FretPosition } from '@/domain/instrument';
import type { Phrase } from '@/domain/phrase';
import type { FretTally, PracticeDay } from './types';

export function fretKey(position: FretPosition): string {
  return `${position.string}:${position.fret}`;
}

export function parseFretKey(key: string): FretPosition {
  const [string, fret] = key.split(':').map(Number);
  return { string: string!, fret: fret! };
}

/**
 * Every note a pass plays, by where it is played. A phrase played twice
 * within one pass counts twice; a tied note is one note held, so it counts
 * once.
 */
export function fretTally(phrase: Phrase, strings: number): FretTally {
  const times = phrase.repeat ?? 1;
  const counts: Record<string, number> = {};
  for (const note of phrase.notes) {
    if (note.tied) continue;
    const key = fretKey(note);
    counts[key] = (counts[key] ?? 0) + times;
  }
  return { strings, counts };
}

/** Add one set of counts into another, in place. */
export function addCounts(into: Record<string, number>, counts: Record<string, number>): void {
  for (const [key, n] of Object.entries(counts)) into[key] = (into[key] ?? 0) + n;
}

/** Notes played at each fret over some days, for one instrument's string count. */
export function neckCounts(days: readonly PracticeDay[], strings: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const day of days) addCounts(out, day.frets[strings] ?? {});
  return out;
}

/**
 * Each spot's share of the busiest one, 0–1, on a square-root scale — played
 * counts are lopsided, and a linear scale leaves everything but the favorite
 * shape looking untouched.
 */
export function heatLevels(counts: Record<string, number>): Record<string, number> {
  const max = Math.max(0, ...Object.values(counts));
  if (max === 0) return {};
  return Object.fromEntries(
    Object.entries(counts).map(([key, n]) => [key, Math.sqrt(n) / Math.sqrt(max)]),
  );
}

/** How much of the neck has been played, and the frets no string has been played at. */
export function neckSummary(
  counts: Record<string, number>,
  strings: number,
  fretCount: number,
): { touched: number; total: number; untouchedFrets: number[] } {
  let touched = 0;
  const untouchedFrets: number[] = [];
  for (let fret = 0; fret <= fretCount; fret += 1) {
    let any = false;
    for (let string = 0; string < strings; string += 1) {
      if ((counts[fretKey({ string, fret })] ?? 0) > 0) {
        touched += 1;
        any = true;
      }
    }
    if (!any) untouchedFrets.push(fret);
  }
  return { touched, total: strings * (fretCount + 1), untouchedFrets };
}

/** Frets as runs: [0, 15, 16, 17, 22] → "0, 15–17, 22". */
export function fretRuns(frets: readonly number[]): string {
  const runs: string[] = [];
  const sorted = [...frets].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j += 1;
    runs.push(i === j ? `${sorted[i]}` : `${sorted[i]}–${sorted[j]}`);
    i = j + 1;
  }
  return runs.join(', ');
}
