import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STANDARD_GUITAR } from '@/domain/instrument';
import Dexie from 'dexie';
import { TheoryPadDB } from '../db';
import { createRepositories } from '../repositories/dexie';
import type { Repositories } from '../repositories/types';
import type { NewExercise, NewRep, NewSession, NewVideo } from '../repositories/types';
import { FIRST_RUN_VIDEOS } from '../seed/videos';

const exerciseFixture: NewExercise = {
  definitionId: 'modes-through-key',
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

/** The repository contract, run against Dexie over `fake-indexeddb`. */
function suite(name: string, make: () => Promise<Repositories>, teardown?: () => Promise<void>) {
  describe(name, () => {
    let repos: Repositories;

    beforeEach(async () => {
      repos = await make();
    });

    afterEach(async () => {
      await teardown?.();
    });

    describe('routines', () => {
      const routine = {
        name: 'Morning',
        sessionAxisPolicies: {},
        items: [
          {
            id: 'item-1',
            exerciseId: 'ex-1',
            definitionId: 'modes-through-key',
            reps: 2,
            params: {},
            tempo: { targetTempo: 70, maxTempo: null },
            axisPolicies: {},
            heldAxisValues: {},
          },
        ],
      };

      it('adds, reads back, lists and updates', async () => {
        const saved = await repos.routines.add(routine);
        expect(await repos.routines.byId(saved.id)).toEqual(saved);
        expect(await repos.routines.all()).toHaveLength(1);

        const renamed = await repos.routines.update(saved.id, { name: 'Evening', favorite: true });
        expect(renamed).toMatchObject({ name: 'Evening', favorite: true });
        expect(renamed.items).toEqual(routine.items);
      });

      it('soft-deletes, so a sync layer could propagate it', async () => {
        const saved = await repos.routines.add(routine);
        await repos.routines.softDelete(saved.id);
        expect(await repos.routines.byId(saved.id)).toBeUndefined();
        expect(await repos.routines.all()).toHaveLength(0);
      });
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
        await expect(repos.exercises.update('nope', { defaultReps: 3 })).rejects.toThrow();
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
        expect(await repos.days.all()).toEqual([]);
      });
    });

    describe('practice days', () => {
      const day = (d: number, hour = 12) => new Date(2026, 8, d, hour).getTime();

      it('rolls each rep into its day as it is written', async () => {
        const frets = { strings: 6, counts: { '0:5': 2, '1:7': 1 } };
        await repos.reps.add(
          repFixture({ startedAt: day(7), endedAt: day(7) + 60_000, frets, axes: { key: 'D', mode: 'dorian' } }),
        );
        await repos.reps.add(repFixture({ startedAt: day(7, 20), endedAt: day(7, 20) + 30_000, frets }));
        await repos.reps.add(
          repFixture({ startedAt: day(9), endedAt: day(9) + 30_000, frets, status: 'abandoned' }),
        );

        const days = await repos.days.all();
        expect(days.map((d) => [d.date, d.seconds, d.passes])).toEqual([
          ['2026-09-07', 90, 2],
          ['2026-09-09', 30, 0],
        ]);
        expect(days[0]!.frets).toEqual({ 6: { '0:5': 4, '1:7': 2 } });
        expect(days[0]!.keyModes).toEqual({ 'D dorian': 1 });
        expect((await repos.days.inRange('2026-09-08', '2026-09-30')).map((d) => d.date)).toEqual([
          '2026-09-09',
        ]);
      });

      it('rebuilds to exactly what incremental maintenance produced', async () => {
        for (let i = 0; i < 30; i += 1) {
          const startedAt = day(1 + (i % 9), 8 + (i % 12));
          await repos.reps.add(
            repFixture({
              startedAt,
              endedAt: startedAt + 45_000,
              axes: { key: i % 2 ? 'C' : 'Bb', mode: 'lydian' },
              frets: { strings: 6, counts: { [`${i % 6}:${i % 13}`]: 1 + (i % 3) } },
              status: i % 5 === 0 ? 'abandoned' : 'completed',
            }),
          );
        }
        const before = await repos.days.all();
        await repos.stats.rebuild();
        expect(await repos.days.all()).toEqual(before);
      });
    });

    describe('videos', () => {
      const track: NewVideo = {
        videoId: 'abcdefghijk',
        title: 'D Dorian funk',
        scope: { kind: 'shared' },
        playAlong: true,
        startSec: 12.5,
        keyMode: { tonic: 'D' as never, mode: 'dorian' },
        bpm: 96,
        beatsPerBar: 4,
        tags: ['funk'],
      };

      it('adds, updates and soft-deletes, and lists only live ones', async () => {
        const before = (await repos.videos.all()).length;
        const added = await repos.videos.add(track);
        expect(await repos.videos.byId(added.id)).toEqual(added);

        const updated = await repos.videos.update(added.id, { bpm: 98 });
        expect(updated.bpm).toBe(98);
        expect(updated.title).toBe('D Dorian funk');

        await repos.videos.softDelete(added.id);
        expect(await repos.videos.byId(added.id)).toBeUndefined();
        expect(await repos.videos.all()).toHaveLength(before);
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

describe('the v2 migration', () => {
  it('strips the name and tags that now live on the definition', async () => {
    // A copy drifts: when the definition was renamed, every row kept the old
    // name. The stored copies are removed rather than left to go stale.
    const name = `theorypad-migration-${Date.now()}`;

    const before = new Dexie(name);
    before.version(1).stores({
      exercises: 'id, definitionId, updatedAt, deletedAt',
      sessions: 'id, routineId, startedAt, updatedAt, deletedAt',
      reps: 'id, sessionId, exerciseId, definitionId, startedAt, [exerciseId+startedAt], [definitionId+startedAt]',
      exerciseStats: 'exerciseId, definitionId, updatedAt',
      settings: 'key',
    });
    await before.open();
    await before.table('exercises').add({
      ...exerciseFixture,
      id: 'legacy-row',
      createdAt: 1,
      updatedAt: 1,
      name: 'Seven modes through a key',
      userTags: ['mine'],
    });
    before.close();

    const after = new TheoryPadDB(name);
    const row = await after.exercises.get('legacy-row');

    expect(row).toBeDefined();
    expect(row).not.toHaveProperty('name');
    expect(row).not.toHaveProperty('userTags');
    // Everything that is genuinely the user's survives.
    expect(row!.tempo.targetTempo).toBe(76);
    expect(row!.definitionId).toBe('modes-through-key');

    await after.delete();
  });
});

describe('the v4 migration', () => {
  it('builds the practice days from the reps already logged', async () => {
    const name = `theorypad-migration-v4-${Date.now()}`;
    const before = new Dexie(name);
    before.version(3).stores({
      exercises: 'id, definitionId, updatedAt, deletedAt',
      sessions: 'id, routineId, startedAt, updatedAt, deletedAt',
      reps: 'id, sessionId, exerciseId, definitionId, startedAt, [exerciseId+startedAt], [definitionId+startedAt]',
      exerciseStats: 'exerciseId, definitionId, updatedAt',
      settings: 'key',
      routines: 'id, updatedAt, deletedAt',
    });
    await before.open();
    const startedAt = new Date(2026, 8, 10, 18).getTime();
    await before.table('reps').add({
      ...repFixture({ startedAt, endedAt: startedAt + 120_000, axes: { key: 'A', mode: 'aeolian' } }),
      id: 'old-rep',
      createdAt: 1,
      updatedAt: 1,
    });
    before.close();

    const after = new TheoryPadDB(name);
    expect(await after.practiceDays.toArray()).toEqual([
      { date: '2026-09-10', seconds: 120, passes: 1, keyModes: { 'A aeolian': 1 }, frets: {} },
    ]);
    await after.delete();
  });
});

describe('the first-run track', () => {
  it('is in a new database once, as an ordinary row', async () => {
    const database = new TheoryPadDB(`first-run-${Math.random()}`);
    const repos = createRepositories(database);
    const videos = await repos.videos.all();
    expect(videos).toEqual([...FIRST_RUN_VIDEOS]);
    expect(videos[0]).not.toHaveProperty('builtIn');
    await database.delete();
  });

  it('stays deleted when deleted', async () => {
    const name = `first-run-deleted-${Math.random()}`;
    const database = new TheoryPadDB(name);
    const [first] = FIRST_RUN_VIDEOS;
    await createRepositories(database).videos.softDelete(first!.id);
    database.close();

    const reopened = new TheoryPadDB(name);
    expect(await createRepositories(reopened).videos.all()).toEqual([]);
    await reopened.delete();
  });

  it('is added by the v5 migration to a database that predates it', async () => {
    const name = `theorypad-migration-v5-${Date.now()}`;
    const before = new Dexie(name);
    before.version(4).stores({
      exercises: 'id, definitionId, updatedAt, deletedAt',
      sessions: 'id, routineId, startedAt, updatedAt, deletedAt',
      reps: 'id, sessionId, exerciseId, definitionId, startedAt, [exerciseId+startedAt], [definitionId+startedAt]',
      exerciseStats: 'exerciseId, definitionId, updatedAt',
      settings: 'key',
      routines: 'id, updatedAt, deletedAt',
      practiceDays: 'date',
    });
    await before.open();
    await before.table('exercises').add({ ...exerciseFixture, id: 'kept', createdAt: 1, updatedAt: 1 });
    before.close();

    const after = new TheoryPadDB(name);
    expect(await after.videos.toArray()).toEqual([...FIRST_RUN_VIDEOS]);
    expect(await after.exercises.get('kept')).toBeDefined();
    await after.delete();
  });
});

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

describe('settings saved before a field existed', () => {
  it('fill in the new field from the defaults, not as false', async () => {
    // A stored row from before `showNeck` would otherwise hide the neck.
    const database = new TheoryPadDB(`old-settings-${Math.random()}`);
    const repos = createRepositories(database);
    const current = await repos.settings.get();
    const { showNeck: _dropped, ...oldUi } = current.ui;
    await database.settings.put({ ...current, ui: oldUi as typeof current.ui });

    const loaded = await repos.settings.get();
    expect(loaded.ui.showNeck).toBe(true);
    expect(loaded.audio.loop).toBe(false);
    await database.delete();
  });

  it('follow the system when they predate Appearance', async () => {
    const database = new TheoryPadDB(`old-settings-${Math.random()}`);
    const repos = createRepositories(database);
    const current = await repos.settings.get();
    const { appearance: _dropped, ...oldUi } = current.ui;
    await database.settings.put({ ...current, ui: { ...oldUi, showNeck: false } as typeof current.ui });

    const loaded = await repos.settings.get();
    expect(loaded.ui.appearance).toBe('system');
    expect(loaded.ui.showNeck).toBe(false);
    await database.delete();
  });
});
