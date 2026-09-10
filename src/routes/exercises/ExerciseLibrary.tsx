import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useExercises } from '@/store/exercises';
import { useSettings } from '@/store/settings';
import { findExerciseDefinition } from '@/exercises/registry';
import { Button, EmptyState, Kicker, Tag } from '@/components/ui';

export function ExerciseLibrary() {
  const { exercises, loaded, load } = useExercises();
  const loadSettings = useSettings((s) => s.load);
  const [tag, setTag] = useState<string | null>(null);

  useEffect(() => {
    void load();
    void loadSettings();
  }, [load, loadSettings]);

  const withDefinitions = useMemo(
    () =>
      exercises
        .map((exercise) => ({ exercise, definition: findExerciseDefinition(exercise.definitionId) }))
        .filter((row) => row.definition !== undefined),
    [exercises],
  );

  // Tags rather than a single family: a legato speed drill through a scale is
  // genuinely all three, and would be missing from two searches otherwise.
  const tags = useMemo(() => {
    const all = new Set<string>();
    for (const { exercise, definition } of withDefinitions) {
      for (const t of definition!.tags) all.add(t);
      for (const t of exercise.userTags) all.add(t);
    }
    return [...all].sort();
  }, [withDefinitions]);

  const visible = tag
    ? withDefinitions.filter(
        ({ exercise, definition }) =>
          definition!.tags.includes(tag as never) || exercise.userTags.includes(tag),
      )
    : withDefinitions;

  return (
    <section>
      <div className="border-b-2 border-divider px-8 py-7">
        <Kicker accent>Exercises</Kicker>
        <h1 className="text-[42px]">Your library</h1>
        <p className="max-w-[640px] text-[15px] text-ink/70">
          Everything you can practise. Open one to set its target tempo and how much it varies.
        </p>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-divider px-8 py-3">
          <span className="kicker mr-1">Filter</span>
          <button
            type="button"
            onClick={() => setTag(null)}
            className={`px-2 py-0.5 text-[11px] font-semibold ${
              tag === null ? 'bg-accent text-bg' : 'bg-surface text-ink/70 hover:bg-ink/10'
            }`}
          >
            All
          </button>
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTag(t === tag ? null : t)}
              className={`px-2 py-0.5 text-[11px] font-semibold ${
                t === tag ? 'bg-accent text-bg' : 'bg-surface text-ink/70 hover:bg-ink/10'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="px-8 py-6">
        {!loaded && <p className="text-[13px] text-ink/55">Loading…</p>}

        {loaded && visible.length === 0 && (
          <EmptyState title="Nothing here yet">
            No exercises match that tag.
          </EmptyState>
        )}

        <ul>
          {visible.map(({ exercise, definition }) => (
            <li
              key={exercise.id}
              className="flex items-baseline gap-4 border-b border-divider py-4"
            >
              <div className="min-w-0 flex-1">
                <Link
                  to={`/exercises/${exercise.id}`}
                  className="text-[20px] font-extrabold hover:text-accent-700"
                >
                  {exercise.name}
                </Link>
                <p className="text-[13px] text-ink/65">{definition!.summary}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {definition!.tags.map((t) => (
                    <Tag key={t}>{t}</Tag>
                  ))}
                  {exercise.userTags.map((t) => (
                    <Tag key={t} variant="outline">
                      {t}
                    </Tag>
                  ))}
                </div>
              </div>

              <div className="w-24 shrink-0 text-right">
                <p className="text-[20px] font-extrabold tabular-nums">
                  {exercise.tempo.targetTempo ?? '—'}
                </p>
                <p className="kicker">target bpm</p>
              </div>

              <Link to={`/practice/exercise/${exercise.id}`} className="shrink-0">
                <Button variant="primary">Practise</Button>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
