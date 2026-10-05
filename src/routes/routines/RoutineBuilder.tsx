import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { Exercise, Routine, RoutineItem } from '@/data';
import type { AxisId } from '@/domain/variation';
import { describePolicies, describeReps } from '@/exercises/describe';
import { repsAreQuestions, resolveGeneratedBacking } from '@/exercises/params';
import { estimateItemSeconds, formatDuration } from '@/exercises/estimate';
import { findExerciseDefinition } from '@/exercises/registry';
import { AxisPolicyEditor } from '@/components/variation/AxisPolicyEditor';
import { settledMode } from '@/components/backing/chordContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FavoriteToggle } from '@/components/ui/favorite-toggle';
import { Kicker } from '@/components/ui/kicker';
import { exerciseLabel, useExerciseLookup, useExercises } from '@/store/exercises';
import { FromBlueprint } from '@/components/library/FromBlueprint';
import { useRoutines } from '@/store/routines';
import { useSettings } from '@/store/settings';
import { SettingsDialog } from '../practice/SettingsDialog';
import { effectiveItem, overridesSession, visibleAxes, withoutLocked } from '@/exercises/locks';
import { listGroups } from '@/domain/library';
import { useFolders } from '@/store/folders';
import { LoadingState } from '@/components/ui/page-header';

/** Key, scale and mode belong to the routine: rolled once, shared by every item. */
const SESSION_AXES: AxisId[] = ['scale', 'mode', 'key'];

