import type { ModeName, PitchClass } from '@/domain/music';
import type { Instrument } from '@/domain/instrument';
import type { AxisPolicies } from '@/domain/variation';
import type { TempoConfig } from '@/domain/tempo';

export type Uuid = string;

/**
 * Every row carries a client-generated id, timestamps, and a soft delete.
 *
 * That is three fields, and it is what makes a sync backend a later adapter
 * rather than a migration: two devices can create rows without colliding,
 * last-write-wins has something to compare, and deletions can propagate.
 */
export interface Row {
  id: Uuid;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface VideoRef {
  provider: 'youtube';
  videoId: string;
  startSec?: number;
  endSec?: number;
  title?: string;
}

/**
 * A configured instance of a definition. This is what appears in routines.
 *
 * It holds only what is *yours* — how the exercise is set up. What the exercise
 * *is* (name, tags, summary, which axes it varies) lives in code, on the
 * definition this points at, and is read through rather than copied. A copy
 * drifts: when the definition was renamed, every row kept the old name until it
 * was reset.
 */
export interface Exercise extends Row {
  definitionId: string;
  params: unknown;
  axisPolicies: AxisPolicies;
  /** Remembered values for axes set to `hold`. */
  heldAxisValues: Record<string, string>;
  tempo: TempoConfig;
  defaultReps: number;
  video?: VideoRef;
  notes?: string;
}

export interface Session extends Row {
  routineId: Uuid | null;
  seed: number;
  startedAt: number;
  endedAt: number | null;
  sessionKey: PitchClass;
  sessionMode: ModeName;
}

export interface RepScore {
  correct: number;
  total: number;
  medianSecPerQuestion: number;
}

export interface Rep extends Row {
  sessionId: Uuid;
  exerciseId: Uuid;
  definitionId: string;
  /** Rep number within this exercise in this session. */
  index: number;
  startedAt: number;
  endedAt: number | null;
  /** The tempo actually used. Null in free time. */
  tempo: number | null;
  freeTime: boolean;
  /** Resolved axis value keys, denormalised for querying. */
  axes: Record<string, string>;
  seed: number;
  status: 'completed' | 'skipped' | 'abandoned';
  score?: RepScore;
}

/**
 * All-time aggregates, maintained alongside the reps that produce them.
 *
 * Windowed questions ("this week") are indexed queries over `reps`. All-time
 * ones ("every position I have ever rolled") have no bounded window, so they
 * read this instead — written in the same transaction as the rep, and fully
 * rebuildable from the log.
 */
export interface ExerciseStats {
  exerciseId: Uuid;
  definitionId: string;
  repCount: number;
  totalSeconds: number;
  firstPlayedAt: number | null;
  lastPlayedAt: number | null;
  /** Every distinct value ever rolled, per axis. */
  axisValuesSeen: Record<string, string[]>;
  questionsAnswered: number;
  questionsCorrect: number;
  updatedAt: number;
}

export interface Settings {
  key: 'settings';
  instrument: Instrument;
  audio: {
    metronomeEnabled: boolean;
    countInBars: 0 | 1 | 2;
    voice: 'synth' | 'sampled';
    masterVolumeDb: number;
  };
  practice: {
    defaultInterExerciseGapSec: number;
    revealBriefBeforeRep: boolean;
    defaultFretRange: { low: number; high: number };
  };
  ui: {
    showFingerings: boolean;
    showDegreesOnFretboard: boolean;
  };
  updatedAt: number;
}
