import { create } from 'zustand';
import type { KeyMode } from '@/domain/music';
import { canonicalKeyMode, pitchClass } from '@/domain/music';
import {
  coverageCounts,
  createRepositories,
  db,
  type BackingChoice,
  type BackingQuery,
  type Exercise,
  type Routine,
  type Settings,
} from '@/data';
import { effectiveTempo, speedFor, stepSpeed } from '@/domain/backing';
import type { Instrument } from '@/domain/instrument';
// Type only: the engine itself is imported lazily, so Tone loads on first use.
import type { AudioEngine } from '@/audio';
import type * as AudioModuleNs from '@/audio';
type AudioModule = typeof AudioModuleNs;
import type { CoverageCounts } from '@/domain/variation';
import { AXIS_IDS } from '@/domain/variation';
import { answerWeights } from '@/domain/progress';
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
import { useVideos } from './videos';
import { NO_BACKING, resolveFor, sameResolution, type BackingState } from './backing';

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
  /** The track or drone playing instead of the synth notes, if one was chosen. */
  backing: BackingState;
  /** What the backing menu is choosing for: the exercise, or the routine. */
  backingFor: { choice: BackingChoice; query: Omit<BackingQuery, 'keyMode'> } | null;

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
  /** None, the drone, or a track — remembered on the exercise or routine. */
  chooseBacking: (choice: BackingChoice) => Promise<void>;
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

/** A theory drill's leanings, from the last 30 days of its answers. */
async function loadSubjectWeights(exerciseId: string): Promise<Record<string, number>> {
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = await createRepositories(db()).reps.byExercise(exerciseId, 200);
  return answerWeights(recent.filter((rep) => rep.startedAt >= since));
}

/**
 * What to do with the audio as each pass starts. Shared by a single exercise
 * and a routine: they differ in what drives them, not in how they sound.
 */
