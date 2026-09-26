import type { KeyMode } from '@/domain/music';
import { pitchClass } from '@/domain/music';
import type { Instrument } from '@/domain/instrument';
import type { Clock } from '@/domain/time';
import type { CountInBars } from '@/domain/phrase';
import type { AxisPolicies, AxisValueKeys, RolledVariation } from '@/domain/variation';
import {
  SESSION_AXIS_ORDER,
  hashSeed,
  rollVariation,
  variationKeyMode,
} from '@/domain/variation';
import type { TempoConfig } from '@/domain/tempo';
import { routineItemRun } from '../params';
import type { AnyExerciseDefinition, ExerciseInstance } from '../types';
import { ExerciseRunner, type RepStartInfo } from './ExerciseRunner';
import type { RepRecord, RunnerSnapshot } from './types';

/** One item, as the runner needs it: the definition and the item's own settings. */
export interface RoutineRunItem {
  id: string;
  exerciseId: string;
  definition: AnyExerciseDefinition;
  /** Passes — or, for a theory set, how many questions it asks. */
  reps: number;
  params: unknown;
  tempo: TempoConfig;
  /** The item's own count-in — it counts this item in wherever it falls in the routine. */
  countInBars?: CountInBars;
  axisPolicies: AxisPolicies;
  heldAxisValues: Record<string, string>;
  /** Theory: lean toward subjects missed or seen least. */
  subjectWeights?: Readonly<Record<string, number>>;
}

export interface RoutineRunnerConfig {
  clock: Clock;
  instrument: Instrument;
  sessionId: string;
  items: RoutineRunItem[];
  /** Key and mode, rolled once for the whole run. */
  sessionAxisPolicies?: AxisPolicies;
  /** The player's app-wide "never roll these": the routine's key and mode avoid them. */
  blocked?: AxisValueKeys;
  /** For an item that carries none of its own. */
  countInBars?: CountInBars;
  loop?: boolean;
  now: () => number;
  onRepStart?: (info: RepStartInfo) => void;
  onRepEnd?: (rep: RepRecord & { routineItemId: string }) => void;
}

/**
 * `running`: an item is current — ready, counting in, playing or paused; a
 * routine opens here, on its first item, waiting for Play. `done`: every item
 * has had its passes.
 */
export type RoutinePhase = 'running' | 'done';

export interface RoutineItemSnapshot {
  id: string;
  definitionId: string;
  reps: number;
  instance: ExerciseInstance | null;
  variation: RolledVariation | null;
  /** Passes played to the end — skipped and abandoned ones do not count. */
  completed: number;
  /** Skipped before it had all its passes. */
  skipped: boolean;
}

export interface RoutineSnapshot {
  phase: RoutinePhase;
  index: number;
  keyMode: KeyMode;
  items: RoutineItemSnapshot[];
  /** The current item's own snapshot, while running. */
  current: RunnerSnapshot | null;
  /** When Play was first pressed; null until then. */
  startedAt: number | null;
  endedAt: number | null;
}

/**
 * A routine: several exercises played through without touching anything.
 *
 * Every item is rolled up front, and nothing changes after that unless the
 * player re-rolls the item in front of them. Key and mode are rolled once and
 * shared.
 *
 * One clock runs the whole thing. When an item has had its passes the next
 * counts in on the same running clock at its own tempo — the count-in is the
 * only pause between items, and the only warning of a tempo change.
 */
export class RoutineRunner {
  private readonly config: RoutineRunnerConfig;
  private readonly listeners = new Set<(snapshot: RoutineSnapshot) => void>();
  private runners: ExerciseRunner[] = [];
  private unsubscribers: (() => void)[] = [];
  private phase: RoutinePhase = 'running';
  private index = 0;
  private keyMode: KeyMode = { tonic: pitchClass('C'), scale: 'major', mode: 'ionian' };
  private startedAt: number | null = null;
  private endedAt: number | null = null;
  private results = new Map<string, { completed: number; skipped: boolean }>();

  constructor(config: RoutineRunnerConfig) {
    this.config = config;
  }

  // ---------------------------------------------------------------- reading

  get snapshot(): RoutineSnapshot {
    return {
      phase: this.phase,
      index: this.index,
      keyMode: this.keyMode,
      items: this.runners.map((runner, i) => {
        const item = this.config.items[i]!;
        const snap = runner.snapshot;
        return {
          id: item.id,
          definitionId: item.definition.id,
          reps: item.reps,
          instance: runner.currentInstance,
          variation: snap.variation,
          completed: this.results.get(item.id)?.completed ?? 0,
          skipped: this.results.get(item.id)?.skipped ?? false,
        };
      }),
      current: this.phase === 'running' ? (this.current?.snapshot ?? null) : null,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
    };
  }

  /** The item being played, or about to be. */
  get current(): ExerciseRunner | null {
    return this.runners[this.index] ?? null;
  }

