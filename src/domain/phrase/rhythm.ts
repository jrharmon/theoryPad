import { EIGHTH, EIGHTH_TRIPLET, PPQ, QUARTER, SIXTEENTH } from './types';

/**
 * A rhythm pattern is a repeating cycle of note lengths in ticks, plus the
 * velocity to play each at. Patterns are cycled across however many notes a
 * generator hands them, so the same pattern fits a four-note run or a
 * forty-note one.
 */
export interface RhythmPattern {
  id: string;
  name: string;
  /** Note lengths in ticks, cycled. */
  durations: number[];
  /** Velocities, cycled independently of durations. */
  velocities?: number[];
  /** Shift alternate notes later, for swing. Ticks, applied to odd positions. */
  swingTicks?: number;
}

export const STRAIGHT_QUARTERS: RhythmPattern = {
  id: 'straight-quarters',
  name: 'Straight quarters',
  durations: [QUARTER],
};

export const STRAIGHT_EIGHTHS: RhythmPattern = {
  id: 'straight-eighths',
  name: 'Straight 8ths',
  durations: [EIGHTH],
};

export const STRAIGHT_SIXTEENTHS: RhythmPattern = {
  id: 'straight-sixteenths',
  name: 'Straight 16ths',
  durations: [SIXTEENTH],
  velocities: [1, 0.7, 0.8, 0.7],
};

export const EIGHTH_TRIPLETS: RhythmPattern = {
  id: 'eighth-triplets',
  name: 'Eighth triplets',
  durations: [EIGHTH_TRIPLET],
  velocities: [1, 0.7, 0.7],
};

export const SWUNG_EIGHTHS: RhythmPattern = {
  id: 'swung-eighths',
  name: 'Swung 8ths',
  durations: [EIGHTH],
  // A swung pair is long-short: the offbeat lands a third of a beat late.
  swingTicks: EIGHTH_TRIPLET / 2,
};

export const GALLOP: RhythmPattern = {
  id: 'gallop',
  name: 'Gallop',
  durations: [EIGHTH, SIXTEENTH, SIXTEENTH],
  velocities: [1, 0.7, 0.7],
};

export const DOTTED_SHUFFLE: RhythmPattern = {
  id: 'dotted-shuffle',
  name: 'Dotted shuffle',
  durations: [QUARTER + EIGHTH, EIGHTH],
};

export const RHYTHM_PATTERNS = [
  STRAIGHT_QUARTERS,
  STRAIGHT_EIGHTHS,
  STRAIGHT_SIXTEENTHS,
  EIGHTH_TRIPLETS,
  SWUNG_EIGHTHS,
  GALLOP,
  DOTTED_SHUFFLE,
] as const;

export function rhythmById(id: string): RhythmPattern {
  const found = RHYTHM_PATTERNS.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown rhythm pattern: ${id}`);
  return found;
}

/** Note lengths and velocities for `count` notes, cycling the pattern. */
export function expandRhythm(
  pattern: RhythmPattern,
  count: number,
): { startTick: number; durationTicks: number; velocity: number }[] {
  const out: { startTick: number; durationTicks: number; velocity: number }[] = [];
  let tick = 0;

  for (let i = 0; i < count; i += 1) {
    const duration = pattern.durations[i % pattern.durations.length]!;
    const velocity = pattern.velocities?.[i % pattern.velocities.length] ?? 0.8;

    // Swing delays the offbeat and shortens it by the same amount, so the pair
    // still fills its beat exactly — no drift over a long run.
    const swing = pattern.swingTicks ?? 0;
    const isOffbeat = i % 2 === 1;
    const startTick = tick + (isOffbeat ? swing : 0);
    const durationTicks =
      swing === 0 ? duration : isOffbeat ? duration - swing : duration + swing;

    out.push({ startTick, durationTicks, velocity });
    tick += duration;
  }

  return out;
}

/** Ticks one cycle of the pattern occupies. */
export function patternCycleTicks(pattern: RhythmPattern): number {
  return pattern.durations.reduce((a, b) => a + b, 0);
}

/** Ticks `count` notes of this pattern will occupy. */
export function rhythmTotalTicks(pattern: RhythmPattern, count: number): number {
  let total = 0;
  for (let i = 0; i < count; i += 1) total += pattern.durations[i % pattern.durations.length]!;
  return total;
}

export const DEFAULT_PPQ = PPQ;
