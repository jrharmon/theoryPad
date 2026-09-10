import Dexie, { type Table } from 'dexie';
import type { Exercise, ExerciseStats, Rep, Session, Settings } from './entities';

/**
 * The only place `dexie` is imported. Everything else goes through a
 * repository, so tests can use an in-memory fake and a sync layer can be added
 * later as an adapter rather than a rewrite.
 */
export class TheoryPadDB extends Dexie {
  exercises!: Table<Exercise, string>;
  sessions!: Table<Session, string>;
  reps!: Table<Rep, string>;
  exerciseStats!: Table<ExerciseStats, string>;
  settings!: Table<Settings, string>;

  constructor(name = 'theorypad') {
    super(name);
    this.version(1).stores({
      exercises: 'id, definitionId, updatedAt, deletedAt',
      sessions: 'id, routineId, startedAt, updatedAt, deletedAt',
      reps: 'id, sessionId, exerciseId, definitionId, startedAt, [exerciseId+startedAt], [definitionId+startedAt]',
      exerciseStats: 'exerciseId, definitionId, updatedAt',
      settings: 'key',
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
