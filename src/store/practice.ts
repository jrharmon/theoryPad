import { create } from 'zustand';
import type { KeyMode } from '@/domain/music';
import { canonicalKeyMode, pitchClass } from '@/domain/music';
import {
  coverageCounts,
  createRepositories,
  db,
  type Exercise,
  type Routine,
  type Settings,
} from '@/data';
import type { Instrument } from '@/domain/instrument';
// Type only: the engine itself is imported lazily, so Tone loads on first use.
import type { AudioEngine } from '@/audio';
import type { CoverageCounts } from '@/domain/variation';
import { AXIS_IDS } from '@/domain/variation';
import type { ExerciseInstance } from '@/exercises/types';
import { exerciseDefinition, findExerciseDefinition } from '@/exercises/registry';
import { resolveParams } from '@/exercises/params';
import {
  ExerciseRunner,
  RoutineRunner,
  type Reconfiguration,
  type RepRecord,
  type RepStartInfo,
  type RoutineRunItem,
  type RoutineSnapshot,
  type RunnerSnapshot,
} from '@/exercises/runner';
import { ticksPerBar } from '@/domain/phrase';
import { newId } from '@/data';
import { useSettings } from './settings';

interface PracticeState {
  /** The exercise being played — in a routine, the current item's. */
  runner: ExerciseRunner | null;
  /** Set when practicing a routine rather than one exercise. */
  routine: RoutineRunner | null;
  routineId: string | null;
  routineSnapshot: RoutineSnapshot | null;
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
  /** Roll a whole routine for its overview. Nothing plays until `play`. */
  prepareRoutine: (routine: Routine) => Promise<void>;
  /** Start the clock. Must be called from a click or keypress. */
  play: () => Promise<void>;
  pause: () => void;
  resume: () => void;
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

/**
 * What to do with the audio as each pass starts. Shared by a single exercise
 * and a routine: they differ in what drives them, not in how they sound.
 */
function soundFor(engine: AudioEngine, instrument: Instrument) {
  return ({ phrase, countInTicks, freeTime, continuation, countInFrom }: RepStartInfo) => {
    if (continuation) {
      // Straight on from the last pass or item: the clock and the click never
      // stopped, so only the notes need scheduling again — and a count-in in
      // the middle of the clock needs to click even when the metronome is off.
      if (countInFrom !== undefined) engine.metronome.countInBetween(countInFrom, countInTicks);
      engine.phrase.clear();
      if (phrase) engine.phrase.load(phrase, instrument, countInTicks);
      return;
    }
    engine.metronome.stop();
    engine.phrase.clear();
    if (freeTime) return;
    // The metronome always runs, muted or not: the count-in clicks either way,
    // and switching it mid-bar must not shift the beat.
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
    if (phrase) engine.phrase.load(phrase, instrument, countInTicks);
  };
}

function rollSessionKeyMode(): KeyMode {
  // Standalone practice has no routine to inherit a key from, so the exercise's
  // own key axis decides. This is only the fallback for exercises that do not
  // roll one.
  return canonicalKeyMode({ tonic: pitchClass('C'), mode: 'ionian' });
}

export const usePractice = create<PracticeState>((set, get) => ({
  runner: null,
  routine: null,
  routineId: null,
  routineSnapshot: null,
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

      onRepStart: soundFor(engine, settings.instrument),

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

  async prepareRoutine(routine) {
    await get().end();
    const repos = createRepositories(db());
    const { getAudioEngine } = await import('@/audio');
    const engine = getAudioEngine();
    const settings = useSettings.getState().settings;
    const { useRoutines } = await import('./routines');

    const session = await repos.sessions.add({
      routineId: routine.id,
      seed: Math.floor(Date.now() % 2 ** 31),
      startedAt: Date.now(),
      endedAt: null,
      sessionKey: rollSessionKeyMode().tonic,
      sessionMode: rollSessionKeyMode().mode,
    });

    // An item whose exercise no longer exists in code is left out rather than
    // failing the whole routine.
    const items: RoutineRunItem[] = routine.items.flatMap((item) => {
      const definition = findExerciseDefinition(item.definitionId);
      return definition ? [{ ...item, definition }] : [];
    });

    const runner = new RoutineRunner({
      clock: engine.clock,
      instrument: settings.instrument,
      sessionId: session.id,
      items,
      sessionAxisPolicies: routine.sessionAxisPolicies,
      countInBars: settings.audio.countInBars,
      loop: settings.audio.loop,
      now: () => Date.now(),
      onRepStart: soundFor(engine, settings.instrument),
      onRepEnd: (rep) => {
        // Logged against the exercise the item came from — its history — and
        // the item remembers what it rolled, for its own `hold` policies.
        void repos.reps.add({ ...rep, sessionId: session.id });
        void useRoutines
          .getState()
          .updateItem(routine.id, rep.routineItemId, { heldAxisValues: rep.axes });
      },
    });

    runner.subscribe((snapshot) => {
      const current = runner.current;
      set({
        routineSnapshot: snapshot,
        runner: current,
        snapshot: snapshot.current,
        instance: current?.currentInstance ?? null,
      });
      if (snapshot.phase === 'done' || snapshot.current?.state === 'brief') {
        engine.metronome.stop();
        engine.phrase.clear();
      }
    });

    runner.open();
    set({
      routine: runner,
      routineId: routine.id,
      sessionId: session.id,
      exerciseId: null,
      audioReady: false,
      error: null,
    });
  },

  async play() {
    const { runner, routine, routineId } = get();
    if (!runner && !routine) return;

    // This call is inside the click handler's task, which is what lets the
    // AudioContext start. Getting that wrong is the classic silent-app bug.
    const { getAudioEngine } = await import('@/audio');
    const engine = getAudioEngine();
    await engine.init();
    engine.setMasterVolume(useSettings.getState().settings.audio.masterVolumeDb);
    set({ audioReady: true });

    if (routine) {
      if (routine.snapshot.phase === 'overview' && routineId) {
        const { useRoutines } = await import('./routines');
        void useRoutines.getState().markPlayed(routineId, Date.now());
      }
      routine.play();
      return;
    }
    runner?.begin();
  },

  pause: () => get().runner?.pause(),
  resume: () => get().runner?.resume(),
  setTempo: (bpm) => get().runner?.setTempo(bpm),
  nudgeTempo: (delta) => get().runner?.nudgeTempo(delta),
  completeRep: () => get().runner?.completeRep(),
  reroll: () => {
    const { routine, runner } = get();
    if (routine) routine.rerollCurrent();
    else runner?.reroll();
  },
  skip: () => get().routine?.skip(),
  submitSet: (answers) => get().runner?.submitSet({ answers }),
  rerollAll: () => get().routine?.rerollAll(),
  rerollItem: (index) => get().routine?.rerollItem(index),
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
    const { routine, runner } = get();
    if (routine) routine.setCountInBars(bars);
    else runner?.setCountInBars(bars);
    await saveAudio({ countInBars: bars });
  },

  async setLoop(on) {
    const { routine, runner } = get();
    if (routine) routine.setLoop(on);
    else runner?.setLoop(on);
    await saveAudio({ loop: on });
  },

  async end() {
    const { runner, routine, sessionId } = get();
    if (!runner && !routine) return;

    if (routine) routine.end();
    else runner?.end();
    const { getAudioEngine } = await import('@/audio');
    const engine = getAudioEngine();
    engine.metronome.stop();
    engine.phrase.clear();
    engine.clock.stop();

    if (sessionId) {
      const repos = createRepositories(db());
      await repos.sessions.end(sessionId, Date.now());
    }

    set({
      runner: null,
      routine: null,
      routineId: null,
      routineSnapshot: null,
      exerciseId: null,
      snapshot: null,
      instance: null,
      sessionId: null,
    });
  },
}));

export { newId };
