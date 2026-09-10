import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STANDARD_GUITAR } from '@/domain/instrument';
import { TheoryPadDB } from '../db';
import { createRepositories } from '../repositories/dexie';
import { createMemoryRepositories } from '../repositories/memory';
import type { Repositories } from '../repositories/types';
import type { NewExercise, NewRep, NewSession } from '../repositories/types';

const exerciseFixture: NewExercise = {
  definitionId: 'modes-through-key',
  name: 'Seven modes through a key',
  userTags: [],
  params: { variant: 'plain', shapesPerRep: 7, minFret: 1 },
  axisPolicies: {},
  heldAxisValues: {},
  tempo: { targetTempo: 76, maxTempo: null },
  defaultReps: 1,
};

const sessionFixture: NewSession = {
  routineId: null,
  seed: 42,
  startedAt: 1_000,
  endedAt: null,
  sessionKey: 'D' as never,
  sessionMode: 'dorian',
};

function repFixture(overrides: Partial<NewRep> = {}): NewRep {
  return {
    sessionId: 'session-1',
    exerciseId: 'exercise-1',
    definitionId: 'modes-through-key',
    index: 0,
    startedAt: 1_000,
    endedAt: 61_000,
    tempo: 76,
    freeTime: false,
    axes: { neckPosition: '5' },
    seed: 1,
    status: 'completed',
    ...overrides,
  };
}

/**
 * Both implementations are run against the same suite. The in-memory one is
 * what the rest of the app's tests use, so it has to behave identically — a
 * fake that quietly differs is worse than no fake.
 */
