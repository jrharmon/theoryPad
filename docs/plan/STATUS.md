# Status — start here

**Last updated:** 2026-09-12, start of M5.

**Live:** https://jrharmon.github.io/theoryPad/ — every push to `main` deploys.

## Where the project is

| Milestone | State |
| --- | --- |
| M0–M3, M3 follow-up | ✅ complete, merged, live |
| M5 — Routines, settings, export/import | ✅ reviewed, merged, live |
| **M4 — Theory** | **✅ built on `m4-theory`, awaiting review** |
| M6–M10 | not started |

670 unit tests, 43 E2E, `pnpm check` green.

## What works today

- **Home** — your routines, favorites pinned; Start and Edit; New routine.
- **Routine builder** — name, key and mode for the whole routine, and items added from the
  library (each its own copy; the same exercise can go in twice): passes, Edit (tempo,
  settings, what varies), reorder, remove. Estimated length.
- **Running a routine** — an overview of everything rolled (re-roll one or all), then it runs
  hands-off: each item's passes back to back, the next item counted in at its own tempo. Skip
  (or S), "Stay on this" to hold on an item. A summary at the end.
- **Exercises** — four scale/mode exercises, favorites pinned; practicing as in the M3
  follow-up (no reps, Loop, settings dialog, tab size, neck).
- **Theory** — **Key signature drill** (notes, chord qualities, spelling, function, in the
  rolled key — the routine's in a routine) and **Circle of fifths** (signatures, relatives,
  neighbours, mode signatures across all keys). Right answers move on; wrong ones show the
  correction until Enter. Tables are submitted whole. Score and time per set.
- **Settings** — tuning (standard, drop D, 7-string), metronome default, count-in bars,
  volume, neck, tab size; **Export / Import** (merge or replace, with a summary first).
- **Keys**: Space pause · Enter play/start · `[` `]` tempo · R re-roll · M metronome ·
  L loop · S skip (routine) · `-` `=` tab size · Esc leave · theory: 1–6 answer, Enter
  submits a table or moves on, ↑ ↓ pick a table row.

## Next: M4 review, then M6 — practice log, report and fretboard explorer

## Open questions for the player

- **Are the theory distractors actually tempting?** That is M4's whole verify step.
- Is the count-in enough of a pause between a routine's items, especially at a big tempo change?
- Does "Stay on this" feel right for lingering on an item mid-routine?
- Still open: 35 bpm for one-note-per-string; where position-shifting's slide falls; 3rds in
  3nps; the arpeggio inside each shape; whether the seven shapes flow up the neck.

## Decisions made at the start of M4

- **Right answers move on; wrong ones wait** with the correction until you move on.
- **Tables are submitted whole**, one right or wrong — no partial credit.
- **No countdown**; a set is timed as a whole, not per question.

## Decisions made at the start of M5

- **No "today's routine"**; favorites pin routines and exercises to the top of their lists.
- **An overview before a routine starts**; **no Previous**; **no gap** — the count-in is the pause.
- **Settings and export/import in M5**, as orthogonal to routines.

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
