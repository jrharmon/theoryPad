import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FavoriteToggle } from '@/components/ui/favorite-toggle';
import { Kicker } from '@/components/ui/kicker';
import { describeExtent, routineExtent, sortRoutines, useRoutines } from '@/store/routines';
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
import { LoadingState, PageIntro } from '@/components/ui/page-header';

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
    <div className="flex items-center gap-10 px-8 pt-0 pb-5" data-testid="practice-strip">
      <HeatmapGrid cells={cells} today={today} cellSize={13} />
      <div>
        <Kicker>Streak</Kicker>
        <p className="num text-display leading-tight" data-testid="streak">
          {current} {current === 1 ? 'day' : 'days'}
        </p>
      </div>
      <div>
        <Kicker>This week</Kicker>
        <p className="num text-display leading-tight" data-testid="week-time">
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
  const extents = useMemo(
    () => new Map(routines.map((r) => [r.id, routineExtent(r, instrument)])),
    [routines, instrument],
  );

  const newRoutine = async () => {
    const routine = await create();
    void navigate(`/routines/${routine.id}`);
  };

  return (
    <section>
      <div className="flex items-end justify-between px-8 py-7">
        <div>
          <Kicker accent>Practice</Kicker>
          <h1>Your routines</h1>
          <PageIntro>
            A routine plays several exercises straight through, each counted in at its own tempo
            — nothing to click once it starts.
          </PageIntro>
        </div>
        <Button onClick={() => void newRoutine()}>New routine</Button>
      </div>

      <PracticeStrip />

      <div className="px-8 pt-1 pb-6">
        {!loaded && <LoadingState inline />}

        {loaded && sorted.length === 0 && (
          <EmptyState title="No routines yet">
            Make one from the exercises in your library. The same exercise can go in more than
            once, set up differently each time.
          </EmptyState>
        )}

        <ul className="sheet px-5 empty:hidden">
          {sorted.map((routine) => {
            const extent = extents.get(routine.id)!;
            return (
              <li
                key={routine.id}
                className="flex items-center gap-4 border-b border-rule py-4 last:border-b-0"
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
                    className="face-title text-lead hover:text-accent-text"
                  >
                    {routine.name}
                  </Link>
                  <p className="text-body-sm text-ink-muted tabular-nums">
                    {extent.total === 0 ? 'No exercises yet' : describeExtent(extent)}
                  </p>
                </div>
                <Button variant="secondary" asChild>
                  <Link to={`/routines/${routine.id}`}>Edit</Link>
                </Button>
                {extent.played > 0 ? (
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
