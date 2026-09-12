# 07 — Data & Persistence

**No server, no database, no accounts.** All data lives in the browser's IndexedDB, accessed
through Dexie, behind a repository layer. `dexie` is imported only inside `src/data/`.

## Why IndexedDB and not localStorage

localStorage caps at ~5MB, is synchronous (it blocks the main thread), and stores only
strings. The rep log is append-only and unbounded: a year of daily practice at 20 reps a
session is ~7,000 rows, each carrying a resolved axis map. That is fine for IndexedDB and
genuinely bad for localStorage. IndexedDB also gives us indexes, so the report's date-range
queries are real range scans rather than "load everything and filter".

localStorage is used for exactly one thing: a tiny non-critical UI preference cache (last
route, panel open/closed) where losing it costs nothing.

---

## Schema

`src/data/db.ts`:

```ts
class TheoryPadDB extends Dexie {
  exercises!: Table<Exercise, Uuid>;
  routines!: Table<Routine, Uuid>;
  sessions!: Table<Session, Uuid>;
  reps!: Table<Rep, Uuid>;
  backingTracks!: Table<BackingTrack, Uuid>;
  exerciseStats!: Table<ExerciseStats, Uuid>;
  playerStats!: Table<PlayerStats, string>;
  settings!: Table<SettingsRow, string>;

  constructor() {
    super('theorypad');
    this.version(1).stores({
      exercises: 'id, definitionId, updatedAt, deletedAt',
      routines: 'id, updatedAt, deletedAt',
      sessions: 'id, routineId, startedAt, updatedAt, deletedAt',
      reps: 'id, sessionId, exerciseId, definitionId, startedAt, [exerciseId+startedAt], [definitionId+startedAt]',
      backingTracks:
        'id, scopeExerciseId, [scopeExerciseId+trackKeyMode], trackKeyMode, builtIn, updatedAt',
      exerciseStats: 'exerciseId, updatedAt',
      playerStats: 'key',
      settings: 'key',
    });
  }
}
```

Entity shapes are defined in doc 02 §6.

### Sync-ready from day one (at essentially zero cost)

Every row carries:

- **`id: Uuid`** — client-generated (`crypto.randomUUID()`), never an auto-increment. Two
  devices can create rows without colliding.
- **`createdAt` / `updatedAt`** — epoch millis. `updatedAt` is set by the repository layer on
  every write, never by callers.
- **`deletedAt?: number`** — soft delete. Nothing is hard-deleted, because a sync layer needs
  to propagate deletions.

That's the whole tax. It costs three fields and buys the ability to add a sync backend later
as a **new adapter behind the repository interface**, rather than a schema migration and a
rewrite of every call site.

### A note on indexing the backing pool

Dexie cannot index a nested object, so `BackingTrack` carries two flattened, derived columns
maintained by its repository: `trackKeyMode` (`"D:dorian"`) and `scopeExerciseId` (the exercise
id, or `""` for shared). The compound index `[scopeExerciseId+trackKeyMode]` makes both steps of
the resolution order a direct lookup rather than a scan. Derived columns are written by the
repository on every save, never by callers — the same rule as `updatedAt`.

### Migrations

Dexie versions are additive and explicit. Rule: **never change the meaning of an existing
field.** Add a new one and migrate in an upgrade function. The `Rep` rows are practice history
you cannot regenerate — treat them as immutable once written.

`ExerciseDefinition.id` is persisted on every `Rep`. Renaming a definition id orphans history,
so the registry test asserts ids never change (a checked-in `exercise-ids.json` manifest that
the test compares against; adding is fine, removing or renaming fails).

---

## The repository layer

Nothing outside `src/data/` touches Dexie. Each entity gets a repository:

```ts
export interface RepRepository {
  add(rep: NewRep): Promise<Rep>;
  byId(id: Uuid): Promise<Rep | undefined>;
  bySession(sessionId: Uuid): Promise<Rep[]>;
  byExercise(exerciseId: Uuid, limit?: number): Promise<Rep[]>;
  inRange(fromMs: number, toMs: number): Promise<Rep[]>;
  count(): Promise<number>;
}
```

Three reasons this layer exists and is not ceremony:

1. **Tests use an in-memory fake.** Domain and store tests never touch IndexedDB (which is
   slow and awkward in jsdom). Only the repository's own tests use `fake-indexeddb`.
2. **A sync adapter is a drop-in.** `SyncedRepRepository` wraps the local one and mirrors
   writes. Nothing above changes.
3. **Queries stay in one place.** The report's aggregations are non-trivial and belong next to
   the indexes they depend on, not scattered through components.

React reads via `dexie-react-hooks`' `useLiveQuery`, so the UI updates automatically when a
rep is written. Writes go through the repositories.

---

## Derived data, and how big the log actually gets

### The numbers first

"The rep log is unbounded, so querying it must be inefficient" is the right instinct, so here
is the actual size.

A busy year: 5 sessions/week × 52 weeks × 20 reps ≈ **5,200 reps/year**. A `Rep` row is
roughly 400 bytes (three UUIDs, a definition id, timestamps, tempo, seed, status, and the
resolved axis map). That is **~2 MB/year**, ~10 MB after five years. IndexedDB quotas are
typically hundreds of MB to several GB. Storage is not the concern; query shape is.

### Which queries hit which index

| Query                         | Used by                                    | Index                    | Rows touched                 |
| ----------------------------- | ------------------------------------------ | ------------------------ | ---------------------------- |
| Date range                    | report, heatmap, time-by-day, streak       | `startedAt`              | a week ≈ 100; a year ≈ 5,000 |
| One exercise's recent history | "last time you played this", tempo history | `[exerciseId+startedAt]` | tens                         |
| One session's reps            | post-session summary                       | `sessionId`              | tens                         |

