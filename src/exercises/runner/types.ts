import type { KeyMode } from '@/domain/music';
import type { Instrument } from '@/domain/instrument';
import type { CountInBars } from '@/domain/phrase';
import type { RolledVariation } from '@/domain/variation';
import type { FretTally } from '@/domain/progress';

/**
 * The runner's states.
 *
 * `brief` is "ready": the material is generated and shown, and nothing moves
 * until the player says so. A standalone exercise comes back here after every
 * pass, with the same variation, ready to play again. `done` is only reached
 * when a routine has had all the passes it asked for.
 */
export type RunnerState = 'idle' | 'brief' | 'count-in' | 'playing' | 'paused' | 'done';

export type RepOutcome = 'completed' | 'skipped' | 'abandoned';

/** What the runner produces when a rep ends. The caller persists it. */
export interface RepRecord {
  exerciseId: string;
  definitionId: string;
  index: number;
  startedAt: number;
  endedAt: number;
  tempo: number | null;
  freeTime: boolean;
  axes: Record<string, string>;
  seed: number;
  status: RepOutcome;
  /** Theory sets only. */
  score?: { correct: number; total: number };
  answers?: { subject: string; correct: boolean }[];
  /** Finished played passes: every note, by string and fret. */
  frets?: FretTally;
}

/** A finished theory set, as the screen shows it. */
export interface SetResult {
  correct: number;
  total: number;
  seconds: number;
}

export interface RunnerSnapshot {
  state: RunnerState;
  /** Passes finished since the exercise was opened, across every variation. */
  passesPlayed: number;
  /** Passes one press of Play runs before stopping: 1 standalone, the item's reps in a routine. */
  passes: number;
  /** Keep playing the same material until told to stop. */
  loop: boolean;
  /** The last theory set finished, for its summary. */
  lastSet: SetResult | null;
  variation: RolledVariation | null;
  /** Ticks into the phrase, with any count-in already discounted. */
  phraseTick: number;
  /**
   * Ticks played since this press of Play, across every pass of the run, with
   * count-ins discounted. 0 when nothing is under way — Stop puts it back.
   */
  runTicks: number;
  /** Ticks of count-in remaining, or 0. */
  countInRemaining: number;
  /** How long this exercise counts in for — its own setting, not the app's. */
  countInBars: CountInBars;
  currentTempo: number | null;
  targetTempo: number | null;
  freeTime: boolean;
  keyMode: KeyMode;
  instrument: Instrument;
}