function suite(name: string, make: () => Promise<Repositories>, teardown?: () => Promise<void>) {
  describe(name, () => {
    let repos: Repositories;

    beforeEach(async () => {
      repos = await make();
    });

    afterEach(async () => {
      await teardown?.();
    });

    describe('exercises', () => {
      it('adds with an id and timestamps', async () => {
        const saved = await repos.exercises.add(exerciseFixture);
        expect(saved.id).toBeTruthy();
        expect(saved.createdAt).toBeGreaterThan(0);
        expect(saved.updatedAt).toBe(saved.createdAt);
        expect(await repos.exercises.byId(saved.id)).toEqual(saved);
      });

      it('gives every row a distinct id', async () => {
        const a = await repos.exercises.add(exerciseFixture);
        const b = await repos.exercises.add(exerciseFixture);
        expect(a.id).not.toBe(b.id);
      });

      it('updates and bumps updatedAt', async () => {
        const saved = await repos.exercises.add(exerciseFixture);
        const updated = await repos.exercises.update(saved.id, {
          tempo: { targetTempo: 88, maxTempo: 104 },
        });
        expect(updated.tempo.targetTempo).toBe(88);
        expect(updated.updatedAt).toBeGreaterThanOrEqual(saved.updatedAt);
        expect(updated.createdAt).toBe(saved.createdAt);
      });

      it('soft-deletes rather than dropping the row', async () => {
        // A sync layer has to be able to propagate a deletion.
        const saved = await repos.exercises.add(exerciseFixture);
        await repos.exercises.softDelete(saved.id);
        expect(await repos.exercises.byId(saved.id)).toBeUndefined();
        expect(await repos.exercises.all()).toEqual([]);
      });

      it('finds by definition', async () => {
        await repos.exercises.add(exerciseFixture);
        await repos.exercises.add({ ...exerciseFixture, definitionId: 'other' });
        expect(await repos.exercises.byDefinition('modes-through-key')).toHaveLength(1);
      });

      it('refuses to update something that is not there', async () => {
        await expect(repos.exercises.update('nope', { name: 'x' })).rejects.toThrow();
      });
    });

    describe('sessions', () => {
      it('adds, ends and queries by range', async () => {
        const saved = await repos.sessions.add(sessionFixture);
        expect(saved.endedAt).toBeNull();

        const ended = await repos.sessions.end(saved.id, 9_000);
        expect(ended.endedAt).toBe(9_000);

        expect(await repos.sessions.inRange(0, 5_000)).toHaveLength(1);
        expect(await repos.sessions.inRange(5_000, 9_000)).toHaveLength(0);
      });

      it('lists the most recent first', async () => {
        await repos.sessions.add({ ...sessionFixture, startedAt: 1_000 });
        await repos.sessions.add({ ...sessionFixture, startedAt: 3_000 });
        await repos.sessions.add({ ...sessionFixture, startedAt: 2_000 });
        const recent = await repos.sessions.recent();
        expect(recent.map((s) => s.startedAt)).toEqual([3_000, 2_000, 1_000]);
      });
    });

    describe('reps', () => {
      it('adds and counts', async () => {
        await repos.reps.add(repFixture());
        await repos.reps.add(repFixture({ index: 1 }));
        expect(await repos.reps.count()).toBe(2);
      });

      it('queries by session, exercise and date range', async () => {
        await repos.reps.add(repFixture({ startedAt: 1_000 }));
        await repos.reps.add(repFixture({ sessionId: 'session-2', startedAt: 5_000 }));
        await repos.reps.add(repFixture({ exerciseId: 'exercise-2', startedAt: 9_000 }));

        expect(await repos.reps.bySession('session-1')).toHaveLength(2);
        expect(await repos.reps.byExercise('exercise-1')).toHaveLength(2);
        expect(await repos.reps.inRange(0, 5_000)).toHaveLength(2);
      });

      it('returns an exercise’s reps newest first, and honours a limit', async () => {
        for (const startedAt of [1_000, 5_000, 9_000]) {
          await repos.reps.add(repFixture({ startedAt }));
        }
        const found = await repos.reps.byExercise('exercise-1', 2);
        expect(found.map((r) => r.startedAt)).toEqual([9_000, 5_000]);
      });

      it('updates the exercise’s stats as part of writing the rep', async () => {
        await repos.reps.add(repFixture({ axes: { neckPosition: '5' } }));
        await repos.reps.add(
          repFixture({ startedAt: 70_000, endedAt: 130_000, axes: { neckPosition: '7' } }),
        );

        const stats = await repos.stats.byExercise('exercise-1');
        expect(stats?.repCount).toBe(2);
        expect(stats?.axisValuesSeen.neckPosition).toEqual(['5', '7']);
        expect(stats?.totalSeconds).toBe(120);
      });
    });

    describe('stats', () => {
      it('rebuilds to exactly what incremental maintenance produced', async () => {
        for (let i = 0; i < 30; i += 1) {
          await repos.reps.add(
            repFixture({
              exerciseId: i % 3 === 0 ? 'exercise-2' : 'exercise-1',
              startedAt: 1_000 + i * 1_000,
              endedAt: 1_000 + i * 1_000 + 30_000,
              axes: { neckPosition: String((i % 6) * 2) },
              status: i % 7 === 0 ? 'skipped' : 'completed',
            }),
          );
        }

        const before = (await repos.stats.all()).sort((a, b) =>
          a.exerciseId.localeCompare(b.exerciseId),
        );
        await repos.stats.rebuild();
        const after = (await repos.stats.all()).sort((a, b) =>
          a.exerciseId.localeCompare(b.exerciseId),
        );

        expect(after).toEqual(before);
      });

      it('has nothing before anything is played', async () => {
        expect(await repos.stats.all()).toEqual([]);
        expect(await repos.stats.byExercise('exercise-1')).toBeUndefined();
      });
    });

    describe('settings', () => {
      it('returns defaults on first read, and persists them', async () => {
        const first = await repos.settings.get();
        expect(first.instrument.id).toBe(STANDARD_GUITAR.id);
        expect(first.practice.revealBriefBeforeRep).toBe(true);
        expect(await repos.settings.get()).toEqual(first);
      });

      it('saves changes', async () => {
        const current = await repos.settings.get();
        const saved = await repos.settings.save({
          ...current,
          audio: { ...current.audio, countInBars: 2 },
        });
        expect(saved.audio.countInBars).toBe(2);
        expect((await repos.settings.get()).audio.countInBars).toBe(2);
      });
    });
  });
}

let dbCounter = 0;
let currentDb: TheoryPadDB | null = null;

suite(
  'Dexie repositories',
  () => {
    dbCounter += 1;
    currentDb = new TheoryPadDB(`theorypad-test-${dbCounter}`);
    return Promise.resolve(createRepositories(currentDb));
  },
  async () => {
    await currentDb?.delete();
    currentDb = null;
  },
);

suite('in-memory repositories', () => Promise.resolve(createMemoryRepositories()));
