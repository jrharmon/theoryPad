import type { PitchClass } from '@/domain/music';
import { pitchClass } from '@/domain/music';

/**
 * The circle of fifths as the twelve major keys, by position: C is 0, each
 * step clockwise adds a sharp, each step anticlockwise a flat. Six sharps and
 * six flats are the same key, so the circle runs from Db (-5) to F# (+6) —
 * the spellings a guitarist reads.
 */
const MAJORS: Record<number, string> = {
  [-5]: 'Db', [-4]: 'Ab', [-3]: 'Eb', [-2]: 'Bb', [-1]: 'F',
  0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F#',
};

const MINORS: Record<number, string> = {
  [-5]: 'Bb', [-4]: 'F', [-3]: 'C', [-2]: 'G', [-1]: 'D',
  0: 'A', 1: 'E', 2: 'B', 3: 'F#', 4: 'C#', 5: 'G#', 6: 'D#',
};

export const CIRCLE_POSITIONS = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6] as const;

/** Any step count, wrapped back onto the twelve positions. */
export function wrapPosition(position: number): number {
  return ((((position + 5) % 12) + 12) % 12) - 5;
}

export function majorAt(position: number): PitchClass {
  return pitchClass(MAJORS[wrapPosition(position)]!);
}

/** The relative minor of the major key at a position. */
export function minorAt(position: number): PitchClass {
  return pitchClass(MINORS[wrapPosition(position)]!);
}

export function positionOfMajor(tonic: PitchClass): number {
  const found = CIRCLE_POSITIONS.find((p) => MAJORS[p] === tonic);
  if (found === undefined) throw new Error(`${tonic} major is not on the circle as spelled`);
  return found;
}

export function positionOfMinor(tonic: PitchClass): number {
  const found = CIRCLE_POSITIONS.find((p) => MINORS[p] === tonic);
  if (found === undefined) throw new Error(`${tonic} minor is not on the circle as spelled`);
  return found;
}

/** "No sharps or flats", "1 sharp", "3 flats". */
export function signatureLabel(position: number): string {
  if (position === 0) return 'No sharps or flats';
  const count = Math.abs(position);
  const kind = position > 0 ? 'sharp' : 'flat';
  return `${count} ${kind}${count === 1 ? '' : 's'}`;
}
