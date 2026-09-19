import type { AnyExerciseDefinition } from '../types';

/**
 * How a pass is timed — what play, loop and stop mean for one kind of
 * exercise. The runner asks this instead of checking what kind it is running,
 * so a new kind (ear training) is a new strategy, not a new set of branches.
 */
export interface PassTiming {
  readonly name: 'metered' | 'free' | 'set';
  /** Runs the clock: a count-in, a playhead, and an end scheduled at the end of the phrase. */
  readonly clock: boolean;
  /** Pausing means something. A set waits for you anyway. */
  readonly pausable: boolean;
  /** New material every pass, on the same variation: a theory set's questions. */
  readonly freshEachPass: boolean;
  /** Loop keeps it going, pass after pass. */
  readonly loops: boolean;
  /**
   * Another pass in the same run: straight on without stopping the clock, a
   * fresh set waiting to be answered, or none — back to ready (or `done`).
   */
  readonly again: 'straight-on' | 'wait' | 'none';
}

/** Against the metronome: counted in, ended by the clock, looping straight on. */
export const METERED: PassTiming = {
  name: 'metered',
  clock: true,
  pausable: true,
  freshEachPass: false,
  loops: true,
  again: 'straight-on',
};

/** In free time: no clock; the player says when a pass is done. */
export const FREE: PassTiming = {
  name: 'free',
  clock: false,
  pausable: true,
  freshEachPass: false,
  loops: false,
  again: 'none',
};

/** A theory set: no clock, ended by submitting it; the next pass is a fresh set. */
export const SET: PassTiming = {
  name: 'set',
  clock: false,
  pausable: false,
  freshEachPass: true,
  loops: false,
  again: 'wait',
};

/** The timing for a definition, with the player's free-time choice where it has one. */
export function passTiming(definition: AnyExerciseDefinition, freeTime: boolean): PassTiming {
  if (definition.kind === 'theory') return SET;
  if (definition.timing === 'free') return FREE;
  if (definition.timing === 'metronome') return METERED;
  return freeTime ? FREE : METERED;
}
