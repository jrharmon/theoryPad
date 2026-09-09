import { Scale } from 'tonal';
import type { Alteration, Degree, DegreeNumber, KeyMode, ModeName, PitchClass } from './types';
import { chroma, pitchClass, semitonesBetween } from './pitch';

/** Semitones above the tonic for each degree of the major scale. */
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11] as const;

const DEGREE_NUMBERS: readonly DegreeNumber[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * The note that gives each mode its identity — the one you land on to make the
 * mode announce itself, and the one the reference screens highlight.
 */
const SIGNATURE_DEGREE: Record<ModeName, DegreeNumber> = {
  ionian: 7, // the major 7th, against mixolydian's ♭7
  dorian: 6, // the natural 6th, against aeolian's ♭6
  phrygian: 2, // the ♭2
  lydian: 4, // the ♯4
  mixolydian: 7, // the ♭7
  aeolian: 6, // the ♭6
  locrian: 5, // the ♭5
};

function degreeLabel(number: DegreeNumber, alteration: Alteration): string {
  if (alteration === -1) return `♭${number}`;
  if (alteration === 1) return `♯${number}`;
  return `${number}`;
}

export function makeDegree(number: DegreeNumber, alteration: Alteration): Degree {
  return { number, alteration, label: degreeLabel(number, alteration) };
}

/**
 * The seven notes of a key/mode, correctly spelled — each letter name used
 * exactly once. Pass a canonical tonic (see `canonicalKeyMode`) or you may get
 * double accidentals back.
 */
export function scaleNotes(km: KeyMode): PitchClass[] {
  const notes = Scale.get(`${km.tonic} ${km.mode}`).notes;
  if (notes.length !== 7) {
    throw new Error(`Expected 7 notes for ${km.tonic} ${km.mode}, got ${notes.length}`);
  }
  return notes.map((n) => pitchClass(n));
}

/** The seven degrees, with their alteration relative to the major scale. */
export function scaleDegrees(km: KeyMode): Degree[] {
  const notes = scaleNotes(km);
  return notes.map((note, i) => {
    const number = DEGREE_NUMBERS[i]!;
    const actual = semitonesBetween(km.tonic, note);
    const expected = MAJOR_STEPS[i]!;
    const alteration = actual - expected;
    if (alteration !== -1 && alteration !== 0 && alteration !== 1) {
      throw new Error(`Unexpected alteration ${alteration} at degree ${number} of ${km.mode}`);
    }
    return makeDegree(number, alteration);
  });
}

/** The degree a pitch class occupies in a key, or null if it is not in it. */
export function degreeOf(km: KeyMode, pc: PitchClass): Degree | null {
  const notes = scaleNotes(km);
  const degrees = scaleDegrees(km);
  const target = chroma(pc);
  for (let i = 0; i < notes.length; i += 1) {
    if (chroma(notes[i]!) === target) return degrees[i]!;
  }
  return null;
}

/** The note at a degree of the key. */
export function noteAtDegree(km: KeyMode, number: DegreeNumber): PitchClass {
  return scaleNotes(km)[number - 1]!;
}

/** The degree that defines the mode's character. */
export function signatureDegree(km: KeyMode): Degree {
  const number = SIGNATURE_DEGREE[km.mode];
  return scaleDegrees(km)[number - 1]!;
}

/** The note that defines the mode's character. */
export function signatureNote(km: KeyMode): PitchClass {
  return noteAtDegree(km, SIGNATURE_DEGREE[km.mode]);
}

/** Semitone steps between consecutive scale notes, e.g. [2,1,2,2,2,1,2]. */
export function stepPattern(km: KeyMode): number[] {
  const notes = scaleNotes(km);
  return notes.map((note, i) => {
    const next = notes[(i + 1) % notes.length]!;
    return semitonesBetween(note, next) || 12;
  });
}

/** Is this pitch class in the key? */
export function isInScale(km: KeyMode, pc: PitchClass): boolean {
  return degreeOf(km, pc) !== null;
}
