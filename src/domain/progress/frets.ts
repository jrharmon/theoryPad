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
