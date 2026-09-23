import { create } from 'zustand';
import { repos, type BackingChoice, type Exercise, type Routine } from '@/data';
import type { MetronomeVoiceId } from '@/domain/drums';
import type { CountInBars } from '@/domain/phrase';
import type { Reconfiguration } from '@/exercises/runner';
import {
  ExerciseSession,
  NO_BACKING,
  RoutineSession,
  type AudioPort,
  type PracticeSession,
  type SessionDeps,
  type SessionState,
} from '@/session';
import { useExercises } from './exercises';
import { useRoutines } from './routines';
import { useSettings } from './settings';
import { useSounds } from './sounds';
import { useVideos } from './videos';

interface PracticeState extends SessionState {
  session: PracticeSession | null;
  /** The configured exercise being practiced; null in a routine. */
  exerciseId: string | null;
  /** The routine being practiced; null for a single exercise. */
  routineId: string | null;

  /** Open an exercise, rolled and shown. Nothing plays until `play`. */
  prepare: (exercise: Exercise) => Promise<void>;
  /** Roll a whole routine for its overview. Nothing plays until `play`. */
  prepareRoutine: (routine: Routine) => Promise<void>;
  /** Start the clock. Must be called from a click or keypress. */
  play: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  /** Back to the top of what is playing, ready to go again. In a routine, of this item. */
  stop: () => void;
  /** From the top straight away, counted in. Must be called from a click or keypress. */
  restart: () => Promise<void>;
  /** Move the playhead to a tick within the current pass — a note was clicked. */
  seekTo: (phraseTick: number) => void;
  setTempo: (bpm: number) => void;
  nudgeTempo: (delta: number) => void;
  completeRep: () => void;
  reroll: () => void;
  /** Routine only: move to the next item now. */
  skip: () => void;
  /** Theory: the set is answered. */
  submitSet: (answers: { subject: string; correct: boolean }[]) => void;
  /** Routine overview only: a fresh roll of everything, key and mode included. */
  rerollAll: () => void;
  /** Routine overview only: a fresh roll of one item. */
  rerollItem: (index: number) => void;
  /** Apply settings changed from the practice screen, and save them to the exercise. */
  reconfigure: (changes: Reconfiguration) => Promise<void>;
  /** Tear the session down. Leaving the screen calls this; there is no End button. */
  end: () => Promise<void>;
  setFreeTime: (freeTime: boolean) => void;
  /** The metronome for this exercise — or, in a routine, this item. Saved to it. */
  setMetronomeVoice: (id: MetronomeVoiceId) => Promise<void>;
  /** Off, or back to the last metronome that was on. */
  toggleMetronome: () => Promise<void>;
  /** Remembered app-wide, and applied straight away. */
  /** The count-in for this exercise — or, in a routine, this item. Saved to it. */
  setCountIn: (bars: CountInBars) => Promise<void>;
  setLoop: (on: boolean) => Promise<void>;
  /** None, the drone, or a track — remembered on the exercise or routine. */
  chooseBacking: (choice: BackingChoice) => Promise<void>;
}

async function audioPort(): Promise<AudioPort> {
  // Loaded on first use, so Tone stays off the first-paint path.
  const audio = await import('@/audio');
  // Constructing the engine is safe without a gesture; only starting it is not.
  const engine = audio.getAudioEngine();
  // The chosen voice starts downloading now, not on Play. Nothing waits for it:
  // the synth plays until it is in. Settings may not have loaded on a reload
  // straight into practice, and loading them twice is a no-op.
  await useSettings.getState().load();
  void useSounds.getState().choose(useSettings.getState().settings.audio.voice);
  return {
    clock: engine.clock,
    metronome: engine.metronome,
    phrase: engine.phrase,
    configureMetronome: (options) => engine.configureMetronome(options),
    setMetronomeVoice: (id, timeSignature) => engine.setMetronomeVoice(id, timeSignature),
    preloadMetronome: (id) => engine.preloadMetronome(id),
    init: () => engine.init(),
    setMasterVolume: (decibels) => engine.setMasterVolume(decibels),
    drone: (keyMode) => new audio.Drone(keyMode),
    track: (track) => new audio.VideoBacking(track, engine.clock),
  };
}

