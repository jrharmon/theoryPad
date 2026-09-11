import type { Exercise, ExerciseStats } from './entities';

export interface DuplicateResolution {
  /** Rows safe to remove. */
  remove: Exercise[];
  /** Groups left alone because more than one has history behind it. */
  ambiguous: Exercise[][];
}

/**
 * Finds redundant copies of the same exercise.
 *
 * An earlier seeding bug let two loads race and both fill an empty library, so
 * some databases hold two identical rows for one definition. Two instances of a
 * definition are a legitimate thing to want — different keys, different tempos
 * — so this only removes ones that are indistinguishable *and* unused:
 *
 *   - If exactly one copy has reps logged against it, the unplayed ones go.
 *   - If none has been played, the oldest stays and the rest go.
 *   - If several have history, nothing is touched. That is real practice
 *     behind each of them, and guessing would throw one away.
 */
export function findRedundantExercises(
  exercises: Exercise[],
  stats: ExerciseStats[],
): DuplicateResolution {
  const repCounts = new Map(stats.map((s) => [s.exerciseId, s.repCount]));
  const played = (exercise: Exercise) => (repCounts.get(exercise.id) ?? 0) > 0;

  const byDefinition = new Map<string, Exercise[]>();
  for (const exercise of exercises) {
    byDefinition.set(exercise.definitionId, [
      ...(byDefinition.get(exercise.definitionId) ?? []),
      exercise,
    ]);
  }

  const remove: Exercise[] = [];
  const ambiguous: Exercise[][] = [];

  for (const group of byDefinition.values()) {
    if (group.length < 2) continue;

    const withHistory = group.filter(played);
    if (withHistory.length > 1) {
      ambiguous.push(group);
      continue;
    }

    const keep =
      withHistory[0] ?? [...group].sort((a, b) => a.createdAt - b.createdAt)[0]!;
    remove.push(...group.filter((exercise) => exercise.id !== keep.id));
  }

  return { remove, ambiguous };
}
