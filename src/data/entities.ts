import type { KeyMode, ModeName, PitchClass } from '@/domain/music';
import type { Instrument } from '@/domain/instrument';
import type { CountInBars } from '@/domain/phrase';
import type { AxisPolicies } from '@/domain/variation';
import type { TempoConfig } from '@/domain/tempo';
import type { FretTally } from '@/domain/progress';

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

/**
 * A YouTube video: a backing track, or a reference video.
 *
 * Shared ones are backing tracks any exercise or routine can play along to,
 * offered where the session's key and mode match. An exercise's own are
 * offered to that exercise alone — a custom backing track when `playAlong` is
 * on, a lesson or demo to watch when it is off. Every video is equal: there is
 * no built-in flag, and all of them are edited, deleted and exported alike.
 */
export interface Video extends Row {
  /** The YouTube video id — not this row's id. */
  videoId: string;
  title: string;
  scope: VideoScope;
  /** Off makes an exercise's own video a reference video. Shared ones are always on. */
  playAlong: boolean;
  /** Seconds into the video where bar 1 begins, after any intro. */
  startSec: number;
  /** Where a loop jumps back from; the end of the video if absent. */
  endSec?: number;
  /** Required for a shared track. An exercise's own track without one fits any key. */
  keyMode?: KeyMode;
  /** The recording's own tempo. Required to play along. */
  bpm?: number;
  beatsPerBar: number;
  /** For display: "modal vamp", "ii-V-i", "12-bar blues". */
  progression?: string;
  /** Free-form style: "rock", "funk", "drums only". */
  tags: string[];
}

export type VideoScope = { kind: 'shared' } | { kind: 'exercise'; exerciseId: Uuid };

/**
 * What plays instead of the synth notes. None (or absent) is the synth playing
 * the notes, with the metronome. Never chosen automatically.
 */
export type BackingChoice = { kind: 'none' } | { kind: 'drone' } | { kind: 'video'; id: Uuid };

/** Narrows which shared tracks the backing menu offers. */
export interface BackingCriteria {
  /** Every one of these, compared without case. */
  tags: string[];
  bpm?: { min: number; max: number };
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
  /** How long it counts in for. Its own: a slow exercise wants less warning than a fast one. */
  countInBars?: CountInBars;
  /** Passes it starts with when added to a routine. Standalone practice has no reps. */
  defaultReps: number;
  /** Pinned to the top of the library. */
  favorite?: boolean;
  /** The backing last chosen for it; absent is the synth notes. */
  backing?: BackingChoice;
  backingCriteria?: BackingCriteria;
  notes?: string;
}

/**
 * One exercise in a routine, with its own copy of the settings.
 *
 * Copied from the exercise when added and independent afterwards, so the same
 * exercise can appear more than once — different params, different axes
 * pinned or held — without any of it touching the library's copy. Its passes
 * are logged against the exercise it came from: they are that exercise's
 * history.
 */
export interface RoutineItem {
  /** Stable within the routine, so reps can say which item played them. */
  id: Uuid;
  /** The exercise it was copied from. */
  exerciseId: Uuid;
  definitionId: string;
  /** Passes played back to back before the routine moves on. */
  reps: number;
  params: unknown;
  tempo: TempoConfig;
  /** Copied from the exercise, and its own afterwards. It counts this item in in a routine too. */
  countInBars?: CountInBars;
  axisPolicies: AxisPolicies;
  heldAxisValues: Record<string, string>;
}

export interface Routine extends Row {
  name: string;
  items: RoutineItem[];
  /** Key and mode, rolled once per run and shared by every item. */
  sessionAxisPolicies: AxisPolicies;
  /** Pinned to the top of the list. */
  favorite?: boolean;
  lastPlayedAt?: number;
  /** One track (or the drone) through the whole routine; shared tracks only. */
  backing?: BackingChoice;
  backingCriteria?: BackingCriteria;
}

export interface Session extends Row {
  routineId: Uuid | null;
  seed: number;
  startedAt: number;
  endedAt: number | null;
  sessionKey: PitchClass;
  sessionMode: ModeName;
}

/**
 * A theory set's result. How long it took is the rep's own start and end —
 * the player asked for a whole set to be timed, not each question.
 */
export interface RepScore {
  correct: number;
  total: number;
}

/** One theory question's outcome: what it was about, and whether it was right. */
export interface RepAnswer {
  subject: string;
  correct: boolean;
}

export interface Rep extends Row {
  sessionId: Uuid;
  /** The library exercise — for a routine item, the one it was copied from. */
  exerciseId: Uuid;
  /** Set when the pass was played as part of a routine. */
  routineItemId?: Uuid;
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
  /** Theory only: each question, so later practice can lean toward what you miss. */
  answers?: RepAnswer[];
  /** Finished played passes: every note, counted by string and fret. */
  frets?: FretTally;
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

/**
 * What the notes play on. The synth needs no download; piano and guitar are
 * samples under public/samples/. Bass samples are committed too, but guitar tab
 * reaches E6 and a bass sampler would stretch that into a chipmunk, so bass
 * waits for the generated backing (docs/plan/12-SOUNDS.md).
 */
export type VoiceId = 'synth' | 'piano' | 'guitar';

/** Light or dark. 'system' follows the computer, and changes when it does. */
export type Appearance = 'system' | 'light' | 'dark';

export interface Settings {
  key: 'settings';
  instrument: Instrument;
  audio: {
    metronomeEnabled: boolean;
    /**
     * The count-in for an exercise that has none of its own — rows made before
     * the count-in moved onto the exercise. Not shown in Settings any more.
     */
    countInBars: CountInBars;
    /** Keep playing the same material pass after pass. */
    loop: boolean;
    voice: VoiceId;
    masterVolumeDb: number;
  };
  practice: {
    defaultInterExerciseGapSec: number;
    revealBriefBeforeRep: boolean;
    defaultFretRange: { low: number; high: number };
    /**
     * Never rolled, anywhere: keys by pitch (spelled as majors, so Db covers
     * C#) and modes. A key or mode pinned or held on purpose still plays.
     */
    blockedKeys: string[];
    blockedModes: ModeName[];
  };
  ui: {
    showFingerings: boolean;
    showDegreesOnFretboard: boolean;
    /** The neck diagram beside a running exercise. Hiding it gives the tab the room. */
    showNeck: boolean;
    /** The circle of fifths under the neck while practicing, marking the key. */
    showCircle: boolean;
    /** The whole right-hand column beside the tab — the neck, the circle, a track. */
    showInfoColumn: boolean;
    /** Tab size, in steps from the default: positive is bigger. Bars per line follow. */
    tabZoom: number;
    /** Light or dark. 'system' follows the computer, and changes when it does. */
    appearance: Appearance;
  };
  updatedAt: number;
}
