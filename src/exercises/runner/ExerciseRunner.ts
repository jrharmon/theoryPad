import type { KeyMode } from '@/domain/music';
import type { Instrument } from '@/domain/instrument';
import type { Phrase } from '@/domain/phrase';
import { ticksPerBar } from '@/domain/phrase';
import type { Clock } from '@/domain/time';
import type { CoverageCounts, RolledVariation } from '@/domain/variation';
import {
  hashSeed,
  mulberry32,
  rollVariation,
  variationKeyMode,
  variationKeys,
} from '@/domain/variation';
import type { TempoConfig, TempoPlan } from '@/domain/tempo';
import { clampTempo, resolveStartTempo } from '@/domain/tempo';
import type { AnyExerciseDefinition, ExerciseInstance } from '../types';
import type { RepOutcome, RepRecord, RunnerSnapshot, RunnerState } from './types';

export interface RunnerConfig {
  clock: Clock;
  definition: AnyExerciseDefinition;
  /** Persisted id of the configured exercise, for the rep log. */
  exerciseId: string;
  instrument: Instrument;
  sessionId: string;
  sessionKeyMode: KeyMode;
  params: unknown;
  tempo: TempoConfig;
  tempoPlan?: TempoPlan;
  reps: number;
  freeTime?: boolean;
  countInBars?: 0 | 1 | 2;
  /** Previous axis values, for `hold` policies and freshness. */
  heldAxisValues?: Record<string, string>;
  axisPolicies?: Parameters<typeof rollVariation>[0]['policies'];
  coverage?: CoverageCounts;
  /** Injected so the runner stays pure — nothing here reads a real clock. */
  now: () => number;

  /**
   * Called immediately before the clock starts for a rep, so the caller can
   * arrange sound against the same timeline. The runner owns count-in timing,
   * so the phrase must be scheduled at `countInTicks`, not at zero.
   */
  onRepStart?: (info: RepStartInfo) => void;
  /** Called as each rep ends, so the caller can persist it. */
  onRepEnd?: (rep: RepRecord) => void;
}

export interface RepStartInfo {
  phrase: Phrase | null;
  countInTicks: number;
  tempo: number | null;
  freeTime: boolean;
  repIndex: number;
}

export type RunnerListener = (snapshot: RunnerSnapshot) => void;

/**
 * Drives one exercise through its reps.
 *
 * This lives under src/exercises rather than src/domain because it depends on
 * ExerciseDefinition, and the import direction runs exercises -> domain. It is
 * pure in the same sense regardless: no React, no DOM, no persistence, and
 * every clock reading injected.
 *
 * Everything time-based goes through the injected Clock, so this is fully
 * testable with FakeClock and no audio at all — a three-rep exercise runs in a
 * test in microseconds. Sound is the caller's job: it watches the same clock.
 *
 * The same machine serves standalone practice and a chained routine; a routine
 * is this with a playlist wrapped around it.
 */
export class ExerciseRunner {
  private readonly config: RunnerConfig;
  private readonly listeners = new Set<RunnerListener>();
  private handles: number[] = [];

  private state: RunnerState = 'idle';
  private repIndex = 0;
  private variation: RolledVariation | null = null;
  private instance: ExerciseInstance | null = null;
  private currentTempo: number | null = null;
  private repStartedAt = 0;
  private currentKeyMode: KeyMode | null = null;
  /**
   * Bumped on every re-roll and folded into the seed.
   *
   * Without it the seed is (session, exercise, rep), so re-rolling regenerates
   * exactly what was there — the button appeared to do nothing.
   */
  private rollAttempt = 0;
  private countInTicks = 0;
  private completed: RepRecord[] = [];

  constructor(config: RunnerConfig) {
    this.config = config;
  }

  // ---------------------------------------------------------------- reading

