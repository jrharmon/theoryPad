import { z } from 'zod';
import type { TheoryPadDB } from './db';
import type { Exercise, Rep, Routine, Row, Session, Settings } from './entities';
import { withDefaults } from './repositories/dexie';
import { rebuildStats } from './stats';
import { rollupDays } from '@/domain/progress';

/**
 * Export and import: the backup story, and the way to move between devices.
 *
 * An export is every row, soft-deleted ones included — a deletion is data too,
 * and merging without it would bring deleted things back. Stats are not
 * exported: they are rebuilt from the reps on import, so they can never
 * disagree with them.
 */

export const EXPORT_FORMAT_VERSION = 1;

export interface TheoryPadExport {
  formatVersion: typeof EXPORT_FORMAT_VERSION;
  exportedAt: number;
  app: { name: 'theorypad' };
  data: {
    exercises: Exercise[];
    routines: Routine[];
    sessions: Session[];
    reps: Rep[];
    settings: Settings | null;
  };
}

export async function exportData(database: TheoryPadDB, now = Date.now()): Promise<TheoryPadExport> {
  return database.transaction(
    'r',
    [database.exercises, database.routines, database.sessions, database.reps, database.settings],
    async () => ({
      formatVersion: EXPORT_FORMAT_VERSION,
      exportedAt: now,
      app: { name: 'theorypad' as const },
      data: {
        exercises: await database.exercises.toArray(),
        routines: await database.routines.toArray(),
        sessions: await database.sessions.toArray(),
        reps: await database.reps.toArray(),
        settings: (await database.settings.get('settings')) ?? null,
      },
    }),
  );
}

// ---------------------------------------------------------------- parsing

/**
 * Rows are checked for what import relies on — identity and timestamps, and
 * the fields that tie them together — and otherwise passed through. The file
 * came from this app; the check is against damage, not against a stranger.
 */
const row = z
  .object({
    id: z.string().min(1),
    createdAt: z.number(),
    updatedAt: z.number(),
    deletedAt: z.number().optional(),
  })
  .passthrough();

const schema = z.object({
  formatVersion: z.literal(EXPORT_FORMAT_VERSION),
  exportedAt: z.number(),
  app: z.object({ name: z.literal('theorypad') }).passthrough(),
  data: z.object({
    exercises: z.array(row.extend({ definitionId: z.string() })),
    routines: z.array(row.extend({ name: z.string(), items: z.array(z.unknown()) })).default([]),
    sessions: z.array(row.extend({ startedAt: z.number() })),
    reps: z.array(
      row.extend({
        sessionId: z.string(),
        exerciseId: z.string(),
        definitionId: z.string(),
        startedAt: z.number(),
      }),
    ),
    settings: z.object({ key: z.literal('settings') }).passthrough().nullable(),
  }),
});

/** Validate a parsed file. Throws with a readable message if it is not an export. */
export function parseExport(json: unknown): TheoryPadExport {
  const result = schema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.join('.') || 'the file';
    throw new Error(`This is not a TheoryPad export (${where}: ${issue?.message ?? 'invalid'}).`);
  }
  return result.data as unknown as TheoryPadExport;
}

// ----------------------------------------------------------------- import

export type ImportMode = 'merge' | 'replace';

export interface TableSummary {
  added: number;
  updated: number;
  /** In the database but not the file. Replace removes them; merge keeps them. */
  removed: number;
}

export interface ImportSummary {
  mode: ImportMode;
  exercises: TableSummary;
  routines: TableSummary;
  sessions: TableSummary;
  reps: TableSummary;
  settings: 'kept' | 'replaced';
}

type Tables = Pick<TheoryPadDB, 'exercises' | 'routines' | 'sessions' | 'reps'>;
const TABLES = ['exercises', 'routines', 'sessions', 'reps'] as const;

/** Merge keeps whichever copy of a row was changed last; replace takes the file's. */
function summarize(existing: Row[], incoming: Row[], mode: ImportMode): TableSummary {
  const current = new Map(existing.map((r) => [r.id, r]));
  const fileIds = new Set(incoming.map((r) => r.id));
  let added = 0;
  let updated = 0;
  for (const row of incoming) {
    const have = current.get(row.id);
    if (!have) added += 1;
    else if (mode === 'replace' ? JSON.stringify(have) !== JSON.stringify(row) : row.updatedAt > have.updatedAt)
      updated += 1;
  }
  const removed = mode === 'replace' ? existing.filter((r) => !fileIds.has(r.id)).length : 0;
  return { added, updated, removed };
}

function settingsOutcome(
  existing: Settings | undefined,
  incoming: Settings | null,
  mode: ImportMode,
): 'kept' | 'replaced' {
  if (!incoming) return 'kept';
  if (mode === 'replace' || !existing) return 'replaced';
  return incoming.updatedAt > existing.updatedAt ? 'replaced' : 'kept';
}

/** What an import would do, without doing it — shown before anything is written. */
export async function planImport(
  database: TheoryPadDB,
  file: TheoryPadExport,
  mode: ImportMode,
): Promise<ImportSummary> {
  const summary = { mode } as ImportSummary;
  for (const table of TABLES) {
    const existing = (await (database as Tables)[table].toArray()) as Row[];
    summary[table] = summarize(existing, file.data[table], mode);
  }
  summary.settings = settingsOutcome(await database.settings.get('settings'), file.data.settings, mode);
  return summary;
}

/**
 * Apply an import, all or nothing, and rebuild the stats from the reps that
 * result. Returns what it did.
 */
export async function applyImport(
  database: TheoryPadDB,
  file: TheoryPadExport,
  mode: ImportMode,
): Promise<ImportSummary> {
  const summary = await planImport(database, file, mode);

  await database.transaction(
    'rw',
    [
      database.exercises,
      database.routines,
      database.sessions,
      database.reps,
      database.settings,
      database.exerciseStats,
      database.practiceDays,
    ],
    async () => {
      for (const table of TABLES) {
        const store = (database as Tables)[table] as unknown as {
          toArray(): Promise<Row[]>;
          clear(): Promise<void>;
          bulkPut(rows: Row[]): Promise<unknown>;
        };
        const incoming = file.data[table] as Row[];
        if (mode === 'replace') {
          await store.clear();
          await store.bulkPut(incoming);
          continue;
        }
        const current = new Map((await store.toArray()).map((r) => [r.id, r]));
        const newer = incoming.filter((r) => {
          const have = current.get(r.id);
          return !have || r.updatedAt > have.updatedAt;
        });
        await store.bulkPut(newer);
      }

      if (summary.settings === 'replaced' && file.data.settings) {
        await database.settings.put(withDefaults(file.data.settings));
      }

      await database.exerciseStats.clear();
      const reps = await database.reps.toArray();
      await database.exerciseStats.bulkPut(rebuildStats(reps));
      await database.practiceDays.clear();
      await database.practiceDays.bulkPut(rollupDays(reps));
    },
  );

  return summary;
}
