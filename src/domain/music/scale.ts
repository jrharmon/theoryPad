import { Interval } from 'tonal';
import type { Alteration, Degree, DegreeNumber, KeyMode, PitchClass } from './types';
import { chroma, transposeBy, withoutDoubleAccidental } from './pitch';
import type { CharacterId } from './scales';
import { characterId, scaleIntervals } from './scales';

/** Semitones above the tonic for each degree of the major scale. */
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11] as const;

/**
 * The note that gives each mode or scale its identity — the one you land on to
 * make it announce itself, and the one the reference screens highlight. A
 * degree number and its alteration, because blues has two 5ths.
 */
const SIGNATURE_DEGREE: Record<CharacterId, [DegreeNumber, Alteration]> = {
  ionian: [7, 0], // the major 7th, against mixolydian's ♭7
  dorian: [6, 0], // the natural 6th, against aeolian's ♭6
  phrygian: [2, -1], // the ♭2
  lydian: [4, 1], // the ♯4
  mixolydian: [7, -1], // the ♭7
  aeolian: [6, -1], // the ♭6
  locrian: [5, -1], // the ♭5
  'minor-pentatonic': [3, -1], // the ♭3, against major pentatonic's 3
  'major-pentatonic': [3, 0], // the 3rd
  blues: [5, -1], // the ♭5 it adds to minor pentatonic
  'harmonic-minor': [7, 0], // the raised 7th, against aeolian's ♭7
  'phrygian-dominant': [3, 0], // the major 3rd, against phrygian's ♭3
  'melodic-minor': [6, 0], // the natural 6th, against harmonic minor's ♭6
};

function degreeLabel(number: DegreeNumber, alteration: Alteration): string {
  if (alteration === -1) return `♭${number}`;
  if (alteration === 1) return `♯${number}`;
  return `${number}`;
}

export function makeDegree(number: DegreeNumber, alteration: Alteration): Degree {
  return { number, alteration, label: degreeLabel(number, alteration) };
}

function degreeOfInterval(interval: string): Degree {
  const { num, semitones } = Interval.get(interval);
  const number = num as DegreeNumber;
  const alteration = semitones - MAJOR_STEPS[number - 1]!;
  if (alteration !== -1 && alteration !== 0 && alteration !== 1) {
    throw new Error(`Unexpected alteration ${alteration} for interval ${interval}`);
  }
  return makeDegree(number, alteration);
}

/**
 * The notes of a key, one per scale step, correctly spelled. A seven-note
 * scale uses each letter name exactly once. Pass a canonical tonic (see
 * `canonicalKeyMode`) or you may get double accidentals back.
 *
 * Generators that walk the scale index into this by step; anything that names
 * a note uses `scaleDegrees` — in a pentatonic, step 2 is degree ♭3.
 */
export function scaleNotes(km: KeyMode): PitchClass[] {
  // Canonical tonics keep every seven-note scale free of double accidentals.
  // Blues keeps minor pentatonic's tonic, so its ♭5 can land on one — E♭
  // blues' is B𝄫 — and is written as the plain note (A) instead.
  return scaleIntervals(km).map((interval) =>
    withoutDoubleAccidental(transposeBy(km.tonic, interval)),
  );
}

/** The degree of each scale step, with its alteration relative to the major scale. */
export function scaleDegrees(km: KeyMode): Degree[] {
  return scaleIntervals(km).map(degreeOfInterval);
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

/** Does the key have a note at this degree number? A pentatonic has no 2 or 6 (or 4 or 7). */
export function hasDegree(km: KeyMode, number: DegreeNumber): boolean {
  return scaleDegrees(km).some((d) => d.number === number);
}

/**
 * The note at a degree of the key. A bare number takes the unaltered note where
 * the scale has two (blues' 5, not its ♭5); pass the full degree for the other.
 * Throws where the scale has no such degree — check `hasDegree` first.
 */
export function noteAtDegree(km: KeyMode, degree: DegreeNumber | Degree): PitchClass {
  const degrees = scaleDegrees(km);
  const matches =
    typeof degree === 'number'
      ? (d: Degree) => d.number === degree
      : (d: Degree) => d.number === degree.number && d.alteration === degree.alteration;
  const index =
    typeof degree === 'number' && degrees.filter(matches).length > 1
      ? degrees.findIndex((d) => matches(d) && d.alteration === 0)
      : degrees.findIndex(matches);
  if (index < 0) {
    const label = typeof degree === 'number' ? degree : degree.label;
    throw new Error(`${km.tonic} ${km.scale} ${km.mode} has no degree ${label}`);
  }
  return scaleNotes(km)[index]!;
}

/** The degree that defines the mode's (or scale's) character. */
export function signatureDegree(km: KeyMode): Degree {
  const [number, alteration] = SIGNATURE_DEGREE[characterId(km)];
  return makeDegree(number, alteration);
}

/** The note that defines the mode's (or scale's) character. */
export function signatureNote(km: KeyMode): PitchClass {
  return noteAtDegree(km, signatureDegree(km));
}

/** Semitone steps between consecutive scale notes, e.g. [2,1,2,2,2,1,2]. */
export function stepPattern(km: KeyMode): number[] {
  return scaleIntervals(km).map((interval, i, all) => {
    const here = Interval.semitones(interval) ?? 0;
    const next = i + 1 < all.length ? (Interval.semitones(all[i + 1]!) ?? 0) : 12;
    return next - here;
  });
}

/** Is this pitch class in the key? */
export function isInScale(km: KeyMode, pc: PitchClass): boolean {
  return degreeOf(km, pc) !== null;
}
