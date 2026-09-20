import type { KeyMode, KeySignature, ModeName, PitchClass } from '@/domain/music';
import {
  circlePosition,
  keySignature,
  pitchClass,
  relativeMajor,
  scaleNotes,
} from '@/domain/music';

/**
 * The circle of fifths as the twelve major keys, by position: C is 0, each
 * step clockwise adds a sharp, each step anticlockwise a flat. Six sharps and
 * six flats are the same key, so the circle runs from Db (-5) to F# (+6) —
 * the spellings a guitarist reads.
 */
const MAJORS: Record<number, string> = {
  [-5]: 'Db',
  [-4]: 'Ab',
  [-3]: 'Eb',
  [-2]: 'Bb',
  [-1]: 'F',
  0: 'C',
  1: 'G',
  2: 'D',
  3: 'A',
  4: 'E',
  5: 'B',
  6: 'F#',
};

const MINORS: Record<number, string> = {
  [-5]: 'Bb',
  [-4]: 'F',
  [-3]: 'C',
  [-2]: 'G',
  [-1]: 'D',
  0: 'A',
  1: 'E',
  2: 'B',
  3: 'F#',
  4: 'C#',
  5: 'G#',
  6: 'D#',
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

export type CircleRing = 'major' | 'minor' | 'diminished';

export type ChordRole = 'I' | 'ii' | 'iii' | 'IV' | 'V' | 'vi' | 'vii°';

/** One chord of a key, placed on the circle. */
export interface CircleCell {
  ring: CircleRing;
  /** Wrapped onto the twelve positions, C = 0. */
  position: number;
  /** The chord's root, spelled from the key — Cb in Gb major, not B. */
  root: PitchClass;
  role: ChordRole;
}

export interface KeyOnCircle {
  /** Where the parent major sits. */
  position: number;
  signature: KeySignature;
  /** The seven chords the key shares with its parent major: a wedge of the circle. */
  cells: CircleCell[];
  /** The chord the mode is built on — D minor for D dorian. */
  tonic: CircleCell;
}

/** Which of the parent major's chords each mode starts on. */
const MODE_ROLE: Record<ModeName, ChordRole> = {
  ionian: 'I',
  dorian: 'ii',
  phrygian: 'iii',
  lydian: 'IV',
  mixolydian: 'V',
  aeolian: 'vi',
  locrian: 'vii°',
};

/**
 * A key and mode on the circle of fifths: the wedge its parent major's chords
 * make — IV I V round the outside, ii vi iii inside, vii° in the middle — and
 * the one the mode calls home.
 */
export function keyOnCircle(keyMode: KeyMode): KeyOnCircle {
  const major = relativeMajor(keyMode);
  const notes = scaleNotes({ tonic: major, mode: 'ionian' });
  const p = wrapPosition(circlePosition(keyMode));
  const cell = (
    role: ChordRole,
    ring: CircleRing,
    offset: number,
    degree: number,
  ): CircleCell => ({
    role,
    ring,
    position: wrapPosition(p + offset),
    root: notes[degree]!,
  });
  const cells = [
    cell('IV', 'major', -1, 3),
    cell('I', 'major', 0, 0),
    cell('V', 'major', 1, 4),
    cell('ii', 'minor', -1, 1),
    cell('vi', 'minor', 0, 5),
    cell('iii', 'minor', 1, 2),
    cell('vii°', 'diminished', 0, 6),
  ];
  return {
    position: p,
    signature: keySignature(keyMode),
    cells,
    tonic: cells.find((c) => c.role === MODE_ROLE[keyMode.mode])!,
  };
}
