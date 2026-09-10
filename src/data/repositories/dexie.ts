import { STANDARD_GUITAR } from '@/domain/instrument';
import type { TheoryPadDB } from '../db';
import type { Exercise, Rep, Session, Settings, Uuid } from '../entities';
import { newId } from '../ids';
import { applyRep, emptyStats, rebuildStats } from '../stats';
import type {
  NewExercise,
  NewRep,
  NewSession,
  Repositories,
} from './types';

/** Everything the app persists, backed by IndexedDB. */
export function createRepositories(database: TheoryPadDB, now = () => Date.now()): Repositories {
  const stamp = () => now();

  const live = <T extends { deletedAt?: number }>(rows: T[]): T[] =>
    rows.filter((row) => row.deletedAt === undefined);

  return {
    exercises: {
      async add(exercise: NewExercise): Promise<Exercise> {
        const at = stamp();
        const row: Exercise = { ...exercise, id: newId(), createdAt: at, updatedAt: at };
        await database.exercises.add(row);
        return row;
      },

      async byId(id) {
        const row = await database.exercises.get(id);
        return row?.deletedAt === undefined ? row : undefined;
      },

      async all() {
        return live(await database.exercises.toArray());
      },

      async byDefinition(definitionId) {
        return live(await database.exercises.where('definitionId').equals(definitionId).toArray());
      },

      async update(id, changes) {
        const existing = await database.exercises.get(id);
        if (!existing) throw new Error(`No exercise ${id}`);
        const row: Exercise = { ...existing, ...changes, updatedAt: stamp() };
        await database.exercises.put(row);
        return row;
      },

      async softDelete(id) {
        // Soft, because a sync layer has to be able to propagate a deletion.
        const existing = await database.exercises.get(id);
        if (!existing) return;
        await database.exercises.put({ ...existing, deletedAt: stamp(), updatedAt: stamp() });
      },
    },

    sessions: {
      async add(session: NewSession): Promise<Session> {
        const at = stamp();
        const row: Session = { ...session, id: newId(), createdAt: at, updatedAt: at };
        await database.sessions.add(row);
        return row;
      },

      async byId(id) {
        return database.sessions.get(id);
      },

      async end(id, endedAt) {
        const existing = await database.sessions.get(id);
        if (!existing) throw new Error(`No session ${id}`);
        const row: Session = { ...existing, endedAt, updatedAt: stamp() };
        await database.sessions.put(row);
        return row;
      },

      async inRange(fromMs, toMs) {
        return database.sessions.where('startedAt').between(fromMs, toMs, true, true).toArray();
      },

      async recent(limit = 20) {
        return database.sessions.orderBy('startedAt').reverse().limit(limit).toArray();
      },
    },

    reps: {
      async add(rep: NewRep): Promise<Rep> {
        const at = stamp();
        const row: Rep = { ...rep, id: newId(), createdAt: at, updatedAt: at };

        // The rep and its aggregates commit together or not at all, so a crash
        // mid-write cannot leave the cache disagreeing with the log.
        await database.transaction('rw', database.reps, database.exerciseStats, async () => {
          await database.reps.add(row);
          const current =
            (await database.exerciseStats.get(row.exerciseId)) ??
            emptyStats(row.exerciseId, row.definitionId);
          await database.exerciseStats.put(applyRep(current, row));
        });

        return row;
      },

      async byId(id) {
        return database.reps.get(id);
      },

      async bySession(sessionId) {
        return database.reps.where('sessionId').equals(sessionId).toArray();
      },

      async byExercise(exerciseId, limit) {
        const query = database.reps
          .where('[exerciseId+startedAt]')
          .between([exerciseId, 0], [exerciseId, Infinity])
          .reverse();
        return limit === undefined ? query.toArray() : query.limit(limit).toArray();
      },

      async inRange(fromMs, toMs) {
        return database.reps.where('startedAt').between(fromMs, toMs, true, true).toArray();
      },

      async count() {
        return database.reps.count();
      },
    },

    stats: {
      async byExercise(exerciseId: Uuid) {
        return database.exerciseStats.get(exerciseId);
      },

      async all() {
        return database.exerciseStats.toArray();
      },

      async rebuild() {
        // The log stays authoritative; this is what makes the cache safe.
        await database.transaction('rw', database.reps, database.exerciseStats, async () => {
          const reps = await database.reps.toArray();
          await database.exerciseStats.clear();
          await database.exerciseStats.bulkPut(rebuildStats(reps));
        });
      },
    },

    settings: {
      async get(): Promise<Settings> {
        const existing = await database.settings.get('settings');
        if (existing) return existing;
        const defaults = defaultSettings(stamp());
        await database.settings.put(defaults);
        return defaults;
      },

      async save(settings) {
        const row: Settings = { ...settings, key: 'settings', updatedAt: stamp() };
        await database.settings.put(row);
        return row;
      },
    },
  };
}

export function defaultSettings(at: number): Settings {
  return {
    key: 'settings',
    instrument: STANDARD_GUITAR,
    audio: {
      metronomeEnabled: true,
      countInBars: 1,
      voice: 'synth',
      masterVolumeDb: 0,
    },
    practice: {
      defaultInterExerciseGapSec: 8,
      revealBriefBeforeRep: true,
      defaultFretRange: { low: 0, high: 15 },
    },
    ui: {
      showFingerings: false,
      showDegreesOnFretboard: true,
    },
    updatedAt: at,
  };
}
