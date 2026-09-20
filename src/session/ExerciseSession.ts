import { withRequiredTags, type BackingChoice, type Exercise } from '@/data';
import type { KeyMode } from '@/domain/music';
import type { CoverageCounts } from '@/domain/variation';
import { countInTicks, type CountInBars } from '@/domain/phrase';
import type { RunnerState } from '@/exercises/runner';
import { ExerciseRunner, type Reconfiguration } from '@/exercises/runner';
import { resolveParams } from '@/exercises/params';
import { exerciseDefinition } from '@/exercises/registry';
import type { AnyExerciseDefinition } from '@/exercises/types';
import { definedProps } from '@/lib/definedProps';
import type { SessionDeps } from './ports';
import {
  FALLBACK_KEY_MODE,
  PracticeSession,
  blockedValues,
  criteriaQuery,
  loadCoverage,
  loadSubjectWeights,
  openSessionRow,
} from './PracticeSession';

/** One exercise, played as often as asked. Its settings are saved to the exercise. */
export class ExerciseSession extends PracticeSession {
  readonly exerciseId: string;
  private readonly exercise: ExerciseRunner;

  /**
   * Roll a variation and generate the material, without touching audio.
   *
   * Split from `play` because the AudioContext can only start from a user
   * gesture, and opening an exercise is not one. This lets the screen show the
   * brief, the tab and the neck the moment you arrive, with nothing to click
   * through first.
   */
  static async open(exercise: Exercise, deps: SessionDeps): Promise<ExerciseSession> {
    const definition = exerciseDefinition(exercise.definitionId);
    const session = await openSessionRow(deps, null);
    return new ExerciseSession(exercise, definition, session.id, deps, {
      coverage: await loadCoverage(deps, exercise.id),
      ...(definition.kind === 'theory'
        ? { subjectWeights: await loadSubjectWeights(deps, exercise.id) }
        : {}),
    });
  }

  private constructor(
    exercise: Exercise,
    definition: AnyExerciseDefinition,
    sessionId: string,
    deps: SessionDeps,
    history: { coverage: CoverageCounts; subjectWeights?: Readonly<Record<string, number>> },
  ) {
    super(deps, sessionId);
    this.exerciseId = exercise.id;
    const settings = deps.settings();

    this.exercise = new ExerciseRunner({
      clock: deps.audio.clock,
      definition,
      exerciseId: exercise.id,
      instrument: this.instrument,
      sessionId,
      sessionKeyMode: FALLBACK_KEY_MODE,
      params: resolveParams(definition, exercise.params),
      tempo: exercise.tempo,
      ...(definition.defaults.tempoPlan ? { tempoPlan: definition.defaults.tempoPlan } : {}),
      passes: 1,
      loop: settings.audio.loop,
      // The exercise's own; older rows that have none fall back to the setting.
      countInBars: exercise.countInBars ?? settings.audio.countInBars,
      heldAxisValues: exercise.heldAxisValues,
      axisPolicies: exercise.axisPolicies,
      blocked: blockedValues(deps),
      coverage: history.coverage,
      ...(history.subjectWeights ? { subjectWeights: history.subjectWeights } : {}),
      now: deps.now,
      onRepStart: this.sound,
      onRepEnd: (rep) => {
        this.persist(deps.repos.reps.add({ ...rep, sessionId }));
        // Remember what was rolled, so `hold` policies have something to hold.
        this.persist(deps.saveExercise(exercise.id, { heldAxisValues: rep.axes }));
      },
    });

    let before: RunnerState = 'idle';
    this.exercise.subscribe((snapshot) => {
      const entered = snapshot.state !== before;
      before = snapshot.state;
      this.update({ snapshot, instance: this.exercise.currentInstance });
      if (snapshot.state === 'brief' || snapshot.state === 'done') this.silence();
      // Back at the brief — after a re-roll, which can move the key out from
      // under a track, or after a track that would not start was dropped.
      if (entered && snapshot.state === 'brief') this.backing.refresh();
    });

    this.exercise.start();
    this.update({ runner: this.exercise });
    this.backing.open(exercise.backing ?? { kind: 'none' }, {
      exerciseId: exercise.id,
      ...criteriaQuery(withRequiredTags(exercise.backingCriteria, definition.backing?.requiredTags)),
    });
  }

  get runner(): ExerciseRunner {
    return this.exercise;
  }

  protected get keyMode(): KeyMode {
    return this.exercise.snapshot.keyMode;
  }

  async play(): Promise<void> {
    // Everything that needs the click starts before anything awaits: the
    // AudioContext, and a backing track, which some browsers only let start
    // from the click itself.
    const starting = this.deps.audio.init();
    let backingStart: Promise<void> | null = null;
    if (!this.backing.state.starting) {
      const phrase = this.exercise.currentPhrase;
      const { freeTime, countInBars } = this.exercise.snapshot;
      backingStart = this.backing.start(
        freeTime || !phrase ? 0 : countInTicks(phrase.timeSignature, countInBars),
      );
    }
    await this.startAudio(starting);
    if (!backingStart) return;
    // The clock follows the backing: YouTube takes a few hundred milliseconds
    // to get going, and nothing should count from the click.
    await backingStart;
    this.exercise.begin();
  }

  stop(): void {
    if (this.backing.state.starting) return;
    // Back to brief: the subscriber stops the click, the notes and the track.
    this.exercise.stop();
  }

  reroll(): void {
    this.exercise.reroll();
    this.backing.refresh();
  }

  setFreeTime(freeTime: boolean): void {
    this.exercise.setFreeTime(freeTime);
  }

  /**
   * Apply settings changed from the practice screen, and save them to the
   * exercise: the dialog is a shortcut to the config page, not a separate,
   * temporary set of settings.
   */
  async reconfigure(changes: Reconfiguration): Promise<void> {
    this.exercise.reconfigure(changes);
    this.backing.refresh();
    await this.deps.saveExercise(this.exerciseId, definedProps(changes));
  }

  async setCountIn(bars: CountInBars): Promise<void> {
    this.exercise.setCountInBars(bars);
    await this.deps.saveExercise(this.exerciseId, { countInBars: bars });
  }

  protected applyLoop(on: boolean): void {
    this.exercise.setLoop(on);
  }

  protected saveBacking(backing: BackingChoice): Promise<void> {
    return this.deps.saveExercise(this.exerciseId, { backing });
  }

  protected endRunner(): void {
    this.exercise.end();
  }
}
