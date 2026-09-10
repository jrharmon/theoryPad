import { create } from 'zustand';
import { createRepositories, db, type Exercise, type NewExercise } from '@/data';
import type { AxisId, AxisPolicy } from '@/domain/variation';
import { EXERCISE_DEFINITIONS, exerciseDefinition } from '@/exercises/registry';
import type { AnyExerciseDefinition } from '@/exercises/types';

interface ExercisesState {
  exercises: Exercise[];
  loaded: boolean;
  load: () => Promise<void>;
  addFromDefinition: (definitionId: string) => Promise<Exercise>;
  update: (id: string, changes: Partial<Exercise>) => Promise<void>;
  /**
   * Change one axis's policy.
   *
   * A dedicated action rather than the caller building the whole map, because
   * the caller's copy can be a render behind: two quick edits then each write
   * their own view of the map and the second silently drops the first.
   */
  setAxisPolicy: (id: string, axis: AxisId, policy: AxisPolicy) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/** A configured exercise, seeded from its definition's defaults. */
export function newExerciseFrom(definition: AnyExerciseDefinition): NewExercise {
  // The registry erases each definition's params type, so this is genuinely
  // unknown here; the definition validates it and the runner hands it straight
  // back to the same definition.
  const params: unknown = definition.params
    ? (definition.params.parse(definition.defaults.params ?? {}) as unknown)
    : undefined;

  return {
    definitionId: definition.id,
    name: definition.name,
    userTags: [],
    params,
    axisPolicies: definition.defaults.axisPolicies ?? {},
    heldAxisValues: {},
    tempo: { targetTempo: definition.defaults.targetTempo, maxTempo: null },
    defaultReps: definition.defaults.reps,
  };
}

/**
 * Guards against concurrent loads.
 *
 * Several screens call load() on mount, and StrictMode invokes each effect
 * twice — so without this, two loads race, both find an empty library, and both
 * seed it. That is what put two identical exercises in the list.
 */
let inFlight: Promise<void> | null = null;

/**
 * Writes to one exercise run in order.
 *
 * Every update is a read-modify-write of the whole row, so two overlapping
 * ones let the slower reply win and lose the earlier change.
 */
const writeQueues = new Map<string, Promise<unknown>>();

function queued<T>(id: string, work: () => Promise<T>): Promise<T> {
  const next = (writeQueues.get(id) ?? Promise.resolve()).then(work, work);
  writeQueues.set(
    id,
    next.catch(() => undefined),
  );
  return next;
}

export const useExercises = create<ExercisesState>((set, get) => ({
  exercises: [],
  loaded: false,

  async load() {
    if (get().loaded) return;
    inFlight ??= (async () => {
      const repos = createRepositories(db());
      const existing = await repos.exercises.all();

      // Seed by definition rather than by count, so this is idempotent even if
      // it does somehow run twice.
      const have = new Set(existing.map((e) => e.definitionId));
      for (const definition of EXERCISE_DEFINITIONS) {
        if (have.has(definition.id)) continue;
        await repos.exercises.add(newExerciseFrom(definition));
      }

      set({ exercises: await repos.exercises.all(), loaded: true });
    })().finally(() => {
      inFlight = null;
    });

    return inFlight;
  },

  async addFromDefinition(definitionId) {
    const repos = createRepositories(db());
    const created = await repos.exercises.add(newExerciseFrom(exerciseDefinition(definitionId)));
    set({ exercises: [...get().exercises, created] });
    return created;
  },

  async update(id, changes) {
    await queued(id, async () => {
      const repos = createRepositories(db());
      const updated = await repos.exercises.update(id, changes);
      set({ exercises: get().exercises.map((e) => (e.id === id ? updated : e)) });
    });
  },

  async setAxisPolicy(id, axis, policy) {
    await queued(id, async () => {
      const repos = createRepositories(db());
      // Read the row back rather than trusting a caller's copy of the map.
      const current = await repos.exercises.byId(id);
      if (!current) return;
      const updated = await repos.exercises.update(id, {
        axisPolicies: { ...current.axisPolicies, [axis]: policy },
      });
      set({ exercises: get().exercises.map((e) => (e.id === id ? updated : e)) });
    });
  },

  async remove(id) {
    const repos = createRepositories(db());
    await repos.exercises.softDelete(id);
    set({ exercises: get().exercises.filter((e) => e.id !== id) });
  },
}));
