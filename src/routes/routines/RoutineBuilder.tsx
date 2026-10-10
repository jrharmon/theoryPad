import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { Exercise, Routine, RoutineItem } from '@/data';
import type { AxisId } from '@/domain/variation';
import { describePolicies, describeReps } from '@/exercises/describe';
import { repsAreQuestions, resolveGeneratedBacking } from '@/exercises/params';
import { findExerciseDefinition } from '@/exercises/registry';
import { AxisPolicyEditor } from '@/components/variation/AxisPolicyEditor';
import { settledMode } from '@/components/backing/chordContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FavoriteToggle } from '@/components/ui/favorite-toggle';
import { Kicker } from '@/components/ui/kicker';
import { exerciseLabel, useExerciseLookup, useExercises } from '@/store/exercises';
import { FromBlueprint } from '@/components/library/FromBlueprint';
import { describeExtent, routineExtent, useRoutines } from '@/store/routines';
import { isOn, isSection, plays, type RoutineSection } from '@/domain/routine';
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
  // The add dialog, open for a section (or the end of the routine, null).
  const [adding, setAdding] = useState<{ sectionId: string | null } | null>(null);
  // One item's editor at a time — opened by its Edit, or on being added.
  const [editing, setEditing] = useState<string | null>(null);
  // A section just added, its name selected to type over.
  const [fresh, setFresh] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<RoutineSection | null>(null);
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
  const extent = useMemo(
    () => (routine ? routineExtent(routine, instrument) : null),
    [routine, instrument],
  );
  const groups = useMemo(() => (routine ? groupsOf(routine.items) : []), [routine]);

  if (!routines.loaded) return <LoadingState />;
  if (!routine || !extent) {
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
              value={routine.name}
              label="Routine name"
              onRename={(name) => void routines.rename(routine.id, name)}
              className="font-display text-(length:--h1-size) leading-tight tracking-(--display-tracking) [font-weight:var(--display-weight)]"
            />
          </div>
          <p className="mt-1 text-body-sm text-ink-muted tabular-nums">
            {extent.total === 0
              ? 'Add the exercises it plays, in order.'
              : describeExtent(extent)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => void routines.remove(routine.id).then(() => void navigate('/home'))}
          >
            Delete
          </Button>
          {extent.played > 0 ? (
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
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                void routines.addSection(routine.id, null).then((s) => setFresh(s.id))
              }
            >
              Add section
            </Button>
            <Button size="sm" onClick={() => setAdding({ sectionId: null })}>
              Add exercise
            </Button>
          </div>
        </div>
        <p className="mb-3 mt-1 max-w-[640px] text-body-sm text-ink-muted">
          Each is its own copy: changing it here leaves the library alone, and the same exercise
          can go in more than once. Its passes still count toward that exercise’s history.
          Switch one off to leave it out of the run; a section’s switch does it for everything
          under it.
        </p>

        {routine.items.length === 0 ? (
          <EmptyState title="Nothing in it yet">Add an exercise to start.</EmptyState>
        ) : (
          groups.map((group, g) => (
            <div key={group.section?.id ?? 'top'}>
              {group.section && (
                <SectionHeader
                  routine={routine}
                  section={group.section}
                  items={group.items.map(({ item }) => item)}
                  first={g === (groups[0]!.section ? 0 : 1)}
                  last={g === groups.length - 1}
                  fresh={fresh === group.section.id}
                  onAdd={() => setAdding({ sectionId: group.section!.id })}
                  onDelete={() =>
                    group.items.length === 0
                      ? void routines.removeSection(routine.id, group.section!.id, false)
                      : setDeleting(group.section)
                  }
                />
              )}
              {group.items.length > 0 ? (
                <ol className="sheet px-2">
                  {group.items.map(({ item, number }, i) => (
                    <ItemRow
                      key={item.id}
                      routine={routine}
                      item={item}
                      number={number}
                      dimmed={!plays(item, group.section)}
                      sectionOff={group.section !== null && !isOn(group.section)}
                      first={routine.items[0]?.id === item.id}
                      last={routine.items.at(-1)?.id === item.id}
                      lastInGroup={i === group.items.length - 1}
                      // Above a section's first item would only make an empty one.
                      onInsertSection={
                        group.section && i === 0
                          ? null
                          : () =>
                              void routines
                                .addSection(routine.id, item.id)
                                .then((s) => setFresh(s.id))
                      }
                      editing={editing === item.id}
                      onEditing={(open) => setEditing(open ? item.id : null)}
                    />
                  ))}
                </ol>
              ) : (
                <p className="px-5 pb-2 text-meta text-ink-faint">
                  Nothing in it yet — add an exercise, or move one down into it.
                </p>
              )}
            </div>
          ))
        )}
      </div>

      <AddExerciseDialog
        open={adding !== null}
        onOpenChange={(open) => !open && setAdding(null)}
        onPick={(exercise) => {
          const sectionId = adding?.sectionId ?? null;
          setAdding(null);
          // Set up straight away: Done with nothing changed keeps the copy as it came.
          void routines
            .addItem(routine.id, exercise, sectionId)
            .then((item) => setEditing(item.id));
        }}
      />
      <DeleteSectionDialog
        section={deleting}
        count={
          deleting ? (groups.find((g) => g.section?.id === deleting.id)?.items.length ?? 0) : 0
        }
        onOpenChange={(open) => !open && setDeleting(null)}
        onDelete={(withItems) => {
          void routines.removeSection(routine.id, deleting!.id, withItems);
          setDeleting(null);
        }}
      />
    </section>
  );
}