/** A session's world: the app's audio, database and stores. */
async function sessionDeps(): Promise<SessionDeps> {
  const audio = await audioPort();
  // Read the table again on every visit rather than only the first: another
  // tab can have added a track since, and the backing menu would not know.
  await useVideos.getState().load();
  return {
    audio,
    repos: repos(),
    videos: () => useVideos.getState().videos,
    settings: () => useSettings.getState().settings,
    saveAudioSettings: async (changes) => {
      const { settings, save } = useSettings.getState();
      await save({ audio: { ...settings.audio, ...changes } });
    },
    // Through the stores rather than the repositories: writing straight to the
    // database left the library holding a stale copy.
    saveExercise: (id, changes) => useExercises.getState().update(id, changes),
    saveRoutine: (id, changes) => useRoutines.getState().update(id, changes),
    saveRoutineItem: (id, itemId, changes) =>
      useRoutines.getState().updateItem(id, itemId, changes),
    now: () => Date.now(),
  };
}

const CLOSED = {
  session: null,
  exerciseId: null,
  routineId: null,
  runner: null,
  snapshot: null,
  instance: null,
  routineSnapshot: null,
  backing: NO_BACKING,
  audioReady: false,
  metronome: 'click',
} satisfies Partial<PracticeState>;

export const usePractice = create<PracticeState>((set, get) => {
  let unsubscribe: (() => void) | null = null;

  const attach = (session: PracticeSession) => {
    unsubscribe = session.subscribe((state) => set(state));
    set({
      ...session.state,
      session,
      exerciseId: session instanceof ExerciseSession ? session.exerciseId : null,
      routineId: session instanceof RoutineSession ? session.routineId : null,
    });
  };

  const exercise = () => {
    const { session } = get();
    return session instanceof ExerciseSession ? session : null;
  };
  const routine = () => {
    const { session } = get();
    return session instanceof RoutineSession ? session : null;
  };

  return {
    ...CLOSED,

    async prepare(exercise) {
      await get().end();
      attach(await ExerciseSession.open(exercise, await sessionDeps()));
    },

    async prepareRoutine(routine) {
      await get().end();
      attach(await RoutineSession.open(routine, await sessionDeps()));
    },

    play: () => get().session?.play() ?? Promise.resolve(),
    pause: () => get().session?.pause(),
    resume: () => void get().session?.resume(),
    stop: () => get().session?.stop(),
    restart: () => get().session?.restart() ?? Promise.resolve(),
    seekTo: (phraseTick) => get().session?.seekTo(phraseTick),
    setTempo: (bpm) => get().session?.setTempo(bpm),
    nudgeTempo: (delta) => get().session?.nudgeTempo(delta),
    completeRep: () => get().session?.completeRep(),
    reroll: () => get().session?.reroll(),
    skip: () => routine()?.skip(),
    submitSet: (answers) => get().session?.submitSet(answers),
    rerollAll: () => routine()?.rerollAll(),
    rerollItem: (index) => routine()?.rerollItem(index),
    setFreeTime: (freeTime) => exercise()?.setFreeTime(freeTime),
    reconfigure: (changes) => exercise()?.reconfigure(changes) ?? Promise.resolve(),
    setCountIn: (bars) => get().session?.setCountIn(bars) ?? Promise.resolve(),
    setLoop: (on) => get().session?.setLoop(on) ?? Promise.resolve(),
    chooseBacking: (choice) => get().session?.chooseBacking(choice) ?? Promise.resolve(),

    setMetronomeVoice: (id) => get().session?.setMetronomeVoice(id) ?? Promise.resolve(),
    toggleMetronome: () => get().session?.toggleMetronome() ?? Promise.resolve(),

    async end() {
      const { session } = get();
      unsubscribe?.();
      unsubscribe = null;
      set(CLOSED);
      await session?.end();
    },
  };
});
