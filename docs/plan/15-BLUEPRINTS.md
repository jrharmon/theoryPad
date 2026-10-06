# 15 — Blueprints, exercises and folders

_Planned 2026-10-04 with the player. Build on branch `blueprints`, a commit per task, one gate at
the end. Read `STATUS.md` and `CLAUDE.md` first; this doc is the spec._

## Why

A single exercise has too many settings to be the smallest unit of practice. Playing "Modes up
the neck" in triplets and then in sixteenths means resetting several settings every time, and
both share one tempo and one log. The fix is to make what is now "the exercise" into a
**blueprint**, and let the player save many **exercises** from it. Each exercise fixes
some settings for good, which **locks** them and hides them. The rest start at the values saved
with the exercise and stay editable. Each exercise has its own name, tags, folder, tempo and log.

## The good news: the model already has this split

- The code-side `ExerciseDefinition` (`src/exercises/*/definition.ts`) **is the blueprint**: its
  name, summary, axes, params schema and generator.
- The `Exercise` row (`src/data/entities.ts`) **is the exercise**: a configured instance with its
  own params, axis policies, tempo, metronome, backing and so on.
- Reps and `exerciseStats` are already keyed to the row's `exerciseId`, so per-exercise tempo and
  history need no new work.
- What is missing: the app seeds exactly one row per definition and shows the definition's
  name and tags everywhere. There are also no locks, no folders, and no way to make a second
  row except `addFromDefinition`, which nothing uses.

**Vocabulary.** "Blueprint" in the UI. Code keeps `definition` / `ExerciseDefinition`, so don't
rename it (churn, and exercise definition ids are persisted forever). "Locked" is the hide-this
concept. Don't call it "fixed": **Fixed is already an axis policy** (pin one value).

## Decisions (agreed with the player)

1. **What can be locked:** each params field, and each axis's **whole policy**. That covers a
   fixed value, but also e.g. "rhythm: roll from {triplets, 16ths}". Tempo, count-in, metronome,
   play-the-notes, backing choice and generated backing are never locked. They start at the
   exercise's values and stay editable.
2. **Locks are edited on the exercise page**, the full editor: name, tags, folder, and every
   setting with a lock toggle. They can be changed at any time. The practice settings dialog and
   the routine item editor **hide** locked settings.
3. **Remove "Reset to defaults"** entirely (button, store action `resetToDefaults`, its tests).
   No Duplicate action either: the player found it more confusing than useful.
4. **Routine items stay their own copies**, as today. An item is tied to an **exercise** (not
   a blueprint) and keeps its own unlocked settings, tempo, count-in and so on. That lets a routine
   string together minor variations (the same exercise three times in three modes) without saving
   each one as an exercise. Locked settings are **read through from the exercise** at edit and
   play time, never copied: see "Lock resolution". Reps keep logging against the exercise.
5. **Scale / mode override in routines.** An item whose scale or mode is **locked (any policy) or
   Fixed** overrides the routine's for that item. Rolled or held, the routine's wins, as today.
   **Key, scale and mode are all treated alike** (confirmed). The player's example was the same
   exercise three times in a row, each in a different mode or key.
6. **Tags are per exercise**, starting from the blueprint's. Pick from `KNOWN_TAGS` or add your
   own (normalized to lowercase-kebab).
7. **No new top-level section.** A prominent **New exercise** button at the top of the
   Exercises page opens a **blueprint picker**. That leads to the exercise editor, prefilled
   with the blueprint's defaults, nothing locked, and the name set to the blueprint's.
8. **Folders:** a real table, nested to any depth. Each exercise sits in one folder or at the
   top level. Folders are listed before exercises, both **sorted alphabetically, number-aware**
   (`Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })`), so "2 Triplets" comes
   before "10 Sextuplets". No drag-and-drop: an exercise moves through a folder picker in its
   editor. Deleting a folder **moves its contents up one level**, never deletes them.
