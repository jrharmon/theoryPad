import { create } from 'zustand';
import { createRepositories, db, type Exercise, type NewExercise } from '@/data';
import { EXERCISE_DEFINITIONS, exerciseDefinition } from '@/exercises/registry';
import type { AnyExerciseDefinition } from '@/exercises/types';

interface ExercisesState {
  exercises: Exercise[];
  loaded: boolean;
  load: () => Promise<void>;
  addFromDefinition: (definitionId: string) => Promise<Exercise>;
  update: (id: string, changes: Partial<Exercise>) => Promise<void>;
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

export const useExercises = create<ExercisesState>((set, get) => ({
  exercises: [],
  loaded: false,

  async load() {
    const repos = createRepositories(db());
    let exercises = await repos.exercises.all();

    // First run: give the library something in it rather than an empty screen.
    if (exercises.length === 0) {
      for (const definition of EXERCISE_DEFINITIONS) {
        await repos.exercises.add(newExerciseFrom(definition));
      }
      exercises = await repos.exercises.all();
    }

    set({ exercises, loaded: true });
  },

  async addFromDefinition(definitionId) {
    const repos = createRepositories(db());
    const created = await repos.exercises.add(newExerciseFrom(exerciseDefinition(definitionId)));
    set({ exercises: [...get().exercises, created] });
    return created;
  },

  async update(id, changes) {
    const repos = createRepositories(db());
    const updated = await repos.exercises.update(id, changes);
    set({ exercises: get().exercises.map((e) => (e.id === id ? updated : e)) });
  },

  async remove(id) {
    const repos = createRepositories(db());
    await repos.exercises.softDelete(id);
    set({ exercises: get().exercises.filter((e) => e.id !== id) });
  },
}));
