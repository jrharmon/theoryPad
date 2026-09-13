# Status — start here

**Last updated:** 2026-09-13, M6 reviewed and merged. Written as a hand-off: a fresh session
should be able to start M7 from this file, `CLAUDE.md`, and the plan docs it points to.

**Live:** https://jrharmon.github.io/theoryPad/ — the repo is public, and every push to `main`
deploys to GitHub Pages. CI (check, build, E2E) runs on every push too.

## Where the project is

| Milestone | State |
| --- | --- |
| M0 — Foundations · M1 — Music domain · M2 — Vertical slice | ✅ merged, live |
| M3 — Scale & mode family, and its practice-view follow-up | ✅ merged, live |
| M5 — Routines, settings, export/import | ✅ merged, live |
| M4 — Theory | ✅ merged, live |
| M6 — Practice log, report & fretboard explorer | ✅ merged, live |
| **M7 — Audio richness: backing, ear training, improv** | **next** — doc 08 has the tasks |
| M8 — Rest of the catalog · M9 — Polish · M10 — Optional sync | not started |

M5 was deliberately built before M4. Everything is on `main`; there are no open branches.
713 unit tests, 46 E2E, `pnpm check` green.

## How the player works — read before starting anything

- **One milestone at a time, and stop at the gate.** Build the milestone, verify it, report,
  and wait. The player reviews hands-on (often with a guitar) before the next one starts.
  After review: merge the milestone branch into `main` (fast-forward) and push.
- **Questions up front.** Before building a milestone, ask about the choices that would change
  the work, with a recommendation for each, then list the defaults you will take unless told
  otherwise. The answers are detailed and usually improve the design. Don't ask about things
  with an obvious default — take the default and say so.
- **Token economy matters more than speed.** Single-threaded, no subagents. Read what the task
  needs, not the whole repo.
- **Verify by looking.** Anything visual gets a screenshot before it is called done (see
  "Checking UI" below). Most of the bugs that mattered in this project were invisible to tests.
- **After pushing, check CI as well as the deploy.** CI failed for three pushes before anyone
  noticed (see "Things that bit").
- American spelling in user-facing text. The player plays three-note-per-string shapes, not
  CAGED.

## Branches and commits

- A branch per milestone (`m6-…`), a commit per task, merged into `main` at the gate.
- Every commit ends with the `Co-Authored-By` trailer the harness specifies.
- Plan docs are updated as decisions are made — edit the relevant doc rather than leaving the
  decision in conversation. Each milestone in doc 08 gets an **Outcome** paragraph at its end.

## How the code is laid out