function soundFor(
  engine: AudioEngine,
  instrument: Instrument,
  backing: () => BackingState['resolved']['kind'],
) {
  return ({ phrase, countInTicks, freeTime, continuation, countInFrom }: RepStartInfo) => {
    // A track or the drone plays instead of the notes. Under a track the
    // recording is the click and the count-in, so the metronome says nothing.
    const notes = backing() === 'none' ? phrase : null;
    engine.metronome.setSilenced(backing() === 'video');
    if (continuation) {
      // Straight on from the last pass or item: the clock and the click never
      // stopped, so only the notes need scheduling again — and a count-in in
      // the middle of the clock needs to click even when the metronome is off.
      if (countInFrom !== undefined) engine.metronome.countInBetween(countInFrom, countInTicks);
      engine.phrase.clear();
      if (notes) engine.phrase.load(notes, instrument, countInTicks);
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
    if (notes) engine.phrase.load(notes, instrument, countInTicks);
  };
}

let audio: AudioModule | null = null;
/** A second press of Play while YouTube is still starting must not start twice. */
let starting = false;

function rollSessionKeyMode(): KeyMode {
  // Standalone practice has no routine to inherit a key from, so the exercise's
  // own key axis decides. This is only the fallback for exercises that do not
  // roll one.
  return canonicalKeyMode({ tonic: pitchClass('C'), mode: 'ionian' });
}

export const usePractice = create<PracticeState>((set, get) => {
  /**
   * Work out what the chosen backing means in the current key, and make or
   * drop its source to match. Cheap and idempotent: called after anything that
   * can move the key or change the choice.
   */
  let refreshing = false;
  const refreshBacking = () => {
    // Setting the tempo below makes the runner emit, which lands back here.
    if (refreshing) return;
    refreshing = true;
    try {
      refreshBackingNow();
    } finally {
      refreshing = false;
    }
  };
  const refreshBackingNow = () => {
    const { runner, routine, backing, backingFor } = get();
    if (!backingFor || !audio) return;
    const keyMode = routine ? routine.snapshot.keyMode : runner?.snapshot.keyMode;
    if (!keyMode) return;
    const { options, resolved } = resolveFor(useVideos.getState().videos, backingFor.choice, {
      ...backingFor.query,
      keyMode,
    });
    let next: BackingState = { ...backing, choice: backingFor.choice, options, resolved };

    if (sameResolution(backing.resolved, resolved) && (backing.source || resolved.kind === 'none')) {
      if (backing.source instanceof audio.Drone) backing.source.setKeyMode(keyMode);
      set({ backing: next });
      return;
    }

    backing.source?.dispose();
    next = { ...next, source: null, player: null, error: null };
    const snapshot = runner?.snapshot;
    let tempo: number | null = null;
    // Leaving a track: back to the tempo from before it took over.
    if (backing.resolved.kind === 'video' && resolved.kind !== 'video' && backing.tempoBefore !== null) {
      tempo = backing.tempoBefore;
      next.tempoBefore = null;
    }

    if (resolved.kind === 'drone') {
      next.source = new audio.Drone(keyMode);
    } else if (resolved.kind === 'video' && resolved.video.bpm !== undefined) {
      const { video } = resolved;
      const bpm = video.bpm!;
      const source = new audio.VideoBacking(
        {
          videoId: video.videoId,
          startSec: video.startSec,
          bpm,
          beatsPerBar: video.beatsPerBar,
          ...(video.endSec !== undefined ? { endSec: video.endSec } : {}),
        },
        audio.getAudioEngine().clock,
      );
      source.player.ready.catch((e: unknown) => {
        if (get().backing.source === source) {
          set({ backing: { ...get().backing, error: (e as Error).message } });
        }
      });
      // The track takes the tempo over, at the speed nearest the one you had.
      const before =
        next.tempoBefore ?? snapshot?.currentTempo ?? snapshot?.targetTempo ?? bpm;
      const speed = speedFor(before, bpm);
      source.setRate(speed);
      tempo = effectiveTempo(bpm, speed);
      next = { ...next, source, player: source.player, speed, tempoBefore: before };
    }
    set({ backing: next });
    if (tempo !== null) runner?.setTempo(tempo);
  };

  /** A track's speed, and the tempo that comes out of it. */
  const applySpeed = (speed: number) => {
    const { backing, runner } = get();
    if (backing.resolved.kind !== 'video' || !backing.source) return;
    backing.source.setRate(speed);
    runner?.setTempo(effectiveTempo(backing.resolved.video.bpm ?? 0, speed));
    set({ backing: { ...backing, speed } });
  };

  /** Start the backing ahead of the clock. A track that will not start is dropped, said so. */
  const startBacking = async (countInTicks: number) => {
    const { backing } = get();
    if (!backing.source) return;
    try {
      await backing.source.start(countInTicks);
    } catch (e) {
      backing.source.dispose();
      set({
        backing: {
          ...backing,
          source: null,
          player: null,
          resolved: { kind: 'none', dropped: false },
          error: (e as Error).message,
        },
      });
    }
  };

  return {
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
    backing: NO_BACKING,
    backingFor: null,

    async prepare(exercise) {
      await get().end();

      const definition = exerciseDefinition(exercise.definitionId);
      const repos = createRepositories(db());

      // Constructing the engine is safe without a gesture; only starting it is
      // not, and that happens in `play`.
      audio = await import('@/audio');
      const engine = audio.getAudioEngine();
      if (!useVideos.getState().loaded) await useVideos.getState().load();

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
        ...(definition.kind === 'theory'
          ? { subjectWeights: await loadSubjectWeights(exercise.id) }
          : {}),
        now: () => Date.now(),

        onRepStart: soundFor(engine, settings.instrument, () => get().backing.resolved.kind),

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
          get().backing.source?.stop();
        }
        // A re-roll can move the key out from under a track.
        if (snapshot.state === 'brief' && get().runner === runner) refreshBacking();
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
        backingFor: {
          choice: exercise.backing ?? { kind: 'none' },
          query: {
            exerciseId: exercise.id,
            ...(exercise.backingCriteria ? { criteria: exercise.backingCriteria } : {}),
          },
        },
      });
      refreshBacking();
    },

    async prepareRoutine(routine) {
      await get().end();
      const repos = createRepositories(db());
      audio = await import('@/audio');
      const engine = audio.getAudioEngine();
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
      const items: RoutineRunItem[] = [];
      for (const item of routine.items) {
        const definition = findExerciseDefinition(item.definitionId);
        if (!definition) continue;
        items.push(
          definition.kind === 'theory'
            ? { ...item, definition, subjectWeights: await loadSubjectWeights(item.exerciseId) }
            : { ...item, definition },
        );
      }

      const runner = new RoutineRunner({
        clock: engine.clock,
        instrument: settings.instrument,
        sessionId: session.id,
        items,
        sessionAxisPolicies: routine.sessionAxisPolicies,
        countInBars: settings.audio.countInBars,
        loop: settings.audio.loop,
        now: () => Date.now(),
        onRepStart: soundFor(engine, settings.instrument, () => get().backing.resolved.kind),
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
      if (!runner || starting) return;
      const phrase = runner.currentPhrase;
      const snapshot = runner.snapshot;
      // The backing starts first and the clock follows it: YouTube takes a few
      // hundred milliseconds to get going, and nothing should count from the click.
      const countIn =
        snapshot.freeTime || !phrase
          ? 0
          : ticksPerBar(phrase.timeSignature) * useSettings.getState().settings.audio.countInBars;
      starting = true;
      try {
        await startBacking(countIn);
      } finally {
        starting = false;
      }
      runner.begin();
    },

    pause: () => {
      const { runner, backing } = get();
      if (runner?.snapshot.state !== 'playing' && runner?.snapshot.state !== 'count-in') return;
      runner.pause();
      backing.source?.pause();
    },
    resume: () => {
      const { runner, backing } = get();
      if (runner?.snapshot.state !== 'paused') return;
      void (async () => {
        await backing.source?.resume().catch(() => undefined);
        runner.resume();
      })();
    },
    setTempo: (bpm) => {
      const { backing, runner } = get();
      if (backing.resolved.kind === 'video' && backing.resolved.video.bpm) {
        applySpeed(speedFor(bpm, backing.resolved.video.bpm));
      } else runner?.setTempo(bpm);
    },
    nudgeTempo: (delta) => {
      const { backing, runner } = get();
      // Under a track the tempo moves in the track's own steps: 5% of its speed.
      if (backing.resolved.kind === 'video') applySpeed(stepSpeed(backing.speed, Math.sign(delta)));
      else runner?.nudgeTempo(delta);
    },
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

    async chooseBacking(choice) {
      const { backingFor, exerciseId, routineId } = get();
      if (!backingFor) return;
      set({ backingFor: { ...backingFor, choice } });
      refreshBacking();
      if (exerciseId) {
        const { useExercises } = await import('./exercises');
        await useExercises.getState().update(exerciseId, { backing: choice });
      } else if (routineId) {
        const { useRoutines } = await import('./routines');
        await useRoutines.getState().setBacking(routineId, choice);
      }
    },

    async end() {
      const { runner, routine, sessionId, backing } = get();
      backing.source?.dispose();
      set({ backing: NO_BACKING, backingFor: null });
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
  };
});

export { newId };
