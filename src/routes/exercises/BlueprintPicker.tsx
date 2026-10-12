import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { folderPath } from '@/domain/library';
import { EXERCISE_DEFINITIONS } from '@/exercises/registry';
import type { AnyExerciseDefinition } from '@/exercises/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingState, PageHeader } from '@/components/ui/page-header';
import { useExercises } from '@/store/exercises';
import { useFolders } from '@/store/folders';

/**
 * New exercise: pick the blueprint it is made from. Choosing one opens its
 * new-exercise page, where it is named and created — nothing is made until
 * then (doc 16, decision 29).
 */
export function BlueprintPicker() {
  const [params] = useSearchParams();
  const { exercises, loaded, load } = useExercises();
  const { folders, loaded: foldersLoaded, load: loadFolders } = useFolders();

  useEffect(() => {
    void load();
    void loadFolders();
  }, [load, loadFolders]);

  if (!loaded || !foldersLoaded) return <LoadingState />;

  const asked = params.get('folder');
  const folderId = asked && folders.some((f) => f.id === asked) ? asked : null;
  const back = folderId ? `/exercises/folder/${folderId}` : '/exercises';
  const where = folderPath(folders, folderId)
    .map((f) => f.name)
    .join(' › ');

  const open = (definition: AnyExerciseDefinition) =>
    `/exercises/new/${definition.id}${folderId ? `?folder=${folderId}` : ''}`;

  return (
    <section>
      <PageHeader
        kicker="New exercise"
        title="Pick a blueprint"
        // As wide as the list under it.
        introClassName="max-w-[900px]"
        intro={`What it is made from. It starts with the blueprint’s settings, nothing locked${where ? `, in ${where}` : ''}; name it on the next page, and lock what you like once it is made.`}
      >
        <Button variant="secondary" asChild>
          <Link to={back}>Cancel</Link>
        </Button>
      </PageHeader>
      <div className="px-8 pt-1 pb-8">
        <ul className="sheet max-w-[900px] px-2">
          {EXERCISE_DEFINITIONS.map((definition) => {
            const count = exercises.filter((e) => e.definitionId === definition.id).length;
            return (
              <li key={definition.id} className="border-b border-rule last:border-b-0">
                <Link
                  to={open(definition)}
                  className="flex w-full items-baseline gap-4 rounded-control px-3 py-3.5 text-left hover:bg-ink/5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="face-title block text-title">{definition.name}</span>
                    <span className="block text-body-sm text-ink-muted">
                      {definition.summary}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {definition.tags.map((t) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                    </span>
                  </span>
                  <span className="shrink-0 text-body-sm text-ink-muted tabular-nums">
                    {count === 1 ? '1 exercise' : `${count} exercises`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
