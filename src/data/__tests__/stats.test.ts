import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@/domain/variation';
import type { Rep } from '../entities';
import { applyRep, coverageCounts, coverageForAxis, emptyStats, rebuildStats } from '../stats';

function rep(overrides: Partial<Rep> = {}): Rep {
  const startedAt = overrides.startedAt ?? 1_000;
  return {
    id: `rep-${Math.random()}`,
    createdAt: startedAt,
    updatedAt: startedAt,
    sessionId: 'session-1',
    exerciseId: 'exercise-1',
    definitionId: 'modes-through-key',
    index: 0,
    startedAt,
    endedAt: startedAt + 60_000,
    tempo: 76,
    freeTime: false,
    axes: { key: 'D', mode: 'dorian', neckPosition: '5' },
    seed: 1,
    status: 'completed',
    ...overrides,
  };
}

describe('applyRep', () => {
  it('counts a completed rep and its time', () => {
    const stats = applyRep(emptyStats('exercise-1', 'modes-through-key'), rep());
    expect(stats.repCount).toBe(1);
    expect(stats.totalSeconds).toBe(60);
    expect(stats.firstPlayedAt).toBe(1_000);
    expect(stats.lastPlayedAt).toBe(1_000);
  });

  it('counts time but not a rep for skipped and abandoned ones', () => {
    // Otherwise skipping through a routine inflates every total.
    for (const status of ['skipped', 'abandoned'] as const) {
      const stats = applyRep(emptyStats('exercise-1', 'd'), rep({ status }));
      expect(stats.repCount, status).toBe(0);
      expect(stats.totalSeconds, status).toBe(60);
    }
  });

  it('records every distinct axis value, deduplicated and sorted', () => {
    let stats = emptyStats('exercise-1', 'd');
    stats = applyRep(stats, rep({ axes: { neckPosition: '5' } }));
    stats = applyRep(stats, rep({ axes: { neckPosition: '3' } }));
    stats = applyRep(stats, rep({ axes: { neckPosition: '5' } }));
    expect(stats.axisValuesSeen.neckPosition).toEqual(['3', '5']);
  });

  it('does not record axis values from a rep that was not played', () => {
    const stats = applyRep(
      emptyStats('exercise-1', 'd'),
      rep({ status: 'skipped', axes: { neckPosition: '12' } }),
    );
    expect(stats.axisValuesSeen).toEqual({});
  });

  it('tracks the earliest and latest play', () => {
    let stats = emptyStats('exercise-1', 'd');
    stats = applyRep(stats, rep({ startedAt: 5_000 }));
    stats = applyRep(stats, rep({ startedAt: 1_000 }));
    stats = applyRep(stats, rep({ startedAt: 9_000 }));
    expect(stats.firstPlayedAt).toBe(1_000);
    expect(stats.lastPlayedAt).toBe(9_000);
  });

  it('accumulates theory scores', () => {
    let stats = emptyStats('exercise-1', 'd');
    stats = applyRep(stats, rep({ score: { correct: 6, total: 8 } }));
    stats = applyRep(stats, rep({ score: { correct: 7, total: 8 } }));
    expect(stats.questionsAnswered).toBe(16);
    expect(stats.questionsCorrect).toBe(13);
  });

  it('ignores an unfinished rep’s duration rather than inventing one', () => {
    const stats = applyRep(emptyStats('exercise-1', 'd'), rep({ endedAt: null }));
    expect(stats.totalSeconds).toBe(0);
  });
});

describe('rebuildStats', () => {
  it('produces the same result as applying reps one at a time', () => {
    // This is what makes the cache safe rather than a drifting counter: it can
    // always be reconstructed from the log, and the two agree.
    const rng = mulberry32(4242);
    const statuses = ['completed', 'completed', 'completed', 'skipped', 'abandoned'] as const;
    const exercises = ['exercise-1', 'exercise-2', 'exercise-3'];
    const positions = ['0', '3', '5', '7', '10', '12'];

    const reps: Rep[] = Array.from({ length: 400 }, () =>
      rep({
        exerciseId: rng.pick(exercises),
        startedAt: 1_000 + rng.int(500_000),
        status: rng.pick(statuses),
        axes: { neckPosition: rng.pick(positions), key: rng.pick(['C', 'D', 'G']) },
        ...(rng.next() > 0.7
          ? { score: { correct: rng.int(9), total: 8 } }
          : {}),
      }),
    );

    // Incremental, in write order.
    const incremental = new Map<string, ReturnType<typeof emptyStats>>();
    for (const r of [...reps].sort((a, b) => a.startedAt - b.startedAt)) {
      const current = incremental.get(r.exerciseId) ?? emptyStats(r.exerciseId, r.definitionId);
      incremental.set(r.exerciseId, applyRep(current, r));
    }

    const rebuilt = new Map(rebuildStats(reps).map((s) => [s.exerciseId, s]));

    expect([...rebuilt.keys()].sort()).toEqual([...incremental.keys()].sort());
    for (const [id, expected] of incremental) {
      expect(rebuilt.get(id), id).toEqual(expected);
    }
  });

  it('is order-independent', () => {
    const rng = mulberry32(7);
    const reps: Rep[] = Array.from({ length: 50 }, () =>
      rep({ startedAt: 1_000 + rng.int(10_000), axes: { neckPosition: rng.pick(['3', '5']) } }),
    );
    const forwards = rebuildStats(reps);
    const backwards = rebuildStats([...reps].reverse());
    expect(backwards).toEqual(forwards);
  });

  it('returns nothing for an empty log', () => {
    expect(rebuildStats([])).toEqual([]);
  });
});

describe('coverage', () => {
  it('collects every value seen across exercises', () => {
    const stats = rebuildStats([
      rep({ exerciseId: 'a', axes: { neckPosition: '3' } }),
      rep({ exerciseId: 'b', axes: { neckPosition: '7' } }),
      rep({ exerciseId: 'b', axes: { neckPosition: '3' } }),
    ]);
    expect(coverageForAxis(stats, 'neckPosition')).toEqual(['3', '7']);
    expect(coverageForAxis(stats, 'stringSet')).toEqual([]);
  });

  it('counts values for the roller’s bias', () => {
    const counts = coverageCounts(
      [
        rep({ axes: { neckPosition: '3' } }),
        rep({ axes: { neckPosition: '3' } }),
        rep({ axes: { neckPosition: '7' } }),
        rep({ axes: {} }),
      ],
      'neckPosition',
    );
    expect(counts).toEqual({ '3': 2, '7': 1 });
  });
});