  subscribe(listener: (snapshot: RoutineSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snapshot = this.snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }

  // ------------------------------------------------------------------ open

  /** Roll key and mode, then every item, and wait on the first for Play. */
  open(): void {
    const { instrument, sessionId, sessionAxisPolicies } = this.config;
    const session = rollVariation({
      axes: SESSION_AXIS_ORDER,
      seed: hashSeed(sessionId, 'routine', 0, 0),
      instrument,
      ...(sessionAxisPolicies ? { policies: sessionAxisPolicies } : {}),
      ...(this.config.blocked ? { blocked: this.config.blocked } : {}),
    });
    this.keyMode = variationKeyMode(session) ?? this.keyMode;
    const shared: AxisPolicies = {
      scale: { mode: 'fixed', value: this.keyMode.scale },
      mode: { mode: 'fixed', value: this.keyMode.mode },
      key: { mode: 'fixed', value: this.keyMode.tonic },
    };

    this.runners = this.config.items.map((item) => {
      const { params, passes } = routineItemRun(item.definition, item);
      const runner = new ExerciseRunner({
        clock: this.config.clock,
        definition: item.definition,
        exerciseId: item.exerciseId,
        seedKey: `${item.id}:0`,
        instrument,
        sessionId,
        sessionKeyMode: this.keyMode,
        params,
        tempo: item.tempo,
        passes,
        endWhenFinished: true,
        loop: this.config.loop ?? false,
        countInBars: item.countInBars ?? this.config.countInBars ?? 0,
        heldAxisValues: item.heldAxisValues,
        ...(item.subjectWeights ? { subjectWeights: item.subjectWeights } : {}),
        // Key, scale and mode belong to the routine, whatever the item's own policy.
        axisPolicies: { ...item.axisPolicies, ...shared },
        now: this.config.now,
        ...(this.config.onRepStart ? { onRepStart: this.config.onRepStart } : {}),
        onRepEnd: (rep) => {
          const result = this.results.get(item.id) ?? { completed: 0, skipped: false };
          if (rep.status === 'completed') result.completed += 1;
          if (rep.status === 'skipped') result.skipped = true;
          this.results.set(item.id, result);
          this.config.onRepEnd?.({ ...rep, routineItemId: item.id });
        },
      });
      runner.start();
      return runner;
    });

    this.unsubscribers = this.runners.map((runner, i) => {
      // What the item was doing before it finished: playing or answering means
      // the routine carries straight on; stopped or paused means it waits.
      let before = runner.snapshot.state;
      return runner.subscribe((snapshot) => {
        const was = before;
        before = snapshot.state;
        if (i === this.index && this.phase === 'running' && snapshot.state === 'done') {
          this.advance(was === 'playing' || was === 'count-in');
          return;
        }
        this.emit();
      });
    });

    this.emit();
  }

  // --------------------------------------------------------------- running

  /** Play the current item if it is waiting — the first time, the routine starts. */
  play(): void {
    if (this.phase !== 'running') return;
    this.startedAt ??= this.config.now();
    this.current?.begin();
    this.emit();
  }

  /** Move to the next item now. A pass in progress is logged as skipped. */
  skip(): void {
    if (this.phase !== 'running' || !this.current) return;
    // Skipped from ready, with no pass in progress, is still a skip.
    const id = this.config.items[this.index]!.id;
    const result = this.results.get(id) ?? { completed: 0, skipped: false };
    this.results.set(id, { ...result, skipped: true });
    // The item goes to `done`, and the subscription moves on from there.
    this.current.skip();
  }

  /**
   * Jump to another item, forward or back, and wait on it for Play. A pass in
   * progress is logged as skipped; items jumped over are left as they were.
   * Going back plays an item again as it was rolled, and the routine carries
   * on in order from there.
   */
  goTo(index: number): void {
    if (this.phase !== 'running' || index === this.index) return;
    const target = this.runners[index];
    if (!target) return;
    const leaving = this.current;
    // Moved first, so everything the item being left emits as it stops is
    // already about the item jumped to.
    this.index = index;
    leaving?.rewind();
    target.rewind();
    this.emit();
  }

  pause(): void {
    this.current?.pause();
  }

  resume(): void {
    this.current?.resume();
  }

  setTempo(bpm: number): void {
    this.current?.setTempo(bpm);
  }

  nudgeTempo(delta: number): void {
    this.current?.nudgeTempo(delta);
  }

  /** Stay on the current item, pass after pass, until switched off. */
  setLoop(loop: boolean): void {
    this.config.loop = loop;
    for (const runner of this.runners) runner.setLoop(loop);
  }

  /** The current item's count-in — each item has its own, as it has its own tempo. */
  setCountInBars(bars: CountInBars): void {
    const item = this.config.items[this.index];
    if (item) item.countInBars = bars;
    this.current?.setCountInBars(bars);
    this.emit();
  }

  /**
   * Stop the current item and wait on it, ready to play it again from the top.
   * A routine runs hands-off, but a pass that fell apart should not have to be
   * played out or skipped.
   */
  stop(): void {
    if (this.phase !== 'running' || !this.current) return;
    this.current.stop();
    this.config.clock.stop();
    this.emit();
  }

  /** Re-roll the current item's own axes. Key and mode stay the routine's. */
  rerollCurrent(): void {
    this.current?.reroll();
  }

  /** Leave. A pass in progress is logged as abandoned. */
  end(): void {
    // Unsubscribe first: the item ending goes to `done`, which would otherwise
    // read as finished and start the next one.
    for (const off of this.unsubscribers) off();
    this.unsubscribers = [];
    if (this.phase === 'running') this.current?.end();
    this.config.clock.stop();
  }

  /**
   * The current item is finished — played out, answered, or skipped. If it
   * was going, the next counts in straight away; if it was stopped or
   * paused, the next waits for Play.
   */
  private advance(active: boolean): void {
    if (!active) this.config.clock.stop();
    this.moveOn({ start: active });
  }

  private moveOn({ start }: { start: boolean }): void {
    this.index += 1;
    if (this.index >= this.runners.length) {
      this.index = this.runners.length - 1;
      this.phase = 'done';
      this.endedAt = this.config.now();
      this.config.clock.stop();
      this.emit();
      return;
    }
    if (start) {
      // The next item counts itself in exactly as it would standalone: the
      // count-in is the only pause between items, and how long it wants is
      // that exercise's business.
      const next = this.config.items[this.index];
      this.current?.beginNext(next?.countInBars ?? this.config.countInBars ?? 0);
    }
    this.emit();
  }
}
