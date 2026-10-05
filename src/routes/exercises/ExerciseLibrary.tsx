import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FavoriteToggle } from '@/components/ui/favorite-toggle';
import { secondLine } from '@/exercises/locks';
import { FromBlueprint } from '@/components/library/FromBlueprint';
import { libraryRows, useExercises } from '@/store/exercises';
import { useSettings } from '@/store/settings';
import { LoadingState, PageHeader } from '@/components/ui/page-header';

export function ExerciseLibrary() {
  const { exercises, loaded, load, update } = useExercises();
  const loadSettings = useSettings((s) => s.load);
  const instrument = useSettings((s) => s.settings.instrument);
  const [tag, setTag] = useState<string | null>(null);

  useEffect(() => {
    void load();
    void loadSettings();
  }, [load, loadSettings]);

  const rows = useMemo(() => libraryRows(exercises), [exercises]);

  // Tags rather than a single family: a legato speed drill through a scale is
  // genuinely all three, and would be missing from two searches otherwise.
  const tags = useMemo(() => {
    const all = new Set<string>();
    for (const { exercise } of rows) for (const t of exercise.tags) all.add(t);
    return [...all].sort();
  }, [rows]);

  const visible = tag ? rows.filter(({ exercise }) => exercise.tags.includes(tag)) : rows;

  return (
    <section>
      <PageHeader
        kicker="Exercises"
        title="Your library"
        intro="Everything you can practice. Open one to set its target tempo and how much it varies."
      >
        <Button asChild>
          <Link to="/exercises/new">New exercise</Link>
        </Button>
      </PageHeader>

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-8 pb-1">
          <span className="kicker mr-1">Filter</span>
          <TagFilter label="All" active={tag === null} onClick={() => setTag(null)} />
          {tags.map((t) => (
            <TagFilter
              key={t}
              label={t}
              active={t === tag}
              onClick={() => setTag(t === tag ? null : t)}
            />
          ))}
        </div>
      )}

      <div className="px-8 pt-4 pb-6">
        {!loaded && <LoadingState inline />}

        {loaded && visible.length === 0 && (
          <EmptyState title="Nothing here yet">No exercises match that tag.</EmptyState>
        )}

        <ul className="sheet px-5 empty:hidden">
          {visible.map(({ exercise, definition }) => (
            <li
              key={exercise.id}
              className="flex items-baseline gap-4 border-b border-rule py-4 last:border-b-0"
            >
              <FavoriteToggle
                on={exercise.favorite ?? false}
                label={exercise.name}
                onChange={(on) => void update(exercise.id, { favorite: on })}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <Link
                    to={`/exercises/${exercise.id}`}
                    className="face-title text-title hover:text-accent-text"
                  >
                    {exercise.name}
                  </Link>
                  <FromBlueprint name={exercise.name} blueprint={definition.name} />
                </div>
                <p className="text-body-sm text-ink-muted">
                  {secondLine(exercise, definition, instrument)}
                </p>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {exercise.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="w-24 shrink-0 text-right">
                <p className="text-title font-extrabold tabular-nums">
                  {exercise.tempo.targetTempo ?? '—'}
                </p>
                <p className="kicker">target bpm</p>
              </div>

              <Button asChild className="shrink-0">
                <Link to={`/practice/exercise/${exercise.id}`}>Practice</Link>
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function TagFilter({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? 'default' : 'secondary'}
      size="xs"
      className="rounded-full"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
