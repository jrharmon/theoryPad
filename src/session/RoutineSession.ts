import { withRequiredTags, type BackingChoice, type Routine } from '@/data';
import type { MetronomeVoiceId } from '@/domain/drums';
import type { KeyMode } from '@/domain/music';
import type { CountInBars } from '@/domain/phrase';
import { RoutineRunner, type ExerciseRunner, type RoutineRunItem } from '@/exercises/runner';
import { findExerciseDefinition } from '@/exercises/registry';
import type { SessionDeps } from './ports';
import {
  PracticeSession,
  blockedValues,
  criteriaQuery,
  loadSubjectWeights,
  openSessionRow,
} from './PracticeSession';

/**
 * A routine: its items played through on one clock, under one backing. Its
 * settings are saved to the routine and its items.
 */
export class RoutineSession extends PracticeSession {
  readonly routineId: string;
  private readonly routine: RoutineRunner;
  /** Each item's own metronome, by item id; absent is the setting's. */
  private readonly metronomes = new Map<string, MetronomeVoiceId>();

  /** Roll a whole routine for its overview. Nothing plays until `play`. */
  static async open(routine: Routine, deps: SessionDeps): Promise<RoutineSession> {
    const session = await openSessionRow(deps, routine.id);
    // An item whose exercise no longer exists in code is left out rather than
    // failing the whole routine.
    const items: RoutineRunItem[] = [];
    for (const item of routine.items) {
      const definition = findExerciseDefinition(item.definitionId);
      if (!definition) continue;
      items.push(
        definition.kind === 'theory'
          ? {
              ...item,
              definition,
              subjectWeights: await loadSubjectWeights(deps, item.exerciseId),
            }
          : { ...item, definition },
      );
    }
    return new RoutineSession(routine, items, session.id, deps);
  }

  private constructor(
    routine: Routine,
    items: RoutineRunItem[],
    sessionId: string,
    deps: SessionDeps,
  ) {
    super(deps, sessionId);
    this.routineId = routine.id;
    const settings = deps.settings();
    for (const item of routine.items) {
      if (item.metronome) this.metronomes.set(item.id, item.metronome);
    }
    // Every item's, before Play: the routine runs straight through.
    const chosen = routine.items.map((item) => item.metronome ?? settings.audio.metronome);
    for (const id of new Set(chosen)) {
      deps.audio.preloadMetronome(id);
    }

    this.routine = new RoutineRunner({
      clock: deps.audio.clock,
      instrument: this.instrument,
      sessionId,
      items,
      sessionAxisPolicies: routine.sessionAxisPolicies,
      blocked: blockedValues(deps),
      countInBars: settings.audio.countInBars,
      loop: settings.audio.loop,
      now: deps.now,
      onRepStart: this.sound,
      onRepEnd: (rep) => {
        // Logged against the exercise the item came from — its history — and
        // the item remembers what it rolled, for its own `hold` policies.
        this.persist(deps.repos.reps.add({ ...rep, sessionId }));
        this.persist(
          deps.saveRoutineItem(routine.id, rep.routineItemId, { heldAxisValues: rep.axes }),
        );
      },
    });

    let lastItem: ExerciseRunner | null = null;
    this.routine.subscribe((snapshot) => {
      const current = this.routine.current;
      this.update({
        routineSnapshot: snapshot,
        runner: current,
        snapshot: snapshot.current,
        instance: current?.currentInstance ?? null,
      });
      if (snapshot.phase === 'done' || snapshot.current?.state === 'brief') this.silence();
      if (snapshot.phase !== 'running' || !current) return;

      // One track through the routine, at each item's own tempo.
      if (current !== lastItem) {
        lastItem = current;
        this.backing.fitTo(current);
      }
      const state = snapshot.current?.state;
      if (
        current.currentInstance?.kind === 'theory' &&
        (state === 'count-in' || state === 'playing')
      ) {
        this.backing.shelveTrack();
      }
    });

    this.routine.open();
    this.syncMetronome();
    this.backing.open(routine.backing ?? { kind: 'none' }, {
      // One track plays through, so it must suit every played item.
      ...criteriaQuery(
        withRequiredTags(
          routine.backingCriteria,
          items.flatMap((item) => item.definition.backing?.requiredTags ?? []),
        ),
      ),
    });
  }

  get runner(): ExerciseRunner | null {
    return this.routine.current;
  }

  protected get keyMode(): KeyMode {
    return this.routine.snapshot.keyMode;
  }

  async play(): Promise<void> {
    const starting = this.deps.audio.init();
    await this.startAudio(starting);
    if (this.routine.snapshot.phase === 'overview') {
      this.persist(this.deps.saveRoutine(this.routineId, { lastPlayedAt: this.deps.now() }));
    }
    this.routine.play();
    this.afterAdvance();
  }

  stop(): void {
    if (this.backing.state.starting) return;
    // Back to brief: the subscriber stops the click, the notes and the track.
    this.routine.stop();
  }

  reroll(): void {
    this.routine.rerollCurrent();
  }

  /** Move to the next item now. */
  skip(): void {
    this.routine.skip();
    this.afterAdvance();
  }

  /** Overview only: a fresh roll of everything, key and mode included. */
  rerollAll(): void {
    this.routine.rerollAll();
    this.backing.refresh();
  }

  /** Overview only: a fresh roll of one item. */
  rerollItem(index: number): void {
    this.routine.rerollItem(index);
  }

  async setCountIn(bars: CountInBars): Promise<void> {
    this.routine.setCountInBars(bars);
    const { items, index } = this.routine.snapshot;
    const item = items[index];
    if (item) await this.deps.saveRoutineItem(this.routineId, item.id, { countInBars: bars });
  }

  protected applyLoop(on: boolean): void {
    this.routine.setLoop(on);
  }

  protected saveBacking(backing: BackingChoice): Promise<void> {
    return this.deps.saveRoutine(this.routineId, { backing });
  }

  protected currentMetronome(): MetronomeVoiceId {
    const { items, index } = this.routine.snapshot;
    const item = items[index];
    return (item && this.metronomes.get(item.id)) ?? this.deps.settings().audio.metronome;
  }

  protected async rememberMetronome(id: MetronomeVoiceId): Promise<void> {
    const { items, index } = this.routine.snapshot;
    const item = items[index];
    if (!item) return;
    this.metronomes.set(item.id, id);
    await this.deps.saveRoutineItem(this.routineId, item.id, { metronome: id });
  }

  protected endRunner(): void {
    this.routine.end();
  }

  /**
   * A played item has started its clock with the track not yet going — the
   * first item, or the first after a theory set. Called once the runner has
   * finished starting, so the track can hold the clock back until it sounds.
   */
  protected override afterAdvance(): void {
    const current = this.routine.current;
    if (this.routine.snapshot.phase !== 'running' || !current) return;
    if (current.currentInstance?.kind === 'theory') return;
    const state = current.snapshot.state;
    const { started, starting, resolved } = this.backing.state;
    if (
      (state === 'count-in' || state === 'playing') &&
      !started &&
      !starting &&
      resolved.kind !== 'none'
    ) {
      this.persist(this.backing.catchUp(current));
    }
  }
}
