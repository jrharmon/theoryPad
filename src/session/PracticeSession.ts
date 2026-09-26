import { coverageCounts, type BackingChoice, type BackingCriteria, type Session } from '@/data';
import {
  chordTimeline,
  compById,
  pickProgression,
  renderPass,
  type ChordSpan,
  type GeneratedBackingSettings,
  type Progression,
} from '@/domain/backing';
import type { Instrument } from '@/domain/instrument';
import { canonicalKeyMode, pitchClass, type KeyMode, type ModeName } from '@/domain/music';
import type { MetronomeVoiceId } from '@/domain/drums';
import type { CountInBars, Phrase, TimeSignature } from '@/domain/phrase';
import { answerWeights } from '@/domain/progress';
import {
  AXIS_IDS,
  hashSeed,
  mulberry32,
  type AxisValueKeys,
  type CoverageCounts,
  type RolledVariation,
} from '@/domain/variation';
import type {
  ExerciseRunner,
  RepStartInfo,
  RoutineSnapshot,
  RunnerSnapshot,
} from '@/exercises/runner';
import type { ExerciseInstance } from '@/exercises/types';
import { BackingController, NO_BACKING, type BackingState } from './backing';
import type { SessionDeps } from './ports';

/** Everything the practice screen shows, as one value. */
export interface SessionState {
  /** The exercise being played — in a routine, the current item's. */
  runner: ExerciseRunner | null;
  /** The runner's snapshot. In a routine, only while an item is running. */
  snapshot: RunnerSnapshot | null;
  instance: ExerciseInstance | null;
  /** Set when practicing a routine rather than one exercise. */
  routineSnapshot: RoutineSnapshot | null;
  /** The track or drone playing instead of the synth notes, if one was chosen. */
  backing: BackingState;
  audioReady: boolean;
  /** The metronome for this exercise — in a routine, this item — or the setting's. */
  metronome: MetronomeVoiceId;
  /**
   * What the generated backing would play on this roll, whether or not it is
   * chosen: the menu names it. Null for a theory set.
   */
  generated: GeneratedPlan | null;
  /**
   * The chords of the current pass, from its bar 1, while Generated is chosen
   * and can play here — before Play too, so they can be read first. Null
   * otherwise.
   */
  chords: ChordSpan[] | null;
}

export interface GeneratedPlan {
  settings: GeneratedBackingSettings;
  /** Picked from the roll's seed: the same roll, the same progression. */
  progression: Progression;
}

/**
 * Standalone practice has no routine to inherit a key from, so the exercise's
 * own key axis decides. This is only the key for exercises that do not roll one.
 */
export const FALLBACK_KEY_MODE: KeyMode = canonicalKeyMode({
  tonic: pitchClass('C'),
  scale: 'major',
  mode: 'ionian',
});

/** The session row every rep is logged under. */
export function openSessionRow(deps: SessionDeps, routineId: string | null): Promise<Session> {
  const now = deps.now();
  return deps.repos.sessions.add({
    routineId,
    seed: Math.floor(now % 2 ** 31),
    startedAt: now,
    endedAt: null,
    sessionKey: FALLBACK_KEY_MODE.tonic,
    sessionMode: FALLBACK_KEY_MODE.mode as ModeName,
  });
}

/** Recent rolls, so the roller can push toward ground you have not covered. */
export async function loadCoverage(
  deps: SessionDeps,
  exerciseId: string,
): Promise<CoverageCounts> {
  const recent = await deps.repos.reps.byExercise(exerciseId, 60);
  const counts: CoverageCounts = {};
  for (const axis of AXIS_IDS) {
    const values = coverageCounts(recent, axis);
    if (Object.keys(values).length > 0) counts[axis] = values;
  }
  return counts;
}

/** A theory drill's leanings, from the last 30 days of its answers. */
export async function loadSubjectWeights(
  deps: SessionDeps,
  exerciseId: string,
): Promise<Record<string, number>> {
  const since = deps.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = await deps.repos.reps.byExercise(exerciseId, 200);
  return answerWeights(recent.filter((rep) => rep.startedAt >= since));
}

/** The player's app-wide "never roll these", as the roller takes them. */
export function blockedValues(deps: SessionDeps): AxisValueKeys {
  const { practice } = deps.settings();
  return {
    key: practice.blockedKeys ?? [],
    scale: practice.blockedScales ?? [],
    mode: practice.blockedModes ?? [],
  };
}

export const criteriaQuery = (criteria: BackingCriteria | undefined) =>
  criteria ? { criteria } : {};

