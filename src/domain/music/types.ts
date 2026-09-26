/**
 * Core musical types.
 *
 * PitchClass and NoteName are branded because they are both strings and are
 * trivially confused ("D" vs "D4"). Passing one where the other is expected is
 * a real and silent bug class, so the compiler is made to care.
 */

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

/** A note without an octave: "C", "F#", "Bb". */
export type PitchClass = Brand<string, 'PitchClass'>;

/** A note with an octave: "D4", "F#3". */
export type NoteName = Brand<string, 'NoteName'>;

/** A MIDI note number, 0-127. Middle C (C4) is 60. */
export type Midi = Brand<number, 'Midi'>;

/** 0-11, C = 0. Pitch identity with no spelling attached. */
export type Chroma = Brand<number, 'Chroma'>;

export const MODE_NAMES = [
  'ionian',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'aeolian',
  'locrian',
] as const;

export type ModeName = (typeof MODE_NAMES)[number];

/** The scales a key can be played in. Menu order. */
export const SCALE_IDS = [
  'major',
  'minor-pentatonic',
  'major-pentatonic',
  'blues',
  'harmonic-minor',
  'phrygian-dominant',
  'melodic-minor',
] as const;

export type ScaleId = (typeof SCALE_IDS)[number];

/**
 * A pentatonic box. Shared by the three pentatonic scales: Shape n is the box
 * that starts on the scale's nth note, with the root unchanged.
 */
export const SHAPE_IDS = ['shape-1', 'shape-2', 'shape-3', 'shape-4', 'shape-5'] as const;

export type ShapeId = (typeof SHAPE_IDS)[number];

/** A scale with neither modes nor shapes has one mode, whose id is its own. */
export type SingleModeScaleId = 'harmonic-minor' | 'phrygian-dominant' | 'melodic-minor';

/**
 * Every scale's modes. Unique app-wide, and stored in the rep log, so never
 * rename one. `ModeName` is the Major scale's seven.
 */
export type ModeId = ModeName | ShapeId | SingleModeScaleId;

/**
 * A root, a scale, and one of that scale's modes. For the Major scale the mode
 * changes the notes; for a pentatonic it changes only the box.
 */
export interface KeyMode {
  tonic: PitchClass;
  scale: ScaleId;
  mode: ModeId;
}

export type DegreeNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Alteration relative to the major scale. Every scale here needs only -1..1. */
export type Alteration = -1 | 0 | 1;

export interface Degree {
  number: DegreeNumber;
  alteration: Alteration;
  /** Display form: "1", "♭3", "♯4". */
  label: string;
}

export type TriadQuality = 'maj' | 'min' | 'dim' | 'aug';

export type SeventhQuality =
  'maj7' | 'min7' | 'dom7' | 'min7b5' | 'dim7' | 'minMaj7' | 'maj7sharp5';

export type ChordQuality = TriadQuality | SeventhQuality;

/**
 * The chord family a degree belongs to, relative to the mode's own tonic.
 * Every diatonic chord is in one: tonic (1, 3, 6), subdominant (2, 4),
 * dominant (5, 7). Degree names — supertonic, mediant — are not modeled;
 * people say "the 2nd", and families are what the drills ask about.
 *
 * Taken by degree in every mode. In a mode whose 7th is a subtonic rather
 * than a leading tone it is still called dominant, which keeps one rule
 * across all seven modes.
 */
export type ChordFunction = 'tonic' | 'subdominant' | 'dominant';

export interface DiatonicChord {
  degree: Degree;
  root: PitchClass;
  triad: TriadQuality;
  seventh: SeventhQuality;
  /** "Dm", "F", "Bdim" */
  triadSymbol: string;
  /** "Dm7", "Fmaj7", "Bm7b5" */
  seventhSymbol: string;
  /**
   * Null where the diatonic ninth is a minor 9th, which is not a usable
   * extension — honest rather than inventing a chord that isn't in the key.
   */
  ninthSymbol: string | null;
  notes: { triad: PitchClass[]; seventh: PitchClass[] };
  function: ChordFunction;
}

export interface KeySignature {
  /** Number of sharps, or 0. Never set at the same time as `flats`. */
  sharps: number;
  /** Number of flats, or 0. */
  flats: number;
  /** The major key this mode is a rotation of. */
  relativeMajor: PitchClass;
  /** Accidentals in signature order, e.g. ["F#", "C#"]. */
  accidentals: PitchClass[];
}
