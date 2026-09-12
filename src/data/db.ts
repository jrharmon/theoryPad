import Dexie, { type Table } from 'dexie';
import type { PracticeDay } from '@/domain/progress';
import { rollupDays } from '@/domain/progress';
import type { Exercise, ExerciseStats, Rep, Routine, Session, Settings } from './entities';

/**
 * The only place `dexie` is imported. Everything else goes through a
 * repository, so tests can use an in-memory fake and a sync layer can be added
 * later as an adapter rather than a rewrite.
 */
export class TheoryPadDB extends Dexie {
  exercises!: Table<Exercise, string>;
  routines!: Table<Routine, string>;
  sessions!: Table<Session, string>;
  reps!: Table<Rep, string>;
  exerciseStats!: Table<ExerciseStats, string>;
  settings!: Table<Settings, string>;
  practiceDays!: Table<PracticeDay, string>;

  constructor(name = 'theorypad') {
    super(name);
    this.version(1).stores({
      exercises: 'id, definitionId, updatedAt, deletedAt',
      sessions: 'id, routineId, startedAt, updatedAt, deletedAt',
      reps: 'id, sessionId, exerciseId, definitionId, startedAt, [exerciseId+startedAt], [definitionId+startedAt]',
      exerciseStats: 'exerciseId, definitionId, updatedAt',
      settings: 'key',
    });

    // Name and tags moved onto the definition, where they belong. The stored
    // copies are dead weight, and a stale one is worse than none.
    this.version(2)
      .stores({})
      .upgrade((transaction) =>
        transaction
          .table<Record<string, unknown>>('exercises')
          .toCollection()
          .modify((row) => {
            delete row.name;
            delete row.userTags;
          }),
      );

    // Routines arrive in milestone 5. A new table, nothing to migrate.
    this.version(3).stores({ routines: 'id, updatedAt, deletedAt' });

    // Milestone 6: a per-day rollup for the heatmap, streak and fretboard
    // explorer. A cache over the log, so it starts out rebuilt from it.
    this.version(4)
      .stores({ practiceDays: 'date' })
      .upgrade(async (transaction) => {
        const reps = await transaction.table<Rep>('reps').toArray();
        await transaction.table<PracticeDay>('practiceDays').bulkPut(rollupDays(reps));
      });
  }
}

let instance: TheoryPadDB | null = null;

export function db(): TheoryPadDB {
  instance ??= new TheoryPadDB();
  return instance;
}

/** For tests: swap in a database with its own name, or reset. */
export function setDb(next: TheoryPadDB | null): void {
  instance = next;
}
