# Status — start here

**Last updated:** 2026-09-10, end of M3 (awaiting review).

## Where the project is

| Milestone | State |
| --- | --- |
| M0 — Foundations & rails | ✅ complete |
| M1 — Music domain & rendering primitives | ✅ complete |
| M2 — The vertical slice: one exercise, end to end | ✅ complete, reviewed |
| **M3 — The scale & mode family** | **✅ complete, awaiting review** |
| M4–M10 | not started |

599 unit tests, 31 E2E, `pnpm check` green. M0–M2 are merged to `main` (fast-forward, in
order); M3 is on `m3-scale-family`, to be merged at the gate. **Nothing has been pushed** —
the GitHub remote is empty, and a push to `main` triggers the Pages deploy.

## What works today

`pnpm dev`, then **Exercises**:

- **Modes up the neck** — all seven 3nps shapes of a rolled key; variants `plain`,
  `arpeggio-then-scale` (each shape's 7th chord up, scale down) and `pause-on-root`
  (roots a beat, everything else an eighth).
- **Interval sequences** — 3rds to 7ths, groups of 3 and 4, same-direction or alternating,
  through the shape at a rolled position.
- **One note per string** — a note-finding sweep. The tab shows note names, not frets, and
  the neck is left empty.
- **Position shifting** — up through the shapes with a slide on each four-note string, back
  down by another route.
- The config page: tempo and reps, a **Settings** form generated from each exercise's params,
  and **What varies** — Roll / Fixed / Hold per axis, with chips to leave values out of a roll.
- Running an exercise, logging reps, `/#/dev/gallery` — as in M2.

## Next: the M3 review, then M4

Doc 08 has the M3 outcome and the line-count measurement (the claim held: 32–37 lines of
`generate` per new exercise). M4 is the theory exercises.

## Open questions for the player

Only a guitar can answer these:

- **Is 50 bpm right for one-note-per-string?** One note per beat is ~1.2 s to find each.
- **Does position-shifting's route feel natural?** The slide is marked on the fourth note of
  a string going up and the lowest going down. Does that match where you actually shift?
- **Are the interval figures playable in 3nps?** 3rds on one string stretch across the shape.
- **Does the arpeggio sit well inside each shape**, or does it want its own fingering?
- **Still open from M2:** is seven shapes, frets 1→12, a playable amount of neck? Does it
  flow between shapes? Doc 10 §A has the rest.

## Decisions made during M2's review round

These came from playing with the app and are not obvious from the code alone:

- **shadcn/ui was adopted mid-milestone**, not deferred to M6 — the point of M2 is setting
  patterns later milestones follow, so validating it early was worth more than the delay.
- **No interstitial before an exercise.** `prepare` (roll + generate, no audio) is split
  from `play` (starts the AudioContext, which needs a user gesture).
- **The transport is frozen to the bottom** and the tab auto-scrolls, because a 21-bar
  exercise otherwise means scrolling away from the controls with a guitar in your hands.
- **The metronome is a 2kHz click, not a drum.** A low thud sits in the same register as
  the low strings and disappears under them.
- **Re-roll releases `hold`.** A hold that nothing can release is a trap.
- **An exercise's identity lives on its definition, its configuration in the database.**
  Copying `name` across that line let it go stale. See doc 02 §6.
- **Names and tags are edited in code**, not the UI. No name editor, no Duplicate.
- **Identical unplayed copies of one exercise are cleaned up on load** — damage from a
  seeding race that has since been fixed.

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
- **The E2E suite assumed one exercise.** Locators in `e2e/practice.spec.ts` are now scoped
  to one library row; keep new ones scoped too.
- **Look at the output.** M1's shape tiling, M2's key mismatch, the unreadable sixteenth-note
  tab and the rounded badges were all found by rendering a screenshot, not by a test.