/**
 * One visit to the practice screen: a single exercise or a routine, the sound
 * it makes, its backing, and what it saves. Framework-free — the practice
 * store holds one and mirrors its state; tests drive one with `FakeClock` and
 * a fake audio port.
 *
 * The two kinds differ in what drives them and where their settings are saved,
 * not in how they sound; each subclass answers only those questions.
 */
export abstract class PracticeSession {
  readonly sessionId: string;
  protected readonly deps: SessionDeps;
  protected readonly instrument: Instrument;
  protected readonly backing: BackingController;
  private current: SessionState = {
    runner: null,
    snapshot: null,
    instance: null,
    routineSnapshot: null,
    backing: NO_BACKING,
    audioReady: false,
    metronome: 'click',
    generated: null,
    chords: null,
  };
  /** What `chords` was laid out from, so it changes only with them. */
  private laidOut: {
    plan: GeneratedPlan | null;
    phrase: Phrase | null;
    chosen: boolean;
    freeTime: boolean;
    chords: ChordSpan[] | null;
  } | null = null;
  /** What `generated` was worked out from, so it changes only with them. */
  private planned: { runner: ExerciseRunner | null; variation: RolledVariation | null } = {
    runner: null,
    variation: null,
  };
  /** What `M` turns the metronome back on to. */
  private lastMetronome: MetronomeVoiceId = 'click';
  private readonly listeners = new Set<(state: SessionState) => void>();

  protected constructor(deps: SessionDeps, sessionId: string) {
    this.deps = deps;
    this.sessionId = sessionId;
    this.instrument = deps.settings().instrument;
    this.backing = new BackingController({
      audio: deps.audio,
      videos: deps.videos,
      host: {
        keyMode: () => this.keyMode,
        runner: () => this.runner,
        pauseFromVideo: () => this.pause(),
        resumeFromVideo: () => void this.resume(),
      },
      onChange: (backing) => this.update({ backing }),
    });
  }

  /** The runner whose tempo, pauses and passes the transport controls. */
  abstract get runner(): ExerciseRunner | null;
  /** The key the backing must fit. */
  protected abstract get keyMode(): KeyMode | null;

  get state(): SessionState {
    return this.current;
  }