9. **Exercises page:** file-browser style. A breadcrumb (Exercises › Scales › Modes), then that
   folder's subfolders, then its exercises. **Favorites** is a dynamic folder, first at the top
   level, containing every favorited exercise. Those exercises also stay in their real
   folders. A tag filter or a name search **flattens** the view across all folders, showing each
   row's folder path.
10. **Side panel (practice list): grouped, full-path headers, no indentation.** Favorites group
    first, then top-level exercises, then each non-empty folder depth-first. Each folder's
    exercises sit under a header showing its full path (`SCALES › MODES › RHYTHMS`), all at the
    same left edge. Headers are **right-aligned and clipped on the left**: a path too long for
    the panel runs off the left edge, so the right end, the useful part, always shows. Only the
    display is clipped, never the text. Not collapsible. On open, scroll the current exercise into view.
11. **Second line of a row** (side panel and library): a short description of what is **locked**,
    e.g. "Triplets · Dorian", from the same wording as `describePolicies`. If nothing is
    locked, use the blueprint's summary.
12. **Starters: one "open" exercise per blueprint, named the same as the blueprint**, which is
    exactly what is seeded today. They are created **only on the app's first load**, into an
    empty database: see "Seeding".
13. **Names are unique within a folder** (trimmed, case-insensitive). Different folders may
    reuse names, and so may the top level and a folder. Folder names are unique among siblings
    too. Check on create, rename and move, and show the error inline. A new exercise from a
    blueprint whose name is taken gets "Name 2", "Name 3", and so on.
14. **Delete is always soft** (`deletedAt`), as rows already are. Rep history keeps showing
    the exercise it was tied to, by its name, marked deleted. A routine item whose exercise was
    deleted keeps working and says so in the builder.

## Agreed at the start of the build (2026-10-05)

These refine or replace the decisions above; where they differ, these win.

15. **Routine items take the routine's key, scale and mode by default**, whatever the exercise
    has. `itemFromExercise` still leaves them out. An item uses its own only where its effective
    policy is **Fixed**: set Fixed in the item editor, or **locked Fixed** on the exercise. A
    locked Roll (even from a subset) or Hold still takes the routine's. The item editor's Scale,
    Mode and Key rows offer **Routine's | Fixed**, Routine's by default; a locked one is hidden.
    (The Scale axis's own default is Fixed Major, so "Fixed" means stored on the item or locked,
    never the axis default.)
16. **Scale and mode override as a pair.** If an item overrides either, it takes both from
    itself: a mode only means something inside its scale. Key stands alone.
17. **Adding an exercise to a routine opens its item editor straight away.** Done with nothing
    changed keeps the copied defaults.