| Where | What |
| --- | --- |
| `src/domain/` | Pure logic. `music` (tonal wrapper), `instrument` (shapes, fretboard), `phrase` (ticks, builder), `variation` (axes, policies, roller), `theory` (questions, distractors), `neck`, `tempo`, `time` (Clock, FakeClock). |
| `src/exercises/` | Definitions, one directory each, registered in `registry.ts`; `shared/` generators; `params.ts` (a Zod schema → a settings form); `runner/` — `ExerciseRunner` and `RoutineRunner`. |
| `src/domain/progress/` | Everything progress, pure: local day keys, the per-day rollup, heatmap, streak, time by day, exercise log, report summary, fret tally and neck heat, key × mode grid, answer weights. |
| `src/data/` | Dexie (schema v4: exercises, routines, sessions, reps, exerciseStats, practiceDays, settings), repositories (Dexie + in-memory, one test suite), stats, `transfer.ts` (export/import). |
| `src/store/` | Zustand: `practice` (drives one exercise or a routine through the same screen), `exercises`, `routines`, `settings`, `progress` (days, today, last key/mode), `report`, `keyModeView` (the practice screen's reference open state). |
| `src/routes/` | Screens: `home` (practice strip + routines), `routines` (builder), `exercises` (library, config), `practice` (exercise, routine, theory, settings dialog), `report` (page, model, export), `fretboard` (explorer, key × mode grid), `settings`, `dev/gallery`. |
| `src/components/` | `music` (Fretboard with a heat layer, TabStaff, KeyModeView, KeyModeTrigger), `charts` (HeatmapGrid, DayBarChart), `theory`, `variation` (AxisPolicyEditor), `ui` (shadcn incl. popover and sheet, + our own). |

### The run model, briefly (doc 03 has it in full)

- An exercise **rolls once** when opened, or when a routine starts, and **stays put** until an
  explicit Re-roll. Changing a setting in the practice dialog re-rolls only the axis whose
  policy changed.
- **No reps standalone.** Play runs the material once; Loop repeats it on a running clock;
  every pass is logged as it ends, and leaving mid-pass logs it as abandoned. No End, no Skip.
- **Routines:** each item is its **own copy** of an exercise's settings. Passes play back to
  back; the next item counts in on the same clock at its own tempo, with at least a bar and no
  other gap. Key and mode are the routine's. Passes are logged against the source exercise.
  Nothing ever writes `maxTempo`.
- **Theory:** a set of questions is a pass, with no clock. Each pass is a fresh set on the same
  key. A right answer moves on after a beat; a wrong one waits with the correction. Tables are
  submitted whole. The rep logs the score and each question's subject and result; the set is
  timed as a whole.
- **Progress:** the log is the truth; `practiceDays` is a cache over it. A finished played
  pass also logs `frets` — every note by string and fret — which feeds the explorer's heat.
  Days split at local midnight; weeks start Monday.

## What works today

- **Home**: a four-week heatmap, the streak and this week's time; then your routines,
  favorites pinned, with Start and Edit.
- **Report** (`/report`): Last 7 / 30 days, This month or Custom; sessions, time, variations,
  exercises; time by day; a sortable exercise table (theory rows show a score). Export a
  self-contained HTML report or the raw log as CSV.
- **Fretboard** (`/fretboard`): a key and mode across the whole neck (starts on the last one
  practiced), degrees or notes, one 3nps shape at a time; a notes-played heat layer (all time
  or 30 days); spots played, frets never played; a key × mode grid that picks the key; the full
  key/mode view beside it.
- **Key/mode reference**: click the key in the practice strip or routine overview (or press K)
  for a compact popover; Full view for the drawer — notes, chords with 7ths/9ths/function,
  progressions, and the mode prose. Also linked from What varies and the routine builder once a
  key and mode are both fixed or held.
- **Routine builder**: name, key/mode policies, items (passes, Edit, reorder, remove), and an
  estimated length.
- **Running a routine**: an overview (re-roll one item or all), then hands-off play; Skip (or
  S); "Stay on this"; a summary.
- **Exercises** (library with favorites and tag filter; config page with generated settings and
  What varies):
  - *Modes up the neck* — plain, arpeggio-then-scale, pause-on-root
  - *Interval sequences*
  - *One note per string* — note names on the tab, no neck
  - *Position shifting*
  - *Key signature drill* (theory)
  - *Circle of fifths* (theory) — leans toward keys you miss or have seen least
- **Practicing**:
  - Metronome, Count-in and Loop toggles
  - a settings dialog
  - tab size (`-` / `=`) and bar lines
  - the neck trimmed to the frets in use, or hidden.
- **Settings**: tuning (standard, drop D, 7-string), sound, display, and Export / Import (merge
  or replace, with a summary first).
- **Keys**:
  - Space: pause
  - Enter: play or start
  - `[` `]`: tempo
  - R: re-roll
  - M: metronome
  - L: loop
  - S: skip (routines)
  - K: the key/mode reference
  - `-` `=`: tab size
  - Esc: leave
  - Theory: 1–6 answer, Enter submits or moves on, ↑ ↓ choose a table row.

## Next: M7

Doc 08 §M7: backing tracks (model, YouTube source with rate, control, track management and
the 12×7 coverage grid), reference videos, `free-improv-target`, `ear-training`, and
`PreviewPlayer`. Ask the player first, per the working agreement — likely questions: which
tracks seed the shared pool beyond the first, whether reference videos matter before backing,
and which of the five ear-training drills come first.

## Open questions for the player

These need a guitar:
- 35 bpm for one-note-per-string.
- Where position-shifting's slide falls.
- 3rds in 3nps shapes.
- The arpeggio inside each shape.
- Whether the seven shapes flow up the neck.
- Whether one bar of count-in is enough between routine items at a big tempo change.
- Whether "Stay on this" feels right mid-routine.

## Decisions, newest first

**M6 review**
- The neck heat matches what was played; the report is useful; the mode prose stands for now;
  the Home strip stays. Merged without changes.

**Start of M6**
- No personal bests for now; Home gets the heatmap, streak and week's time.
- Every finished played pass records each note by string and fret; a per-day rollup makes the
  neck's all-time and 30-day heat cheap.
- `/fretboard` is a reference first, with note-count shading as a layer.
- The key/mode popover never stops playback; Full view is a drawer.

**M4 review**
- **Traps occasionally, not on every question.** About one question in three offers a near
  miss (`TRICK_RATE` in `domain/theory/distractors.ts`). The rest offer plain alternatives:
  the key's other notes, its other chords, same-side counts, neighbouring keys.

**Start of M4**
- Right answers move on; wrong ones wait until you move on.
- Tables are one right-or-wrong answer.
- No countdown, and no per-question timing.

**Start of M5**
- No "today's routine"; favorites pin routines and exercises.
- An overview before a routine starts; no Previous; no gap between items — the count-in is
  the pause.
- Settings and export/import went into M5.

**After M3's review**
- No reps standalone; no automatic re-roll anywhere; any setting changeable by hand.
- Routine items are independent copies, and their passes count toward the source exercise.
- Max tempo is always manual.
- Routines before theory.

**Start of M3**
- One-note-per-string is note-finding: jumping between strings is the point.
- Position-shifting is 3nps with four-note strings at the shifts.
- Many axes are fine; only key and mode are ever shared across a routine.
- Pause-on-root: root a quarter, others eighths, then wait for the bar.
- Milestone branches merge to `main` at each gate.

**M2 review**
- shadcn/ui adopted.
- No interstitial before an exercise.
- The transport is frozen to the bottom of the screen.
- The metronome is a 2 kHz click.
- Names and tags are edited in code, not the UI.

## Checking UI

The dev server is `pnpm dev` on :5173; the player often has one running already. To look at
something, write a short Playwright script in the session scratchpad, driving
`http://localhost:5173` with `chromium` from `@playwright/test` and saving screenshots to read
back:
- Symlink the project's `node_modules` into the scratchpad so the import resolves.
- Scripts must not live in the repo root, or lint picks them up.
- A fresh browser has an empty IndexedDB, so navigate by exercise name through the library,
  not by stored ids.
- Wait for the thing you want. `play()` awaits the audio engine, so the screen changes a
  moment after the click.
- **Seeding practice history:** against the dev server, `page.evaluate` can
  `await import('/src/data/index.ts')` and write reps through `createRepositories(db())` — the
  rollup and stats update as they would in use. A few weeks of plausible reps is enough to
  look at the heatmap, report and explorer. For the real write path, raise the tempo
  (Shift+] repeatedly) and play one pass of Position shifting — about 40 s.

