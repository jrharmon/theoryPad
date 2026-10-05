import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useExercises } from '@/store/exercises';
import { useSettings } from '@/store/settings';
import { findExerciseDefinition } from '@/exercises/registry';
import { resolveGeneratedBacking } from '@/exercises/params';
import { GeneratedBackingEditor } from '@/components/backing/GeneratedBackingEditor';
import { settledMode } from '@/components/backing/chordContext';
import { AxisPolicyEditor } from '@/components/variation/AxisPolicyEditor';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Kicker } from '@/components/ui/kicker';
import { Separator } from '@/components/ui/separator';
import { FromBlueprint } from '@/components/library/FromBlueprint';
import { FolderPicker } from '@/components/library/FolderPicker';
import { TagsEditor } from '@/components/library/TagsEditor';
import { FavoriteToggle } from '@/components/ui/favorite-toggle';
import { exerciseNamesIn, nameProblem } from '@/domain/library';
import { KNOWN_TAGS } from '@/exercises/types';
import { useFolders } from '@/store/folders';
import { ParamsEditor } from './ParamsEditor';
import { BackingCriteriaEditor, ExerciseVideos } from './ExerciseVideos';
import { LoadingState } from '@/components/ui/page-header';

export function ExerciseDetail() {
  const { exerciseId } = useParams();
  const { exercises, loaded, load, update, setAxisPolicy, setLock, remove } = useExercises();
  const folders = useFolders((s) => s.folders);
  const loadFolders = useFolders((s) => s.load);
  const move = useFolders((s) => s.move);
  const navigate = useNavigate();
  // Just made from a blueprint: the name is the first thing to set.
  const fresh = (useLocation().state as { fresh?: boolean } | null)?.fresh === true;
  const named = useRef(false);
  const loadSettings = useSettings((s) => s.load);
  const instrument = useSettings((s) => s.settings.instrument);

  useEffect(() => {
    void load();
    void loadSettings();
    void loadFolders();
  }, [load, loadSettings, loadFolders]);

  // The tags on offer: the known ones and any the player has added anywhere.
  const offeredTags = useMemo(() => {
    const all = new Set<string>(KNOWN_TAGS);
    for (const e of exercises) for (const t of e.tags) all.add(t);
    return [...all].sort();
  }, [exercises]);

  const exercise = exercises.find((e) => e.id === exerciseId);
  const definition = exercise ? findExerciseDefinition(exercise.definitionId) : undefined;

  if (!loaded) return <LoadingState />;
  if (!exercise || !definition) {
    return (
      <div className="px-8 py-8">
        <EmptyState title="No such exercise">
          <Link to="/exercises" className="text-accent-text underline">
            Back to the library
          </Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <section>
      <div className="flex items-start justify-between gap-6 px-8 py-7">
        <div className="min-w-0 flex-1">
          <Kicker accent>Exercise</Kicker>
          <div className="flex items-center gap-3">
            <FavoriteToggle
              on={exercise.favorite ?? false}
              label={exercise.name}
              onChange={(on) => void update(exercise.id, { favorite: on })}
            />
            <NameField
              // Fresh for each exercise, and after a rename made elsewhere (a move's " - 2").
              key={`${exercise.id}:${exercise.name}`}
              name={exercise.name}
              taken={exerciseNamesIn(folders, exercises, exercise.folderId, exercise.id)}
              selectOnOpen={() => {
                if (!fresh || named.current) return false;
                named.current = true;
                return true;
              }}
              onRename={(name) => void update(exercise.id, { name })}
            />
          </div>
          <FromBlueprint name={exercise.name} blueprint={definition.name} className="block" />
          <p className="mt-1 max-w-[680px] text-body-sm text-ink-muted">
            {definition.description}
          </p>
          <div className="mt-4 grid max-w-[900px] grid-cols-[64px_1fr] items-baseline gap-x-3 gap-y-2.5">
            <span className="kicker">Folder</span>
            <div className="w-64">
              <FolderPicker
                folders={folders}
                value={exercise.folderId}
                onChange={(to) => void move({ folderIds: [], exerciseIds: [exercise.id] }, to)}
              />
            </div>
            <span className="kicker">Tags</span>
            <TagsEditor
              tags={exercise.tags}
              offered={offeredTags}
              onChange={(tags) => void update(exercise.id, { tags })}
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-6">
          <Button
            variant="secondary"
            onClick={() => void remove(exercise.id).then(() => void navigate('/exercises'))}
          >
            Delete
          </Button>
          <Button asChild>
            <Link to={`/practice/exercise/${exercise.id}`}>Practice this</Link>
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 px-8 pt-1 pb-7 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          {/* A theory exercise has no pulse, so nothing to set a tempo for. */}
          {definition.kind === 'played' && (
            <div className="sheet px-5 py-4">
              <Kicker>Tempo</Kicker>
              <div className="mt-3 space-y-4">
                <Field
                  label="Target tempo"
                  htmlFor="target-tempo"
                  hint="The tempo you mean to play this at. Moving the tempo while practicing never changes it."
                >
                  <Input
                    id="target-tempo"
                    type="number"
                    min={30}
                    max={300}
                    className="tabular-nums"
                    value={exercise.tempo.targetTempo ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      void update(exercise.id, {
                        tempo: {
                          ...exercise.tempo,
                          targetTempo: e.target.value === '' ? null : Number(e.target.value),
                        },
                      })
                    }
                  />
                </Field>

                <Field
                  label="Best ever"
                  htmlFor="best-tempo"
                  hint="Record keeping only. Nothing reads this."
                >
                  <Input
                    id="best-tempo"
                    type="number"
                    min={30}
                    max={300}
                    className="tabular-nums"
                    value={exercise.tempo.maxTempo ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      void update(exercise.id, {
                        tempo: {
                          ...exercise.tempo,
                          maxTempo: e.target.value === '' ? null : Number(e.target.value),
                        },
                      })
                    }
                  />
                </Field>
              </div>
            </div>
          )}
          <ExerciseVideos exercise={exercise} played={definition.kind === 'played'} />
          {definition.kind === 'played' && (
            <BackingCriteriaEditor
              exercise={exercise}
              requiredTags={definition.backing?.requiredTags}
            />
          )}
          {definition.kind === 'played' && (
            <div className="sheet px-5 py-4" data-testid="generated-backing">
              <Kicker>Generated backing</Kicker>
              <p className="mt-1 text-meta text-ink-muted">
                Bass and piano over the key’s chords, when Generated is chosen in the Backing
                menu.
              </p>
              <div className="mt-3">
                <GeneratedBackingEditor
                  key={exercise.id}
                  initial={resolveGeneratedBacking(definition, exercise.generatedBacking)}
                  chordsIn={{
                    mode: settledMode(exercise.axisPolicies, exercise.heldAxisValues),
                  }}
                  onChange={(generatedBacking) =>
                    void update(exercise.id, { generatedBacking })
                  }
                />
              </div>
            </div>
          )}
        </div>

        <div>
          {definition.params && (
            <div className="sheet mb-8 px-5 py-4">
              <Kicker>Settings</Kicker>
              <div className="mt-3 max-w-[320px]">
                <ParamsEditor
                  definition={definition}
                  stored={exercise.params}
                  locks={{
                    locked: exercise.locked.params,
                    onToggle: (key, locked) => void setLock(exercise.id, 'params', key, locked),
                  }}
                  onChange={(params) => void update(exercise.id, { params })}
                />
              </div>
            </div>
          )}

          <Kicker>What varies</Kicker>
          <p className="mb-3 max-w-[560px] text-body-sm text-ink-muted">
            A <strong>lock</strong> fixes a setting into this exercise: it is hidden wherever
            the exercise is used, and set only here. <strong>Roll</strong> picks a new value
            each time you open it or re-roll. <strong>Fixed</strong> pins one.{' '}
            <strong>Hold</strong> keeps whatever came up last and stays there until you press
            re-roll — for working one key for a while without pinning it forever. When rolling,
            click values to leave them out.
          </p>
          <AxisPolicyEditor
            axes={definition.axes}
            policies={exercise.axisPolicies}
            held={exercise.heldAxisValues}
            instrument={instrument}
            allowed={definition.allowedValues}
            locks={{
              locked: exercise.locked.axes,
              onToggle: (axis, locked) => void setLock(exercise.id, 'axes', axis, locked),
            }}
            onChange={(axis, policy) => void setAxisPolicy(exercise.id, axis, policy)}
          />

          {definition.axes.length === 0 && (
            <p className="text-body-sm text-ink-muted">
              This exercise is the same every time — it varies nothing.
            </p>
          )}
        </div>
      </div>

      <Separator className="invisible" />
    </section>
  );
}

/**
 * The exercise's name, edited in place. Saved on blur or Enter; a blank name
 * or one already used in its folder is shown, not saved. Escape goes back.
 */
function NameField({
  name,
  taken,
  selectOnOpen,
  onRename,
}: {
  name: string;
  taken: readonly string[];
  /** True the first time it is asked, on an exercise just made: focus it, ready to type over. */
  selectOnOpen: () => boolean;
  onRename: (name: string) => void;
}) {
  const [draft, setDraft] = useState(name);
  const problem = nameProblem(draft, taken);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!selectOnOpen()) return;
    input.current?.focus();
    input.current?.select();
  }, [selectOnOpen]);
  const commit = () => {
    if (problem === null && draft.trim() !== name) onRename(draft.trim());
  };
  return (
    <div className="min-w-0 flex-1">
      {/* A plain input: the shared field's text size wins over a heading's. */}
      <input
        aria-label="Exercise name"
        ref={input}
        aria-invalid={problem !== null}
        aria-describedby={problem ? 'name-problem' : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setDraft(name);
        }}
        className="w-full min-w-0 border-b border-transparent bg-transparent font-display text-(length:--h1-size) leading-tight tracking-(--display-tracking) [font-weight:var(--display-weight)] outline-none hover:border-rule focus:border-ink aria-invalid:border-destructive"
      />
      {problem && (
        <p id="name-problem" className="mt-1 text-meta text-destructive">
          {problem === 'empty'
            ? 'A name is needed. Escape puts the old one back.'
            : 'Another exercise in this folder has that name.'}
        </p>
      )}
    </div>
  );
}
