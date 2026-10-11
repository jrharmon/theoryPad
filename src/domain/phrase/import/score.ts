import type { Bend, Harmonic, Technique } from '../types';

/**
 * What a Guitar Pro file holds, as far as a phrase needs it. The reader in
 * `src/import/guitar-pro/` fills it from the file's XML; everything here is
 * plain data, so the converter can be pure.
 *
 * Indices are the file's own: master bars from 0, strings from 0 = lowest.
 */
export interface GpScore {
  title: string;
  artist: string;
  /** Every tempo marking, as quarter notes a minute, in bar order. */
  tempos: GpTempo[];
  masterBars: GpMasterBar[];
  tracks: GpTrack[];
}

export interface GpTempo {
  /** The master bar it is marked in. */
  bar: number;
  bpm: number;
}

/** A bar as every track shares it: meter, key, repeats, markers. */
export interface GpMasterBar {
  time: { beats: number; unit: number };
  /** Sharps (positive) or flats (negative) in the key signature. */
  key: { accidentals: number; minor: boolean };
  repeatStart: boolean;
  /** On the bar that ends a repeat: how many times the section plays in all. 0 for none. */
  repeatEnd: number;
  /** The passes this bar is played on, for an alternate ending ("1st", "2nd"); empty otherwise. */
  alternateEndings: number[];
  /** A rehearsal marker: "A Intro", "Verse 1". Shown above the bar. */
  section?: string;
  /** Where a jump can land: Segno, Coda, DoubleCoda, SegnoSegno, Fine. */
  targets: string[];
  /** Jumps taken at the end of this bar: DaCapo, DaSegnoAlCoda, DaCoda… */
  jumps: string[];
  /** What the bar carries that the tab won't show, by name: "fermata". */
  unsupported: string[];
}

export interface GpTrack {
  name: string;
  /** MIDI pitches, lowest string first. Empty for a track that isn't a stringed instrument. */
  tuning: number[];
  capo: number;
  /** One per master bar; each a list of voices, each a list of beats in order. */
  bars: GpBeat[][][];
}

/** A note value: 1 whole, 2 half, 4 quarter … 128. */
export type GpNoteValue = 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128;

export interface GpRhythm {
  value: GpNoteValue;
  dots: number;
  /** `num` notes in the time of `den`: an eighth triplet is 3 in 2. */
  tuplet?: { num: number; den: number };
}

export interface GpBeat {
  rhythm: GpRhythm;
  /** A grace beat takes no time; it belongs to the beat after it. */
  grace?: 'before-beat' | 'on-beat';
  pickStroke?: 'down' | 'up';
  /** None is a rest. */
  notes: GpNote[];
  /** Free text written at this beat: "Palm muted run". */
  text?: string;
  unsupported: string[];
}

/** Slide flags as the file stores them; several can be set at once. */
export const GP_SLIDE = {
  shift: 1,
  legato: 2,
  outDown: 4,
  outUp: 8,
  inBelow: 16,
  inAbove: 32,
} as const;

export interface GpNote {
  string: number;
  fret: number;
  /** Continues the note before it on this string. */
  tied: boolean;
  /** `GP_SLIDE` flags, on the note a slide leaves from. */
  slide: number;
  /** The second note of a hammer-on or pull-off. */
  hopoDestination: boolean;
  /** Techniques that belong to this note alone. */
  techniques: Technique[];
  harmonic?: Harmonic;
  bend?: Bend;
  unsupported: string[];
}
