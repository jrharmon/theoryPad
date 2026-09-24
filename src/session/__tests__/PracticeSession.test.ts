import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TheoryPadDB,
  createRepositories,
  defaultSettings,
  type Exercise,
  newId,
  type NewExercise,
  type Repositories,
  type Routine,
  type RoutineItem,
  type Settings,
  type Video,
} from '@/data';
import {
  formatProgression,
  type GeneratedBackingSettings,
  type RenderedPass,
} from '@/domain/backing';
import type { MetronomeVoiceId } from '@/domain/drums';
import { chordOnDegree, chroma, type KeyMode } from '@/domain/music';
import { countInTicks, ticksPerBar, type Phrase } from '@/domain/phrase';
import { FakeClock } from '@/domain/time';
import { exerciseDefinition } from '@/exercises/registry';
import { newExerciseFrom } from '@/store/exercises';
import { itemFromExercise } from '@/store/routines';
import { serialWrites } from '@/store/util';
import type { VideoTrack, YouTubePlayer } from '@/audio';
import {
  ExerciseSession,
  RoutineSession,
  type AudioPort,
  type DroneSource,
  type GeneratedPlan,
  type GeneratedSource,
  type PracticeSession,
  type SessionDeps,
  type TrackSource,
} from '..';

type Status = 'loaded' | 'playing' | 'paused' | 'stopped' | 'disposed';

class FakeTrack implements TrackSource {
  readonly kind = 'video';
  readonly rates = { min: 0.25, max: 2, step: 0.05 };
  readonly player = {} as YouTubePlayer;
  readonly bpm: number;
  private readonly failWith: Error | null;
  speed = 1;
  status: Status = 'loaded';
  private transport: ((playing: boolean) => void) | null = null;
  startedFrom: number | null = null;
  reanchored = 0;

  constructor(track: VideoTrack, failWith: Error | null) {
    this.bpm = track.bpm;
    this.failWith = failWith;
  }

  get effectiveBpm() {
    return this.bpm * this.speed;
  }
  load() {
    return Promise.resolve();
  }
  start(countInTicks: number) {
    if (this.failWith) return Promise.reject(this.failWith);
    this.status = 'playing';
    this.startedFrom = countInTicks;
    return Promise.resolve();
  }
  pause() {
    this.status = 'paused';
  }
  resume() {
    this.status = 'playing';
    return Promise.resolve();
  }
  stop() {
    this.status = 'stopped';
  }
  setRate(speed: number) {
    this.speed = speed;
  }
  reanchor() {
    this.reanchored += 1;
  }
  onTransport(listener: (playing: boolean) => void) {
    this.transport = listener;
    return () => {
      this.transport = null;
    };
  }
  /** YouTube's own controls, as the player would use them. */
  useOwnControls(playing: boolean) {
    this.status = playing ? 'playing' : 'paused';
    this.transport?.(playing);
  }
  dispose() {
    this.status = 'disposed';
  }
}

class FakeDrone implements DroneSource {
  readonly kind = 'drone';
  readonly rates = null;
  readonly effectiveBpm = null;
  keyMode: KeyMode;
  status: Status = 'loaded';

  constructor(keyMode: KeyMode) {
    this.keyMode = keyMode;
  }
  load() {
    return Promise.resolve();
  }
  start() {
    this.status = 'playing';
    return Promise.resolve();
  }
  pause() {}
  resume() {
    return Promise.resolve();
  }
  stop() {
    this.status = 'stopped';
  }
  setRate() {}
  setKeyMode(keyMode: KeyMode) {
    this.keyMode = keyMode;
  }
  dispose() {
    this.status = 'disposed';
  }
}

class FakeGenerated implements GeneratedSource {
  readonly kind = 'generated';
  readonly rates = null;
  readonly effectiveBpm = null;
  status: Status = 'loaded';
  loading = false;
  /** Every pass it was handed, in order. */
  passes: { pass: RenderedPass; atTick: number }[] = [];
  cleared = 0;

