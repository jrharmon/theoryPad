import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { exerciseNamesIn, freeName, nameProblem } from '@/domain/library';
import type { NewExercise as Draft } from '@/data/repositories/types';
import { findExerciseDefinition } from '@/exercises/registry';
import type { AnyExerciseDefinition } from '@/exercises/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/page-header';
import { newExerciseFrom, useExercises } from '@/store/exercises';
import { useFolders } from '@/store/folders';
import { useSettings } from '@/store/settings';
import { ExerciseEditor } from './ExerciseDetail';
import { WrittenImport } from './WrittenImport';
import { writtenSettings, type WrittenChoice } from './written';

/**
 * A new exercise from a blueprint: the exercise's own page, every setting on
 * it, the name selected to type over — but nothing is saved until Save, and
 * Cancel leaves nothing behind (doc 16, decision 29). A written exercise's
 * page reads its file too, and can't be saved until it has.
 */
export function NewExercise() {
  const { definitionId = '' } = useParams();
  const [query] = useSearchParams();
  const { exercises, loaded, load } = useExercises();
  const { folders, loaded: foldersLoaded, load: loadFolders } = useFolders();
  const loadSettings = useSettings((s) => s.load);
  const definition = findExerciseDefinition(definitionId);

  useEffect(() => {
    void load();
    void loadFolders();
    void loadSettings();
  }, [load, loadFolders, loadSettings]);

  if (!loaded || !foldersLoaded) return <LoadingState />;
  const asked = query.get('folder');
  const folderId = asked && folders.some((f) => f.id === asked) ? asked : null;
  if (!definition) {
    return (
      <div className="px-8 py-8">
        <EmptyState title="No such blueprint">
          <Link to="/exercises/new" className="text-accent-text underline">
            Pick another
          </Link>
        </EmptyState>
      </div>
    );
  }
  const start = newExerciseFrom(definition, {
    name: freeName(definition.name, exerciseNamesIn(folders, exercises, folderId)),
    folderId,
  });
  // A fresh draft for each blueprint and folder: another's must not carry over.
  return (
    <DraftEditor key={`${definition.id}:${folderId}`} definition={definition} start={start} />
  );
}

function DraftEditor({
  definition,
  start,
}: {
  definition: AnyExerciseDefinition;
  start: Draft;
}) {
  const navigate = useNavigate();
  const { exercises, addFromDefinition } = useExercises();
  const folders = useFolders((s) => s.folders);
  const [draft, setDraft] = useState<Draft>(start);
  // A name typed by the player isn't replaced by a file's.
  const [named, setNamed] = useState(false);
  const [saving, setSaving] = useState(false);
  const written = definition.id === 'phrase';
  const [choice, setChoice] = useState<WrittenChoice | null>(null);

  const change = (changes: Partial<Draft>) => setDraft((d) => ({ ...d, ...changes }));
  // The name is selected to type over once, as the page opens.
  const selected = useRef(false);
  const selectOnce = useCallback(() => {
    if (selected.current) return false;
    selected.current = true;
    return true;
  }, []);

  // A file read: its notes, tuning, key and tempo, and its name unless one was typed.
  const onImport = useCallback(
    (next: WrittenChoice | null) => {
      setChoice(next);
      if (!next) return;
      setDraft((d) => ({
        ...d,
        ...writtenSettings(next),
        tempo: { ...d.tempo, targetTempo: next.imported.phrase.writtenTempo ?? 100 },
        ...(named
          ? {}
          : {
              name: freeName(
                next.imported.name,
                exerciseNamesIn(folders, exercises, d.folderId),
              ),
            }),
      }));
    },
    [named, folders, exercises],
  );

  const problem = nameProblem(draft.name, exerciseNamesIn(folders, exercises, draft.folderId));
  const blocked = problem !== null || (written && choice === null) || saving;

  const save = async () => {
    if (blocked) return;
    setSaving(true);
    const { name, folderId, ...rest } = draft;
    const created = await addFromDefinition(definition.id, { name, folderId }, rest);
    // This page is a step on the way: Back from the exercise skips it.
    void navigate(`/exercises/${created.id}`, { replace: true });
  };
  const back = draft.folderId ? `/exercises/new?folder=${draft.folderId}` : '/exercises/new';

  return (
    <ExerciseEditor
      exercise={draft}
      id={null}
      definition={definition}
      selectName={selectOnce}
      edits={{
        update: (changes) => {
          if (changes.name !== undefined) setNamed(true);
          change(changes);
        },
        setAxisPolicy: (axis, policy) =>
          setDraft((d) => ({ ...d, axisPolicies: { ...d.axisPolicies, [axis]: policy } })),
        setLock: (kind, key, locked) =>
          setDraft((d) => {
            const list: string[] = [...d.locked[kind]];
            const next = locked ? [...new Set([...list, key])] : list.filter((k) => k !== key);
            return { ...d, locked: { ...d.locked, [kind]: next } };
          }),
        moveTo: (folderId) => change({ folderId }),
      }}
      actions={
        <>
          <Button variant="secondary" asChild>
            <Link to={back}>Cancel</Link>
          </Button>
          <Button disabled={blocked} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      {written && <WrittenImport onChange={onImport} />}
    </ExerciseEditor>
  );
}
