import { useCallback, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { Routine } from '@/data';
import type { RoutineSnapshot } from '@/exercises/runner';
import { estimateItemSeconds, formatDuration } from '@/exercises/estimate';
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
import { useRunnerHotkeys } from './useRunnerHotkeys';

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
  useRunnerHotkeys({ onLeave: leave });

  if (!loaded) return <p className="px-8 py-8 text-[13px] text-ink/55">Loading…</p>;
  if (!routine) {
    return (
      <div className="px-8 py-8">
        <EmptyState title="No such routine">
          <Link to="/home" className="text-accent-700 underline">
            Back to your routines
          </Link>
        </EmptyState>
      </div>
    );
  }
  if (!routineSnapshot) return <p className="px-8 py-8 text-[13px] text-ink/55">Rolling…</p>;

  return (
    <section className="pb-24">
      {routineSnapshot.phase === 'overview' && (
        <Overview routine={routine} snapshot={routineSnapshot} />
      )}

      {routineSnapshot.phase === 'running' && (
        <>
          <RunningChrome name={routine.name} />
          <PracticeBody />
          <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-divider bg-bg">
            <TransportBar />
          </div>
        </>
      )}

      {routineSnapshot.phase === 'done' && <Summary routine={routine} snapshot={routineSnapshot} />}
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
      <div className="border-b-2 border-divider px-8 py-7">
        <Kicker accent>Routine · about {formatDuration(total)}</Kicker>
        <h1 className="text-[42px]">{routine.name}</h1>
        <p className="max-w-[640px] text-[15px] text-ink/70">
          Everything in <strong>{key}</strong>. Read it through, re-roll anything you would rather
          not play, then start — it runs to the end on its own.
        </p>
      </div>

      <ol className="px-8 py-4">
        {snapshot.items.map((item, index) => {
          const definition = findExerciseDefinition(item.definitionId);
          return (
            <li
              key={item.id}
              className="grid grid-cols-[28px_1fr_auto] items-baseline gap-3 border-b border-divider py-4"
              data-testid="overview-item"
            >
              <span className="text-[13px] font-extrabold tabular-nums text-ink/45">{index + 1}</span>
              <div className="min-w-0">
                <p className="kicker">
                  {definition?.name} · {item.reps === 1 ? '1 pass' : `${item.reps} passes`}
                </p>
                <p className="text-[18px] font-extrabold">{item.instance?.brief.headline}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => practice.rerollItem(index)}>
                Re-roll
              </Button>
            </li>
          );
        })}
      </ol>

      <div className="fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center gap-3 border-t-2 border-divider bg-bg px-8 py-3">
        <Button size="lg" onClick={() => void practice.play()} data-testid="start-routine">
          Start
        </Button>
        <PlaybackToggles />
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
      <h2 className="text-[34px]">{routine.name}</h2>
      <p className="mb-6 text-[14px] text-ink/70 tabular-nums">
        {formatDuration(seconds)} · every pass logged against its exercise.
      </p>
      <ol className="mb-8 max-w-[640px]">
        {snapshot.items.map((item, index) => (
          <li key={item.id} className="flex gap-3 border-b border-divider py-2 text-[14px]">
            <span className="w-6 tabular-nums text-ink/45">{index + 1}</span>
            <span className="flex-1">{findExerciseDefinition(item.definitionId)?.name}</span>
            <span className="tabular-nums text-ink/60">
              {item.completed === 0 && item.skipped
                ? 'skipped'
                : `${item.completed === 1 ? '1 pass' : `${item.completed} passes`}${item.skipped ? ' · skipped' : ''}`}
            </span>
          </li>
        ))}
      </ol>
      <div className="flex gap-3">
        <Button onClick={() => void usePractice.getState().prepareRoutine(routine)}>Again</Button>
        <Button variant="secondary" asChild>
          <Link to="/home">Back to your routines</Link>
        </Button>
      </div>
    </div>
  );
}
