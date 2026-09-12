import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Routine } from '@/data';
import type { Instrument } from '@/domain/instrument';
import { estimateItemSeconds, formatDuration } from '@/exercises/estimate';
import { findExerciseDefinition } from '@/exercises/registry';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FavoriteToggle } from '@/components/ui/favorite-toggle';
import { Kicker } from '@/components/ui/kicker';
import { sortRoutines, useRoutines } from '@/store/routines';
import { useSettings } from '@/store/settings';
import { useProgress } from '@/store/progress';
import { HeatmapGrid } from '@/components/charts/HeatmapGrid';
import {
  formatPracticeTime,
  practiceHeatmap,
  secondsBetween,
  streak,
  weekStart,
} from '@/domain/progress';

/** About how long a routine takes, from its items' own settings. */
function routineSeconds(routine: Routine, instrument: Instrument): number {
  return routine.items.reduce((total, item) => {
    const definition = findExerciseDefinition(item.definitionId);
    return definition ? total + estimateItemSeconds(definition, item, instrument) : total;
  }, 0);
}

/** The last four weeks at a glance: the heatmap, the streak, this week's time. */
function PracticeStrip() {
  const { days, today, loaded, load } = useProgress();
  useEffect(() => {
    void load();
  }, [load]);

  const cells = useMemo(() => practiceHeatmap(days, today), [days, today]);
  const { current } = useMemo(() => streak(days, today), [days, today]);
  const thisWeek = secondsBetween(days, weekStart(today), today);

  if (!loaded) return null;
  return (
    <div
      className="flex items-center gap-10 border-b-2 border-divider px-8 py-5"
      data-testid="practice-strip"
    >
      <HeatmapGrid cells={cells} today={today} cellSize={13} />
      <div>
        <Kicker>Streak</Kicker>
        <p className="tabular text-[28px] leading-tight" data-testid="streak">
          {current} {current === 1 ? 'day' : 'days'}
        </p>
      </div>
      <div>
        <Kicker>This week</Kicker>
        <p className="tabular text-[28px] leading-tight" data-testid="week-time">
          {formatPracticeTime(thisWeek)}
        </p>
      </div>
    </div>
  );
}

/** Your routines: favorites pinned to the top, then the ones you played last. */
export function Home() {
  const { routines, loaded, load, create, setFavorite } = useRoutines();
  const loadSettings = useSettings((s) => s.load);
  const instrument = useSettings((s) => s.settings.instrument);
  const navigate = useNavigate();

  useEffect(() => {
    void load();
    void loadSettings();
  }, [load, loadSettings]);

  const sorted = useMemo(() => sortRoutines(routines), [routines]);
  const durations = useMemo(
    () => new Map(routines.map((r) => [r.id, routineSeconds(r, instrument)])),
    [routines, instrument],
  );

  const newRoutine = async () => {
    const routine = await create();
    void navigate(`/routines/${routine.id}`);
  };

  return (
    <section>
      <div className="flex items-end justify-between border-b-2 border-divider px-8 py-7">
        <div>
          <Kicker accent>Practice</Kicker>
          <h1 className="text-[42px]">Your routines</h1>
          <p className="max-w-[640px] text-[15px] text-ink/70">
            A routine plays several exercises straight through, each counted in at its own
            tempo — nothing to click once it starts.
          </p>
        </div>
        <Button onClick={() => void newRoutine()}>New routine</Button>
      </div>

      <PracticeStrip />

      <div className="px-8 py-6">
        {!loaded && <p className="text-[13px] text-ink/55">Loading…</p>}

        {loaded && sorted.length === 0 && (
          <EmptyState title="No routines yet">
            Make one from the exercises in your library. The same exercise can go in more than
            once, set up differently each time.
          </EmptyState>
        )}

        <ul>
          {sorted.map((routine) => {
            const count = routine.items.length;
            return (
              <li
                key={routine.id}
                className="flex items-center gap-4 border-b border-divider py-4"
                data-testid="routine-row"
              >
                <FavoriteToggle
                  on={routine.favorite ?? false}
                  label={routine.name}
                  onChange={(on) => void setFavorite(routine.id, on)}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/routines/${routine.id}`}
                    className="text-[18px] font-extrabold hover:text-accent-700"
                  >
                    {routine.name}
                  </Link>
                  <p className="text-[13px] text-ink/60 tabular-nums">
                    {count === 0
                      ? 'No exercises yet'
                      : `${count} exercise${count === 1 ? '' : 's'} · about ${formatDuration(durations.get(routine.id) ?? 0)}`}
                  </p>
                </div>
                <Button variant="secondary" asChild>
                  <Link to={`/routines/${routine.id}`}>Edit</Link>
                </Button>
                {count > 0 ? (
                  <Button asChild>
                    <Link to={`/practice/routine/${routine.id}`}>Start</Link>
                  </Button>
                ) : (
                  <Button disabled>Start</Button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
