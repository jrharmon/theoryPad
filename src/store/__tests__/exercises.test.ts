import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TheoryPadDB, createRepositories, repos, setDb } from '@/data';
import { EXERCISE_DEFINITIONS, exerciseDefinition } from '@/exercises/registry';
import { newExerciseFrom, useExercises } from '../exercises';

let database: TheoryPadDB;

beforeEach(() => {
  database = new TheoryPadDB(`exercises-store-${Math.random()}`);
  setDb(database);
  useExercises.setState({ exercises: [], loaded: false });
});

afterEach(async () => {
  setDb(null);
  await database.delete();
});

describe('the first load', () => {
  it('gives an empty database one starter per blueprint, named after it', async () => {
    // StrictMode loads twice at once; the guard keeps it to one set.
    await Promise.all([useExercises.getState().load(), useExercises.getState().load()]);

    const exercises = await repos().exercises.all();
    expect(exercises.map((e) => e.definitionId).sort()).toEqual(
      EXERCISE_DEFINITIONS.map((d) => d.id).sort(),
    );
    const modes = exercises.find((e) => e.definitionId === 'modes-through-key')!;
    expect(modes).toMatchObject({
      name: exerciseDefinition('modes-through-key').name,
      tags: [...exerciseDefinition('modes-through-key').tags],
      folderId: null,
      locked: { params: [], axes: [] },
    });
  });

  it('adds nothing to a database whose only exercises are deleted', async () => {
    const r = createRepositories(database);
    const only = await r.exercises.add(
      newExerciseFrom(exerciseDefinition('modes-through-key')),
    );
    await r.exercises.softDelete(only.id);

    await useExercises.getState().load();
    expect(useExercises.getState().exercises).toEqual([]);
    expect(await repos().exercises.all()).toEqual([]);
  });
});