export function RoutineBuilder() {
  const { routineId } = useParams();
  const routines = useRoutines();
  const loadExercises = useExercises((s) => s.load);
  const loadSettings = useSettings((s) => s.load);
  const instrument = useSettings((s) => s.settings.instrument);
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  // One item's editor at a time — opened by its Edit, or on being added.
  const [editing, setEditing] = useState<string | null>(null);
  const loadFolders = useFolders((s) => s.load);

  useEffect(() => {
    void routines.load();
    void loadExercises();
    void loadSettings();
    void loadFolders();
    // Load once on arrival; the store keeps itself current after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const routine = routines.routines.find((r) => r.id === routineId);
  const total = useMemo(
    () =>
      routine?.items.reduce((sum, item) => {
        const definition = findExerciseDefinition(item.definitionId);
        return definition ? sum + estimateItemSeconds(definition, item, instrument) : sum;
      }, 0) ?? 0,
    [routine, instrument],
  );

  if (!routines.loaded) return <LoadingState />;
  if (!routine) {
    return (
      <div className="px-8 py-8">
        <EmptyState title="No such routine">
          <Link to="/home" className="text-accent-text underline">
            Back to your routines
          </Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <section className="pb-16">
      <div className="flex items-end justify-between gap-6 px-8 py-7">
        <div className="min-w-0 flex-1">
          <Kicker accent>Routine</Kicker>
          <div className="flex items-center gap-3">
            <FavoriteToggle
              on={routine.favorite ?? false}
              label={routine.name}
              onChange={(on) => void routines.setFavorite(routine.id, on)}
            />
            <NameField
              routine={routine}
              onRename={(name) => void routines.rename(routine.id, name)}
            />
          </div>
          <p className="mt-1 text-body-sm text-ink-muted tabular-nums">
            {routine.items.length === 0
              ? 'Add the exercises it plays, in order.'
              : `${routine.items.length} exercise${routine.items.length === 1 ? '' : 's'} · about ${formatDuration(total)}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => void routines.remove(routine.id).then(() => void navigate('/home'))}
          >
            Delete
          </Button>
          {routine.items.length > 0 ? (
            <Button asChild>
              <Link to={`/practice/routine/${routine.id}`}>Start</Link>
            </Button>
          ) : (
            <Button disabled>Start</Button>
          )}
        </div>
      </div>

      <div className="px-8 pt-1 pb-6">
        <Kicker>Key and mode</Kicker>
        <p className="mb-3 mt-1 text-body-sm text-ink-muted">
          Rolled once when the routine starts, and shared by every exercise in it.
        </p>
        <div className="max-w-[900px]">
          <AxisPolicyEditor
            axes={SESSION_AXES}
            policies={routine.sessionAxisPolicies}
            held={{}}
            instrument={instrument}
            onChange={(axis, policy) =>
              void routines.setSessionPolicy(routine.id, axis, policy)
            }
          />
        </div>
      </div>

      <div className="max-w-[1100px] px-8 pt-2 pb-6">
        <div className="flex items-center justify-between">
          <Kicker>Exercises</Kicker>
          <Button size="sm" onClick={() => setAdding(true)}>
            Add exercise
          </Button>
        </div>
        <p className="mb-3 mt-1 max-w-[640px] text-body-sm text-ink-muted">
          Each is its own copy: changing it here leaves the library alone, and the same exercise
          can go in more than once. Its passes still count toward that exercise’s history.
        </p>

        {routine.items.length === 0 ? (
          <EmptyState title="Nothing in it yet">Add an exercise to start.</EmptyState>
        ) : (
          <ol className="sheet px-2">
            {routine.items.map((item, index) => (
              <ItemRow
                key={item.id}
                routine={routine}
                item={item}
                index={index}
                last={index === routine.items.length - 1}
                editing={editing === item.id}
                onEditing={(open) => setEditing(open ? item.id : null)}
              />
            ))}
          </ol>
        )}
      </div>

      <AddExerciseDialog
        open={adding}
        onOpenChange={setAdding}
        onPick={(exercise) => {
          setAdding(false);
          // Set up straight away: Done with nothing changed keeps the copy as it came.
          void routines.addItem(routine.id, exercise).then((item) => setEditing(item.id));
        }}
      />
    </section>
  );
}

/** Saved on blur or Enter, not on every keystroke. */
function NameField({
  routine,
  onRename,
}: {
  routine: Routine;
  onRename: (name: string) => void;
}) {
  const [draft, setDraft] = useState(routine.name);
  const commit = () => {
    const name = draft.trim();
    if (name && name !== routine.name) onRename(name);
    else setDraft(routine.name);
  };
  return (
    // A plain input: the shared field's text size wins over a heading's.
    <input
      aria-label="Routine name"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      className="w-full min-w-0 border-b border-transparent bg-transparent font-display text-(length:--h1-size) leading-tight tracking-(--display-tracking) [font-weight:var(--display-weight)] outline-none hover:border-rule focus:border-ink"
    />
  );
}

const MAX_PASSES = 9;
const MAX_QUESTIONS = 40;

function ItemRow({
  routine,
  item,
  index,
  last,
  editing,
  onEditing,
}: {
  routine: Routine;
  item: RoutineItem;
  index: number;
  last: boolean;
  editing: boolean;
  onEditing: (open: boolean) => void;
}) {
  const routines = useRoutines();
  const instrument = useSettings((s) => s.settings.instrument);
  const playNotes = useSettings((s) => s.settings.audio.playNotes);
  const definition = findExerciseDefinition(item.definitionId);
  const exercise = useExerciseLookup()(item.exerciseId);
  // Locked settings are the exercise's, read through rather than copied.
  const effective = effectiveItem(item, exercise);
  const locks = exercise?.locked ?? NO_LOCKS;

  if (!definition) {
    return (
      <li className="flex items-center gap-3 border-b border-rule px-3 py-3 text-body-sm text-ink-muted">
        An exercise that no longer exists ({item.definitionId}) — it will be left out.
        <Button
          variant="secondary"
          size="xs"
          onClick={() => void routines.removeItem(routine.id, item.id)}
        >
          Remove
        </Button>
      </li>
    );
  }

  const ownAxes = definition.axes.filter((a) => !SESSION_AXES.includes(a));
  // A theory set's reps are its questions: one set, as long as asked for.
  const questions = repsAreQuestions(definition);
  const unit = questions ? 'questions' : 'passes';
  // Its own key, or its own scale and mode, over the routine's: "Own mode: Lydian".
  const own = (['key', 'scale'] as const).flatMap((axis) =>
    overridesSession(axis, effective.axisPolicies)
      ? describePolicies(
          effective.axisPolicies,
          definition.axes.filter((a) =>
            axis === 'key' ? a === 'key' : a !== 'key' && SESSION_AXES.includes(a),
          ),
          instrument,
        ).map((text) => `Own ${text.charAt(0).toLowerCase()}${text.slice(1)}`)
      : [],
  );
  const described = [
    item.tempo.targetTempo === null ? null : `${item.tempo.targetTempo} bpm`,
    ...own,
    ...describePolicies(effective.axisPolicies, ownAxes, instrument),
  ].filter(Boolean);

  return (
    <li
      className={`grid grid-cols-[28px_1fr_auto] items-center gap-3 px-3 py-3 ${last ? '' : 'border-b border-rule'}`}
      data-testid="routine-item"
    >
      <span className="text-body-sm font-extrabold tabular-nums text-ink-faint">
        {index + 1}
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="face-title text-body">{exercise?.name ?? definition.name}</span>
          <FromBlueprint name={exercise?.name ?? definition.name} blueprint={definition.name} />
        </p>
        {exercise?.deletedAt !== undefined ? (
          <p className="text-meta text-ink-muted">
            Its exercise was deleted. It still plays, as it is set up here.
          </p>
        ) : (
          <p className="text-meta text-ink-muted">{definition.summary}</p>
        )}
        {described.length > 0 && (
          <p className="truncate text-meta text-ink-muted">{described.join(' · ')}</p>
        )}
      </div>

      <div className="flex items-center gap-1">
        <div
          className="mr-2 flex items-center gap-1"
          role="group"
          aria-label={questions ? 'Questions' : 'Passes'}
        >
          <Button
            variant="secondary"
            size="icon-xs"
            aria-label={`Fewer ${unit}`}
            disabled={item.reps <= 1}
            onClick={() =>
              void routines.updateItem(routine.id, item.id, { reps: item.reps - 1 })
            }
          >
            −
          </Button>
          <span
            className="w-24 text-center text-body-sm tabular-nums"
            data-testid="item-passes"
          >
            {describeReps(definition, item.reps)}
          </span>
          <Button
            variant="secondary"
            size="icon-xs"
            aria-label={`More ${unit}`}
            disabled={item.reps >= (questions ? MAX_QUESTIONS : MAX_PASSES)}
            onClick={() =>
              void routines.updateItem(routine.id, item.id, { reps: item.reps + 1 })
            }
          >
            +
          </Button>
        </div>
        <Button variant="secondary" size="xs" onClick={() => onEditing(true)}>
          Edit
        </Button>
        <Button
          variant="secondary"
          size="icon-xs"
          aria-label="Move up"
          disabled={index === 0}
          onClick={() => void routines.moveItem(routine.id, item.id, -1)}
        >
          ↑
        </Button>
        <Button
          variant="secondary"
          size="icon-xs"
          aria-label="Move down"
          disabled={last}
          onClick={() => void routines.moveItem(routine.id, item.id, 1)}
        >
          ↓
        </Button>
        <Button
          variant="secondary"
          size="xs"
          onClick={() => void routines.removeItem(routine.id, item.id)}
        >
          Remove
        </Button>
      </div>

      <SettingsDialog
        open={editing}
        onOpenChange={onEditing}
        title={exercise ? exerciseLabel(exercise) : definition.name}
        description="This copy only — the exercise in your library is left as it is. Key, scale and mode are the routine’s unless fixed here."
        definition={definition}
        initial={{
          tempo: effective.tempo,
          params: effective.params,
          axisPolicies: effective.axisPolicies,
          ...(definition.kind === 'played'
            ? {
                generatedBacking: resolveGeneratedBacking(definition, item.generatedBacking),
                playNotes: item.playNotes ?? playNotes,
              }
            : {}),
        }}
        held={effective.heldAxisValues}
        // Key and mode are the routine's, rolled when it runs.
        chordsIn={{ mode: settledMode(routine.sessionAxisPolicies) }}
        axes={visibleAxes(definition.axes, locks)}
        hiddenParams={[...locks.params, ...(questions ? ['questionCount'] : [])]}
        inRoutine
        onApply={(changed) =>
          void routines.updateItem(routine.id, item.id, withoutLocked(changed, item, locks))
        }
      />
    </li>
  );
}

/** The library, grouped as the practice side panel groups it. Picking one adds a copy of it. */
function AddExerciseDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (exercise: Exercise) => void;
}) {
  const exercises = useExercises((s) => s.exercises);
  const folders = useFolders((s) => s.folders);
  const groups = useMemo(
    () =>
      listGroups(
        folders,
        exercises.filter((e) => findExerciseDefinition(e.definitionId)),
      ),
    [folders, exercises],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Add an exercise</DialogTitle>
          <DialogDescription>
            It comes in with the settings it has in your library, and opens here to change.
          </DialogDescription>
        </DialogHeader>
        {groups.map((group) => (
          <section key={group.key}>
            <p className="kicker px-2 pt-2 text-ink-faint">
              {group.kind === 'favorites'
                ? 'Favorites'
                : group.kind === 'top'
                  ? 'Top level'
                  : group.path.join(' › ')}
            </p>
            <ul>
              {group.exercises.map((exercise) => {
                const definition = findExerciseDefinition(exercise.definitionId)!;
                return (
                  <li key={exercise.id} className="border-b border-rule last:border-b-0">
                    <button
                      type="button"
                      onClick={() => onPick(exercise)}
                      className="flex w-full items-baseline gap-3 px-2 py-2.5 text-left hover:bg-ink/5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="face-title text-body">{exercise.name}</span>
                          <FromBlueprint name={exercise.name} blueprint={definition.name} />
                        </span>
                        <span className="block text-meta text-ink-muted">
                          {definition.summary}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </DialogContent>
    </Dialog>
  );
}

const NO_LOCKS = { params: [], axes: [] } as const;
