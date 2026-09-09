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
export const QUARTER_TRIPLET = PPQ * 2 / 3;
export const EIGHTH_TRIPLET = PPQ / 3;
export const SIXTEENTH_TRIPLET = PPQ / 6;
export const EIGHTH_QUINTUPLET = PPQ * 2 / 5;

export type Articulation =
  | 'hammer-on'
  | 'pull-off'
  | 'slide-up'
  | 'slide-down'
  | 'slide-into'
  | 'bend'
  | 'bend-release'
  | 'vibrato'
  | 'palm-mute'
  | 'ghost'
  | 'staccato'
  | 'let-ring';

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
  articulation?: Articulation;
  finger?: Finger;
  role?: NoteRole;
  /** Shown under the note, e.g. "♭3". */
  annotation?: string;
  /** Picking direction, for technique exercises. */
  pickStroke?: 'down' | 'up';
  /** Tied from the previous note on the same string. */
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
  /** Shown beneath the bar, e.g. "Bar 4 · land on B". */
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
}

export const FOUR_FOUR: TimeSignature = { beats: 4, unit: 4 };
export const THREE_FOUR: TimeSignature = { beats: 3, unit: 4 };
export const SIX_EIGHT: TimeSignature = { beats: 6, unit: 8 };