  load() {
    this.loading = true;
    return Promise.resolve();
  }
  start() {
    this.status = 'playing';
    return Promise.resolve();
  }
  pause() {}
  resume() {
    return Promise.resolve();
  }
  stop() {
    this.status = 'stopped';
  }
  setRate() {}
  loadPass(pass: RenderedPass, atTick: number) {
    this.passes.push({ pass, atTick });
  }
  clear() {
    this.cleared += 1;
  }
  dispose() {
    this.status = 'disposed';
  }
}

/** The audio engine as a session sees it, recording what it was told to sound. */
function fakeAudio() {
  const clock = new FakeClock(120);
  const sound = {
    notes: null as Phrase | null,
    notesAt: 0,
    clicking: false,
    silenced: false,
    metronome: null as MetronomeVoiceId | null,
    preloaded: [] as MetronomeVoiceId[],
  };
  const fake = {
    clock,
    sound,
    tracks: [] as FakeTrack[],
    drones: [] as FakeDrone[],
    generated: [] as FakeGenerated[],
    /** Every track made from now on fails to start with this. */
    failTracks: null as Error | null,
    port: null as unknown as AudioPort,
  };
  fake.port = {
    clock,
    metronome: {
      start: () => (sound.clicking = true),
      stop: () => (sound.clicking = false),
      setSilenced: (silenced) => (sound.silenced = silenced),
      countInBetween: () => {},
    },
    phrase: {
      load: (phrase, _instrument, atTick = 0) => {
        sound.notes = phrase;
        sound.notesAt = atTick;
      },
      clear: () => (sound.notes = null),
    },
    configureMetronome: () => {},
    setMetronomeVoice: (id) => (sound.metronome = id),
    preloadMetronome: (id) => sound.preloaded.push(id),
    init: () => Promise.resolve(),
    setMasterVolume: () => {},
    drone: (keyMode) => {
      const drone = new FakeDrone(keyMode);
      fake.drones.push(drone);
      return drone;
    },
    generated: () => {
      const made = new FakeGenerated();
      fake.generated.push(made);
      return made;
    },
    track: (track) => {
      const made = new FakeTrack(track, fake.failTracks);
      fake.tracks.push(made);
      return made;
    },
  };
  return fake;
}

let database: TheoryPadDB | null = null;
let count = 0;
/**
 * Every write a session has started. Sessions persist fire-and-forget, so a
 * test can end with one still running; deleting the database under it fails
 * the run with a DatabaseClosedError.
 */
let writes: Promise<unknown>[] = [];

function recorded<A extends unknown[]>(save: (...args: A) => Promise<void>) {
  return (...args: A) => {
    const write = save(...args);
    writes.push(write);
    return write;
  };
}

afterEach(async () => {
  await Promise.allSettled(writes);
  writes = [];
  await database?.delete();
  database = null;
});

/** A session's world: real repositories over fake-indexeddb, fake audio, settings in memory. */
function world(videos: Video[] = []) {
  count += 1;
  database = new TheoryPadDB(`session-test-${count}`);
  const repos = createRepositories(database);
  const audio = fakeAudio();
  const settings: Settings = defaultSettings(0);
  let time = 1_000_000;
  // As the routines store does: one row's read-modify-writes never overlap.
  const queued = serialWrites();
  const deps: SessionDeps = {
    audio: audio.port,
    repos,
    videos: () => videos,
    settings: () => settings,
    saveAudioSettings: (changes) => {
      settings.audio = { ...settings.audio, ...changes };
      return Promise.resolve();
    },
    saveExercise: recorded(async (id: string, changes: Partial<Exercise>) => {
      await repos.exercises.update(id, changes);
    }),
    saveRoutine: recorded((id: string, changes: Partial<Routine>) =>
      queued(id, async () => {
        await repos.routines.update(id, changes);
      }),
    ),
    saveRoutineItem: recorded((id: string, itemId: string, changes: Partial<RoutineItem>) =>
      queued(id, async () => {
        const routine = (await repos.routines.byId(id))!;
        await repos.routines.update(id, {
          items: routine.items.map((item) =>
            item.id === itemId ? { ...item, ...changes } : item,
          ),
        });
      }),
    ),
    now: () => (time += 1_000),
    onError: (error) => {
      throw error;
    },
  };
  return { deps, repos, audio, settings };
}