interface Group {
  /** Null for the items above the first section. */
  section: RoutineSection | null;
  /** Numbered through the routine, counting only what plays. */
  items: { item: RoutineItem; number: number | null }[];
}

/** The list cut at each divider, as it is drawn: a header, then a sheet of its items. */
function groupsOf(entries: Routine['items']): Group[] {
  const groups: Group[] = [{ section: null, items: [] }];
  let number = 0;
  for (const entry of entries) {
    if (isSection(entry)) {
      groups.push({ section: entry, items: [] });
      continue;
    }
    const group = groups.at(-1)!;
    group.items.push({ item: entry, number: plays(entry, group.section) ? ++number : null });
  }
  return groups.filter((g) => g.section !== null || g.items.length > 0);
}

/** A divider: its name, its switch, and its own Add, moves and Delete. */
function SectionHeader({
  routine,
  section,
  items,
  first,
  last,
  fresh,
  onAdd,
  onDelete,
}: {
  routine: Routine;
  section: RoutineSection;
  items: RoutineItem[];
  first: boolean;
  last: boolean;
  fresh: boolean;
  onAdd: () => void;
  onDelete: () => void;
}) {
  const routines = useRoutines();
  const on = items.filter(isOn).length;
  const plural = (n: number) => `${n} exercise${n === 1 ? '' : 's'}`;
  const count =
    items.length === 0
      ? 'Empty'
      : !isOn(section)
        ? `${plural(items.length)}, off`
        : on === items.length
          ? plural(items.length)
          : `${on} of ${plural(items.length)} on`;
  return (
    <div className="mt-5 flex items-center gap-3 px-5 pb-2" data-testid="routine-section">
      <input
        type="checkbox"
        aria-label={`Play ${section.name}`}
        checked={isOn(section)}
        onChange={(e) =>
          void routines.updateSection(routine.id, section.id, { enabled: e.target.checked })
        }
        className="size-4 shrink-0"
      />
      <NameField
        value={section.name}
        label="Section name"
        autoSelect={fresh}
        onRename={(name) => void routines.updateSection(routine.id, section.id, { name })}
        className={`face-title text-lead ${isOn(section) ? '' : 'text-ink-muted'}`}
      />
      <span className="shrink-0 text-meta text-ink-muted tabular-nums">{count}</span>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="secondary" size="xs" className="mr-1" onClick={onAdd}>
          Add exercise
        </Button>
        <Button
          variant="secondary"
          size="icon-xs"
          aria-label="Move section up"
          disabled={first}
          onClick={() => void routines.moveSection(routine.id, section.id, -1)}
        >
          ↑
        </Button>
        <Button
          variant="secondary"
          size="icon-xs"
          aria-label="Move section down"
          disabled={last}
          onClick={() => void routines.moveSection(routine.id, section.id, 1)}
        >
          ↓
        </Button>
        <Button variant="secondary" size="xs" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}

/**
 * Deleting a section always asks: just the heading — the default, its items
 * staying where they are — or its items too.
 */
function DeleteSectionDialog({
  section,
  count,
  onOpenChange,
  onDelete,
}: {
  section: RoutineSection | null;
  count: number;
  onOpenChange: (open: boolean) => void;
  onDelete: (withItems: boolean) => void;
}) {
  const exercises = `${count} exercise${count === 1 ? '' : 's'}`;
  return (
    <Dialog open={section !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Delete {section?.name}?</DialogTitle>
          <DialogDescription>
            Delete just the heading, and its {exercises} stay where they are — or delete{' '}
            {count === 1 ? 'it' : 'them'} too.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => onDelete(true)}>
            Delete {exercises} too
          </Button>
          <Button autoFocus onClick={() => onDelete(false)}>
            Delete heading only
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Saved on blur or Enter, not on every keystroke. */
function NameField({
  value,
  label,
  onRename,
  autoSelect = false,
  className,
}: {
  value: string;
  label: string;
  onRename: (name: string) => void;
  /** Focused with its text selected, to type straight over. */
  autoSelect?: boolean;
  className: string;
}) {
  const [draft, setDraft] = useState(value);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!autoSelect) return;
    input.current?.focus();
    input.current?.select();
  }, [autoSelect]);
  const commit = () => {
    const name = draft.trim();
    if (name && name !== value) onRename(name);
    else setDraft(value);
  };
  return (
    // A plain input: the shared field's text size wins over a heading's.
    <input
      aria-label={label}
      value={draft}
      ref={input}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      className={`w-full min-w-0 border-b border-transparent bg-transparent outline-none hover:border-rule focus:border-ink ${className}`}
    />
  );
}

