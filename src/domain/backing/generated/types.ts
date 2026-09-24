import type { DegreeNumber } from '../../music';

/** One chord of a progression, held for whole bars (at least one). */
export interface ProgressionStep {
  degree: DegreeNumber;
  bars: number;
}

/**
 * A progression as scale degrees, so it fits any key and mode: the chord
 * qualities come from the mode. `1 4` is i–IV in Dorian and i–iv in Aeolian.
 */
export type Progression = readonly ProgressionStep[];

export type ProgressionSource =
  | { kind: 'vamp' }
  | { kind: 'goTo' }
  | { kind: 'custom'; progressions: readonly Progression[] }; // at least one

export interface GeneratedBackingSettings {
  source: ProgressionSource;
  /** A pattern id from comps.ts. Keep ids once shipped: settings save them. */
  style: string;
  chords: 'sevenths' | 'triads';
}

/** One chord as the pass plays it. */
export interface ChordSpan {
  /** From the pass's bar 1. */
  startTick: number;
  durationTicks: number;
  degree: DegreeNumber;
  /** Spelled in the key: "Dm7", or "Dm" with triads. */
  symbol: string;
}