function addExercise(
  repos: Repositories,
  definitionId: string,
  changes: Partial<NewExercise> = {},
) {
  return repos.exercises.add({
    ...newExerciseFrom(exerciseDefinition(definitionId)),
    ...changes,
  });
}

/** Let fire-and-forget writes and a track's start settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Exactly the rest of the current pass, count-in included. */
function playOut(session: PracticeSession, clock: FakeClock) {
  const runner = session.runner!;
  const phrase = runner.currentPhrase!;
  const length = phrase.totalTicks * (phrase.repeat ?? 1);
  clock.advanceTicks(runner.snapshot.countInRemaining + length - runner.snapshot.phraseTick);
}

const G_IONIAN = { tonic: 'G', mode: 'ionian' } as unknown as KeyMode;

/** The root the generated bass plays on each bar line of a pass, as a chroma. */
function barRoots(pass: RenderedPass, bar: number): number[] {
  return pass.bass.filter((note) => note.tick % bar === 0).map((note) => note.midi % 12);
}

/** The roots a plan's progression puts on each bar, from bar 1. */
function planRoots(plan: GeneratedPlan, keyMode: KeyMode, bars: number): number[] {
  const perBar = plan.progression.flatMap((step) =>
    Array.from({ length: step.bars }, () => step.degree),
  );
  return Array.from({ length: bars }, (_, b) =>
    chroma(chordOnDegree(keyMode, perBar[b % perBar.length]!).root),
  );
}

const GO_TO_SWING: GeneratedBackingSettings = {
  source: { kind: 'goTo' },
  style: 'swing',
  chords: 'triads',
};
const IN_G = {
  key: { mode: 'fixed', value: 'G' },
  mode: { mode: 'fixed', value: 'ionian' },
} as const;

