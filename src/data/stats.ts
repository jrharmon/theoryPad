import type { ExerciseStats, Rep } from './entities';

/**
 * Aggregate maintenance, as pure functions.
 *
 * The Dexie repository uses these, and `rebuild` is defined in terms of the same `apply` — so "the incremental value equals
 * the rebuilt value" is a property that can actually be tested rather than
 * hoped for. That is the whole difference between a counter and a counter you
 * can trust.
 */

export function emptyStats(exerciseId: string, definitionId: string): ExerciseStats {
  return {
    exerciseId,
    definitionId,
    repCount: 0,
    totalSeconds: 0,
    firstPlayedAt: null,
    lastPlayedAt: null,
    axisValuesSeen: {},
    questionsAnswered: 0,
    questionsCorrect: 0,
    updatedAt: 0,
  };
}

function repSeconds(rep: Rep): number {
  if (rep.endedAt === null) return 0;
  return Math.max(0, (rep.endedAt - rep.startedAt) / 1000);
}

/** Fold one rep into an exercise's aggregates. */
export function applyRep(stats: ExerciseStats, rep: Rep): ExerciseStats {
  // Skipped and abandoned reps count as time spent but not as a rep played;
  // otherwise skipping through a routine would inflate every total.
  const counts = rep.status === 'completed';

  const axisValuesSeen: Record<string, string[]> = { ...stats.axisValuesSeen };
  if (counts) {
    for (const [axis, value] of Object.entries(rep.axes)) {
      const seen = axisValuesSeen[axis] ?? [];
      if (!seen.includes(value)) axisValuesSeen[axis] = [...seen, value].sort();
    }
  }

  return {
    ...stats,
    definitionId: rep.definitionId,
    repCount: stats.repCount + (counts ? 1 : 0),
    totalSeconds: stats.totalSeconds + repSeconds(rep),
    firstPlayedAt:
      stats.firstPlayedAt === null
        ? rep.startedAt
        : Math.min(stats.firstPlayedAt, rep.startedAt),
    lastPlayedAt:
      stats.lastPlayedAt === null ? rep.startedAt : Math.max(stats.lastPlayedAt, rep.startedAt),
    axisValuesSeen,
    questionsAnswered: stats.questionsAnswered + (rep.score?.total ?? 0),
    questionsCorrect: stats.questionsCorrect + (rep.score?.correct ?? 0),
    updatedAt: Math.max(stats.updatedAt, rep.startedAt),
  };
}

/** Recompute every aggregate from the log alone. */
export function rebuildStats(reps: Rep[]): ExerciseStats[] {
  const byExercise = new Map<string, ExerciseStats>();

  // Order matters for firstPlayedAt/lastPlayedAt to read naturally, though
  // both are min/max so the result is order-independent either way.
  for (const rep of [...reps].sort((a, b) => a.startedAt - b.startedAt)) {
    const current =
      byExercise.get(rep.exerciseId) ?? emptyStats(rep.exerciseId, rep.definitionId);
    byExercise.set(rep.exerciseId, applyRep(current, rep));
  }

  return [...byExercise.values()];
}

/** Every value ever rolled for an axis, across every exercise. */
export function coverageForAxis(stats: ExerciseStats[], axis: string): string[] {
  const seen = new Set<string>();
  for (const entry of stats) {
    for (const value of entry.axisValuesSeen[axis] ?? []) seen.add(value);
  }
  return [...seen].sort();
}

/** Counts per value for an axis, for the roller's coverage bias. */
export function coverageCounts(reps: Rep[], axis: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const rep of reps) {
    const value = rep.axes[axis];
    if (value === undefined) continue;
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}
