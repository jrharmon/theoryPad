import type { TimeSignature } from '../phrase';

/** One sample in the kit, under public/samples/v1/kit/. */
export type DrumSound =
  'kick' | 'snare' | 'hat-closed' | 'hat-open' | 'ride' | 'crash' | 'stick';

export const DRUM_SOUNDS: readonly DrumSound[] = [
  'kick',
  'snare',
  'hat-closed',
  'hat-open',
  'ride',
  'crash',
  'stick',
];

export interface DrumHit {
  sound: DrumSound;
  /** Ticks from the start of the bar. */
  tick: number;
  /** 0–1. */
  velocity: number;
}

/**
 * A beat that does the metronome's job. Not a backing source: it follows the
 * clock, never owns the tempo, and plays under the notes (docs/plan/12-SOUNDS.md).
 */
export interface DrumPattern {
  id: string;
  name: string;
  /** A one-line description for the menu. */
  detail: string;
  /** Null fits any signature; otherwise the pattern is only offered for this one. */
  timeSignature: TimeSignature | null;
  /** The grid the metronome must schedule it on: every hit lands on a multiple of it. */
  gridTicks(timeSignature: TimeSignature): number;
  /** One bar of hits, in tick order. `barIndex` lets a pattern crash every fourth bar. */
  bar(timeSignature: TimeSignature, barIndex: number): DrumHit[];
}