function track(overrides: Partial<Video> = {}): Video {
  return {
    id: newId(),
    videoId: 'abcdefghijk',
    title: 'G vamp',
    scope: { kind: 'shared' },
    playAlong: true,
    startSec: 0,
    keyMode: G_IONIAN,
    bpm: 100,
    beatsPerBar: 4,
    tags: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('ExerciseSession', () => {
  it('plays a pass after the count-in, logs it, and remembers what it rolled', async () => {
    const { deps, repos, audio } = world();
    const exercise = await addExercise(repos, 'modes-through-key', {
      countInBars: 1,
      tempo: { targetTempo: 80, maxTempo: null },
    });
    const session = await ExerciseSession.open(exercise, deps);
    expect(session.state).toMatchObject({
      audioReady: false,
      snapshot: { state: 'brief', currentTempo: 80 },
      instance: { kind: 'played' },
    });

    await session.play();
    const phrase = session.runner.currentPhrase!;
    const countIn = countInTicks(phrase.timeSignature, 1);
    expect(session.state).toMatchObject({
      audioReady: true,
      snapshot: { state: 'count-in', countInRemaining: countIn },
    });
    expect(audio.sound).toMatchObject({ notes: phrase, notesAt: countIn, clicking: true });

    playOut(session, audio.clock);
    await settle();
    expect(session.state.snapshot?.state).toBe('brief');
    expect(audio.sound).toMatchObject({ notes: null, clicking: false });

    const reps = await repos.reps.byExercise(exercise.id, 10);
    expect(reps).toHaveLength(1);
    expect(reps[0]).toMatchObject({
      sessionId: session.sessionId,
      status: 'completed',
      tempo: 80,
    });
    expect(reps[0]!.frets).toBeDefined();
    expect((await repos.exercises.byId(exercise.id))!.heldAxisValues).toEqual(reps[0]!.axes);

    await session.end();
    expect((await repos.sessions.byId(session.sessionId))!.endedAt).not.toBeNull();
  });

  it('logs nothing when stopped in the count-in, an abandoned pass mid-way, and restarts counted in', async () => {
    const { deps, repos, audio } = world();
    const exercise = await addExercise(repos, 'modes-through-key', { countInBars: 1 });
    const session = await ExerciseSession.open(exercise, deps);

    await session.play();
    session.stop();
    await settle();
    expect(session.state.snapshot?.state).toBe('brief');
    expect(await repos.reps.byExercise(exercise.id, 10)).toEqual([]);

    await session.play();
    const countIn = session.state.snapshot!.countInRemaining;
    audio.clock.advanceTicks(countIn + 480);
    session.stop();
    await settle();
    expect((await repos.reps.byExercise(exercise.id, 10)).map((r) => r.status)).toEqual([
      'abandoned',
    ]);

    await session.restart();
    expect(session.state.snapshot).toMatchObject({
      state: 'count-in',
      countInRemaining: countIn,
    });
    expect(audio.sound.clicking).toBe(true);
  });

  it('hands the tempo to a chosen track at its nearest speed, and takes it back without one', async () => {
    const own = track({ scope: { kind: 'exercise', exerciseId: 'set below' } });
    const { deps, repos, audio } = world([own]);
    const exercise = await addExercise(repos, 'modes-through-key', {
      countInBars: 1,
      tempo: { targetTempo: 72, maxTempo: null },
    });
    own.scope = { kind: 'exercise', exerciseId: exercise.id };
    delete own.keyMode; // an exercise's own track fits any key
    const session = await ExerciseSession.open(exercise, deps);

    await session.chooseBacking({ kind: 'video', id: own.id });
    expect(session.state.backing).toMatchObject({ resolved: { kind: 'video' }, speed: 0.7 });
    expect(session.state.snapshot?.currentTempo).toBe(70);
    expect((await repos.exercises.byId(exercise.id))!.backing).toEqual({
      kind: 'video',
      id: own.id,
    });

    // The track is the click and the count-in; the notes are not played over it.
    await session.play();
    const phrase = session.runner.currentPhrase!;
    expect(audio.tracks[0]).toMatchObject({
      status: 'playing',
      startedFrom: countInTicks(phrase.timeSignature, 1),
    });
    expect(audio.sound).toMatchObject({ notes: null, silenced: true });

    session.setTempo(90);
    expect([audio.tracks[0]!.speed, session.state.snapshot?.currentTempo]).toEqual([0.9, 90]);
    session.nudgeTempo(1);
    expect([audio.tracks[0]!.speed, session.state.snapshot?.currentTempo]).toEqual([0.95, 95]);

    session.stop();
    await session.chooseBacking({ kind: 'none' });
    expect(audio.tracks[0]!.status).toBe('disposed');
    expect(session.state.snapshot?.currentTempo).toBe(72);
  });

  it('follows the video’s own controls: pausing there pauses the exercise, playing resumes it', async () => {
    const own = track({ scope: { kind: 'exercise', exerciseId: 'set below' } });
    const { deps, repos, audio } = world([own]);
    const exercise = await addExercise(repos, 'modes-through-key', { countInBars: 1 });
    own.scope = { kind: 'exercise', exerciseId: exercise.id };
    delete own.keyMode;
    const session = await ExerciseSession.open(exercise, deps);
    await session.chooseBacking({ kind: 'video', id: own.id });
    await session.play();
    expect(session.state.snapshot?.state).toBe('count-in');

    audio.tracks[0]!.useOwnControls(false);
    expect(session.state.snapshot?.state).toBe('paused');

    audio.tracks[0]!.useOwnControls(true);
    await settle();
    expect(session.state.snapshot?.state).toBe('count-in');
    expect(audio.tracks[0]!.status).toBe('playing');

    // The app's own pause reports back from the video, and does not bounce.
    session.pause();
    audio.tracks[0]!.useOwnControls(false);
    expect(session.state.snapshot?.state).toBe('paused');
    await session.resume();
    expect(session.state.snapshot?.state).toBe('count-in');
  });

  it('follows the key: a track that no longer fits is dropped, and the drone retunes', async () => {
    const inG = track();
    const { deps, repos, audio } = world([inG]);
    const exercise = await addExercise(repos, 'modes-through-key', {
      axisPolicies: IN_G,
      tempo: { targetTempo: 72, maxTempo: null },
    });
    const session = await ExerciseSession.open(exercise, deps);
    await session.chooseBacking({ kind: 'video', id: inG.id });
    expect(session.state.snapshot?.currentTempo).toBe(70);

    await session.reconfigure({
      axisPolicies: { ...IN_G, key: { mode: 'fixed', value: 'A' } },
    });
    expect(session.state.backing.resolved).toEqual({ kind: 'none', dropped: true });
    expect(audio.tracks[0]!.status).toBe('disposed');
    expect(session.state.snapshot?.currentTempo).toBe(72);

    await session.chooseBacking({ kind: 'drone' });
    await session.reconfigure({
      axisPolicies: { ...IN_G, key: { mode: 'fixed', value: 'C' } },
    });
    expect(audio.drones).toHaveLength(1);
    expect(String(audio.drones[0]!.keyMode.tonic)).toBe('C');
  });

  it('plays generated bass and piano under the notes, from every pass’s bar 1', async () => {
    const { deps, repos, audio } = world();
    const exercise = await addExercise(repos, 'free-improv-target', { countInBars: 1 });
    const session = await ExerciseSession.open(exercise, deps);
    // Picked from the roll, and there to name before anything is chosen.
    const plan = session.state.generated!;
    expect(plan.settings).toMatchObject({ source: { kind: 'custom' }, style: 'pulse' });
    await session.chooseBacking({ kind: 'generated' });
    const backing = audio.generated[0]!;
    expect(backing.loading).toBe(true);

    await session.setLoop(true);
    await session.play();
    const phrase = session.runner.currentPhrase!;
    const countIn = countInTicks(phrase.timeSignature, 1);
    const bar = ticksPerBar(phrase.timeSignature);
    const { keyMode } = session.state.snapshot!;
    // Under the notes and the click, not instead of them.
    expect(audio.sound).toMatchObject({ notes: phrase, clicking: true, silenced: false });
    expect(backing.passes).toHaveLength(1);
    expect(backing.passes[0]!.atTick).toBe(countIn);
    expect(barRoots(backing.passes[0]!.pass, bar)).toEqual(
      planRoots(plan, keyMode, phrase.totalTicks / bar),
    );

    // Looping, the next pass starts the progression again at its own bar 1.
    playOut(session, audio.clock);
    expect(backing.passes).toHaveLength(2);
    expect(backing.passes[1]).toEqual({
      pass: backing.passes[0]!.pass,
      atTick: countIn + phrase.totalTicks,
    });

    // Stopping silences it; playing again keeps the roll, and so the progression.
    const cleared = backing.cleared;
    session.stop();
    expect(backing.cleared).toBeGreaterThan(cleared);
    await session.play();
    expect(backing.passes.at(-1)!.pass).toEqual(backing.passes[0]!.pass);

    // A re-roll picks again.
    session.stop();
    const picked = new Set<string>();
    for (let i = 0; i < 12; i += 1) {
      session.reroll();
      picked.add(formatProgression(session.state.generated!.progression));
    }
    expect(picked.size).toBeGreaterThan(1);
  });

  it('picks only the progression again when its settings change, and keeps them', async () => {
    const { deps, repos } = world();
    const exercise = await addExercise(repos, 'free-improv-target');
    const session = await ExerciseSession.open(exercise, deps);
    const { variation } = session.state.snapshot!;
    const custom: GeneratedBackingSettings = {
      source: { kind: 'custom', progressions: [[{ degree: 4, bars: 2 }]] },
      style: 'swing',
      chords: 'triads',
    };

    await session.reconfigure({ generatedBacking: custom });
    // The same roll: nothing rolled again but the progression.
    expect(session.state.snapshot!.variation).toEqual(variation);
    expect(session.state.generated).toEqual({
      settings: custom,
      progression: [{ degree: 4, bars: 2 }],
    });

    // Saved to the exercise, so it is what plays next time.
    const reopened = await ExerciseSession.open(
      (await repos.exercises.byId(exercise.id))!,
      deps,
    );
    expect(reopened.state.generated!.settings).toEqual(custom);
  });

  it('drops a track that will not start, says why, and plays the notes instead', async () => {
    const inG = track();
    const { deps, repos, audio } = world([inG]);
    const exercise = await addExercise(repos, 'modes-through-key', {
      axisPolicies: IN_G,
      countInBars: 1,
    });
    const session = await ExerciseSession.open(exercise, deps);
    audio.failTracks = new Error('YouTube could not be reached');
    await session.chooseBacking({ kind: 'video', id: inG.id });

    await session.play();
    expect(session.state.backing).toMatchObject({
      resolved: { kind: 'none' },
      error: 'YouTube could not be reached',
      starting: false,
    });
    expect(session.state.snapshot?.state).toBe('count-in');
    expect(audio.sound).toMatchObject({ notes: session.runner.currentPhrase, silenced: false });
  });

  it('saves count-in to the exercise, loop to settings — and in a routine, count-in to the item', async () => {
    const { deps, repos, settings } = world();
    const exercise = await addExercise(repos, 'modes-through-key', { countInBars: 1 });
    const single = await ExerciseSession.open(exercise, deps);
    await single.setCountIn(2);
    await single.setLoop(true);
    expect((await repos.exercises.byId(exercise.id))!.countInBars).toBe(2);
    expect(settings.audio.loop).toBe(true);
    expect(single.state.snapshot).toMatchObject({ countInBars: 2, loop: true });
    await single.end();

    const item = itemFromExercise(exercise);
    const stored = await repos.routines.add({
      name: 'R',
      items: [item],
      sessionAxisPolicies: {},
    });
    const routine = await RoutineSession.open(stored, deps);
    await routine.setCountIn(0);
    await routine.chooseBacking({ kind: 'drone' });
    const saved = (await repos.routines.byId(stored.id))!;
    expect(saved.items[0]!.countInBars).toBe(0);
    expect(saved.backing).toEqual({ kind: 'drone' });
    expect((await repos.exercises.byId(exercise.id))!.countInBars).toBe(2);
  });

  it('plays each exercise’s own metronome, saves a change to it, and M brings the last one back', async () => {
    const { deps, repos, audio } = world();
    const upbeat = await addExercise(repos, 'modes-through-key', { metronome: 'drums-upbeat' });
    const session = await ExerciseSession.open(upbeat, deps);
    // Downloaded before Play, and played from the first pass.
    expect(audio.sound.preloaded).toEqual(['drums-upbeat']);
    await session.play();
    expect(audio.sound.metronome).toBe('drums-upbeat');

    await session.toggleMetronome();
    expect(session.state.metronome).toBe('off');
    expect(audio.sound.metronome).toBe('off');
    expect((await repos.exercises.byId(upbeat.id))!.metronome).toBe('off');
    await session.toggleMetronome();
    expect(audio.sound.metronome).toBe('drums-upbeat');
    await session.end();

    // One that has not chosen plays the setting's; a routine item keeps its own.
    const plain = await addExercise(repos, 'modes-through-key');
    const other = await ExerciseSession.open(plain, deps);
    expect(other.state.metronome).toBe('click');
    await other.end();

    const stored = await repos.routines.add({
      name: 'R',
      items: [itemFromExercise((await repos.exercises.byId(upbeat.id))!)],
      sessionAxisPolicies: {},
    });
    const routine = await RoutineSession.open(stored, deps);
    await routine.setMetronomeVoice('drums-soft');
    expect((await repos.routines.byId(stored.id))!.items[0]!.metronome).toBe('drums-soft');
    expect((await repos.exercises.byId(upbeat.id))!.metronome).toBe('drums-upbeat');
  });
});

describe('RoutineSession', () => {
  it('carries one track through played, theory and played items, each at its own tempo', async () => {
    const inG = track();
    const { deps, repos, audio } = world([inG]);
    const scales = await addExercise(repos, 'modes-through-key');
    const circle = await addExercise(repos, 'circle-of-fifths');
    const item = (exercise: typeof scales, changes: Partial<RoutineItem>) => ({
      ...itemFromExercise(exercise),
      reps: 1,
      countInBars: 1 as const,
      ...changes,
    });
    const items = [
      item(scales, { tempo: { targetTempo: 80, maxTempo: null } }),
      item(circle, {}),
      item(scales, { tempo: { targetTempo: 100, maxTempo: null } }),
    ];
    const stored = await repos.routines.add({
      name: 'Warm-up',
      items,
      sessionAxisPolicies: IN_G,
      backing: { kind: 'video', id: inG.id },
    });
    const session = await RoutineSession.open(stored, deps);
    expect(session.state.routineSnapshot?.phase).toBe('overview');
    expect(audio.tracks[0]!.speed).toBe(0.8);

    // The track starts a count-in ahead of bar 1, with the clock held until it sounds.
    await session.play();
    await settle();
    expect(session.state.snapshot?.state).toBe('count-in');
    expect(audio.tracks[0]).toMatchObject({
      status: 'playing',
      startedFrom: session.state.snapshot!.countInRemaining,
    });

    // A theory set puts the track away.
    playOut(session, audio.clock);
    expect(session.state.instance?.kind).toBe('theory');
    expect(audio.tracks[0]!.status).toBe('disposed');

    // The next played item gets a fresh track, at its own tempo.
    session.submitSet([{ subject: 'G', correct: true }]);
    await settle();
    expect(session.state.snapshot).toMatchObject({ state: 'count-in', currentTempo: 100 });
    expect(audio.tracks[1]).toMatchObject({ status: 'playing', speed: 1 });

    playOut(session, audio.clock);
    await settle();
    expect(session.state.routineSnapshot?.phase).toBe('done');
    expect(audio.tracks[1]!.status).toBe('stopped');

    const reps = await Promise.all(
      [scales, circle].map((e) => repos.reps.byExercise(e.id, 10)),
    );
    expect(
      reps
        .flat()
        .map((r) => r.routineItemId)
        .sort(),
    ).toEqual(items.map((i) => i.id).sort());
    const saved = (await repos.routines.byId(stored.id))!;
    expect(saved.lastPlayedAt).toBeDefined();
    expect(saved.items[0]!.heldAxisValues).toEqual(
      reps[0]!.find((r) => r.routineItemId === items[0]!.id)!.axes,
    );
  });

  it('plays each item’s own generated progression, and nothing under a theory set', async () => {
    const { deps, repos, audio } = world();
    // Its own settings, copied onto the routine's item.
    const improv = await addExercise(repos, 'free-improv-target', {
      generatedBacking: GO_TO_SWING,
    });
    const circle = await addExercise(repos, 'circle-of-fifths');
    const scales = await addExercise(repos, 'modes-through-key');
    const stored = await repos.routines.add({
      name: 'Over the changes',
      items: [improv, circle, scales].map((e) => ({
        ...itemFromExercise(e),
        reps: 1,
        countInBars: 1 as const,
      })),
      sessionAxisPolicies: IN_G,
      backing: { kind: 'generated' },
    });
    const session = await RoutineSession.open(stored, deps);
    await session.play();
    await settle();
    const backing = audio.generated[0]!;
    const first = session.runner!.currentPhrase!;
    expect(session.state.generated!.settings).toEqual(GO_TO_SWING);
    const bar = ticksPerBar(first.timeSignature);
    expect(backing.passes).toHaveLength(1);
    expect(barRoots(backing.passes[0]!.pass, bar)).toEqual(
      planRoots(session.state.generated!, G_IONIAN, first.totalTicks / bar),
    );

    // A theory set: nothing to play over, and nothing left ringing.
    const cleared = backing.cleared;
    playOut(session, audio.clock);
    expect(session.state.instance?.kind).toBe('theory');
    expect(backing.cleared).toBeGreaterThan(cleared);
    expect(backing.passes).toHaveLength(1);

    // The next played item brings its own: the default, a vamp on the tonic.
    session.submitSet([{ subject: 'G', correct: true }]);
    await settle();
    expect(session.state.generated!.settings.source).toEqual({ kind: 'vamp' });
    expect(backing.passes).toHaveLength(2);
    expect(backing.passes[1]!.atTick).toBe(
      audio.clock.ticks + session.state.snapshot!.countInRemaining,
    );
    const scalesPhrase = session.runner!.currentPhrase!;
    expect(
      new Set(barRoots(backing.passes[1]!.pass, ticksPerBar(scalesPhrase.timeSignature))),
    ).toEqual(new Set([chroma(G_IONIAN.tonic)]));
  });

  it('counts each item in by its own, and never by the exercise it came from', async () => {
    const { deps, repos, audio } = world();
    // One exercise, in the routine twice, counted in differently each time.
    const exercise = await addExercise(repos, 'modes-through-key', { countInBars: 1 });
    const items = [
      { ...itemFromExercise(exercise), reps: 1, countInBars: 2 as const },
      { ...itemFromExercise(exercise), reps: 1, countInBars: 0.5 as const },
    ];
    const stored = await repos.routines.add({
      name: 'Two ways in',
      items,
      sessionAxisPolicies: IN_G,
    });
    const session = await RoutineSession.open(stored, deps);

    await session.play();
    const { timeSignature } = session.runner!.currentPhrase!;
    expect(session.state.snapshot).toMatchObject({
      state: 'count-in',
      countInRemaining: countInTicks(timeSignature, 2),
    });

    // The second item counts itself in on the same running clock — half a bar,
    // its own, not the first item's two bars and not the exercise's one.
    playOut(session, audio.clock);
    await settle();
    expect(session.state.snapshot).toMatchObject({
      state: 'count-in',
      countInRemaining: countInTicks(timeSignature, 0.5),
    });

    // Changing it here belongs to the item being played. The exercise in the
    // library keeps its own, as does the routine's other copy.
    await session.setCountIn(1);
    const saved = (await repos.routines.byId(stored.id))!;
    expect(saved.items.map((item) => item.countInBars)).toEqual([2, 1]);
    expect((await repos.exercises.byId(exercise.id))!.countInBars).toBe(1);
  });

  it('seeks under a backing track, leaving the track playing where it is', async () => {
    const inG = track();
    const { deps, repos, audio } = world([inG]);
    const exercise = await addExercise(repos, 'modes-through-key', { countInBars: 1 });
    const stored = await repos.routines.add({
      name: 'Along with it',
      items: [{ ...itemFromExercise(exercise), reps: 1 }],
      sessionAxisPolicies: IN_G,
      backing: { kind: 'video', id: inG.id },
    });
    const session = await RoutineSession.open(stored, deps);
    await session.play();
    await settle();

    audio.clock.advanceTicks(session.runner!.snapshot.countInRemaining + 960);
    expect(session.runner!.snapshot.phraseTick).toBe(960);

    // The exercise moves; the recording plays on from where it is and takes
    // the clock's new position as the one to stay in step with.
    session.seekTo(480);
    expect(session.runner!.snapshot.phraseTick).toBe(480);
    expect(audio.tracks[0]).toMatchObject({ status: 'playing', reanchored: 1 });
  });
});