  get snapshot(): RunnerSnapshot {
    const raw = this.config.clock.ticks;
    return {
      state: this.state,
      repIndex: this.repIndex,
      totalReps: this.config.reps,
      variation: this.variation,
      phraseTick: Math.max(0, raw - this.countInTicks),
      countInRemaining: Math.max(0, this.countInTicks - raw),
      currentTempo: this.currentTempo,
      targetTempo: this.config.tempo.targetTempo,
      freeTime: this.isFreeTime,
      keyMode: this.currentKeyMode ?? this.config.sessionKeyMode,
      instrument: this.config.instrument,
    };
  }

  get currentInstance(): ExerciseInstance | null {
    return this.instance;
  }

  get currentPhrase(): Phrase | null {
    return this.instance?.kind === 'played' ? this.instance.phrase : null;
  }

  /** Reps finished so far, for the caller to persist. */
  get completedReps(): readonly RepRecord[] {
    return this.completed;
  }

  private get isFreeTime(): boolean {
    if (this.config.definition.timing === 'free') return true;
    if (this.config.definition.timing === 'metronome') return false;
    return this.config.freeTime ?? false;
  }

  subscribe(listener: RunnerListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snapshot = this.snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }

  private setState(next: RunnerState): void {
    this.state = next;
    this.emit();
  }

  // ------------------------------------------------------------- lifecycle

  /** Roll the first variation and show its brief. */
  start(): void {
    if (this.state !== 'idle') return;
    this.repIndex = 0;
    this.completed = [];
    this.rollAttempt = 0;
    this.prepareRep();
  }

  /**
   * Leave the brief and begin. Nothing advances on its own from the brief —
   * the player reads the whole variation first.
   */
  begin(): void {
    if (this.state !== 'brief') return;
    this.beginRep();
  }

  pause(): void {
    if (this.state !== 'playing' && this.state !== 'count-in') return;
    this.config.clock.pause();
    this.setState('paused');
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.config.clock.start();
    // Coming back mid-count-in should look like the count-in again.
    this.setState(this.config.clock.ticks < this.countInTicks ? 'count-in' : 'playing');
  }

  /**
   * Finish the current rep. Called by the player in free time, and by the
   * clock when a metered phrase reaches its end.
   */
  completeRep(outcome: RepOutcome = 'completed'): void {
    if (this.state === 'idle' || this.state === 'done' || this.state === 'rep-complete') return;
    this.finishRep(outcome);
  }

  skipRep(): void {
    this.completeRep('skipped');
  }

  /**
   * Re-roll this rep's variation and show the brief again.
   *
   * Asking for something new also releases any `hold`: an axis set to hold is
   * meant to stay put until you say otherwise, and this is you saying so.
   */
  reroll(): void {
    if (this.state === 'done') return;
    this.clearScheduled();
    this.config.clock.stop();
    this.rollAttempt += 1;
    this.prepareRep({ releaseHolds: true });
  }

  /** Abandon the exercise. Any rep in progress is logged as abandoned. */
  end(): void {
    if (this.state === 'done') return;
    if (this.state === 'playing' || this.state === 'paused' || this.state === 'count-in') {
      this.finishRep('abandoned', true);
    }
    this.clearScheduled();
    this.config.clock.stop();
    this.setState('done');
  }

  // ---------------------------------------------------------------- tempo

  /**
   * Move the working tempo. This never touches `targetTempo`: raising the
   * configured tempo is always an explicit, separate action.
   */
  setTempo(bpm: number): void {
    if (this.currentTempo === null) return;
    this.currentTempo = clampTempo(bpm);
    this.config.clock.setBpm(this.currentTempo);
    this.emit();
  }

  nudgeTempo(delta: number): void {
    if (this.currentTempo !== null) this.setTempo(this.currentTempo + delta);
  }

  /** Turn the metronome on or off between reps. */
  setFreeTime(freeTime: boolean): void {
    if (this.config.definition.timing === 'free' || this.config.definition.timing === 'metronome') {
      return;
    }
    this.config.freeTime = freeTime;
    this.emit();
  }

  // ------------------------------------------------------------- internals

