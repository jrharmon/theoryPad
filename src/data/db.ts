import Dexie, { type Table } from 'dexie';
import type { PracticeDay } from '@/domain/progress';
import { rollupDays } from '@/domain/progress';
import type {
  Exercise,
  ExerciseStats,
  Rep,
  Routine,
  Session,
  Settings,
  Video,
} from './entities';
import { FIRST_RUN_VIDEOS } from './seed/videos';

/**
 * The only place `dexie` is imported. Everything else goes through a
 * repository, so a sync layer can be added later as an adapter rather than a
 * rewrite. Tests run the real thing over `fake-indexeddb`.
 */
export class TheoryPadDB extends Dexie {
  exercises!: Table<Exercise, string>;
  routines!: Table<Routine, string>;
  sessions!: Table<Session, string>;
  reps!: Table<Rep, string>;
  exerciseStats!: Table<ExerciseStats, string>;
  settings!: Table<Settings, string>;
  practiceDays!: Table<PracticeDay, string>;
  videos!: Table<Video, string>;

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

    // Milestone 7: backing tracks and reference videos. Few enough to read
    // whole and match in memory, so nothing beyond the id is indexed. The first
    // track is added once — here for an existing database, on populate for a
    // new one — and after that it is a row like any other.
    this.version(5)
      .stores({ videos: 'id, updatedAt' })
      .upgrade((transaction) =>
        transaction.table<Video>('videos').bulkAdd([...FIRST_RUN_VIDEOS]),
      );
    // Sampled instruments. `audio.voice` was stored as 'synth' from the start
    // but never shown anywhere, so nobody chose it: everyone moves to the new
    // default once, and from here on the synth is a real choice.
    this.version(6)
      .stores({})
      .upgrade((transaction) =>
        transaction
          .table<Settings>('settings')
          .toCollection()
          .modify((row) => {
            row.audio = { ...row.audio, voice: 'guitar' };
          }),
      );
    this.on('populate', (transaction) => {
      void transaction.table<Video>('videos').bulkAdd([...FIRST_RUN_VIDEOS]);
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
