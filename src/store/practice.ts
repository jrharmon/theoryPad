import { create } from 'zustand';
import type { KeyMode } from '@/domain/music';
import { canonicalKeyMode, pitchClass } from '@/domain/music';
import { coverageCounts, createRepositories, db, type Exercise, type Settings } from '@/data';
import type { CoverageCounts } from '@/domain/variation';
import { AXIS_IDS } from '@/domain/variation';
import type { ExerciseInstance } from '@/exercises/types';
import { exerciseDefinition } from '@/exercises/registry';
import { resolveParams } from '@/exercises/params';
import {
  ExerciseRunner,
  type Reconfiguration,
  type RepRecord,
  type RunnerSnapshot,
} from '@/exercises/runner';
import { ticksPerBar } from '@/domain/phrase';
import { newId } from '@/data';
import { useSettings } from './settings';

interface PracticeState {
  runner: ExerciseRunner | null;
  /** The configured exercise being practiced, so changes can be saved back to it. */
  exerciseId: string | null;
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
  reroll: () => void;
  /** Apply settings changed from the practice screen, and save them to the exercise. */
  reconfigure: (changes: Reconfiguration) => Promise<void>;
  /** Tear the runner down. Leaving the screen calls this; there is no End button. */
  end: () => Promise<void>;
  setFreeTime: (freeTime: boolean) => void;
  /** The transport's toggles. Remembered app-wide, and applied straight away. */
  setMetronome: (on: boolean) => Promise<void>;
  setCountIn: (on: boolean) => Promise<void>;
  setLoop: (on: boolean) => Promise<void>;
}

async function saveAudio(changes: Partial<Settings['audio']>) {
  const { settings, save } = useSettings.getState();
  await save({ audio: { ...settings.audio, ...changes } });
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
  exerciseId: null,
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

    const settings = useSettings.getState().settings;
    const { useExercises } = await import('./exercises');

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
      params: resolveParams(definition, exercise.params),
      tempo: exercise.tempo,
      ...(definition.defaults.tempoPlan ? { tempoPlan: definition.defaults.tempoPlan } : {}),
      passes: 1,
      loop: settings.audio.loop,
      countInBars: settings.audio.countInBars,
      heldAxisValues: exercise.heldAxisValues,
      axisPolicies: exercise.axisPolicies,
      coverage: await loadCoverage(exercise.id),
      now: () => Date.now(),

      onRepStart: ({ phrase, countInTicks, freeTime, continuation }) => {
        if (continuation) {
          // Straight on from the last pass: the clock and the click never
          // stopped, so only the notes need scheduling again.
          engine.phrase.clear();
          if (phrase) engine.phrase.load(phrase, settings.instrument, countInTicks);
          return;
        }
        engine.metronome.stop();
        engine.phrase.clear();
        if (freeTime) return;
        // The metronome always runs, muted or not: the count-in clicks either
        // way, and switching it mid-bar must not shift the beat.
        const audio = useSettings.getState().settings.audio;
        if (phrase) {
          const perBar = ticksPerBar(phrase.timeSignature);
          engine.configureMetronome({
            timeSignature: phrase.timeSignature,
            // The runner only ever counts in whole bars, from the 0–2 setting.
            countInBars: (perBar > 0 ? Math.round(countInTicks / perBar) : 0) as 0 | 1 | 2,
          });
        }
        engine.metronome.setMuted(!audio.metronomeEnabled);
        engine.metronome.start();
        // The phrase goes after the count-in, not at zero.
        if (phrase) engine.phrase.load(phrase, settings.instrument, countInTicks);
      },

      onRepEnd: (rep: RepRecord) => {
        void repos.reps.add({ ...rep, sessionId: session.id });
        // Remember what was rolled, so `hold` policies have something to hold.
        // Through the store rather than the repository: writing straight to the
        // database left the library holding a stale copy, so a held value never
        // appeared until a reload.
        void useExercises.getState().update(exercise.id, { heldAxisValues: rep.axes });
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
      exerciseId: exercise.id,
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
  reroll: () => get().runner?.reroll(),
  setFreeTime: (freeTime) => get().runner?.setFreeTime(freeTime),

  async reconfigure(changes) {
    const { runner, exerciseId } = get();
    if (!runner || !exerciseId) return;
    runner.reconfigure(changes);

    // Saved to the exercise too: the dialog is a shortcut to the config page,
    // not a separate, temporary set of settings.
    const { useExercises } = await import('./exercises');
    await useExercises.getState().update(exerciseId, {
      ...(changes.params !== undefined ? { params: changes.params } : {}),
      ...(changes.tempo ? { tempo: changes.tempo } : {}),
      ...(changes.axisPolicies ? { axisPolicies: changes.axisPolicies } : {}),
    });
  },

  async setMetronome(on) {
    const { getAudioEngine } = await import('@/audio');
    getAudioEngine().metronome.setMuted(!on);
    await saveAudio({ metronomeEnabled: on });
  },

  async setCountIn(on) {
    const bars = on ? 1 : 0;
    get().runner?.setCountInBars(bars);
    await saveAudio({ countInBars: bars });
  },

  async setLoop(on) {
    get().runner?.setLoop(on);
    await saveAudio({ loop: on });
  },

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

    set({ runner: null, exerciseId: null, snapshot: null, instance: null, sessionId: null });
  },
}));

export { newId };
