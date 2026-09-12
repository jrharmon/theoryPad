# Status — start here

**Last updated:** 2026-09-12, start of M5.

**Live:** https://jrharmon.github.io/theoryPad/ — every push to `main` deploys.

## Where the project is

| Milestone | State |
| --- | --- |
| M0–M3 | ✅ complete, merged to `main`, pushed |
| M3 follow-up — the practice view | ✅ reviewed, merged |
| **M5 — Routines** | **next** (moved ahead of M4) |
| M4 — Theory | after M5 |
| M6–M10 | not started |

613 unit tests, 33 E2E, `pnpm check` green. The repo is public; Pages deploys from GitHub
Actions.

## What works today

`pnpm dev`, then **Exercises**:

- Four exercises: **Modes up the neck** (three variants), **Interval sequences**, **One note
  per string** (note names, no neck), **Position shifting**.
- **Practicing**: a variation is rolled on arrival and stays until Re-roll. Play runs it
  once; Loop repeats it on a running clock. Metronome, Count-in and Loop toggles, remembered
  app-wide. A **Settings** dialog changes tempo, params and what varies without leaving; only
  the axes you changed roll again. Every pass is logged; leaving logs one in progress. No
  reps, no Skip, no End.
- **Tab**: bar lines; a labeled **Tab size** control (and `-` / `=`) — bars per line follow
  the available width; neck show/hide; the neck shows only the frets in use.
- **Keys**: Space pause · Enter play · `[` `]` tempo · R re-roll · M metronome · L loop ·
  `-` `=` tab size · Esc leave.
- The config page: tempo, Settings (from each exercise's params), What varies with
  roll-from-subset chips.

## Next: M5 — Routines

Doc 08 has the tasks and the rules agreed after M3; doc 02 has `RoutineItem` (each item its
own copy of an exercise's settings). The runner already supports what a routine needs:
`passes`, `endWhenFinished`, and continuation passes on a running clock.

## Open questions for the player

Recorded by the player to try with a guitar:

- Is 35 bpm right for one-note-per-string?
- Position-shifting: is the slide where you actually shift?
- Are 3rds in 3nps comfortable, and does the arpeggio sit well inside each shape?
- Do the seven shapes flow up the neck?

## Decisions made after M3's review

- **No reps standalone; no automatic re-roll anywhere.** Roll on arrival or routine start,
  stay put until Re-roll. Any setting can be changed by hand at any time.
- **Routine items are independent copies** of an exercise's settings; the same exercise can
  appear more than once. Their passes count toward the source exercise.
- **Max tempo is manual, always** — a fast pass says nothing about whether it was clean.
- **Routines before theory**: M5, then M4.

## Decisions made at the start of M3

- **One-note-per-string is a note-finding exercise.** Jumping between strings is the point;
  the player is limited by finding the note, never by moving the hand.
- **Position-shifting is 3nps with four-note strings** at the shifts; the descent rotates them.
- **Both interval pairings, as an axis.** Many axes are fine — each exercise declares its own.
- **Only key and mode are shared across a routine.** Every other axis rolls per exercise.
- **Pause-on-root is not musical on purpose**: root a quarter, others eighths, wait for the bar.
- **Milestone branches merge to `main` at each gate**, so `main` stays the clean history.

## Things that bit, and would bite again

- **ESLint flat config: the last matching block wins a rule outright.** Four overlapping
  `no-restricted-imports` blocks left only the last one live, silently. `test/eslint-boundaries.test.ts`
  exists because of it.
- **Tailwind layering.** A `@layer components` class loses to a utility, and a `@layer base`
  rule does too. `.kicker` is declared with `@utility`; the zero-radius rule for `[data-slot]`
  is deliberately unlayered.
- **The shadcn CLI reads the root `tsconfig.json`**, which is solution-style. Without
  `paths` duplicated there it writes components into a literal `@/` directory.
- **TypeScript is pinned to 6.0.3.** TS 7 is `latest`, but typescript-eslint does not
  support it, and losing type-aware linting costs more than the compiler speed.
- **A fresh Playwright browser has an empty IndexedDB**, so exercise ids differ from the
  dev pane's. Drive screenshots by exercise name through the library, not by URL.
- **Settings saves must update memory first.** Waiting for the write let two quick toggles
  merge into the same stale settings. Stored settings are also laid over the defaults on
  load, so a new field is never read as `undefined`/false.
- **FakeClock fires anything due within one advance**, including events scheduled from a
  callback. Restarting the clock inside a pass-end callback looped forever; passes now
  continue on the running clock instead.
- **The E2E suite assumed one exercise.** Locators in `e2e/practice.spec.ts` are now scoped
  to one library row; keep new ones scoped too.
- **Look at the output.** M1's shape tiling, M2's key mismatch, the unreadable sixteenth-note
  tab and the rounded badges were all found by rendering a screenshot, not by a test.
