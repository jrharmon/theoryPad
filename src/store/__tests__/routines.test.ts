import { describe, expect, it } from 'vitest';
import type { Exercise, Routine, RoutineItem } from '@/data';
import { itemFromExercise, moveItem, sortRoutines } from '../routines';

const exercise: Exercise = {
  id: 'ex-1',
  definitionId: 'modes-through-key',
  params: { variant: 'plain' },
  axisPolicies: {
    key: { mode: 'fixed', value: 'G' },
    direction: { mode: 'fixed', value: 'ascending' },
  },
  heldAxisValues: { direction: 'descending' },
  tempo: { targetTempo: 70, maxTempo: 90 },
  defaultReps: 2,
  createdAt: 1,
  updatedAt: 1,
};

describe('itemFromExercise', () => {
  it('copies the settings, leaving key and mode to the routine', () => {
    const item = itemFromExercise(exercise);
    expect(item).toMatchObject({
      exerciseId: 'ex-1',
      definitionId: 'modes-through-key',
      reps: 2,
      params: { variant: 'plain' },
      tempo: { targetTempo: 70, maxTempo: 90 },
      axisPolicies: { direction: { mode: 'fixed', value: 'ascending' } },
    });
    expect(item.axisPolicies.key).toBeUndefined();
  });

  it('shares nothing with the exercise afterwards', () => {
    const item = itemFromExercise(exercise);
    (item.params as { variant: string }).variant = 'pause-on-root';
    item.tempo.targetTempo = 120;
    expect(exercise.params).toEqual({ variant: 'plain' });
    expect(exercise.tempo.targetTempo).toBe(70);
  });

  it('gives each copy its own id, so one exercise can be added twice', () => {
    expect(itemFromExercise(exercise).id).not.toBe(itemFromExercise(exercise).id);
  });
});

describe('moveItem', () => {
  const items = ['a', 'b', 'c'].map((id) => ({ id }) as RoutineItem);

  it('moves up and down, and stops at the ends', () => {
    expect(moveItem(items, 'b', -1).map((i) => i.id)).toEqual(['b', 'a', 'c']);
    expect(moveItem(items, 'b', 1).map((i) => i.id)).toEqual(['a', 'c', 'b']);
    expect(moveItem(items, 'a', -1)).toBe(items);
    expect(moveItem(items, 'c', 1)).toBe(items);
  });
});

describe('sortRoutines', () => {
  const r = (id: string, extra: Partial<Routine>): Routine => ({
    id,
    name: id,
    items: [],
    sessionAxisPolicies: {},
    createdAt: 1,
    updatedAt: 1,
    ...extra,
  });

  it('puts favorites first, then the most recently played', () => {
    const sorted = sortRoutines([
      r('old', { lastPlayedAt: 10 }),
      r('fav', { favorite: true }),
      r('recent', { lastPlayedAt: 20 }),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(['fav', 'recent', 'old']);
  });
});
