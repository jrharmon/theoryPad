/**
 * Musical time is measured in INTEGER TICKS from the start of the phrase.
 *
 * Not float beats. PPQ 480 divides cleanly by 2, 3, 4, 5, 6, 8, 12 and 16, so
 * eighths, triplets, sixteenths, quintuplets and swing are all exact integers.
 * Float beat positions produce 0.30000000000000004 comparisons the moment a
 * triplet appears, and the symptom is notes silently missing from the tab.
 * Integers also map straight onto Tone.js ticks.
 */
export const PPQ = 480;

export const WHOLE = PPQ * 4;
export const HALF = PPQ * 2;
export const QUARTER = PPQ;
export const EIGHTH = PPQ / 2;
export const SIXTEENTH = PPQ / 4;
export const THIRTY_SECOND = PPQ / 8;
export const QUARTER_TRIPLET = (PPQ * 2) / 3;
export const EIGHTH_TRIPLET = PPQ / 3;
export const SIXTEENTH_TRIPLET = PPQ / 6;
export const EIGHTH_QUINTUPLET = (PPQ * 2) / 5;

/**
 * How a note is played, beyond its string, fret and time. A note can carry
 * several: Guitar Pro stacks them (a slide into vibrato under palm mute).
 *
 * The slides and slurs that join two notes sit on the **second** note — the one
 * they arrive at — because that is where tab writes them: 5h7, 5/7.
 */
export type Technique =
  | 'hammer-on'
  | 'pull-off'
  /** From the note before on this string; the arriving note is picked. */
  | 'slide-up'
  | 'slide-down'
  /** From the note before on this string, not picked again. */
  | 'legato-slide-up'
  | 'legato-slide-down'
  /** Into this note from nowhere in particular: below, or above. */
  | 'slide-in-below'
  | 'slide-in-above'
  /** Away from this note to nowhere in particular. */
  | 'slide-out-down'
  | 'slide-out-up'
  | 'vibrato'
  | 'palm-mute'
  | 'let-ring'
  | 'staccato'
  | 'ghost'
  /** A muted string: a percussive hit with no pitch. */
  | 'dead'
  | 'accent'
  /** Fretted by the picking hand. */
  | 'tap';

/**
 * A bend's shape through the note: `at` runs 0–1 from the note's start to its
 * end, `tones` is how far the string is bent, in whole tones (1 is a full
 * bend, 0.5 a half). A pre-bend starts above 0; a release comes back down.
 */
export interface Bend {
  points: { at: number; tones: number }[];
}

export type HarmonicKind = 'natural' | 'artificial' | 'pinch' | 'tapped' | 'semi';

export interface Harmonic {
  kind: HarmonicKind;
  /**
   * For every kind but natural: the fret, counted from the fretted note, where
   * the harmonic is touched — 12 is an octave up. A natural harmonic is
   * touched at the note's own fret.
   */
  fret?: number;
}

/** What a note is doing harmonically; drives colour in the tab and on the neck. */
export type NoteRole = 'root' | 'target' | 'chord-tone' | 'passing' | 'none';

export type Finger = 0 | 1 | 2 | 3 | 4 | 't';

export interface TabNote {
  /** 0-based index into the instrument's tuning; 0 is the lowest string. */
  string: number;
  fret: number;
  /** Ticks from the start of the phrase. */
  startTick: number;
  durationTicks: number;
  /** 0-1. Default 0.8; accents 1.0; slurred and ghost notes lower. */
  velocity?: number;
  techniques?: Technique[];
  bend?: Bend;
  harmonic?: Harmonic;
  /**
   * A grace note: it belongs to the beat at its `startTick` and takes no time
   * there. Played just before that beat, or on it, ahead of the main note.
   */
  grace?: 'before-beat' | 'on-beat';
  finger?: Finger;
  role?: NoteRole;
  /** Shown under the note, e.g. "♭3". */
  annotation?: string;
  /**
   * Shown in place of the fret number. A note-finding exercise writes the
   * note name here, because printing the fret would give the answer away.
   */
  display?: string;
  /** Picking direction, for technique exercises. */
  pickStroke?: 'down' | 'up';
  /** Tied from the previous note on the same string: held, not picked again. */
  tied?: boolean;
}

export interface TimeSignature {
  beats: number;
  /** Which note value gets the beat: 4 is a quarter. */
  unit: 1 | 2 | 4 | 8 | 16;
}

export interface Bar {
  index: number;
  startTick: number;
  timeSignature: TimeSignature;
  /** Shown beneath the bar after its number, e.g. "Phrase 2 · land on B". */
  label?: string;
}

export interface Phrase {
  /** Carried so a serialised phrase is self-describing. Always PPQ. */
  ppq: number;
  timeSignature: TimeSignature;
  bars: Bar[];
  /** Sorted by startTick, then by string. */
  notes: TabNote[];
  totalTicks: number;
  /** Play the whole phrase this many times within one rep. */
  repeat?: number;
  /**
   * The tempo it was written at, for a phrase read from a file: a fact about
   * the music, never a practice tempo. Nothing in practice writes it.
   */
  writtenTempo?: number;
}

export const FOUR_FOUR: TimeSignature = { beats: 4, unit: 4 };
export const THREE_FOUR: TimeSignature = { beats: 3, unit: 4 };
export const SIX_EIGHT: TimeSignature = { beats: 6, unit: 8 };