const MAX_PASSES = 9;
const MAX_QUESTIONS = 40;

function ItemRow({
  routine,
  item,
  number,
  dimmed,
  sectionOff,
  first,
  last,
  lastInGroup,
  onInsertSection,
  editing,
  onEditing,
}: {
  routine: Routine;
  item: RoutineItem;
  /** Through the routine, counting only what plays; null when it sits out. */
  number: number | null;
  /** Off, or under a section that is. */
  dimmed: boolean;
  /** Under a section switched off: its own switch keeps its state but can't change. */
  sectionOff: boolean;
  /** First and last in the whole list, where moving stops. */
  first: boolean;
  last: boolean;
  lastInGroup: boolean;
  /** A new section divider just above this item — offered on hover. */
  onInsertSection: (() => void) | null;
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
      className={`group/row relative grid grid-cols-[16px_20px_1fr_auto] items-center gap-3 px-3 py-3 ${lastInGroup ? '' : 'border-b border-rule'}`}
      data-testid="routine-item"
    >
      {onInsertSection && (
        <button
          type="button"
          aria-label={`Add a section above ${exercise?.name ?? definition.name}`}
          onClick={onInsertSection}
          className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 rounded-toggle bg-paper px-2 text-meta leading-5 text-accent-text opacity-0 ring-1 ring-rule transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100"
        >
          + Section here
        </button>
      )}
      <input
        type="checkbox"
        aria-label={`Play ${exercise?.name ?? definition.name}`}
        checked={isOn(item)}
        disabled={sectionOff}
        onChange={(e) =>
          void routines.updateItem(routine.id, item.id, { enabled: e.target.checked })
        }
        className={`size-4 ${sectionOff ? 'opacity-50' : ''}`}
      />
      <span className="text-body-sm font-extrabold tabular-nums text-ink-faint">{number}</span>
      <div className={`min-w-0 ${dimmed ? 'opacity-50' : ''}`}>
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
          disabled={first}
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
