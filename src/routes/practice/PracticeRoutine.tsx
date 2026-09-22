import { useCallback, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { Routine } from '@/data';
import type { RoutineSnapshot } from '@/exercises/runner';
import { describeReps } from '@/exercises/describe';
import { estimateItemSeconds, formatDuration } from '@/exercises/estimate';
import { repsAreQuestions } from '@/exercises/params';
import { findExerciseDefinition } from '@/exercises/registry';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Kicker } from '@/components/ui/kicker';
import { usePractice } from '@/store/practice';
import { useRoutines } from '@/store/routines';
import { useSettings } from '@/store/settings';
import { PracticeBody } from './PracticeBody';
import { RunningChrome } from './RunningChrome';
import { PlaybackToggles, TransportBar } from './TransportBar';
import { BackingMenu } from './BackingMenu';
import { useKeyModeView } from '@/store/keyModeView';
import { ReferenceTrigger } from './ReferenceTrigger';
import { useRunnerHotkeys } from './useRunnerHotkeys';
import { LoadingState, PageIntro } from '@/components/ui/page-header';

/**
 * A routine, start to finish. The overview shows everything that was rolled,
 * so it can be read — and re-rolled — before committing to it. Once started
 * nothing needs touching: each item counts in when the last one ends.
 */
export function PracticeRoutine() {
  const { routineId } = useParams();
  const { routines, loaded, load } = useRoutines();
  const loadSettings = useSettings((s) => s.load);
  const routineSnapshot = usePractice((s) => s.routineSnapshot);
  const prepared = useRef<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    void load();
    void loadSettings();
  }, [load, loadSettings]);

  const routine = routines.find((r) => r.id === routineId);

  useEffect(() => {
    if (!routine || prepared.current === routine.id) return;
    prepared.current = routine.id;
    void usePractice.getState().prepareRoutine(routine);
    // Prepared once on arrival: an item's held values are saved back to the
    // routine as it plays, and that must not restart the run.
  }, [routine]);

  // Leaving must not leave a metronome running.
  useEffect(() => () => void usePractice.getState().end(), []);

  const leave = useCallback(() => void navigate('/home'), [navigate]);
  const referenceOpen = useKeyModeView((s) => s.popover || s.sheet);
  useRunnerHotkeys({ onLeave: leave, enabled: !referenceOpen });

  if (!loaded) return <LoadingState />;
  if (!routine) {
    return (
      <div className="px-8 py-8">
        <EmptyState title="No such routine">
          <Link to="/home" className="text-accent-text underline">
            Back to your routines
          </Link>
        </EmptyState>
      </div>
    );
  }
  if (!routineSnapshot) return <LoadingState>Rolling…</LoadingState>;

  return (
    <section className="pb-28">
      {routineSnapshot.phase === 'overview' && (
        <Overview routine={routine} snapshot={routineSnapshot} />
      )}

      {routineSnapshot.phase === 'running' && (
        <>
          <RunningChrome name={routine.name} />
          <PracticeBody />
          <div className="fixed inset-x-4 bottom-3.5 z-20 rounded-[14px] bg-transport text-transport-ink shadow-(--shadow-float) ring-1 ring-transport-edge">
            <TransportBar />
          </div>
        </>
      )}

      {routineSnapshot.phase === 'done' && (
        <Summary routine={routine} snapshot={routineSnapshot} />
      )}
    </section>
  );
}

function Overview({ routine, snapshot }: { routine: Routine; snapshot: RoutineSnapshot }) {
  const instrument = useSettings((s) => s.settings.instrument);
  const practice = usePractice();
  const total = routine.items.reduce((sum, item) => {
    const definition = findExerciseDefinition(item.definitionId);
    return definition ? sum + estimateItemSeconds(definition, item, instrument) : sum;
  }, 0);
  const key = `${snapshot.keyMode.tonic} ${snapshot.keyMode.mode.charAt(0).toUpperCase()}${snapshot.keyMode.mode.slice(1)}`;

  return (
    <>
      <div className="px-8 py-7">
        <Kicker accent>Routine · about {formatDuration(total)}</Kicker>
        <h1>{routine.name}</h1>
        <PageIntro>
          Everything in{' '}
          <ReferenceTrigger keyMode={snapshot.keyMode}>
            <strong>{key}</strong>
          </ReferenceTrigger>
          . Read it through, re-roll anything you would rather not play, then start — it runs to
          the end on its own.
        </PageIntro>
      </div>

      <ol className="sheet mx-8 px-5">
        {snapshot.items.map((item, index) => {
          const definition = findExerciseDefinition(item.definitionId);
          return (
            <li
              key={item.id}
              className="grid grid-cols-[28px_1fr_auto] items-baseline gap-3 border-b border-rule py-4 last:border-b-0"
              data-testid="overview-item"
            >
              <span className="text-body-sm font-extrabold tabular-nums text-ink-faint">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="kicker">
                  {definition?.name} · {describeReps(definition, item.reps)}
                </p>
                <p className="face-title text-lead">{item.instance?.brief.headline}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => practice.rerollItem(index)}>
                Re-roll
              </Button>
            </li>
          );
        })}
      </ol>

      <div className="fixed inset-x-4 bottom-3.5 z-20 flex flex-wrap items-center gap-3 rounded-[14px] bg-transport px-[18px] py-2.5 text-transport-ink shadow-(--shadow-float) ring-1 ring-transport-edge">
        <Button size="lg" onClick={() => void practice.play()} data-testid="start-routine">
          Start
        </Button>
        <PlaybackToggles />
        <BackingMenu />
        <div className="ml-auto">
          <Button variant="secondary" size="sm" onClick={() => practice.rerollAll()}>
            Re-roll all
          </Button>
        </div>
      </div>
    </>
  );
}

function Summary({ routine, snapshot }: { routine: Routine; snapshot: RoutineSnapshot }) {
  const seconds =
    snapshot.startedAt && snapshot.endedAt ? (snapshot.endedAt - snapshot.startedAt) / 1000 : 0;
  return (
    <div className="px-8 py-10">
      <Kicker accent>Finished</Kicker>
      <h2>{routine.name}</h2>
      <p className="mb-6 text-body-sm text-ink-muted tabular-nums">
        {formatDuration(seconds)} · every pass logged against its exercise.
      </p>
      <ol className="sheet mb-8 max-w-[640px] px-5">
        {snapshot.items.map((item, index) => {
          const definition = findExerciseDefinition(item.definitionId);
          // A theory item is one set of its reps' questions: done, or not.
          const played =
            definition && repsAreQuestions(definition)
              ? item.completed > 0
                ? describeReps(definition, item.reps)
                : null
              : describeReps(definition, item.completed);
          return (
            <li
              key={item.id}
              className="flex gap-3 border-b border-rule py-2.5 text-body-sm last:border-b-0"
            >
              <span className="w-6 tabular-nums text-ink-faint">{index + 1}</span>
              <span className="flex-1">{definition?.name}</span>
              <span className="tabular-nums text-ink-muted">
                {item.completed === 0 && item.skipped
                  ? 'skipped'
                  : `${played ?? describeReps(definition, 0)}${item.skipped ? ' · skipped' : ''}`}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="flex gap-3">
        <Button onClick={() => void usePractice.getState().prepareRoutine(routine)}>
          Again
        </Button>
        <Button variant="secondary" asChild>
          <Link to="/home">Back to your routines</Link>
        </Button>
      </div>
    </div>
  );
}
