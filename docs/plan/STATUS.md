# Status — start here

**Last updated:** 2026-09-12, end of M4. Written as a hand-off: a fresh session should be able
to start M6 from this file, `CLAUDE.md`, and the plan docs it points to.

**Live:** https://jrharmon.github.io/theoryPad/ — the repo is public, and every push to `main`
deploys to GitHub Pages. CI (check, build, E2E) runs on every push too.

## Where the project is

| Milestone | State |
| --- | --- |
| M0 — Foundations · M1 — Music domain · M2 — Vertical slice | ✅ merged, live |
| M3 — Scale & mode family, and its practice-view follow-up | ✅ merged, live |
| M5 — Routines, settings, export/import | ✅ merged, live |
| M4 — Theory | ✅ merged, live |
| **M6 — Practice log, report & fretboard explorer** | **next** — doc 08 has the tasks |
| M7 — Audio richness · M8 — Rest of the catalog · M9 — Polish · M10 — Optional sync | not started |

M5 was deliberately built before M4. Everything is on `main`; there are no open branches.
672 unit tests, 43 E2E, `pnpm check` green.

## How the player works — read before starting M6

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
| `src/data/` | Dexie (schema v3: exercises, routines, sessions, reps, exerciseStats, settings), repositories (Dexie + in-memory, one test suite), stats, `transfer.ts` (export/import). |
| `src/store/` | Zustand: `practice` (drives one exercise or a routine through the same screen), `exercises`, `routines`, `settings`. |
| `src/routes/` | Screens: `home` (routines), `routines` (builder), `exercises` (library, config), `practice` (exercise, routine, theory, settings dialog), `settings`, `dev/gallery`. `/fretboard` and `/report` are still placeholders — M6. |
| `src/components/` | `music` (Fretboard, TabStaff, tab layout), `theory` (single pick, table fill, feedback, circle strip, note row), `variation` (AxisPolicyEditor), `ui` (shadcn + our own). |

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

## What works today

- **Home**: your routines, favorites pinned, with Start and Edit.
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
  - *Circle of fifths* (theory)
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
  - `-` `=`: tab size
  - Esc: leave
  - Theory: 1–6 answer, Enter submits or moves on, ↑ ↓ choose a table row.

## Next: M6

Doc 08 §M6: `domain/progress/` (coverage, heatmap, time-by-day, streak, tempo history), the
home page's heatmap and personal bests, `/report`, `/fretboard`, `<KeyModeView />`, the
mode-character prose (drafted for the player to edit), and report export.

Carried into M6 from earlier milestones:
- **Circle of fifths should lean toward keys you miss or have seen least.** Keys are drawn
  evenly for now. Every theory rep already logs `answers: { subject, correct }[]` for this.
- Home gets its **heatmap and personal bests** here. It is just the routines list today.
- Things the report can use: set duration comes from the rep's start and end; theory scores
  are on `rep.score`; routine passes carry `routineItemId`.

Ask the player first, per the working agreement. Likely questions: what "personal bests"
means without auto-tracked max tempo; the report's default date range; whether the fretboard
explorer's coverage counts every rep or only completed ones.

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

## Things that bit, and would bite again

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
