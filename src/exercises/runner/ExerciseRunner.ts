import type { KeyMode } from '@/domain/music';
import type { Instrument } from '@/domain/instrument';
import type { Phrase } from '@/domain/phrase';
import { ticksPerBar } from '@/domain/phrase';
import type { Clock } from '@/domain/time';
import type { AxisPolicies, CoverageCounts, RolledVariation } from '@/domain/variation';
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
  /**
   * Passes one press of Play runs, back to back on the same material. 1 for
   * standalone practice; a routine item's rep count. Default 1.
   */
  passes?: number;
  /** Keep playing the same material pass after pass. Changeable while running. */
  loop?: boolean;
  /** Go to `done` once the passes are played, instead of back to ready. For routines. */
  endWhenFinished?: boolean;
  freeTime?: boolean;
  countInBars?: 0 | 1 | 2;
  /** Previous axis values, for `hold` policies and freshness. */
  heldAxisValues?: Record<string, string>;
  axisPolicies?: AxisPolicies;
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
  /** The tick the phrase starts at: after the count-in, or where the last pass ended. */
  countInTicks: number;
  /**
   * A loop or a routine's next pass, running straight on from the last. The
   * clock has not stopped, so the metronome must be left alone — only the
   * phrase needs scheduling again.
   */
  continuation: boolean;
  tempo: number | null;
  freeTime: boolean;
  repIndex: number;
}

export type RunnerListener = (snapshot: RunnerSnapshot) => void;

/** Settings changed from inside a running exercise. */
export interface Reconfiguration {
  params?: unknown;
  tempo?: TempoConfig;
  axisPolicies?: AxisPolicies;
}