  private prepareRep(options: { releaseHolds?: boolean } = {}): void {
    const { definition, instrument, sessionKeyMode, sessionId, exerciseId } = this.config;
    const held = options.releaseHolds ? {} : (this.config.heldAxisValues ?? {});

    const seed = hashSeed(sessionId, exerciseId, this.repIndex, this.rollAttempt);

    this.variation = rollVariation({
      axes: definition.axes,
      seed,
      instrument,
      ...(this.config.axisPolicies ? { policies: this.config.axisPolicies } : {}),
      held,
      ...(this.config.coverage ? { coverage: this.config.coverage } : {}),
      sessionKeyMode,
    });

    // An exercise that rolls its own key must be generated in that key, not in
    // the session's. The session key is only the fallback for exercises that
    // do not declare one — a routine sharing a key across its exercises.
    this.currentKeyMode = variationKeyMode(this.variation, sessionKeyMode) ?? sessionKeyMode;

    this.instance = definition.generate({
      variation: this.variation,
      keyMode: this.currentKeyMode,
      instrument,
      params: this.config.params,
      rng: mulberry32(seed),
      repIndex: this.repIndex,
    });

    this.currentTempo = this.isFreeTime
      ? null
      : resolveStartTempo(this.config.tempo, this.config.tempoPlan, this.repIndex);

    this.setState('brief');
  }

  private beginRep(): void {
    const { clock } = this.config;
    this.clearScheduled();
    clock.stop();
    clock.seek(0);

    this.repStartedAt = this.config.now();

    if (this.isFreeTime) {
      // No clock, no count-in, no playhead. The rep ends when the player says.
      this.countInTicks = 0;
      this.config.onRepStart?.({
        phrase: this.currentPhrase,
        countInTicks: 0,
        tempo: null,
        freeTime: true,
        repIndex: this.repIndex,
      });
      this.setState('playing');
      return;
    }

    if (this.currentTempo !== null) clock.setBpm(this.currentTempo);

    const phrase = this.currentPhrase;
    const bars = phrase ? ticksPerBar(phrase.timeSignature) : 0;
    this.countInTicks = bars * (this.config.countInBars ?? 0);

    if (this.countInTicks > 0) {
      this.setState('count-in');
      this.handles.push(clock.schedule(() => this.setState('playing'), this.countInTicks));
    } else {
      this.setState('playing');
    }

    if (phrase) {
      const length = phrase.totalTicks * (phrase.repeat ?? 1);
      this.handles.push(
        clock.schedule(() => this.finishRep('completed'), this.countInTicks + length),
      );
    }

    this.config.onRepStart?.({
      phrase,
      countInTicks: this.countInTicks,
      tempo: this.currentTempo,
      freeTime: false,
      repIndex: this.repIndex,
    });

    clock.start();
  }

  private finishRep(outcome: RepOutcome, silent = false): void {
    this.clearScheduled();
    this.config.clock.stop();

    if (this.variation) {
      const record: RepRecord = {
        exerciseId: this.config.exerciseId,
        definitionId: this.config.definition.id,
        index: this.repIndex,
        startedAt: this.repStartedAt || this.config.now(),
        endedAt: this.config.now(),
        tempo: this.currentTempo,
        freeTime: this.isFreeTime,
        axes: variationKeys(this.variation),
        seed: this.variation.seed,
        status: outcome,
      };
      this.completed.push(record);
      this.config.onRepEnd?.(record);
      // What this rep rolled becomes what the next one holds.
      this.config.heldAxisValues = variationKeys(this.variation);
    }

    if (silent) return;

    this.repIndex += 1;
    if (this.repIndex >= this.config.reps) {
      this.setState('done');
      return;
    }

    this.setState('rep-complete');

    const rerollPolicy = this.config.definition.rerollPolicy ?? 'per-rep';
    if (rerollPolicy === 'per-rep') {
      this.prepareRep();
    } else {
      // Same variation for every rep — repetition is the point of the exercise.
      this.setState('brief');
    }
  }

  private clearScheduled(): void {
    for (const handle of this.handles) this.config.clock.clear(handle);
    this.handles = [];
  }
}
