/**
 * What progress needs from a logged pass. The data layer's `Rep` satisfies
 * this structurally; the domain does not import the data layer.
 */
export interface LoggedRep {
  sessionId: string;
  exerciseId: string;
  definitionId: string;
  startedAt: number;
  endedAt: number | null;
  tempo: number | null;
  freeTime: boolean;
  axes: Record<string, string>;
  seed: number;
  status: 'completed' | 'skipped' | 'abandoned';
  score?: { correct: number; total: number };
  answers?: { subject: string; correct: boolean }[];
  frets?: FretTally;
}

/**
 * Every note a pass played, counted by where it was played. Keys are
 * `"string:fret"` with string 0 the lowest, as everywhere in the model.
 * `strings` says which instrument the counts belong to: a 7-string's lowest
 * string is not a 6-string's.
 */
export interface FretTally {
  strings: number;
  counts: Record<string, number>;
}

/** A local calendar day, `YYYY-MM-DD`. Days split at local midnight. */
export type DayKey = string;

/**
 * One day of practice, rolled up. A cache over the log: written in the same
 * transaction as each rep and rebuildable from the reps alone, so the
 * all-time views (every fret ever played, every key and mode) never scan the
 * whole log.
 */
export interface PracticeDay {
  date: DayKey;
  /** Every pass, finished or not: time at the instrument. */
  seconds: number;
  /** Finished passes and sets. A day with one of these keeps a streak alive. */
  passes: number;
  /** Finished passes per key and mode, keyed `"Bb dorian"`. */
  keyModes: Record<string, number>;
  /** Notes played on finished passes, per instrument string count. */
  frets: Record<string, Record<string, number>>;
}
