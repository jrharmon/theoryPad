import type { KeyMode } from '@/domain/music';
import type { Instrument } from '@/domain/instrument';
import type { RolledVariation } from '@/domain/variation';

/**
 * The runner's states.
 *
 * `brief` has no countdown of its own: the design is emphatic that the whole
 * rolled variation is revealed and read before anything starts moving.
 */
export type RunnerState =
  | 'idle'
  | 'brief'
  | 'count-in'
  | 'playing'
  | 'paused'
  | 'rep-complete'
  | 'done';

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
}

export interface RunnerSnapshot {
  state: RunnerState;
  /** 0-based rep being played. */
  repIndex: number;
  totalReps: number;
  variation: RolledVariation | null;
  /** Ticks into the phrase, with any count-in already discounted. */
  phraseTick: number;
  /** Ticks of count-in remaining, or 0. */
  countInRemaining: number;
  currentTempo: number | null;
  targetTempo: number | null;
  freeTime: boolean;
  keyMode: KeyMode;
  instrument: Instrument;
}
