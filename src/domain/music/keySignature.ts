import type { KeyMode, KeySignature, ModeName, PitchClass } from './types';
import { pitchClass, transposeBy } from './pitch';
import { keyModeName, parentMode } from './scales';

/** How far each mode's tonic sits above its parent major's tonic. */
const MODE_OFFSET_FROM_MAJOR: Record<ModeName, string> = {
  ionian: '1P',
  dorian: '2M',
  phrygian: '3M',
  lydian: '4P',
  mixolydian: '5P',
  aeolian: '6M',
  locrian: '7M',
};

const SHARP_ORDER = ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'].map((s) => pitchClass(s));
const FLAT_ORDER = ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'].map((s) => pitchClass(s));

/** Accidentals in each major key, by tonic. */
const MAJOR_ALTERATION: Record<string, number> = {
  C: 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  B: 5,
  'F#': 6,
  'C#': 7,
  F: -1,
  Bb: -2,
  Eb: -3,
  Ab: -4,
  Db: -5,
  Gb: -6,
  Cb: -7,
};

/**
 * The major key a mode is a rotation of: D dorian -> C major. A pentatonic
 * goes through its parent mode, so A minor pentatonic -> C major too. Harmonic
 * minor, Phrygian dominant and melodic minor aren't rotations of any major
 * key and have no signature of their own, so this throws for them — check
 * `hasKeySignature` first.
 */
export function relativeMajor(km: KeyMode): PitchClass {
  const parent = parentMode(km);
  if (parent === null) throw new Error(`${keyModeName(km)} has no key signature of its own`);
  const down = MODE_OFFSET_FROM_MAJOR[parent.mode as ModeName];
  return transposeBy(km.tonic, `-${down}`);
}

/** Is the key a mode of major, or inside one? Only those have a signature. */
export function hasKeySignature(km: KeyMode): boolean {
  return parentMode(km) !== null;
}

/**
 * The key signature a mode inherits from its parent major. D dorian and C
 * ionian share one: no sharps, no flats.
 */
export function keySignature(km: KeyMode): KeySignature {
  const major = relativeMajor(km);
  const alteration = MAJOR_ALTERATION[major];
  if (alteration === undefined) {
    throw new Error(`No key signature for relative major ${major} (from ${keyModeName(km)})`);
  }

  const sharps = alteration > 0 ? alteration : 0;
  const flats = alteration < 0 ? -alteration : 0;
  const accidentals =
    alteration > 0 ? SHARP_ORDER.slice(0, sharps) : FLAT_ORDER.slice(0, flats);

  return { sharps, flats, relativeMajor: major, accidentals };
}

/** Steps around the circle of fifths from C: F is -1, G is +1. */
export function circlePosition(km: KeyMode): number {
  const sig = keySignature(km);
  return sig.sharps - sig.flats;
}
