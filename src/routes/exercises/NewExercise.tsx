import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { exerciseNamesIn, freeName, nameProblem } from '@/domain/library';
import type { NewExercise as NewExerciseRow } from '@/data/repositories/types';
import { findExerciseDefinition } from '@/exercises/registry';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { LoadingState, PageHeader } from '@/components/ui/page-header';
import { FolderPicker } from '@/components/library/FolderPicker';
import { useExercises } from '@/store/exercises';
import { useFolders } from '@/store/folders';

/**
 * What a blueprint adds to its new-exercise page: its own part of the page,
 * and what it sets on the exercise once Create is pressed. Null means it
 * can't be created yet (a written exercise with no file read).
 */
export interface BlueprintSetup {
  content: ReactNode;
  overrides: Partial<NewExerciseRow> | null;
  /** A name to start from, in place of the blueprint's: a file's section or title. */
  suggestedName?: string;
}

/**
 * New exercise from a blueprint. Nothing is saved until Create — Cancel, or
 * leaving, makes nothing — so changing your mind leaves nothing behind
 * (doc 16, decision 29). Create opens the new exercise's page.
 */
export function NewExercise({
  setup,
}: {
  /** A blueprint's own part of the page; the written exercise's import, so far. */
  setup?: (definitionId: string) => BlueprintSetup | null;
}) {
  const { definitionId = '' } = useParams();
  const [query] = useSearchParams();
  const navigate = useNavigate();
  const { exercises, loaded, load, addFromDefinition } = useExercises();
  const { folders, loaded: foldersLoaded, load: loadFolders } = useFolders();
  const definition = findExerciseDefinition(definitionId);

  const asked = query.get('folder');
  const [folderId, setFolderId] = useState<string | null>(asked);
  const [name, setName] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void load();
    void loadFolders();
  }, [load, loadFolders]);

  const extra = definition && setup ? setup(definition.id) : null;
  const ready = loaded && foldersLoaded;
  const folder = folderId && folders.some((f) => f.id === folderId) ? folderId : null;
  const taken = ready ? exerciseNamesIn(folders, exercises, folder) : [];
  const startingName =
    definition && ready ? freeName(extra?.suggestedName ?? definition.name, taken) : '';
  const draft = name ?? startingName;

  // Ready to type over, as soon as there is a name to select.
  useEffect(() => {
    if (!ready || name !== null) return;
    input.current?.focus();
    input.current?.select();
  }, [ready, name, startingName]);

  if (!ready) return <LoadingState />;
  const back = folder ? `/exercises/new?folder=${folder}` : '/exercises/new';
  if (!definition) {
    return (
      <div className="px-8 py-8">
        <EmptyState title="No such blueprint">
          <Link to={back} className="text-accent-text underline">
            Pick another
          </Link>
        </EmptyState>
      </div>
    );
  }

  const problem = nameProblem(draft, taken);
  const blocked = problem !== null || (extra !== null && extra.overrides === null) || creating;

  const create = async () => {
    if (blocked) return;
    setCreating(true);
    const created = await addFromDefinition(
      definition.id,
      { name: draft.trim(), folderId: folder },
      extra?.overrides ?? undefined,
    );
    // This page is a step on the way: Back from the exercise skips it.
    void navigate(`/exercises/${created.id}`, { replace: true });
  };

  return (
    <section>
      <PageHeader
        kicker="New exercise"
        title={definition.name}
        introClassName="max-w-[900px]"
        intro={definition.summary}
      >
        <div className="flex gap-2">
          <Button variant="secondary" asChild>
            <Link to={back}>Cancel</Link>
          </Button>
          <Button disabled={blocked} onClick={() => void create()}>
            Create
          </Button>
        </div>
      </PageHeader>
      <div className="space-y-6 px-8 pt-1 pb-8">
        <div className="sheet flex max-w-[900px] flex-wrap items-start gap-x-8 gap-y-4 p-5">
          <Field label="Name" htmlFor="new-exercise-name">
            <Input
              id="new-exercise-name"
              ref={input}
              className="w-[360px]"
              value={draft}
              aria-invalid={problem !== null}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') void create();
              }}
            />
            {problem && (
              <p className="mt-1 text-meta text-destructive">
                {problem === 'empty'
                  ? 'A name is needed.'
                  : 'Another exercise in this folder has that name.'}
              </p>
            )}
          </Field>
          <Field label="Folder">
            <div className="w-64">
              <FolderPicker folders={folders} value={folder} onChange={setFolderId} />
            </div>
          </Field>
        </div>
        {extra?.content}
      </div>
    </section>
  );
}
