import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FavoriteToggle } from '@/components/ui/favorite-toggle';
import { Kicker } from '@/components/ui/kicker';
import { describePolicies } from '@/exercises/describe';
import { findExerciseDefinition } from '@/exercises/registry';
import { useExercises } from '@/store/exercises';
import { useSettings } from '@/store/settings';

export function ExerciseLibrary() {
  const { exercises, loaded, load, update } = useExercises();
  const loadSettings = useSettings((s) => s.load);
  const instrument = useSettings((s) => s.settings.instrument);
  const [tag, setTag] = useState<string | null>(null);

  useEffect(() => {
    void load();
    void loadSettings();
  }, [load, loadSettings]);

  const rows = useMemo(
    () =>
      exercises
        .flatMap((exercise) => {
          const definition = findExerciseDefinition(exercise.definitionId);
          return definition ? [{ exercise, definition }] : [];
        })
        // Favorites pinned to the top; otherwise the order they were added.
        .sort((a, b) => Number(b.exercise.favorite ?? false) - Number(a.exercise.favorite ?? false)),
    [exercises],
  );

  // Tags rather than a single family: a legato speed drill through a scale is
  // genuinely all three, and would be missing from two searches otherwise.
  const tags = useMemo(() => {
    const all = new Set<string>();
    for (const { definition } of rows) for (const t of definition.tags) all.add(t);
    return [...all].sort();
  }, [rows]);

  const visible = tag
    ? rows.filter(({ definition }) => (definition.tags as string[]).includes(tag))
    : rows;

  return (
    <section>
      <div className="border-b-(length:--rule-section-w) border-divider px-8 py-7">
        <Kicker accent>Exercises</Kicker>
        <h1>Your library</h1>
        <p className="max-w-[640px] text-[15px] text-ink/70">
          Everything you can practice. Open one to set its target tempo and how much it varies.
        </p>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-rule px-8 py-3">
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

      <div className="px-8 py-6">
        {!loaded && <p className="text-[13px] text-ink/55">Loading…</p>}

        {loaded && visible.length === 0 && (
          <EmptyState title="Nothing here yet">No exercises match that tag.</EmptyState>
        )}

        <ul>
          {visible.map(({ exercise, definition }) => (
            <li key={exercise.id} className="flex items-baseline gap-4 border-b border-rule py-4">
              <FavoriteToggle
                on={exercise.favorite ?? false}
                label={definition.name}
                onChange={(on) => void update(exercise.id, { favorite: on })}
              />
              <div className="min-w-0 flex-1">
                <Link
                  to={`/exercises/${exercise.id}`}
                  className="face-title text-[20px] hover:text-accent-text"
                >
                  {definition.name}
                </Link>
                <p className="text-[13px] text-ink/65">{definition.summary}</p>

                {/* Two instances of one definition share a name and summary,
                    so what differs has to be on the row. */}
                {(() => {
                  const policies = describePolicies(exercise.axisPolicies, definition.axes, instrument);
                  return policies.length > 0 ? (
                    <p className="mt-1 text-[12px] text-ink/50">{policies.join(' · ')}</p>
                  ) : null;
                })()}

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {definition.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="w-24 shrink-0 text-right">
                <p className="text-[20px] font-extrabold tabular-nums">
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
    <Button variant={active ? 'default' : 'secondary'} size="xs" onClick={onClick}>
      {label}
    </Button>
  );
}
