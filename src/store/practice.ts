import { create } from 'zustand';
import type { KeyMode } from '@/domain/music';
import { canonicalKeyMode, pitchClass } from '@/domain/music';
import { coverageCounts, createRepositories, db, type Exercise } from '@/data';
import type { CoverageCounts } from '@/domain/variation';
import { AXIS_IDS } from '@/domain/variation';
import type { ExerciseInstance } from '@/exercises/types';
import { exerciseDefinition } from '@/exercises/registry';
import { ExerciseRunner, type RepRecord, type RunnerSnapshot } from '@/exercises/runner';
import { newId } from '@/data';

interface PracticeState {
  runner: ExerciseRunner | null;
  snapshot: RunnerSnapshot | null;
  instance: ExerciseInstance | null;
  /** Ticks into the phrase; polled on rAF so playback does not re-render. */
  sessionId: string | null;
  audioReady: boolean;
  error: string | null;

  /**
   * Roll a variation and generate the material, without touching audio.
   *
   * Split from `play` because the AudioContext can only start from a user
   * gesture, and opening an exercise is not one. This lets the screen show the
   * brief, the tab and the neck the moment you arrive, with nothing to click
   * through first.
   */
  prepare: (exercise: Exercise) => Promise<void>;
  /** Start the clock. Must be called from a click or keypress. */
  play: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  setTempo: (bpm: number) => void;
  nudgeTempo: (delta: number) => void;
  completeRep: () => void;
  skipRep: () => void;
  reroll: () => void;
  end: () => Promise<void>;
  setFreeTime: (freeTime: boolean) => void;
}

/** Recent rolls, so the roller can push toward ground you have not covered. */
async function loadCoverage(exerciseId: string): Promise<CoverageCounts> {
  const repos = createRepositories(db());
  const recent = await repos.reps.byExercise(exerciseId, 60);
  const counts: CoverageCounts = {};
  for (const axis of AXIS_IDS) {
    const values = coverageCounts(recent, axis);
    if (Object.keys(values).length > 0) counts[axis] = values;
  }
  return counts;
}

function rollSessionKeyMode(): KeyMode {
  // Standalone practice has no routine to inherit a key from, so the exercise's
  // own key axis decides. This is only the fallback for exercises that do not
  // roll one.
  return canonicalKeyMode({ tonic: pitchClass('C'), mode: 'ionian' });
}

export const usePractice = create<PracticeState>((set, get) => ({
  runner: null,
  snapshot: null,
  instance: null,
  sessionId: null,
  audioReady: false,
  error: null,

  async prepare(exercise) {
    await get().end();

    const definition = exerciseDefinition(exercise.definitionId);
    const repos = createRepositories(db());

    // Constructing the engine is safe without a gesture; only starting it is
    // not, and that happens in `play`.
    const { getAudioEngine } = await import('@/audio');
    const engine = getAudioEngine();

    const { useSettings } = await import('./settings');
    const settings = useSettings.getState().settings;

    const session = await repos.sessions.add({
      routineId: null,
      seed: Math.floor(Date.now() % 2 ** 31),
      startedAt: Date.now(),
      endedAt: null,
      sessionKey: rollSessionKeyMode().tonic,
      sessionMode: rollSessionKeyMode().mode,
    });

    const runner = new ExerciseRunner({
      clock: engine.clock,
      definition,
      exerciseId: exercise.id,
      instrument: settings.instrument,
      sessionId: session.id,
      sessionKeyMode: rollSessionKeyMode(),
      params: exercise.params,
      tempo: exercise.tempo,
      ...(definition.defaults.tempoPlan ? { tempoPlan: definition.defaults.tempoPlan } : {}),
      reps: exercise.defaultReps,
      countInBars: settings.audio.countInBars,
      heldAxisValues: exercise.heldAxisValues,
      axisPolicies: exercise.axisPolicies,
      coverage: await loadCoverage(exercise.id),
      now: () => Date.now(),

      onRepStart: ({ phrase, countInTicks, freeTime }) => {
        engine.metronome.stop();
        engine.phrase.clear();
        if (freeTime) return;
        if (settings.audio.metronomeEnabled) engine.metronome.start();
        // The phrase goes after the count-in, not at zero.
        if (phrase) engine.phrase.load(phrase, settings.instrument, countInTicks);
      },

      onRepEnd: (rep: RepRecord) => {
        void repos.reps.add({ ...rep, sessionId: session.id });
        // Remember what was rolled, so `hold` policies have something to hold.
        void repos.exercises.update(exercise.id, { heldAxisValues: rep.axes });
      },
    });

    runner.subscribe((snapshot) => {
      set({ snapshot, instance: runner.currentInstance });
      if (snapshot.state === 'brief' || snapshot.state === 'done') {
        engine.metronome.stop();
        engine.phrase.clear();
      }
    });

    runner.start();
    set({
      runner,
      sessionId: session.id,
      audioReady: false,
      error: null,
      snapshot: runner.snapshot,
      instance: runner.currentInstance,
    });
  },

  async play() {
    const runner = get().runner;
    if (!runner) return;

    // This call is inside the click handler's task, which is what lets the
    // AudioContext start. Getting that wrong is the classic silent-app bug.
    const { getAudioEngine } = await import('@/audio');
    const engine = getAudioEngine();
    await engine.init();
    set({ audioReady: true });

    runner.begin();
  },

  pause: () => get().runner?.pause(),
  resume: () => get().runner?.resume(),
  setTempo: (bpm) => get().runner?.setTempo(bpm),
  nudgeTempo: (delta) => get().runner?.nudgeTempo(delta),
  completeRep: () => get().runner?.completeRep(),
  skipRep: () => get().runner?.skipRep(),
  reroll: () => get().runner?.reroll(),
  setFreeTime: (freeTime) => get().runner?.setFreeTime(freeTime),

  async end() {
    const { runner, sessionId } = get();
    if (!runner) return;

    runner.end();
    const { getAudioEngine } = await import('@/audio');
    const engine = getAudioEngine();
    engine.metronome.stop();
    engine.phrase.clear();
    engine.clock.stop();

    if (sessionId) {
      const repos = createRepositories(db());
      await repos.sessions.end(sessionId, Date.now());
    }

    set({ runner: null, snapshot: null, instance: null, sessionId: null });
  },
}));

export { newId };