/**
 * Drives one exercise: roll once, then play the material as often as asked.
 *
 * A variation is rolled when the exercise opens and stays put until the player
 * re-rolls — never automatically between passes. Each finished pass is logged.
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
  /** Passes finished since opening — the rep log's index. */
  private passesPlayed = 0;
  /** Passes finished since Play was pressed. */
  private passesThisRun = 0;
  private variation: RolledVariation | null = null;
  private instance: ExerciseInstance | null = null;
  private currentTempo: number | null = null;
  private repStartedAt = 0;
  private currentKeyMode: KeyMode | null = null;
  /**
   * Bumped on every re-roll and folded into the seed.
   *
   * Without it the seed is (session, exercise), so re-rolling regenerates
   * exactly what was there — the button appeared to do nothing.
   */
  private rollAttempt = 0;
  private countInTicks = 0;
  /** Tick the current pass's phrase starts at. Passes after the first run straight on. */
  private passStartTick = 0;
  private completed: RepRecord[] = [];

  constructor(config: RunnerConfig) {
    this.config = config;
  }

  // ---------------------------------------------------------------- reading

  get snapshot(): RunnerSnapshot {
    const raw = this.config.clock.ticks;
    return {
      state: this.state,
      passesPlayed: this.passesPlayed,
      passes: this.passes,
      loop: this.config.loop ?? false,
      variation: this.variation,
      phraseTick: Math.max(0, raw - this.passStartTick),
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

  private get passes(): number {
    return Math.max(1, this.config.passes ?? 1);
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

  /** Roll the variation and show it, ready to play. */
  start(): void {
    if (this.state !== 'idle') return;
    this.passesPlayed = 0;
    this.completed = [];
    this.rollAttempt = 0;
    this.roll();
    this.currentTempo = this.startTempo();
    this.setState('brief');
  }

  /** Play from the ready state. Nothing starts on its own. */
  begin(): void {
    if (this.state !== 'brief') return;
    this.passesThisRun = 0;
    this.beginPass();
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
   * Finish the current pass. Called by the player in free time, and by the
   * clock when a metered phrase reaches its end.
   */
  completeRep(outcome: RepOutcome = 'completed'): void {
    if (this.state !== 'playing' && this.state !== 'paused' && this.state !== 'count-in') return;
    this.finishPass(outcome);
  }

  /**
   * A new variation, back to ready. The only way a variation changes.
   *
   * Asking for something new also releases any `hold`: an axis set to hold is
   * meant to stay put until you say otherwise, and this is you saying so.
   */
  reroll(): void {
    if (this.state === 'done' || this.state === 'idle') return;
    this.stopPass();
    this.rollAttempt += 1;
    const policies: AxisPolicies = { ...this.config.axisPolicies };
    for (const [id, policy] of Object.entries(policies)) {
      if (policy.mode === 'hold') policies[id as keyof AxisPolicies] = { mode: 'roll' };
    }
    // Against what is on screen, so the strip highlights what actually changed.
    this.roll({ policies, held: this.variation ? variationKeys(this.variation) : {} });
    this.setState('brief');
  }

  /**
   * Apply settings changed mid-exercise, and show the result, ready to play.
   *
   * Only the axes whose policy changed are rolled again — pinning the key to G
   * should give you G, not a new position and rhythm as well. Everything else
   * keeps the value it has.
   */
  reconfigure(changes: Reconfiguration): void {
    if (this.state === 'done' || this.state === 'idle') return;
    this.stopPass();

    if (changes.params !== undefined) this.config.params = changes.params;
    if (changes.tempo) {
      const targetMoved = changes.tempo.targetTempo !== this.config.tempo.targetTempo;
      this.config.tempo = changes.tempo;
      if (targetMoved) this.currentTempo = this.startTempo();
    }

    const previous = this.variation;
    if (changes.axisPolicies && previous) {
      const before = this.config.axisPolicies ?? {};
      const after = changes.axisPolicies;
      this.config.axisPolicies = after;
      const kept = variationKeys(previous);
      const policies: AxisPolicies = {};
      const changed = new Set<string>();

      for (const id of this.config.definition.axes) {
        if (JSON.stringify(before[id] ?? { mode: 'roll' }) !== JSON.stringify(after[id] ?? { mode: 'roll' })) {
          changed.add(id);
          const policy = after[id];
          if (policy) policies[id] = policy;
        } else if (kept[id] !== undefined) {
          policies[id] = { mode: 'fixed', value: kept[id] };
        }
      }

      this.rollAttempt += 1;
      this.roll({ policies, held: kept });

      // What was kept is shown as it was: still rolled, not suddenly "fixed".
      for (const [id, axis] of Object.entries(this.variation!.axes)) {
        const old = previous.axes[id as keyof typeof previous.axes];
        if (!changed.has(id) && old) {
          this.variation!.axes[id as keyof typeof previous.axes] = {
            ...axis,
            source: old.source,
            fresh: false,
          };
        }
      }
    } else {
      this.generate();
    }

    this.setState('brief');
  }

  /** Leave the exercise. Any pass in progress is logged as abandoned. */
  end(): void {
    if (this.state === 'done') return;
    this.stopPass();
    this.setState('done');
  }

  /** Keep going after this pass, or stop at the end of it. */
  setLoop(loop: boolean): void {
    this.config.loop = loop;
    this.emit();
  }

  /** Takes effect the next time Play is pressed. */
  setCountInBars(bars: 0 | 1 | 2): void {
    this.config.countInBars = bars;
    this.emit();
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

  private startTempo(): number | null {
    return this.isFreeTime
      ? null
      : resolveStartTempo(this.config.tempo, this.config.tempoPlan, 0);
  }

  /** Roll a variation and generate its material. */
  private roll(options: { policies?: AxisPolicies; held?: Record<string, string> } = {}): void {
    const { definition, instrument, sessionKeyMode, sessionId, exerciseId } = this.config;
    // `held` is what a hold keeps and what freshness is judged against.
    const held = options.held ?? this.config.heldAxisValues ?? {};
    const policies = options.policies ?? this.config.axisPolicies;

    this.variation = rollVariation({
      axes: definition.axes,
      seed: hashSeed(sessionId, exerciseId, 0, this.rollAttempt),
      instrument,
      ...(policies ? { policies } : {}),
      held,
      ...(this.config.coverage ? { coverage: this.config.coverage } : {}),
      sessionKeyMode,
    });
    this.generate();
  }

  /** Material for the current variation and params. */
  private generate(): void {
    if (!this.variation) return;
    const { definition, instrument, sessionKeyMode } = this.config;

    // An exercise that rolls its own key must be generated in that key, not in
    // the session's. The session key is only the fallback for exercises that
    // do not declare one — a routine sharing a key across its exercises.
    this.currentKeyMode = variationKeyMode(this.variation, sessionKeyMode) ?? sessionKeyMode;

    this.instance = definition.generate({
      variation: this.variation,
      keyMode: this.currentKeyMode,
      instrument,
      params: this.config.params,
      rng: mulberry32(this.variation.seed),
      repIndex: this.passesPlayed,
    });
  }

  /** Start playing from the ready state, counting in first. */
  private beginPass(): void {
    const { clock } = this.config;
    this.clearScheduled();
    clock.stop();
    clock.seek(0);

    this.repStartedAt = this.config.now();

    if (this.isFreeTime) {
      // No clock, no count-in, no playhead. The pass ends when the player says.
      this.countInTicks = 0;
      this.passStartTick = 0;
      this.config.onRepStart?.({
        phrase: this.currentPhrase,
        countInTicks: 0,
        continuation: false,
        tempo: null,
        freeTime: true,
        repIndex: this.passesPlayed,
      });
      this.setState('playing');
      return;
    }

    if (this.currentTempo !== null) clock.setBpm(this.currentTempo);

    const phrase = this.currentPhrase;
    const bars = phrase ? ticksPerBar(phrase.timeSignature) : 0;
    this.countInTicks = bars * (this.config.countInBars ?? 0);
    this.passStartTick = this.countInTicks;

    if (this.countInTicks > 0) {
      this.setState('count-in');
      this.handles.push(clock.schedule(() => this.setState('playing'), this.countInTicks));
    } else {
      this.setState('playing');
    }

    this.scheduleEnd();
    this.config.onRepStart?.({
      phrase,
      countInTicks: this.passStartTick,
      continuation: false,
      tempo: this.currentTempo,
      freeTime: false,
      repIndex: this.passesPlayed,
    });

    clock.start();
  }

  /**
   * The next pass of a loop or a routine item, straight on from the last with
   * no count-in and no stop: the clock keeps running, so the beat never slips.
   */
  private continuePass(): void {
    this.repStartedAt = this.config.now();
    this.passStartTick = this.config.clock.ticks;
    this.scheduleEnd();
    this.config.onRepStart?.({
      phrase: this.currentPhrase,
      countInTicks: this.passStartTick,
      continuation: true,
      tempo: this.currentTempo,
      freeTime: false,
      repIndex: this.passesPlayed,
    });
    this.emit();
  }

  private scheduleEnd(): void {
    const phrase = this.currentPhrase;
    if (!phrase) return;
    const length = phrase.totalTicks * (phrase.repeat ?? 1);
    this.handles.push(
      this.config.clock.schedule(() => this.finishPass('completed'), this.passStartTick + length),
    );
  }

  /** Stop whatever is playing, logging an unfinished pass as abandoned. */
  private stopPass(): void {
    if (this.state === 'playing' || this.state === 'paused' || this.state === 'count-in') {
      this.finishPass('abandoned', { stop: true });
    }
    this.clearScheduled();
    this.config.clock.stop();
  }

  private finishPass(outcome: RepOutcome, options: { stop?: boolean } = {}): void {
    this.clearScheduled();

    if (this.variation) {
      const record: RepRecord = {
        exerciseId: this.config.exerciseId,
        definitionId: this.config.definition.id,
        index: this.passesPlayed,
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
      // What was played is what a `hold` keeps next time.
      this.config.heldAxisValues = variationKeys(this.variation);
    }

    this.passesPlayed += 1;
    this.passesThisRun += 1;
    if (options.stop) return;

    const again = this.config.loop || this.passesThisRun < this.passes;
    if (again && !this.isFreeTime) {
      this.continuePass();
      return;
    }
    this.config.clock.stop();
    this.setState(this.config.endWhenFinished ? 'done' : 'brief');
  }

  private clearScheduled(): void {
    for (const handle of this.handles) this.config.clock.clear(handle);
    this.handles = [];
  }
}
