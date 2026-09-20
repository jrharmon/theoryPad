import { describe, expect, it } from 'vitest';
import type { Exercise, ExerciseStats } from '../entities';
import { emptyStats } from '../stats';
import { findRedundantExercises } from '../dedupe';

function exercise(id: string, definitionId = 'modes-through-key', createdAt = 1_000): Exercise {
  return {
    id,
    createdAt,
    updatedAt: createdAt,
    definitionId,
    params: {},
    axisPolicies: {},
    heldAxisValues: {},
    tempo: { targetTempo: 70, maxTempo: null },
    defaultReps: 2,
  };
}

function played(exerciseId: string, repCount: number): ExerciseStats {
  return { ...emptyStats(exerciseId, 'modes-through-key'), repCount };
}

describe('findRedundantExercises', () => {
  it('leaves a library with no duplicates alone', () => {
    const rows = [exercise('a'), exercise('b', 'other')];
    expect(findRedundantExercises(rows, [])).toEqual({ remove: [], ambiguous: [] });
  });

  it('keeps the oldest when nothing has been played', () => {
    const older = exercise('a', 'modes-through-key', 1_000);
    const newer = exercise('b', 'modes-through-key', 2_000);
    const { remove } = findRedundantExercises([newer, older], []);
    expect(remove.map((e) => e.id)).toEqual(['b']);
  });

  it('keeps the one with practice behind it, whatever its age', () => {
    const older = exercise('a', 'modes-through-key', 1_000);
    const newer = exercise('b', 'modes-through-key', 2_000);
    const { remove } = findRedundantExercises([older, newer], [played('b', 12)]);
    expect(remove.map((e) => e.id)).toEqual(['a']);
  });

  it('touches nothing when several have history', () => {
    // Guessing would throw away real practice.
    const a = exercise('a');
    const b = exercise('b');
    const result = findRedundantExercises([a, b], [played('a', 3), played('b', 5)]);
    expect(result.remove).toEqual([]);
    expect(result.ambiguous).toHaveLength(1);
  });

  it('handles more than two copies', () => {
    const rows = [
      exercise('a', 'modes-through-key', 3_000),
      exercise('b', 'modes-through-key', 1_000),
      exercise('c', 'modes-through-key', 2_000),
    ];
    const { remove } = findRedundantExercises(rows, []);
    expect(remove.map((e) => e.id).sort()).toEqual(['a', 'c']);
  });

  it('groups by definition, not across them', () => {
    const rows = [
      exercise('a', 'one', 1_000),
      exercise('b', 'one', 2_000),
      exercise('c', 'two', 1_000),
    ];
    const { remove } = findRedundantExercises(rows, []);
    expect(remove.map((e) => e.id)).toEqual(['b']);
  });

  it('ignores stats for exercises that are gone', () => {
    const rows = [
      exercise('a', 'modes-through-key', 1_000),
      exercise('b', 'modes-through-key', 2_000),
    ];
    const { remove } = findRedundantExercises(rows, [played('vanished', 9)]);
    expect(remove.map((e) => e.id)).toEqual(['b']);
  });
});
