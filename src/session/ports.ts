import type { Repositories, Routine, RoutineItem, Settings, Exercise, Video } from '@/data';
import type { MetronomeVoiceId } from '@/domain/drums';
import type { Instrument } from '@/domain/instrument';
import type { RenderedPass } from '@/domain/backing';
import type { KeyMode } from '@/domain/music';
import type { Phrase, TimeSignature } from '@/domain/phrase';
import type { Clock } from '@/domain/time';
// Types only: the audio module is loaded lazily, so Tone stays off first paint.
// The store hands a session an `AudioPort` built from it once it has loaded.
import type { BackingSource, VideoTrack, YouTubePlayer } from '@/audio';

/**
 * The parts of the audio engine a session drives. The real one is the
 * `AudioEngine`; tests pass a fake over `FakeClock`.
 */
export interface AudioPort {
  readonly clock: Clock;
  readonly metronome: {
    start(): void;
    stop(): void;
    setSilenced(silenced: boolean): void;
    countInBetween(from: number, to: number): void;
  };
  readonly phrase: {
    load(phrase: Phrase, instrument: Instrument, atTick?: number): void;
    clear(): void;
  };
  configureMetronome(options: { timeSignature: TimeSignature; countInTicks: number }): void;
  /** What the metronome sounds through, for a phrase in this signature. Off counts in only. */
  setMetronomeVoice(id: MetronomeVoiceId, timeSignature: TimeSignature): void;
  /** Start downloading what a metronome can play, so it is in before Play. */
  preloadMetronome(id: MetronomeVoiceId): void;
  /** Must be called from a user gesture. */
  init(): Promise<void>;
  setMasterVolume(decibels: number): void;
  drone(keyMode: KeyMode): DroneSource;
  /** Bass and piano chords under the notes. Its samples start downloading on `load`. */
  generated(): GeneratedSource;
  /** A YouTube track kept in time with the clock. */
  track(track: VideoTrack): TrackSource;
}

export interface DroneSource extends BackingSource {
  setKeyMode(keyMode: KeyMode): void;
}

export interface GeneratedSource extends BackingSource {
  /**
   * Schedule a pass's bass and piano from `atTick`, its bar 1, dropping what
   * was scheduled for the last pass.
   */
  loadPass(pass: RenderedPass, atTick: number): void;
  /** Nothing scheduled, nothing ringing. */
  clear(): void;
}

export interface TrackSource extends BackingSource {
  /** For the screen to mount. */
  readonly player: YouTubePlayer;
}

/**
 * Everything a session reads and writes outside itself. Saves to an exercise
 * or a routine go through their stores, so the library never holds a stale
 * copy; reps and sessions go straight to the repositories.
 */
export interface SessionDeps {
  audio: AudioPort;
  repos: Repositories;
  videos: () => readonly Video[];
  settings: () => Settings;
  saveAudioSettings: (changes: Partial<Settings['audio']>) => Promise<void>;
  saveExercise: (id: string, changes: Partial<Exercise>) => Promise<void>;
  saveRoutine: (id: string, changes: Partial<Routine>) => Promise<void>;
  saveRoutineItem: (
    routineId: string,
    itemId: string,
    changes: Partial<RoutineItem>,
  ) => Promise<void>;
  now: () => number;
  /** A write that failed after the fact, with nobody left waiting on it. */
  onError?: (error: unknown) => void;
}
