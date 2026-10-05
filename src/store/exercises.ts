import { useMemo } from 'react';
import { create } from 'zustand';
import { repos, type Exercise, type NewExercise } from '@/data';
import type { AxisId, AxisPolicy } from '@/domain/variation';
import {
  EXERCISE_DEFINITIONS,
  exerciseDefinition,
  findExerciseDefinition,
} from '@/exercises/registry';
import type { AnyExerciseDefinition } from '@/exercises/types';
import { serialWrites } from './util';

interface ExercisesState {
  /** The live ones. */
  exercises: Exercise[];
  /** Deleted ones, still named by the reps and routine items tied to them. */
  deleted: Exercise[];
  loaded: boolean;
  load: () => Promise<void>;
  /** A new exercise from a blueprint, named and placed by the caller. */
  addFromDefinition: (
    definitionId: string,
    place: { name: string; folderId: string | null },
  ) => Promise<Exercise>;
  update: (id: string, changes: Partial<Exercise>) => Promise<void>;
  /**
   * Change one axis's policy.
   *
   * A dedicated action rather than the caller building the whole map, because
   * the caller's copy can be a render behind: two quick edits then each write
   * their own view of the map and the second silently drops the first.
   */
  setAxisPolicy: (id: string, axis: AxisId, policy: AxisPolicy) => Promise<void>;
  /** Lock a params key or an axis, or unlock it. The value stays where it is. */
  setLock: (id: string, kind: 'params' | 'axes', key: string, locked: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
  removeMany: (ids: readonly string[]) => Promise<void>;
}

/**
 * The library in the order it is listed: favorites pinned to the top, the
 * rest in the order they were added. One whose definition is gone from the
 * code is left out.
 */
export function libraryRows(
  exercises: Exercise[],
): { exercise: Exercise; definition: AnyExerciseDefinition }[] {
  return exercises
    .flatMap((exercise) => {
      const definition = findExerciseDefinition(exercise.definitionId);
      return definition ? [{ exercise, definition }] : [];
    })
    .sort(
      (a, b) => Number(b.exercise.favorite ?? false) - Number(a.exercise.favorite ?? false),
    );
}

/**
 * A new exercise from a blueprint: its defaults, its name and tags, nothing
 * locked, at the top level unless told otherwise.
 */
export function newExerciseFrom(
  definition: AnyExerciseDefinition,
  { name = definition.name, folderId = null }: { name?: string; folderId?: string | null } = {},
): NewExercise {
  // Straight from the schema: its `.default()` values are the exercise's
  // starting params, written once. The registry erases each definition's
  // params type, so this is genuinely unknown here; the definition validates
  // it and the runner hands it straight back to the same definition.
  const params: unknown = definition.params
    ? (definition.params.parse({}) as unknown)
    : undefined;

  return {
    definitionId: definition.id,
    name,
    tags: [...definition.tags],
    folderId,
    locked: { params: [], axes: [] },
    params,
    axisPolicies: definition.defaults.axisPolicies ?? {},
    heldAxisValues: {},
    tempo: { targetTempo: definition.defaults.targetTempo, maxTempo: null },
    countInBars: definition.defaults.countInBars ?? 1,
    defaultReps: definition.defaults.reps,
  };
}

/**
 * Guards against concurrent loads.
 *
 * Several screens call load() on mount, and StrictMode invokes each effect
 * twice — so without this, two loads race, both find an empty library, and both
 * seed it.
 */
let inFlight: Promise<void> | null = null;

/** Writes to one exercise run in order; see `serialWrites`. */
const queued = serialWrites();

export const useExercises = create<ExercisesState>((set, get) => ({
  exercises: [],
  deleted: [],
  loaded: false,

  async load() {
    if (get().loaded) return;
    inFlight ??= (async () => {
      // A starter per blueprint, on the first load only: a table with no rows
      // at all, not even deleted ones, is a new database. After that nothing is
      // added — a deleted starter stays deleted, and a blueprint added to the
      // code later is the player's to make an exercise from.
      if ((await repos().exercises.withDeleted()).length === 0) {
        for (const definition of EXERCISE_DEFINITIONS) {
          await repos().exercises.add(newExerciseFrom(definition));
        }
      }

      const everything = await repos().exercises.withDeleted();
      set({
        exercises: everything.filter((e) => e.deletedAt === undefined),
        deleted: everything.filter((e) => e.deletedAt !== undefined),
        loaded: true,
      });
    })().finally(() => {
      inFlight = null;
    });

    return inFlight;
  },

  async addFromDefinition(definitionId, place) {
    const created = await repos().exercises.add(
      newExerciseFrom(exerciseDefinition(definitionId), place),
    );
    set({ exercises: [...get().exercises, created] });
    return created;
  },

  async update(id, changes) {
    await queued(id, async () => {
      const updated = await repos().exercises.update(id, changes);
      set({ exercises: get().exercises.map((e) => (e.id === id ? updated : e)) });
    });
  },

  async setAxisPolicy(id, axis, policy) {
    await queued(id, async () => {
      // Read the row back rather than trusting a caller's copy of the map.
      const current = await repos().exercises.byId(id);
      if (!current) return;
      const updated = await repos().exercises.update(id, {
        axisPolicies: { ...current.axisPolicies, [axis]: policy },
      });
      set({ exercises: get().exercises.map((e) => (e.id === id ? updated : e)) });
    });
  },

  async setLock(id, kind, key, locked) {
    await queued(id, async () => {
      const current = await repos().exercises.byId(id);
      if (!current) return;
      const others = (current.locked[kind] as string[]).filter((k) => k !== key);
      const updated = await repos().exercises.update(id, {
        locked: { ...current.locked, [kind]: locked ? [...others, key] : others },
      });
      set({ exercises: get().exercises.map((e) => (e.id === id ? updated : e)) });
    });
  },

  remove: (id) => get().removeMany([id]),

  async removeMany(ids) {
    for (const id of ids) await repos().exercises.softDelete(id);
    const at = Date.now();
    const gone = get()
      .exercises.filter((e) => ids.includes(e.id))
      .map((e) => ({ ...e, deletedAt: at }));
    set({
      exercises: get().exercises.filter((e) => !ids.includes(e.id)),
      deleted: [...get().deleted, ...gone],
    });
  },
}));

/**
 * Any exercise by id, deleted ones included: a rep or a routine item names the
 * exercise it was tied to whatever became of it.
 */
export function useExerciseLookup(): (id: string) => Exercise | undefined {
  const exercises = useExercises((s) => s.exercises);
  const deleted = useExercises((s) => s.deleted);
  return useMemo(() => {
    const byId = new Map([...deleted, ...exercises].map((e) => [e.id, e]));
    return (id: string) => byId.get(id);
  }, [exercises, deleted]);
}

/** An exercise's name as shown: marked when it has been deleted. */
export function exerciseLabel(exercise: Exercise): string {
  return exercise.deletedAt === undefined ? exercise.name : `${exercise.name} (deleted)`;
}
