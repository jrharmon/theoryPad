import type { NoteName, PitchClass, Degree, KeyMode } from '@/domain/music';

export interface Instrument {
  id: string;
  name: string;
  /**
   * Open-string pitches, LOWEST to HIGHEST. Its length defines the string
   * count — nothing in the codebase may assume six.
   *
   *   Standard: ["E2","A2","D3","G3","B3","E4"]
   *   Drop D:   ["D2","A2","D3","G3","B3","E4"]
   *   7-string: ["B1","E2","A2","D3","G3","B3","E4"]
   */
  tuning: NoteName[];
  fretCount: number;
  handedness: 'right' | 'left';
  /** Fret the capo sits at; 0 for none. */
  capo: number;
}

/**
 * A point on the neck.
 *
 * `string` is a 0-based index into `Instrument.tuning`, so **0 is the
 * lowest-pitched string** — not necessarily low E, and not the "1st string" a
 * guitarist would name. Tab and the fretboard diagram invert this for display,
 * in the renderer and nowhere else.
 */
export interface FretPosition {
  string: number;
  /** 0 is the open string. */
  fret: number;
}

export interface FretRange {
  low: number;
  high: number;
}

/** A note of a scale located on the neck. */
export interface ScaleNotePosition extends FretPosition {
  pitchClass: PitchClass;
  note: NoteName;
  degree: Degree;
  isRoot: boolean;
}

/** A window of frets the fretting hand occupies. */
export interface NeckPosition {
  /** Lowest fret of the window; also its name — 7 is "7th position". */
  fret: number;
  /** How many frets the hand covers. 4 normally, more with stretches. */
  span: number;
}

/** A named subset of strings, by index. */
export interface StringSet {
  id: string;
  name: string;
  /** String indices, ascending. */
  strings: number[];
}

export interface ScaleOnNeckOptions {
  range?: FretRange;
  keyMode: KeyMode;
}