## Things that bit, and would bite again

- **Escape in a popover or drawer left the exercise.** Radix closes it during the keydown
  dispatch; React re-renders synchronously, the hotkey effect re-attaches its window listener,
  and the same event reaches it. `useRunnerHotkeys` now ignores keys whose target is inside a
  dialog or popover — don't rely on `enabled` alone for that.
- **`Date.now()` in render fails lint** (`react-hooks/purity`). Stores keep a `today` set on
  load; screens read it.

- **CI was red for three pushes and nobody looked.** The ESLint-boundaries test builds a
  TypeScript program and took over 5 s on the CI runner. It now has a 30 s timeout. After a
  push, check the CI run, not just the deploy. The API gives run status without credentials;
  failure messages are on the check-run's `annotations` endpoint.
- **Playwright's web server can time out locally** (`pnpm build && pnpm preview` on :4173). If
  it does, start `pnpm preview --port 4173` yourself; the config reuses a running server. And
  never chain `;` after a test run in a command that also merges or pushes.
- **ESLint flat config: the last matching block wins a rule outright.** That is why
  `test/eslint-boundaries.test.ts` exists.
- **Tailwind layering.** A `@layer components` or `@layer base` rule loses to a utility.
  `.kicker` is an `@utility`; the zero-radius `[data-slot]` rule is unlayered. The shared
  `Input`'s text size wins over a heading class — use a plain `<input>` for big inline fields.
- **The shadcn CLI** reads the solution-style root `tsconfig.json`, and the components import
  `cn` from the `cn` package. Match that, don't "fix" it.
- **TypeScript is pinned to 6.0.3** — typescript-eslint does not support TS 7 yet.
- **Settings update in memory before writing**, or quick toggles undo each other. Stored
  settings are laid over the defaults on load.
- **FakeClock fires anything due within one advance**, including events scheduled from a
  callback. Never restart the clock inside a clock callback; passes and routine items
  continue on the running clock.
- **A routine's "keep going"** means the item was playing or answering — not that the clock
  is running. A theory set has no clock.
- **E2E locators must be scoped** to a library row, or to the dialog: there are six exercises
  now.
- **Look at the output.** Shape tiling, a key mismatch, unreadable sixteenths, rounded badges,
  a zoom that squeezed numbers together, repeated quiz questions — all found in screenshots,
  not by tests.
