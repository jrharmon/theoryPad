import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { exerciseNamesIn, folderPath, freeName } from '@/domain/library';
import { EXERCISE_DEFINITIONS } from '@/exercises/registry';
import type { AnyExerciseDefinition } from '@/exercises/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingState, PageHeader } from '@/components/ui/page-header';
import { useExercises } from '@/store/exercises';
import { useFolders } from '@/store/folders';

/**
 * New exercise: pick the blueprint it is made from. Choosing one creates the
 * exercise straight away — in the folder it was asked for from, named after
 * the blueprint ("Name 2" if that is taken there) — and opens its editor.
 * Delete undoes a mistake; there is no draft to hold.
 */
export function BlueprintPicker() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { exercises, loaded, load, addFromDefinition } = useExercises();
  const { folders, loaded: foldersLoaded, load: loadFolders } = useFolders();
  const [creating, setCreating] = useState(false);

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

  const create = async (definition: AnyExerciseDefinition) => {
    if (creating) return;
    setCreating(true);
    const name = freeName(definition.name, exerciseNamesIn(folders, exercises, folderId));
    const created = await addFromDefinition(definition.id, { name, folderId });
    // The picker is a step on the way: Back from the editor skips it. The
    // editor opens with the name selected, ready to type over.
    void navigate(`/exercises/${created.id}`, { replace: true, state: { fresh: true } });
  };

  return (
    <section>
      <PageHeader
        kicker="New exercise"
        title="Pick a blueprint"
        // As wide as the list under it.
        introClassName="max-w-[900px]"
        intro={`What it is made from. It starts with the blueprint’s settings, nothing locked${where ? `, in ${where}` : ''}; name it and lock what you like on the next page.`}
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
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => void create(definition)}
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
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