These are indexed range scans, not full scans, and they stay small because the interesting
window is always bounded — you report on a week or a month, not on all of history.

### The one query that genuinely grows: all-time coverage

Coverage is the exception, and it is the case you were right to flag:

> "Which neck positions have I **ever** rolled for this exercise?"
> "Which keys have I **ever** played Dorian in?"
> "How many times have I played this, total?"

There is no bounded window here. Answering it from the log means scanning every rep for that
exercise, forever. So for these we **do** keep a maintained aggregate — your counter idea,
with one safeguard.

```ts
interface ExerciseStats {
  exerciseId: Uuid; // primary key
  repCount: number;
  totalSeconds: number;
  firstPlayedAt: number | null;
  lastPlayedAt: number | null;
  /** Set-valued coverage: every distinct value ever rolled, per axis. */
  axisValuesSeen: Record<AxisId, string[]>;
  /** Theory exercises. */
  questionsAnswered: number;
  questionsCorrect: number;
  updatedAt: number;
}

/** Player-wide rollup: streak, total sessions, per-mode key coverage. Singleton row. */
interface PlayerStats {
  /* … */
}
```

Two rules make this safe rather than the usual drifting-counter problem:

1. **Stats are written in the same Dexie transaction as the rep.** A rep and its stat update
   commit together or not at all, so a crash mid-write can't desynchronise them.
2. **The log stays authoritative and the cache is rebuildable.** `rebuildStats()` recomputes
   every aggregate from `reps` alone. It runs on demand from settings, and there is a test
   that applies a randomised sequence of rep writes and asserts
   `incrementally-maintained === rebuilt`. A drift bug fails a test instead of quietly
   corrupting a year of history.

That is the whole difference between "a counter" and "a counter you can trust": the counter is
a cache of something reconstructible, not the only copy.

### Everything else stays a query

`domain/progress/` holds the windowed aggregations as pure functions over an array of `Rep`,
so they are unit-testable against fixtures with no database at all:

```ts
practiceHeatmap(reps, days): { date: string; seconds: number; intensity: 0|1|2|3 }[]
timeByDay(reps, from, to): { date: string; seconds: number }[]
exerciseLog(reps, from, to): ExerciseLogRow[]
streak(reps, today): { current: number; longest: number }
tempoHistory(reps, exerciseId): { at: number; tempo: number }[]
```

And the all-time views read `ExerciseStats` / `PlayerStats`:

```ts
coverage(stats): {
  keysSeen: PitchClass[];
  keyModeMatrix: Record<ModeName, PitchClass[]>;
  positionsSeen: number[];
  positionsNeverRolled: number[];          // the fretboard explorer's CTA
  stringSetsSeen: string[];
}
```

The split is the rule to remember: **windowed questions query the log; all-time questions read
the cache; the cache is always rebuildable from the log.**

## Export / import

The multi-device story for v1, and the backup story forever.

```ts
interface TheoryPadExport {
  formatVersion: 1;
  exportedAt: number;
  app: { name: 'theorypad'; version: string };
  data: {
    exercises: Exercise[];
    routines: Routine[];
    backingTracks: BackingTrack[]; // user-added only; built-ins come from the seed table
    sessions: Session[];
    reps: Rep[];
    settings: Settings;
    /* exerciseStats and playerStats are NOT exported — they are rebuilt on import. */
  };
}
```

- **Export** — one JSON file, downloaded. Because rows are UUID-keyed with timestamps, an
  export is a complete, portable snapshot.
- **Import** — validated with Zod against the schema for its `formatVersion`, then merged with
  last-write-wins on `updatedAt`, keyed by `id`. Offer both **merge** and **replace**; default
  to merge, and always show a summary before committing ("adds 12 exercises, updates 3, adds
  428 reps").
- Import is transactional — one Dexie transaction, all or nothing.
- A round-trip test (export → wipe → import → deep-equal) is part of the E2E suite.
- _As built (M5):_ `src/data/transfer.ts`. The file carries `app: { name }` without a
  version — `formatVersion` is what import checks. Soft-deleted rows are exported, so a
  merge cannot resurrect a deletion. Backing tracks join the file when they exist (M7).

Also worth having, cheaply: a "download my practice log as CSV" for the report, since that is
the thing you might want in a spreadsheet.

---

## If we later want sync

Not being built. Recorded so the decision is fast when it comes up.

The schema above is already CRDT-adjacent: UUID keys, `updatedAt`, soft deletes, and an
append-only log that is the only real source of truth. `reps` are immutable once written, so
they need only union-merge, never conflict resolution. Only `exercises`, `routines` and
`settings` are mutable, and last-write-wins on `updatedAt` is entirely adequate for a
single-person app.

| Option                                        | Fit                                                                                                                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Firebase (Auth + Firestore)**               | Easiest path. Google sign-in, offline persistence built in, generous free tier. Adds auth UI and security rules. **The default recommendation if you want sync.** |
| **Supabase**                                  | Postgres + row-level security. Better if you ever want real SQL over the practice log or a shared/teacher view. More setup.                                       |
| **A file in Dropbox / iCloud / Google Drive** | Export/import, automated. No accounts to build, no backend to secure, works with the schema exactly as-is. Least capable, least work.                             |
| **CRDT (Yjs / Automerge) + a sync server**    | Overkill for one user on two devices.                                                                                                                             |

Whichever, it lands as `src/data/sync/` plus wrapping repositories. Nothing above the
repository layer changes.