  subscribe(listener: (state: SessionState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  protected update(changes: Partial<SessionState>): void {
    this.current = { ...this.current, ...changes };
    const { runner } = this.current;
    const variation = runner?.snapshot.variation ?? null;
    if (runner !== this.planned.runner || variation !== this.planned.variation) {
      this.planned = { runner, variation };
      this.current = { ...this.current, generated: this.planFor(runner) };
    }
    const chords = this.chordsNow();
    if (chords !== this.current.chords) this.current = { ...this.current, chords };
    for (const listener of this.listeners) listener(this.current);
  }

  // ------------------------------------------------------------- transport

  /** Start the clock. Must be called from a click or keypress. */
  abstract play(): Promise<void>;
  /** Back to the top of what is playing, ready to go again. In a routine, of this item. */
  abstract stop(): void;
  abstract reroll(): void;
  /** The count-in for this exercise — or, in a routine, this item. Saved to it. */
  abstract setCountIn(bars: CountInBars): Promise<void>;
  protected abstract applyLoop(on: boolean): void;
  protected abstract saveBacking(choice: BackingChoice): Promise<void>;
  /** The metronome this exercise — or this routine item — has chosen, or the setting's. */
  protected abstract currentMetronome(): MetronomeVoiceId;
  /** Remember a metronome on the exercise or item: in memory at once, then saved. */
  protected abstract rememberMetronome(id: MetronomeVoiceId): Promise<void>;
  protected abstract endRunner(): void;
  /** The generated-backing settings of this exercise — or, in a routine, this item. */
  protected abstract generatedSettings(): GeneratedBackingSettings;
  /**
   * Pick the progression again after the generated-backing settings changed.
   * Same roll, same seed: only the progression moves, never an axis.
   */
  protected replanGenerated(): void {
    this.planned = { runner: null, variation: null };
    this.update({});
  }
  /** After an action that can start an item: a routine may need its track caught up. */
  protected afterAdvance(): void {}

  pause(): void {
    const runner = this.runner;
    if (this.backing.state.starting) return;
    const state = runner?.snapshot.state;
    if (state !== 'playing' && state !== 'count-in') return;
    runner!.pause();
    this.backing.pause();
  }

  async resume(): Promise<void> {
    const runner = this.runner;
    if (runner?.snapshot.state !== 'paused' || this.backing.state.starting) return;
    await this.backing.resume();
    runner.resume();
  }

  /** From the top straight away, counted in. Must be called from a click or keypress. */
  async restart(): Promise<void> {
    if (this.backing.state.starting) return;
    this.stop();
    await this.play();
  }

  /**
   * Move the playhead to a note the player clicked, and carry on from there.
   *
   * A backing track cannot be dragged along with it — YouTube seeks in its own
   * time — so the track simply plays on from where it is. The exercise moves
   * anyway, and the track is re-anchored to the clock's new position: without
   * that, the follower would spend the next few seconds hauling the clock back
   * to the recording and the click would undo itself.
   */
  seekTo(phraseTick: number): void {
    if (this.backing.state.starting) return;
    if (this.runner?.seekTo(phraseTick)) this.backing.reanchor();
  }

  setTempo(bpm: number): void {
    if (!this.backing.setTempo(bpm)) this.runner?.setTempo(bpm);
  }

  nudgeTempo(delta: number): void {
    if (!this.backing.nudge(delta)) this.runner?.nudgeTempo(delta);
  }

  completeRep(): void {
    this.runner?.completeRep();
    this.afterAdvance();
  }

  /** Theory: the set is answered. */
  submitSet(answers: { subject: string; correct: boolean }[]): void {
    this.runner?.submitSet({ answers });
    this.afterAdvance();
  }

  /**
   * The metronome for this exercise — or, in a routine, this item. Saved to
   * it, and heard straight away: swapping the voice mid-run is safe.
   */
  async setMetronomeVoice(id: MetronomeVoiceId): Promise<void> {
    const saving = this.rememberMetronome(id);
    this.syncMetronome(this.runner?.currentPhrase?.timeSignature);
    await saving;
  }

  /** Off, or back to the last metronome that was on: the reflex to kill the click. */
  toggleMetronome(): Promise<void> {
    return this.setMetronomeVoice(
      this.current.metronome === 'off' ? this.lastMetronome : 'off',
    );
  }

  async setLoop(on: boolean): Promise<void> {
    this.applyLoop(on);
    await this.deps.saveAudioSettings({ loop: on });
  }

  /** None, the drone, or a track — remembered on the exercise or routine. */
  async chooseBacking(choice: BackingChoice): Promise<void> {
    this.backing.choose(choice);
    await this.saveBacking(choice);
  }

  /** Tear it all down. Leaving the screen calls this; there is no End button. */
  async end(): Promise<void> {
    this.backing.dispose();
    this.endRunner();
    const { audio } = this.deps;
    audio.metronome.stop();
    audio.phrase.clear();
    audio.clock.stop();
    this.listeners.clear();
    await this.deps.repos.sessions.end(this.sessionId, this.deps.now());
  }

  // ------------------------------------------------------------- internals

  /**
   * Start the AudioContext. The promise must be made inside the click — the
   * classic silent-app bug — so callers start it before anything awaits.
   */
  protected async startAudio(starting: Promise<void>): Promise<void> {
    await starting;
    this.deps.audio.setMasterVolume(this.deps.settings().audio.masterVolumeDb);
    this.update({ audioReady: true });
  }

  /**
   * Show the current exercise's metronome, and hand it to the engine for a
   * phrase in this signature. Called as each exercise starts, and on a change.
   */
  protected syncMetronome(timeSignature?: TimeSignature): void {
    const id = this.currentMetronome();
    if (id !== 'off') this.lastMetronome = id;
    else if (this.lastMetronome === 'off') this.lastMetronome = 'click';
    if (id !== this.current.metronome) this.update({ metronome: id });
    if (timeSignature) this.deps.audio.setMetronomeVoice(id, timeSignature);
  }

  /** Back at the brief, or finished: nothing sounds. */
  protected silence(): void {
    this.deps.audio.metronome.stop();
    this.deps.audio.phrase.clear();
    this.backing.generated?.clear();
    this.backing.stop();
  }

  /** A write nobody waits on. It still must not fail silently. */
  protected persist(write: Promise<unknown>): void {
    write.catch((error: unknown) => {
      if (this.deps.onError) this.deps.onError(error);
      else console.error(error);
    });
  }

  /**
   * The progression this roll picks. Seeded from the variation, so the same
   * roll always picks the same one and a re-roll may pick another.
   */
  private planFor(runner: ExerciseRunner | null): GeneratedPlan | null {
    const variation = runner?.snapshot.variation;
    if (!runner || !variation || runner.currentInstance?.kind !== 'played') return null;
    const settings = this.generatedSettings();
    const rng = mulberry32(hashSeed(variation.seed, 'backing'));
    return { settings, progression: pickProgression(settings, runner.snapshot.keyMode, rng) };
  }

  /** The chords the generated backing plays this pass, if it is chosen and can play. */
  private chordsNow(): ChordSpan[] | null {
    const { runner, generated: plan, backing } = this.current;
    const phrase = runner?.currentPhrase ?? null;
    const chosen = backing.resolved.kind === 'generated';
    const freeTime = runner?.snapshot.freeTime ?? false;
    const last = this.laidOut;
    if (
      last &&
      last.plan === plan &&
      last.phrase === phrase &&
      last.chosen === chosen &&
      last.freeTime === freeTime
    ) {
      return last.chords;
    }
    const chords =
      chosen && runner && plan
        ? passTimeline(plan, runner.snapshot.keyMode, phrase, freeTime)
        : null;
    this.laidOut = { plan, phrase, chosen, freeTime, chords };
    return chords;
  }

  /**
   * Hand the generated backing this pass, from its bar 1 — every pass, so each
   * sounds the same and a routine's next item plays its own progression. It
   * needs a clock, and a pattern written for the phrase's signature.
   */
  private loadGenerated(phrase: Phrase | null, atTick: number, freeTime: boolean): void {
    const source = this.backing.generated;
    if (!source) return;
    const runner = this.runner;
    const plan = this.planFor(runner);
    const keyMode = runner?.snapshot.keyMode;
    const timeline = plan && keyMode ? passTimeline(plan, keyMode, phrase, freeTime) : null;
    if (!plan || !keyMode || !phrase || !timeline) {
      source.clear();
      return;
    }
    const { chords, style } = plan.settings;
    source.loadPass(
      renderPass(timeline, compById(style), keyMode, chords, phrase.totalTicks),
      atTick,
    );
  }

  /** What to do with the audio as each pass starts. */
  protected readonly sound = ({
    phrase,
    countInTicks,
    freeTime,
    continuation,
    countInFrom,
  }: RepStartInfo): void => {
    const { audio } = this.deps;
    // A track plays instead of the notes; the drone and generated play under them. Under a
    // track the recording is the click and the count-in, so the metronome says
    // nothing.
    const underTrack = this.backing.underTrack;
    const notes = underTrack ? null : phrase;
    audio.metronome.setSilenced(underTrack);
    if (continuation) {
      // Straight on from the last pass or item: the clock and the click never
      // stopped, so only the notes need scheduling again — and a count-in in
      // the middle of the clock needs to click even when the metronome is off.
      if (countInFrom !== undefined) {
        audio.metronome.countInBetween(countInFrom, countInTicks);
        // A routine's next item, with a metronome of its own.
        if (phrase) this.syncMetronome(phrase.timeSignature);
      }
      audio.phrase.clear();
      if (notes) audio.phrase.load(notes, this.instrument, countInTicks);
      this.loadGenerated(phrase, countInTicks, freeTime);
      return;
    }
    audio.metronome.stop();
    audio.phrase.clear();
    this.backing.generated?.clear();
    if (freeTime) return;
    // The metronome always runs, muted or not: the count-in clicks either way,
    // and switching it mid-bar must not shift the beat.
    if (phrase) audio.configureMetronome({ timeSignature: phrase.timeSignature, countInTicks });
    this.syncMetronome(phrase?.timeSignature);
    audio.metronome.start();
    // The phrase goes after the count-in, not at zero, and the backing with it.
    if (notes) audio.phrase.load(notes, this.instrument, countInTicks);
    this.loadGenerated(phrase, countInTicks, freeTime);
  };
}

/**
 * The chords of one pass, or null where the generated backing can't play: no
 * phrase (a theory set), free time (no clock), or a style written for another
 * time signature.
 */
function passTimeline(
  plan: GeneratedPlan,
  keyMode: KeyMode,
  phrase: Phrase | null,
  freeTime: boolean,
): ChordSpan[] | null {
  const { timeSignature } = compById(plan.settings.style);
  if (
    !phrase ||
    freeTime ||
    timeSignature.beats !== phrase.timeSignature.beats ||
    timeSignature.unit !== phrase.timeSignature.unit
  ) {
    return null;
  }
  return chordTimeline(plan.progression, keyMode, plan.settings.chords, phrase);
}
