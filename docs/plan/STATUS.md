# Status — start here

**Last updated:** 2026-09-10, end of M2.

## Where the project is

| Milestone | State |
| --- | --- |
| M0 — Foundations & rails | ✅ complete |
| M1 — Music domain & rendering primitives | ✅ complete |
| M2 — The vertical slice: one exercise, end to end | ✅ complete, reviewed |
| **M3 — The scale & mode family** | **next** |
| M4–M10 | not started |

518 unit tests, 29 E2E, `pnpm check` green. Branch `m2-vertical-slice`, unmerged.

## What works today

`pnpm dev`, then **Exercises**:

- One exercise, `modes-through-key` ("Modes up the neck"), generating 21 bars of tab
  across all seven three-note-per-string shapes of a rolled key.
- Opening it rolls a variation and generates the material immediately; the transport is
  frozen to the bottom of the screen; the tab scrolls itself as it plays.
- Metronome, playhead, tempo control, pause, re-roll, skip, end. Keyboard-operable.
- Every rep is logged to IndexedDB with what it rolled and the tempo actually used.
- `/#/dev/gallery` — the M1 primitives against fixture data, with playback.

## Next: M3

Doc 08 has the task list. In short: three shared generators (`intervalRun`,
`oneNotePerString`, `horizontalRun`), three exercises built on them, and the two
`modes-through-key` variants that currently throw.

**The point of M3 is a measurement**, not just content: the plan claims a typical exercise
is a short composition of shared pieces. `modes-through-key` came out at ~40 lines of
`generate`. If the next three do not, the shared layer is wrong and it is much cheaper to
fix at three exercises than at thirteen.

## Open questions for the player

Carried from the M2 review, all needing a guitar rather than a test:

- **Is the generated material playable?** Seven shapes ascending frets 1→12 is a lot of
  neck. Does it flow, or jump awkwardly between shapes?
- **Free time.** Removed from the UI at the player's request (just don't press play). The
  runner keeps the capability for `free-improv-target` in M7; revisit then whether a rep
  needs a manual end at all.
- Doc 10 §A has the rest.

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
- **Look at the output.** M1's shape tiling, M2's key mismatch, the unreadable sixteenth-note
  tab and the rounded badges were all found by rendering a screenshot, not by a test.