18. **Deleting a folder deletes everything in it**, subfolders and their exercises included, as
    every file system does (replaces decision 8's "moves its contents up"). Soft, like every
    delete; it asks first and says how much goes. To keep something, move it out first.
19. **Moving many at once.** On the Exercises page, **Select** turns on checkboxes on exercise
    and folder rows; **Move to…** opens a folder picker (full paths, "Top level" first) and
    moves the selection. A folder can't move into itself or below itself. The single picker in
    the exercise editor stays. A name clash on any move adds **" - 2"** (" - 3", …); a new
    exercise from a blueprint still gets "Name 2".
20. **Side panel scrolling.** A favorite is listed twice, and both rows are marked current. On
    arrival the panel scrolls the copy that was clicked (it rides along in the link's state)
    into view, only if it is out of view. Arriving from anywhere else scrolls to the first.
21. **New exercise in Favorites** creates it at the top level, not favorited (favoriting is
    always by hand). New folder is hidden there.

22. **A routine's video track over an item in its own key or mode** (asked mid-run, option A):
    the track is dropped for that item, which plays its notes and metronome, and the next item
    that fits gets the track fresh from bar 1, counted in, as after a theory set. Resuming
    mid-recording would mean re-aligning the clock to the video and was not built. The player
    noted this leaves room for an item's own backing later (FUTURE-WORK).

Defaults taken without asking: the second line is values only ("Triplets · Dorian"), with the
label kept for toggles and numbers, "Triplets or 16ths" for a locked subset, "Any key" for a
locked roll. "from ⟨blueprint⟩" shows in the editor header, the practice header and settings
dialog, library rows and routine-builder rows, not the side panel. Tags: the known tags plus any
custom tag in use as on/off pills, and an Add tag field. Names save on blur or Enter; a clash or
an empty name shows inline and is not saved. The v7 upgrade gives a second row of one blueprint
"Name 2". Folder rows count every exercise beneath them. Search matches the exercise's and the
blueprint's name. While an overriding item plays, the key/mode reference and circle show its
own key and mode.

## Data model

`src/data/entities.ts`:

```ts
export interface Exercise extends Row {
  definitionId: string;            // the blueprint
  name: string;                    // new
  tags: string[];                  // new; starts from the blueprint's
  folderId: Uuid | null;           // new; null is the top level
  locked: ExerciseLocks;           // new
  // …everything else as today
}

/** What an exercise fixes for good. The values live in its own params / axisPolicies. */
export interface ExerciseLocks {
  params: string[];  // params keys
  axes: AxisId[];
}

export interface Folder extends Row {
  name: string;
  parentId: Uuid | null;
}
```

`RoutineItem` is unchanged in shape. Today `itemFromExercise` drops key and mode, and the
runner forces the routine's scale/mode/key over every item. Both change (task 7).

**Dexie v7** (`src/data/db.ts`): add `folders: 'id, updatedAt'`, and upgrade each exercise row
with `name` = its definition's name (or its id if the definition is gone), `tags` = the
definition's tags, `folderId: null` and `locked: { params: [], axes: [] }`.

**Export format v2** (`src/data/transfer.ts`): add `folders` and the new exercise fields.
Import still accepts v1, upgraded the same way as the Dexie migration (one shared
function, so the two cannot drift).

**Repositories:** a `folders` repo (all, byId, add, update, softDelete), and an exercises lookup
that **includes deleted rows**, for the report and for routine items.

## Seeding

Today `useExercises.load()` seeds any definition with no exercise row, so deleting the only
exercise for a blueprint brings it back on the next load. Replace that with **first load
only**: if the exercises table has **no rows at all, deleted ones included**, it is a new
database, so create one starter per blueprint (`newExerciseFrom`, named after the blueprint).
Otherwise create nothing. There is no flag:

- Deleting the last exercise for a blueprint leaves it deleted.
- A blueprint added to the code later does not add an exercise to an existing database. The
  player makes one from the blueprint picker.

Keep the `inFlight` guard, so StrictMode's double effect can't seed twice. **Remove
`findRedundantExercises`** and its call: it cleaned up after a seeding race that shipped, has
long since run, and would now wrongly treat two untouched exercises from one blueprint as
duplicates.

## Lock resolution (pure, `src/exercises/locks.ts`, with tests)

One function that every consumer goes through:

- `effectiveItem(item, exercise)`: the item with each locked params key and locked axis policy
  (and held value) replaced by the exercise's. Used by the routine builder, the item editor
  and `RoutineSession` when building runners.
- `visibleParams(definition, locks)` / `visibleAxes(axes, locks)`: what the practice dialog and
  item editor show. `SettingsDialog` already takes `axes` and `hiddenParams`, so feed those
  instead of adding a new path.
- `overridesSession(axis, policies, locks)`: true for `scale` / `mode` / `key` when locked or
  Fixed (decision 5). The routine runner uses it.
- `describeLocks(exercise, definition, instrument)`: the row's second line (decision 11).

## Routine overrides (decision 5)

- `itemFromExercise` keeps the exercise's scale/mode/key policies instead of dropping them.
  The item editor shows scale, mode and key, unless they are locked. Fixing one there is an
  override.
- `RoutineRunner.open`: the shared policies apply only to axes the item does not override.
  An overriding axis rolls from the item's own policy, still seeded per item.
- **Backing on an overriding item** (agreed): the drone and generated
  backing follow the item's key/mode. A routine-wide **video track can't**, so that item plays
  as if backing were None (notes + metronome), and the track resumes on the next matching item.
  If that is fiddly in `BackingController`, stop and ask rather than invent.
- The builder labels an overriding item ("Own mode: Lydian").

## UI

- **Name everywhere.** Every `definition.name` that names a row becomes the exercise's name:
  `ExerciseDetail`, `ExerciseLibrary`, `PracticeExercise` (`RunningChrome`),
  `PracticeSettingsDialog`, `PracticeList`, `PracticeRoutine`, `RoutineBuilder` (three places),
  `report/model.ts` (via the include-deleted lookup, "(deleted)" after the name). Wherever the
  name differs from the blueprint's, the blueprint is still named once, quietly: "from Modes up
  the neck".
- **Exercise page** (`/exercises/:id`): the editor. Header: name (editable inline), blueprint
  name and description, tags editor (known tags as chips plus free text), folder picker,
  favorite, Delete, Practice. Every params field and every axis row gets a **lock toggle**
  (lucide `Lock` / `LockOpen`, ghost icon button, labeled "Lock" / "Unlock" for assistive
  tech). A locked row stays editable here, because this is where its value is set. Locked
  rows read as settled: muted label plus the lock icon. Tempo, videos, criteria and generated
  backing as today, with no locks. Remove Reset.
- **Blueprint picker** (`/exercises/new`, reached from the New exercise button; also
  `/exercises/new?folder=<id>` from inside a folder): one sheet listing every blueprint with
  name, summary, tags and "N exercises". Choosing one creates the exercise in the current
  folder and opens its editor. Creating straight away rather than holding a draft keeps one
  editor; Delete undoes a mistake.
- **Exercises page** (`/exercises`, `/exercises/folder/:folderId`): decision 9. Header row:
  breadcrumb, **New exercise** (primary, conspicuous), New folder. Folder rows show a folder icon,
  name and count, plus Rename and Delete from a small menu. Exercise rows as today, with the new
  second line (decision 11) and the exercise's own tags. Search plus tag filter flatten the
  view, and each row then shows its folder path. Favorites opens as a folder, with each row
  showing its real path.
- **Side panel** (`PracticeList.tsx`, `ExerciseList`): decision 10. The path header is a
  one-line flex row, `flex justify-end overflow-hidden whitespace-nowrap`, with the whole
  path in one child that doesn't shrink (`shrink-0`). With `justify-end`, a child wider than
  the row spills off the left. Keep the full path in the DOM, and put it in `title` for hover.
  Look at a three-deep path in both themes. `RoutineList` is unchanged apart from names.
- **Routine builder:** the add-exercise picker shows exercise names grouped by folder path
  (same grouping helper as the side panel). The item editor hides locked settings and shows
  scale/mode/key (task 7).

## Tasks

Each task ends with `pnpm check` green, and a look in both themes for anything visual. Tests
follow the player's philosophy: a few outcome-focused tests per unit, edge cases only where they
matter, no screenshot tests.

1. **Data (M).** Entities, `Folder`, Dexie v7 upgrade, folders repo, include-deleted lookup,
   the shared v1→v2 upgrade function, export v2 and import of v1, first-load-only seeding,
   removing `findRedundantExercises`. Tests: the upgrade over `fake-indexeddb` (names, tags,
   folder, locks); an empty database gets one starter per blueprint; a database whose only
   rows are deleted gets none; v1 import round-trips.
2. **Pure helpers (S).** `locks.ts` (above) and `folders.ts`: tree from rows, natural sort,
   full paths, sibling-unique check, delete-moves-contents-up, the depth-first grouping for the
   side panel and the routine picker. Tests on each.
3. **Names, tags, no Reset (S).** Decision 14 and "Name everywhere". Remove Reset. Library rows
   get the second line. The report shows deleted exercises by name.
4. **Exercise editor and locks (M).** The editor (name, tags, folder, lock toggles). The
   practice settings dialog hides locked settings through `visibleParams` / `visibleAxes`.
   Look at the locked/unlocked states closely; this is the screen the player will judge most.
5. **New exercise (S).** The button, the blueprint picker, create-in-folder, "Name 2"
   naming.
6. **Folders (M).** Exercises page browser, breadcrumb, Favorites, new/rename/delete folder,
   search and tag flattening. Then the side panel grouping with left-clipped paths.
7. **Routines (M).** `effectiveItem` in the builder, the item editor and `RoutineSession`. The
   item editor hides locked settings and shows scale/mode/key. The scale/mode/key override in
   `RoutineRunner`, and backing on an overriding item. Scenario test over `FakeClock`: a
   routine whose item locks Lydian plays Lydian while its neighbors play the routine's mode,
   and the reps log against the exercise.
8. **Close (S).** E2E: create an exercise from a blueprint into a new folder, lock rhythm,
   confirm the practice dialog hides it, favorite it, find it in the side panel's Favorites
   group. Update the existing E2E that used Reset or definition names. STATUS.md gets the run's
   section and a refreshed "How the code is laid out". Delete nothing from FUTURE-WORK
   (this run wasn't in it). Stop at the gate.

## At the gate, for the player to judge

- Does making a variation (New exercise → Modes up the neck → lock rhythm → name it) feel quick
  enough to do mid-practice?
- Do locked settings read clearly on the exercise page, and is the practice dialog meaningfully
  calmer?
- The side panel with folders three deep: does the left-clipped path read well, and does the current
  exercise land in view?
- A routine mixing the routine's mode with an item locked to another mode: does it sound and
  look right, including the backing on that item?

## Not in this run

Drag-and-drop ordering or moving; a Duplicate action; more starter exercises (add them over
time as needed); collapsible side-panel groups; templates of routines.

## Outcome (2026-10-06, at the gate)

All eight tasks built on `blueprints`, a commit each; `pnpm check` green (979 unit tests in 59
files), all 72 E2E pass. Every screen was looked at in both themes as it was built.

- **1 Data.** Dexie v7 (`folders`; every exercise upgraded by `upgradeExercises` in
  `src/data/upgrade.ts`, shared with the v1 import). The data layer is told the blueprints at
  start-up (`setBlueprintCatalog` in `main.tsx`) rather than importing them. Export v2.
  Starters only into a table with no rows at all; `findRedundantExercises` and `dedupe.ts` gone.
- **2 Helpers.** `src/exercises/locks.ts` and `src/domain/library/` (names, folders, the grouped
  list). `overridesSession(axis, policies)` takes no locks: it runs on the effective item, where
  locks are already applied. Added for later tasks: `withoutLocked` (an item editor's save keeps
  the item's own value under a lock) and `withSessionChoice` (scale and mode as a pair).
- **3 Names.** As specified; "(deleted)" after a deleted exercise's name in the report, the
  routine screens and the builder.
- **4 Editor.** Locked rows: a solid lock (heavier stroke) and a muted label; open locks are
  faint. The first look had locked and open icons too alike at 12px.
- **5 New exercise.** The editor opens with the name selected, to type over (not in the spec;
  it makes "mid-practice" quicker). Back from the editor skips the picker.
- **6 Folders.** Folder rows' menu: Rename, Delete (with a confirm that counts what goes).
  Practice from a library row tells the side panel which copy to show (its folder's, or
  Favorites' from the Favorites view). **Found by looking:** the side panel ran below the
  window at the top of the page, so its last rows sat behind the transport and could never
  be scrolled into view; it is now ~100px shorter and ends above the transport.
- **7 Routines.** As specified, plus decisions 15–17 and 22. Two scenario tests over FakeClock:
  a Lydian-locked item between two in the routine's mode (drone follows; reps against the
  exercise), and a track dropped for it and restarted after.
- **8 Close.** `e2e/blueprints.spec.ts`; the Reset and duplicate-cleanup E2E removed; routine
  E2E add items through `addToRoutine` (the editor now opens on add).
