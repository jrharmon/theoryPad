# Status — start here

**Last updated:** 2026-09-25. **Nothing is in progress. M7b is next.** **"Generated backing"
is merged and pushed** (2026-09-25): "Generated" in the Backing menu plays sampled bass and
piano chords under the notes, over a progression of scale degrees (vamp on 1, the mode's go-to
progressions, or custom lists) picked from the roll, set per exercise and per routine item, with
the chords shown over the tab and in the improv counter. **`docs/plan/13-GENERATED-BACKING.md`**
has the spec and every task's outcome and review; "Generated backing" under "Remaining work"
summarizes it. `main` is the only branch, local and origin in sync. Before that: **"Sounds — sampled instruments and drum metronomes" is merged
and pushed**: the notes play on sampled guitar (default) or piano, and the metronome is a menu —
Off, Click, or a drum beat (Simple, Upbeat, Swing, Heavy) — chosen per exercise. The beats
beyond Simple are **drum tab in `src/domain/drums/beats.ts`**, written to be tweaked and added
to. See "Sounds" under "Remaining work" and `docs/plan/12-SOUNDS.md`, whose per-task
**Outcome** and **Gate** sections record every decision. `main` is the only branch. **M7b is
next.** Before that, two things merged today: **a routine's theory reps are now its
question count**, and **the exercise follows YouTube's own pause and play**, which closes the
backing-track run — see those sections. Before that, as of 2026-09-21: **Feedback round 6 is merged and live** — circled root fret
numbers in the tab, a routine's pass counter, and chord families replacing degree names in the
theory drill; see "Feedback round 6" below. Nothing is in progress. Before that, **feedback round 5 was merged
and live** — a transport clock, settings and the backing menu reloading on every visit, and
uniform bar widths in the tab, plus two frozen readouts fixed on the way; see "Feedback round
5" below. Before that, **feedback round 4 was merged and live** — five transport and generator fixes from
living with the app, listed under "Feedback round 4". Before that, "Backing tracks — ads and the YouTube host" is **finished**:
tasks 1 and 2 are merged and live, and task 3 turned out not to need custom controls at all — the
exercise follows YouTube's own pause and play instead. **M7b is next.** The ad task corrected the advert signal that whole run was planned
around, so read that section before touching backing playback again. Written as a hand-off: a
fresh session should be able to pick up from this file, `CLAUDE.md`, and the plan docs it points
to. Start with "Remaining work".

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
| Restyle — Notebook, light and dark | ✅ merged, live — doc 11 |
| M7a — Backing tracks, reference videos, free improv | ✅ merged, live |
| Feedback rounds 1–3 — after living with M7a | ✅ merged, live |
| Cleanup — architecture review | ✅ all nine steps merged — `docs/review/ARCHITECTURE-REVIEW.md` |
| Backing tracks — ads and the YouTube host | ✅ all three done — task 3 by following YouTube's controls rather than hiding them |
| Feedback round 4 — transport and turning notes | ✅ merged, live — see below |
| Feedback round 5 — transport clock, reloads, tab bar widths | ✅ merged, live — see below |
| Feedback round 6 — circled tab roots, pass counter, chord families | ✅ merged, live — see below |
| Sounds — sampled instruments and drum metronomes | ✅ merged, pushed 2026-09-23 — spec, every task's outcome and both gate rounds in `docs/plan/12-SOUNDS.md` |
| Generated backing — bass and piano over the key's chords | ✅ merged, pushed 2026-09-25 — spec, outcomes and reviews in `docs/plan/13-GENERATED-BACKING.md` |
| M7b — Ear training and "hear it" | **next** — see "Remaining work" |
| M8 — Rest of the catalog · M9 — Polish · M10 — Optional sync | not started |

M5 was deliberately built before M4. Everything is on `main`, and every merged branch has been
deleted — `main` is the only branch, local and origin in sync. 735 unit tests in 55 files,
69 E2E, `pnpm check` green.

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
| `src/data/` | Dexie (schema v6: exercises, routines, sessions, reps, exerciseStats, practiceDays, settings), repositories (Dexie, tested over `fake-indexeddb`; reached through `repos()`), stats, `transfer.ts` (export/import). |
| `src/session/` | Framework-free `PracticeSession` (`ExerciseSession`, `RoutineSession`): runner, sound routing, saves; `BackingController` (choice → source, track/runner tempo hand-off). Injected `AudioPort` + repositories; scenario-tested over `FakeClock` and `fake-indexeddb`. Imports audio as types only (lint-enforced). |
| `src/store/` | Zustand: `practice` (a thin adapter holding one `PracticeSession` and mirroring its state), `exercises`, `routines`, `settings`, `progress` (days, today, last key/mode), `report`, `keyModeView` (the practice screen's reference open state), `sounds` (the engine's voice: choose, status, hear it). |
| `src/routes/` | Screens: `home` (practice strip + routines), `routines` (builder), `exercises` (library, config), `practice` (exercise, routine, theory, settings dialog), `report` (page, model, export), `fretboard` (explorer, key × mode grid), `settings`, `dev/gallery`. |
| `src/components/` | `music` (Fretboard with a heat layer, TabStaff, KeyModeView, KeyModeTrigger), `charts` (HeatmapGrid, DayBarChart), `theory`, `variation` (AxisPolicyEditor), `ui` (shadcn incl. popover and sheet, + our own). |
| `src/styles/` | `theme.css`: every token, light values in `@theme`, dark ones under `:root[data-theme="dark"]`, and the shadcn mapping. `index.css`: base type, the `kicker` / `face-title` / `num` / `bg-graph` / `sheet` / `highlight` utilities, and the unlayered `data-slot` overrides. |
| `src/domain/drums/` | Pure drum patterns for the metronome: Simple (generated, any signature), and the 4/4 beats written as drum tab in `beats.ts` — Upbeat, Swing, Heavy — parsed by `tab.ts`; `patternsFor(timeSignature)`. `src/audio/DrumKit.ts` plays them from the sample kit. |
| `src/domain/backing/` | Pure backing maths: speed in 5% steps, the clock↔video timeline (`alignTrack`, `tickAtVideoTime`, `followFactor`), YouTube link and time parsing, tap-along tempo, the drone's notes. |
| `src/audio/backing/` | `YouTubePlayer` (IFrame API, loaded on first use, host www.youtube.com), `VideoBacking`, `TrackFollower` (the clock follows the video), `clickAlong`. `src/audio/Drone.ts` is the drone. |
| `src/data/videos.ts` | Matching tracks to a key (exact, spelling-blind) with saved criteria, a remembered choice, coverage, validation. `src/data/seed/videos.ts` is the first-run track. |
| `src/store/` (M7) | `videos` (the table). The backing state's shape and its controller live in `src/session/backing.ts`. |
| `src/components/media/` | `PlayerSlot` (mounts a player's node once — moving an iframe reloads it), `VideoEmbed` (thumbnail until clicked), `useEnlarge`/`EnlargeScrim`. |
| `src/app/appearance.ts` | The Appearance setting → `<html data-theme>`: `resolveTheme`, `applyAppearance`, `useAppearance` (AppShell). `index.html`'s inline script does the same before first paint from a localStorage mirror. |

### The run model, briefly (doc 03 has it in full)

- An exercise **rolls once** when opened, or when a routine starts, and **stays put** until an
  explicit Re-roll. Changing a setting in the practice dialog re-rolls only the axis whose
  policy changed.
- **No reps standalone.** Play runs the material once; Loop repeats it on a running clock;
  every pass is logged as it ends, and leaving mid-pass logs it as abandoned. No End, no Skip.
- **Routines:** each item is its **own copy** of an exercise's settings. Passes play back to
  back; the next item counts itself in on the same clock, at its own tempo and with its own
  count-in, and that is the only gap. Key and mode are the routine's. Passes are logged against the source exercise.
  Nothing ever writes `maxTempo`.
- **Theory:** a set of questions is a pass, with no clock. Each pass is a fresh set on the same
  key. A right answer moves on after a beat; a wrong one waits with the correction. Tables are
  submitted whole. The rep logs the score and each question's subject and result; the set is
  timed as a whole.
- **Backing (M7a):** one `videos` table — shared tracks (key, mode, bpm; matched exactly) and
  an exercise's own videos (play-along on: its own track; off: a reference video). Nothing is
  chosen for you: None is the synth notes with the click. A track replaces the notes, the
  drone plays under them; a track silences the metronome, count-in included, and owns the tempo (5% steps,
  `targetTempo` untouched). Play starts the video first; the clock follows it (`TrackFollower`).
  The choice is remembered on the exercise or routine. Doc 06 has it all.
- **Progress:** the log is the truth; `practiceDays` is a cache over it. A finished played
  pass also logs `frets` — every note by string and fret — which feeds the explorer's heat.
  Days split at local midnight; weeks start Monday.

## What works today

- **Notebook, light and dark**: a plain page, white sheets, graphite, ballpoint blue,
  highlighter yellow; Bricolage Grotesque and Figtree, self-hosted. **Appearance** in Settings →
  Display: System (default, follows the computer live), Light or Dark — applied before first
  paint on the next load. The exported HTML report is always light.

- **Backing** (M7a): a Backing menu in the transport — None, Drone, or tracks in the key (the
  exercise's own first, then shared, narrowed by its saved criteria). A track shows in the right
  column (held open; Enlarge; Escape shrinks) with its speed beside the tempo. Routines choose
  one on the overview; it plays straight through, re-speeded per item, stopped by a theory set.
- **Settings → Backing tracks**: the 12×7 coverage grid (a filled cell lists its tracks, an
  empty one adds one there), the shared tracks, and the form: paste a link, tap along (T) for
  bar 1 and the bpm, nudge ±0.05 s, **Check with a click**, a loop point, key, mode, tags.
- **Exercise config page**: Videos (reference or play-along, only that exercise sees them) and
  Backing tracks offered (tags, a bpm range). Reference videos also sit in the practice column.
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
  - *Improvise to a target* (`free-improv-target`) — no tab: a phrase counter, the note to land
    on (yellow on each phrase's last bar), the whole mode on the neck
- **Practicing**:
  - Loop; the Metronome menu (Off, Click, or a drum beat — Simple, and Upbeat, Swing and
    Heavy in 4/4 — saved to the exercise or routine item, changeable while playing); the Count-in menu
  - a settings dialog
  - tab size (`-` / `=`) and bar lines
  - the neck trimmed to the frets in use, or hidden.
- **Settings**: tuning (standard, drop D, 7-string), sound (the instrument the notes play
  on — synth, sampled piano or sampled guitar, default guitar — with Hear it, and the sample
  credits; the metronome for exercises that have not chosen one), display (appearance, neck, tab size),
  and Export / Import (merge or replace, with a summary first).
- **Keys**:
  - Space: pause
  - Enter: play or start; mid-pass, restart from the top (in a routine too)
  - Backspace: stop, back to the top
  - `[` `]`: tempo — under a track, one 5% speed step
  - T: tap along, in the track form
  - R: re-roll
  - M: metronome off, and back to the last one that was on
  - L: loop
  - S: skip (routines)
  - K: the key/mode reference
  - `-` `=`: tab size
  - Esc: leave
  - Theory: 1–6 answer, Enter submits or moves on, ↑ ↓ choose a table row.

## Feedback rounds 1–3 — merged (2026-09-16)

The player came back with a list after living with the app, and reviewed it twice more. All of
it is on `main` and live; `pnpm check` green, 807 unit tests, 63 E2E.

### Round 1
- **Circle of fifths** in the practice screen's right column, under the neck (improv too): the
  parent major's seven chords tinted as a wedge, spelled from the key, the mode's home chord in
  blue, the signature in the middle. Settings → Display can hide it. `keyOnCircle` in
  `domain/theory/circle.ts`; `components/music/CircleOfFifths.tsx`.
- **Keys and modes struck out app-wide** (Settings → Keys and modes, `practice.blockedKeys` /
  `blockedModes`). Only a roll avoids them; pinned or held still plays; a roll's subset beats
  the list if nothing else is left. The policy editor shows them struck out and says why.
- **String set defaults to all strings** for every exercise, as the axis's own default
  (`AxisDefinition.defaultPolicy`, read through `policyFor`). **`allowedValues`** on a
  definition limits an axis outright — for triads (8.5): three-string sets, default 1-2-3.
- **Half-bar count-in** (Settings → Sound; `countInTicks` rounds to whole beats). The
  transport's toggle turns the last chosen length back on (`audio.countInWhenOn`).
- **Required backing tags** in a definition (`backing.requiredTags`), added to the saved
  criteria; routines ask for every item's. No exercise uses it yet.
- **Stop and Restart** in the transport, standalone only (Backspace, and Enter mid-pass).
  Stopped past the count-in logs the pass as abandoned; inside it, nothing.
- **Key above mode** in the policy editor (the roller still resolves mode first, for spelling).
- Also fixed on the way: a key subset now matches by pitch, so a subset holding Db still
  offers phrygian's C#.

**Answered at the gate (2026-09-16):** the key × mode heat map on `/fretboard` was simply
missed and is fine as it is; the drone was an old note, already fixed; stop and restart were
wanted in routines too. Half a bar is enough count-in at a slow tempo, and the circle "gives
the perfect view of related chords".

### Round 2
- **The count-in belongs to the exercise**, not to Settings: a Count-in menu in the transport
  beside Backing (None, ½ bar, 1 bar, 2 bars), saved to the exercise — or, in a routine, to the
  item being played, which each carry their own and count that item in wherever it falls (the
  old "at least a bar between items" rule is gone — asked for at the gate). `Settings → Sound`
  no longer has it; `audio.countInBars` survives only as the fallback for rows made before the
  move.
- **Stop and Restart work in a routine**, on the current item: it waits where it is rather than
  moving on. `RoutineRunner.stop()`.
- **The right column scrolls clear of the transport**: sticky, and `overflow-y-auto` inside a
  `max-h` once it is taller than the window. (`calc(100dvh_-_7.5rem)` — the underscores matter,
  a `calc` without spaces round the minus is invalid CSS and silently does nothing.)
- **The neck and the circle minimize** from a button at each panel's top right, and shrink to
  their titles rather than vanishing, so they come back from where they went; the column
  narrows and the tab takes the room. `SidePanel`. Beside the tab size, **Hide Info / Show
  Info** puts the whole column away (`ui.showInfoColumn`) — that is what the old "Hide neck"
  button became.
### Round 3

- **Starting a track shows nothing special**: the transport simply looks like it is playing.
  Only a browser holding the video back still says so, since that needs a press.
- **Between routine items, the count-in is the next exercise's own** — none means none. The
  "always at least a bar" rule is gone, at the player's request.
- **Hide Info / Show Info** beside the tab size puts the whole right column away and brings it
  back (`ui.showInfoColumn`); the panels' own minimize buttons stay for one at a time.
- **Play, pause, restart and stop are icons** (lucide), which is most of the transport's width
  back. Theory keeps its worded Start / Again.

## A routine's theory reps are questions — merged (2026-09-22)

In a routine, a theory item sized by `questionCount` (circle of
fifths, key signature drill) now reads its reps as **questions**, asked as one set: reps 4 is a
4-question set, where before reps 1 was one whole 10-question set. `routineItemRun` in
`src/exercises/params.ts` does it for the runner and the time estimate; the count is set after
the schema, so a routine can go from 1 to 40 questions (the exercise's own form still has its
5–20 / 4–16 limits for standalone practice). The builder's stepper says "questions", a new theory
item starts at the exercise's own question count, and the item's Edit dialog hides the question
count so there is one control, not two. **Routines saved before this** keep their stored reps,
so a theory item at 1 pass is now 1 question until it is stepped up — nothing migrated.

## Feedback round 6 — merged (2026-09-21)

Three things from living with the app. The third turned out to be a real correction to what
the app teaches, not a wording fix. All merged to `main` in three commits. `pnpm check` (692
unit tests in 48 files) and the 66 E2E are green, and every screen that changed was driven in the browser and
looked at, in both themes.

- **Root fret numbers are circled in the tab.** This is the **tab staff**, not the neck
  diagram — the numbers you read off the page while playing. The neck diagram already colours
  its root dot and is untouched; the tab did not mark the root at all, though it has carried
  `data-role` on every note all along. Now a root's fret number sits in a `rounded-full` ring
  at `border-tab-digit/45`, so it follows `--ink-base` into dark on its own.
  - **Only the fret number goes inside the ring.** A pick stroke or an articulation mark says
    how you play the note, not which note it is, so they stay outside it.
  - **The padding is in `em`, not pixels**, so the ring holds its shape across all the zoom
    steps — the digit scales and the ring scales with it. At the smallest step the rows are
    ~13px apart and a pixel padding would have collided with the string above.
  - A **two-digit** fret makes it an oval rather than a circle, which is how tab has always
    written it. Checked at both zoom extremes, with two-digit roots, and in an exercise that
    shows note names instead of fret numbers.
- **A routine says which pass you are on**, `1 / 4`, immediately right of the clock. The runner
  already counted it privately; `passesThisRun` is now on `RunnerSnapshot` beside `passes`, so
  the pass under way is `passesThisRun + 1`. Shown for **every** routine item including a
  one-pass one — items in a routine have different pass counts, so a readout that disappears is
  worse than one that says `1 / 1`. **Loop deliberately runs past the total** (`4 / 3`): that is
  exactly what "Stay on this" is doing, and the toggle is lit right beside it. No label, by the
  player's call; the meaning is in the `aria-label`.
- **Chord families replaced degree names.** The old `chord-function` question asked "Which chord
  is the subdominant in D Dorian?" and accepted only the 4th. The player's teacher calls **both
  the 2nd and the 4th** subdominant chords, and the teacher is right: those are two different
  frames, and the app was using one word for both.
  - **Degree names are gone.** `degreeName()` is deleted — people say "the 2nd", not "the
    supertonic", and the ordinals in `ORDINAL` say it better. Families are what is worth
    learning.
  - `ChordFunction` is now **the family, covering all seven degrees**: tonic (1, 3, 6),
    subdominant (2, 4), dominant (5, 7). `'other'` is gone from the type — every diatonic chord
    is in a family. Taken **by degree in every mode**, at the player's call: a mode whose 7th is
    a subtonic rather than a leading tone is still called dominant, which keeps one rule across
    all seven modes rather than a rule with a footnote. (The alternative, leaving the subtonic
    out, was offered and turned down.)
  - The question is now a **multi-pick**: "Which chords are the subdominant family in D Dorian?"
    with all seven chords of the key offered, shuffled, and a note saying how many to find. It
    is submitted whole like a table — right only if the ticks match exactly, so missing one is
    as wrong as adding one. `MultiPickQuestion` and `multiIsCorrect()` are the new domain
    pieces; `MultiPick.tsx` is the UI. After submitting, each option shows which of **four**
    things it was: right, wrongly ticked (struck through), **missed** (outlined in the accent,
    labelled), or correctly left alone. The correction names **every** wrong tick, which is why
    `TheoryFeedback` now takes `pickedIds` rather than one `pickedId`.
  - The families come off `diatonicChords(km)` itself, so the drill and the key/mode reference
    can never drift apart.
  - **The stored value is still `chord-function`** — it is persisted in saved exercises, so it
    cannot be renamed. `OPTION_LABELS` in `src/exercises/params.ts` overrides just the label to
    "Chord families". That table is the place for a value whose humanized form would mislead.
  - The key/mode reference's **Function column is now Family**, and every row names its family.
    The tint that used to mark I/IV/V is gone: once six or seven rows have a family, a tint on
    three of them distinguishes nothing.
  - Number keys answer up to **7** now, not 6 — a family question offers all seven chords.

**The `PracticeSession.test.ts` flake, fixed (2026-09-21).** It occasionally reported an
unhandled `DatabaseClosedError` after "seeks under a backing track", failing `pnpm check` with
every test green. Sessions persist fire-and-forget (`lastPlayedAt`, held axis values), and under
full-suite load a test could end with one of those writes still queued; `afterEach` then deleted
the database under it. Confirmed by slowing the routine writes 5 ms, which reproduced the exact
error every run. The harness now records every write a session starts and `afterEach` waits for
them before deleting the database; with the delay still in, the error is gone.

## Feedback round 5 — merged (2026-09-20)

Three things from living with the app, plus two frozen readouts and a stale backing menu found
while building them. All merged to `main` in eight commits. `pnpm check` (692 unit tests in 48 files) and the 65 E2E are green, and
every screen was driven in the browser and looked at, in both themes.

- **The transport shows a clock**: how long this press of Play lasts, and how far into it you
  are — `0:12 / 2:00`, beside the bar and beat. Both halves are ticks converted at the tempo
  being played, so a tempo nudge rescales them together and the fraction between them stays
  honest; a pause simply stops the clock and the elapsed time holds. Stop puts it back to 0:00,
  and the length shows before you start too, which is worth knowing with a guitar in your hands.
  The length is one pass of the material times the passes one press of Play runs, so **a routine
  item's rep count multiplies it** — `snapshot.passes` is already the item's reps. **Looping is
  timed as the loop**: going round has no end to count toward, so the length is one time through
  and the elapsed time starts again with it, which is what you want to know while you are in it.
  A theory set, free time and an exercise with no written phrase have nothing to time and show
  nothing.
  `runTicks` on `RunnerSnapshot` is the new part of the model — ticks since Play, across every
  pass of the run, 0 whenever nothing is under way; `runClock()` in `src/routes/practice/`
  turns it and the phrase into the two numbers. It reads between the tempo and the metronome.
- **The bar and beat, and the chrome's progress bar, were frozen.** Both read
  `snapshot.phraseTick`, and the runner only emits when something *happens* to it — so they sat
  at "Bar 1 · beat 1" and 0% for the whole pass. Only the playhead was polled. `usePhraseTick`
  is now `useRunnerTicks`, which returns the phrase tick and the run's ticks, and everything
  that has to count reads it from there. It hands back the same object when the numbers have not
  moved, so a paused clock does not re-render the screen every frame.
- **The settings screen reloads on every visit.** Settings are read once at start-up and kept in
  memory, and `load()` returned early once loaded — so a second tab that was already open showed
  what it last knew until it was refreshed. `useSettings.reload()` reads the row again, through
  the same queue as the writes so a read can never overtake a save that has not landed. `load()`
  is unchanged for every other screen.
- **The practice screen's backing menu reads the video table again on every visit.**
  `sessionDeps()` loaded the videos only `if (!loaded)`, so a tab that had already been to a
  practice screen never saw a track another tab had added — reproduced across two tabs, and the
  same tab showed the track after a page reload. `useVideos.load()` itself has no such guard, so
  **Settings and the exercise config page were already fresh**: an earlier note here that said
  otherwise was wrong. The table is tens of rows, so reading it per visit costs nothing. Pinned
  by an E2E test in `backing.spec.ts` that drives two tabs and never reloads the first — it
  stamps `window` and checks the stamp survived, because a reload would pass whatever the store
  did. It was confirmed to fail on the old `if (!loaded)`.
- **Every tab line is laid out to the same width**, so a bar is the same length wherever it
  falls. A short last line ended up stretching its bars across the whole page, which read as
  longer than they were; it now ends early, and the tracks past its last bar are held open with
  no string line through them. A phrase that fits on one line has nothing to be consistent with
  and takes the full width as before. `slotColumns` in `TabStaff` is the count every line is
  laid out to; the playhead and the bar lines are positioned against it rather than against the
  line's own bars.

## Feedback round 4 — merged (2026-09-20)

Five things from living with the app. All merged to `main`; `pnpm check` is green, and each was
driven in the browser and looked at rather than only tested.

- **A routine item's count-in was already its own** — copied from the exercise when the item is
  added and written back to the item, never to the exercise. Checked end to end and pinned by a
  test in `PracticeSession.test.ts`: one exercise in a routine twice, counted in two bars and
  then half a bar, with the library's copy untouched. Nothing needed fixing. The one thing to
  know is that an item saved before the field existed has no `countInBars` and falls back to the
  app-wide setting until it is set once from the transport.
- **Restart puts the playhead back to the top while it counts in.** It used to sit wherever the
  abandoned pass fell apart, because the tick was only polled while `playing`. `usePhraseTick`
  now runs for as long as there is a playhead to draw — count-in and pause included — and the
  count-in draws the playhead at tick 0 outright, so there is no stale frame.
- **Space starts playback**, as well as pausing and resuming it: from an exercise's brief, from a
  routine's overview, and from a theory drill's. Enter still does what it did.
- **Up-then-down and down-then-up play the turning note twice.** Up the strings to 3, 5, 7 and
  straight back 7, 5, 3 — the turn is a change of picking direction on the same note, not a note
  to skip. Changed in all three places that turn a run round: `applyDirection` (scale runs and
  shape runs), `intervalRun` (the turning figure is answered by the same notes coming back), and
  position shifting's own up/down splice. Three golden files moved with it. `stringSweep` in
  `oneNotePerString` was left alone: it is a repeating cycle, not a direction axis, and its
  period arithmetic depends on the ends not repeating.
- **Clicking a note moves the playhead to it**, playing or paused, and playback carries on from
  there. `ExerciseRunner.seekTo` moves the clock within the pass; the count-in is not somewhere a
  click can land or skip past, and landing past the end lands on the last tick so the pass is
  played out rather than finished by the click. The whole grid cell is the target, not the digit,
  and the note buttons are deliberately out of the tab order: a phrase can run to hundreds of
  notes and tabbing through them to reach the transport would be worse than the shortcut is worth.
- **It works under a backing track too, with the track playing on.** YouTube cannot be dragged to
  the new position, so the exercise moves and the recording does not. That needed `TrackFollower`
  to hold an offset: it exists to haul the clock back into step with the video several times a
  second, so without re-anchoring it the click undid itself over the next few seconds.
  `reanchor()` takes where the clock is now as where it belongs and keeps the two that far apart,
  still correcting the drift that is its job. It runs down through `BackingController.reanchor`
  and an optional `reanchor?()` on `BackingSource` — only a source with a timeline of its own has
  anything to do. Verified against the real seeded YouTube track: the playhead stays where it was
  put and runs on from there at tempo.

`FakeClock.seek` was made positional to match Tone's transport — what lies ahead of the new
position is due again, what lies behind it is not. Without that, seeking back over a phrase
replayed its notes in the browser and not in tests.

**And the gallery flake it turned up, fixed.** `e2e/gallery.spec.ts` "returns to Play when a
phrase reaches its end" had been failing in a full `pnpm test:e2e` run and passing on its own —
on an unmodified tree too, so it predated the round. It was not a timing flake but a hole in the
test: it clicked Play and then waited for a Play button, which the click had not changed yet,
because `useTransport.play` is async (it loads Tone and starts the AudioContext). That wait was
answered 33 ms after the click rather than by the 2.7 s phrase ending, so the test went on to
"click Play again" while the first play was still starting — and under load that second click
landed just as the button became Pause, pausing instead of replaying. Hence a Resume button and
no playhead. The test now waits for the playhead before waiting for the phrase to end, and takes
the 3.6 s it always should have. Four full-suite runs and a `--repeat-each=4` pass.

Worth knowing for the dev gallery: `play()` shows nothing while it is starting, so its button can
be pressed again and start a second `play()`. That is dev-only — the practice transport has its
`starting` state for exactly this — but it is what made the test's hole reachable.

## The pause is over (2026-09-20)

After M7a the player paused to live with the app; that pause produced feedback rounds 1–3, the
architecture-review cleanup, and the ad investigation. **The pause is over and the next work is
agreed:** "Backing tracks — ads and the YouTube host" under "Remaining work", three tasks in the
order given, then M7b. The milestone gate still applies — build one task, verify it on the
deploy, report, and wait.

## Remaining work

Planned milestones in order; doc 08 has each task in full. Sizes: S, M, L.

**Cleanup — architecture review** (done, 2026-09-20; agreed 2026-09-17)
- All nine steps of `docs/review/ARCHITECTURE-REVIEW.md`'s work plan are reviewed and merged to
  `main`, in this order: 5 (A3+A5), 6 (A1+A4+A6+T1 — the new `src/session/` layer), 7 (A2 —
  `PassTiming`, `PlayedDefinition | TheoryDefinition`), 8 (T2–T4 — 785 unit tests → 670), 9
  (A7+S2), then the styling steps 1–4.
- Step 7 fixed a live bug: theory subject weights never reached `generate`, so the circle of
  fifths never leaned toward misses. Reviewed at the gate; a free-time routine item now plays
  every rep it asks for, one per Done, rather than a single pass.
- Step 8: 785 unit tests → 668 (15%, not the 25–30% the review aimed at — the rest are distinct
  behaviours, and the rule was to remove a test only when another would fail for the same bug).
  E2E db helpers now live in `e2e/helpers.ts`.
- **Fixed — an unplayable shape (2026-09-20).** `scaleShape(DROP_D_GUITAR, A lydian, startDegree
  4, minFret 1)` spanned sixteen frets: the low D string ran 1-2-4, and the next scale note sits
  below the open A string, so it jumped to fret 11. A shape now refuses an anchor whose next
  string the hand could only reach by leaving the shape behind — more than six frets from where
  it sits — and starts higher up the neck instead, which is the shape `minFret` 2 gave all along.
  `shapesUpTheNeck` skips an anchor whose shape had to start higher (the climb reaches it again at
  the fret it really starts on), `shapeFrom` reports the fret it landed on, and `horizontalRun`
  looks for a start where both routes fit — the way down shifts on other strings, so it can need a
  hand position the way up does not. The invariant test covers `minFret` 0 and 1 again.
- Step 9 (A7+S2): params come from each Zod schema's own `.default()`, `estimateRepSeconds` is
  optional for a played exercise, `AxisValues` types `axisValue` by axis id, briefs read from
  named consts, and `definedProps()` replaces stacked conditional spreads.
- A setting toggled and then reloaded straight away used to lose the write (`serialWrites` queued
  even the first write behind a microtask). Fixed, and the appearance and transport E2E tests now
  wait for the row to land before reloading.
- Styling steps 1–4: Prettier over the repo with `format:check` in `check`; `ToggleButton`,
  `SegmentedControl`, `PageHeader`/`PageIntro` and `LoadingState` in `components/ui`, with the
  filled-pill look keyed on `data-toggle` in `index.css`; a ten-step type scale in `theme.css`
  with lint refusing `text-[Npx]`; three muted inks (`ink-muted`/`faint`/`disabled`); and a
  palette the roles read, which cut the dark block from 78 declarations to 29.
- Checked on screen in both themes at each step (library, practice, fretboard, home, report,
  settings). Merged near-identical values as agreed — 10px into caption, 14 into body-sm, the
  progress track onto the rule colour, and so on.
- Locally `pnpm test:e2e` runs 5 workers with no retry and flakes (gallery replay, transport
  toggles, a theory question); each passes alone, and CI runs one worker with a retry.
- Step 6 changed two behaviors on purpose: a track now fits the tempo you are hearing in a
  routine too (it used to prefer the item's target), and leaving a track mid-routine restores
  the current item's tempo (it used to restore the first item's).
- Gate feedback (2026-09-18): a routine's track never started with its first item (YouTube's
  player was called before onReady) — fixed, and the E2E fake YouTube now loads only once
  mounted and throws before onReady, as the real one does. **Decided:** after a theory set the
  next played item starts its track from bar 1 — better after time away from the guitar.
- E2E runs against `vite preview` on :4173: **`pnpm build` first**, or it tests an old `dist/`
  (it did, once more, during step 6). The dev-gallery test "returns to Play when a phrase reaches
  its end" is flaky under full-suite load; unrelated to the cleanup.

**Backing tracks — ads and the YouTube host** (next; agreed 2026-09-20)

Three tasks, **in this order** — the order is deliberate, see task 2.

*Background: the investigation that produced these (2026-09-20).* A pre-roll ad began playing on
the first Play after each page load on the deployed site, and the app then wrongly announced that
the browser had blocked autoplay. What was established:

- **Not a regression.** `bede19f` (2026-09-17, before the `src/session/` refactor) was deployed to
  the same github.io origin and showed the same ads. The nine cleanup commits are cleared. The
  player's first instinct was that step 7 or 8 caused it; the diffs across the whole video and
  transport path over that range are Prettier reformatting plus an unrelated `definedProps`
  refactor, and `alignTrack`, `playFrom`, `PlayerSlot` and the playerVars are untouched.
- **The origin decides whether ads are served at all.** The same commit `4ac008a` served from
  `localhost` shows no ads; from `jrharmon.github.io` it does. Localhost embeds are not
  monetizable, so **local testing cannot reproduce ads — every check here happens on the deploy.**
  The player had been testing on localhost more than they realized, which is why it felt new.
- **Why ads reach the player at all.** The app embedded `youtube-nocookie.com`
  (`YouTubePlayer.ts`) at the time, which strips the viewer's YouTube session cookies. Task 2 has
  since moved it to `www.youtube.com`. The player therefore cannot see a signed-in
  Premium account and serves ads to an anonymous viewer. nocookie has been the host since M7a
  (`cc08352`, `64cdc42`, `629b5ed`) — it never changed. The player has Premium and sees no ads on
  youtube.com itself; that subscription simply never reaches the iframe.
- **Soundslice, for comparison.** A live slice (`soundslice.com/slices/wvbVc`) embeds
  `https://www.youtube.com/embed/<id>?controls=0&disablekb=1&html5=1&iv_load_policy=3`
  `&modestbranding=1&origin=https://www.soundslice.com&playsinline=1&rel=0&showinfo=0&enablejsapi=1`.
  Regular host → the viewer's Premium applies → no ads; `controls=0` → its own overlay transport.
  `modestbranding` and `showinfo` are deprecated and ignored by YouTube now — don't copy them.
- **Measured baseline.** With no ad, `playVideo()` reaches state `playing` in ~475–950 ms (probe
  against `WkIijba-HcU`, a 632 s track). `BLOCKED_AFTER_MS` is 2 500, so any ad overruns it.

**1. Support ads (M) — built 2026-09-20, at the gate.** Branch `backing-ads`, commit `04c7167`.
Not yet merged or deployed: ads only exist on the deploy, and only `main` deploys, so the
hands-on check needs a push — ask before making one.

**What the deploy actually reports during an advert.** Measured before any code was written, by
embedding `WkIijba-HcU` from the deployed page itself with the app's own host and playerVars, and
again afterwards by replaying the new logic against a live advert. Two adverts caught, one
unskippable pair of 31.4 s and one sponsored pair of 107 s whose second was labelled 2:35:

| | during the advert | when the track starts |
| --- | --- | --- |
| `getPlayerState()` | **`unstarted` (−1) throughout**, skippable or not | 3 → 1 |
| `onStateChange` | two events in the first 30 ms, then **silent for the whole advert** | fires 3, then 1 |
| `getCurrentTime()` | the **advert's** clock: leaves the seek target, runs up from 0, resets per advert | snaps back to the seek target |
| `getDuration()` | the **track's** length, unchanged | the track's length |

**Two of the three bugs did not exist, and the inferred signal was half wrong.**
`getDuration()` never reports the advert's duration — that half of the signal this task was
planned around is unusable. `getCurrentTime()` does, and is the whole basis of the fix.
And because an advert never reports `playing`, `playAndWait` never resolved on one: the clock
already followed the real track (measured starting at `currentTime` 30.12 against a seek to 30),
and `ExerciseSession.play` already held the count-in behind it. Bugs 1 and 3 as written were
inferences from the same wrong premise, not observed behaviour.

**What was actually wrong, and is now fixed.** The fixed 2.5 s `BLOCKED_AFTER_MS` fired during
every advert and announced "Your browser wants the first play to come from the video itself" —
for 105 of the 107 seconds, in the longer run.

- `StartWatch` (`src/domain/backing/startWatch.ts`, pure, unit-tested) reads the video every
  250 ms and says which silence this is. The time moving means something is playing; nothing
  moving at all means the browser is holding it back. Once the time has moved once it never says
  stalled again, so the gap between two back-to-back adverts cannot read as one.
- 1.5 s grace, then stalled after 2.5 s of no progress — so a genuinely blocked video asks for
  its click at 4.0 s. `BLOCKED_AFTER_MS`, `CLICK_WAIT_MS` and `PLAY_TIMEOUT_MS` are all gone;
  each was shorter than either advert measured.
- The one remaining ceiling counts from **the last sign of life**, not from the play. Counted
  from the play it would have dropped a healthy track: two unskipped 2:35 adverts run past five
  minutes.
- `isTrackTime` guards the other side — the defensive guard asked for at the gate. `playing`
  counts as the track only when the time reported with it is not short of where the video was
  sent. **Known limit, accepted when it was asked for:** it cannot draw that line when a track
  starts at 0, because then an advert's clock and the track's read alike; there it says yes,
  which is what the player did before. It is fail-open on purpose — a wrong no would hang the
  exercise, a wrong yes only costs what it cost before. The poll re-checks it behind the state
  event, so a reading that arrives late costs 250 ms rather than the whole wait.
- The panel says "An ad is playing. The exercise starts when the track does." A silent 30 s wait
  after Play reads as broken.

**Verified by replaying the shipped logic against a live 107 s advert on the deploy**: 423
`advert` verdicts, **zero** `stalled`, and the track accepted 84 ms after YouTube reported it, at
`currentTime` 30.1 against a seek to 30. `pnpm check` green (677 unit tests), all 7 backing E2E
green including the genuine blocked path.

**Still to check at the gate** — these need the deploy, so they wait on a push:
- The ad line in both themes, and that it replaces the false blocked message rather than joining it.
- A signed-out browser, for what a viewer without Premium gets.
- Safari/Firefox, that the genuine blocked path still asks for its click (now at 4.0 s, not 2.5 s).

**2. Switch the host to `www.youtube.com` (S) — built 2026-09-20, at the gate.**
Trade-off accepted by the player: YouTube sets cookies and logs viewing from the app; in exchange
a Premium viewer sees no adverts at all. The task 1 work **stays** — anyone without Premium still
gets adverts.

- **Two embeds, not the one this task named.** `YouTubePlayer.ts` is the backing player;
  `VideoEmbed.tsx` is the reference/lesson iframe, which was also on nocookie. Both switched, at
  the gate's direction: a lesson is watched end to end, so a Premium viewer should not sit through
  an advert to reach it, and one host is one thing to explain. `VideoEmbed`'s facade is untouched,
  so nothing third-party still loads until someone clicks.
- **Verified on the deploy before switching that task 1 survives the move.** The advert signal is
  identical on `www.youtube.com`: state stays `unstarted` throughout, and `getCurrentTime()`
  leaves the seek target and runs the advert's clock up from zero. `StartWatch` needed no change.
  This was the real risk in this task and it is cleared by measurement, not by argument.
- `src/domain/backing/youtube.ts` still **parses** nocookie links — a pasted nocookie URL must go
  on working. That is deliberate; do not "tidy" it.
- Docs updated: `06-AUDIO.md` decision 3 now records the switch and why, and both file headers
  explain the trade rather than arguing for nocookie.

**3. Disable YouTube's own controls (S) — DONE 2026-09-22, another way. Closed.**
Not by hiding the controls: **the exercise follows them instead.** Pausing on the video pauses the
exercise and playing there resumes it, which is what the task was for — the runner used to play on
over a silent video. `controls` stays 1, so YouTube's own play button is still there to click, and
the `needsClick` recovery below never became a problem to solve. The player asked for this as the
middle ground and called custom controls closed: ask again only if they come up.

*How it works.* `VideoBacking.onTransport` maps YouTube's `playing` and `paused` states — and
nothing else — onto the `BackingSource` interface; `BackingController` mirrors them into the
session's own `pause` and `resume`. Nothing decides anything on the way: the session already
ignores a state that is its own, so the app pausing the video cannot come back round as a second
pause, and only a disagreement between the two moves anything. States during a start (an advert's
among them) are left alone. Buffering, cueing and the end of the video are the follower's
business, not the transport's — it already holds the clock through a buffer. Covered by a session
scenario test and an E2E over the fake player, and checked by hand against real YouTube on
localhost: paused the video, the clock froze mid-bar and the transport offered Resume; played it,
the exercise carried on and the clock ran again.

**Still open, if it ever matters:** scrubbing YouTube's own progress bar moves the video out from
under the exercise. `reanchor` is the machinery for it. Nobody has asked.

*The rest of this section is what task 3 would have been, kept because it was measured rather
than guessed.* Everything below stays true — but do not start it without reading the `needsClick`
bullet, which is a reproduced failure, not a worry.

`YouTubePlayer.ts` passes `controls: 1` for the backing player, so YouTube's controls show.
Pausing on the video pauses the video but does **not** stop the exercise — the runner plays on.
Set `controls: 0` so only the app's transport drives playback, as Soundslice does. `disablekb: 1`
is already set. Two things to resolve while doing it:

- **Answered before task 2, while adverts were still reachable: Skip survives `controls: 0`.**
  Measured on the deploy with `host: www.youtube.com, controls: 0` — a skippable advert renders
  its "You can skip to video in 5" countdown and then its Skip button exactly as with
  `controls: 1`. `controls: 0` hides YouTube's transport, not the advert's own UI. This had to be
  settled first: once task 2 lands, the player's Premium means their own browser shows no adverts
  to test against, and the check needs a signed-out browser.
- `needsClick` recovery currently depends on the user pressing YouTube's own play button. With the
  controls gone that route disappears — either keep a way to click through, or make sure task 1's
  stall path no longer needs one. **This is now a live problem, not a theoretical one.** While
  testing the above, an advert was seen to stall with `getCurrentTime()` frozen on the seek target
  and `getPlayerState()` at `unstarted`; `playVideo()` is a **no-op during an advert**, so the API
  could not restart it. `StartWatch` correctly calls that stalled and asks for a click — and with
  `controls: 0` there is nothing to click. Resolve this before shipping task 3; an app-level
  "start the video" affordance over the iframe is the obvious candidate.
- The player must stay visible and **at least 200×200 px** (YouTube's ToS minimum; Soundslice
  enforces it with its own "YouTube requires videos to be at least this big" notice). Check the
  side column and the shrunk state.

**Verification for all three:** ads appear only on the deploy, so each task ends with a push and a
hands-on check on https://jrharmon.github.io/theoryPad/ — including in a signed-out browser, to
see what a viewer without Premium gets. Test track: `WkIijba-HcU`.

**Sounds — sampled instruments and drum metronomes** (✅ merged and pushed 2026-09-23; planned 2026-09-22)

**Sounds — how it went (2026-09-23).** A commit per task on `sounds`, each reviewed by the
player before the next began, then merged:

| # | Task | Commit | State |
| --- | --- | --- | --- |
| 1 | `scripts/fetch-samples.mjs`, samples, `CREDITS.md` | `d8b21c9` | ✅ reviewed |
| 2 | `SampledVoice`, voice slot, Settings → Sound Instrument row | `a74c573` | ✅ reviewed |
| 3 | `src/domain/drums/`, `DrumKit` | `790163f` | ✅ reviewed |
| 4 | Metronome voices, per-exercise choice, migration | `41b9798` | ✅ reviewed |
| 5 | Metronome menu, Settings row, `M`, E2E | `ff0bd0c` | ✅ reviewed |
| 6 | Gate: silent metronome fixed (`9e8286f`); beats as tab, louder kick (`b0a4e24`); renames; merged | — | ✅ merged |

What changed from the plan, in short (doc 12's Outcome sections have the reasons):
- **Picked by ear** on a scratch audition page: steel-string acoustic guitar **every
  semitone** (minor thirds sounded synthetic), acoustic bass, and a kit of `drum_heavy_kick`,
  `drum_snare_hard`, `drum_cymbal_closed/open`, `drum_cymbal_soft` (ride), `drum_splash_hard`
  (crash), `perc_snap` (stick). 2.86 MB. mp3 throughout — measured, no encoder padding.
- **No bass voice**: guitar tab reaches E6, the bass samples stop at G3. They wait for
  generated backing. The Instrument row is Synth · Piano · Guitar, **default guitar**; a v6
  migration moved everyone off the never-chosen `'synth'`.
- **The metronome runs one fixed grid** — a twelfth of a beat since the gate, for swing; a voice can be swapped mid-run (routine
  items each have their own), so the menu need not be disabled while playing.
- **Count-ins are fixed in code**: the click counts in on the stick, a drum beat on the open
  hat. **Off loads no samples**, so its count-in is the synth click (accepted by the player).
- **Only what the choice can play is downloaded**: Off nothing, Click the stick, a beat its
  drums plus the open hat and Simple's. A beat plays the click until its drums are in, or if
  they fail.
- Levels were set by offline RMS measurement (guitar +8 dB, piano −2 dB to match the synth;
  kit −12 dB with per-drum trims) — all still for the ear at the gate.

**Task 5, built** to the agreed brief — doc 12's "Task 5 — outcome" has it. Beyond the brief:
the menu shows what is *heard* (a 4/4 beat in 3/4 shows Simple, with a line saying why); a
routine's overview lost its metronome button, which only ever set the first item's; and the
Backing and Count-in menus' detail lines had been rendering at body size (`cn` dropped
`text-meta` against `text-ink-muted`) — all three menus now share `MenuOption`.

**The gate, first listen (2026-09-23)** — doc 12's "Gate — round 1" has it. The metronome was
silent on the real clock (fixed, `9e8286f`). Then: Simple's offbeat ride was inaudible
(raised), the kick too quiet (0 dB now, from −6 — it should be *heard*, merely allowed to
get buried now and then), and Upbeat, Soft and Heavy were too plain. Soft is gone; beats are
now drum tab in `src/domain/drums/beats.ts`, which the player means to tweak and add to:
Upbeat is straight-sixteenth jazz-funk, Swing its triplet cousin, Heavy is metal with gallops
and double-kick runs (the first two had their names swapped on the second listen). No new samples — the player's call — so swing's hi-hat foot is a soft closed hat.

**Second listen: "Everything seems a lot better"** — merged. Answered after the merge: guitar
stays the default, and the open-hat count-in works. Simple in 3/4 and 6/8 waits for the first
exercise in either signature — noted under M8.


**The full spec is `docs/plan/12-SOUNDS.md`. Read it before starting — the design choices below
were answered by the player and should not be reopened.** Six tasks, in order; sizes there.

Two changes that share a sample pipeline and a loading story:

- **The notes stop being a synth.** `SampledVoice` over `Tone.Sampler` — piano, guitar and bass,
  chosen in Settings -> Sound. `InstrumentVoice` was designed for this in M0 and no consumer
  changes. Polyphonic, so chords work; `PhrasePlayer` already schedules simultaneous notes.
- **The metronome becomes a choice of voice**: Off, Click, or one of four drum beats, from a
  popover in the transport like the Backing menu. Drums are *a metronome*, not a backing source
  — they do not own the tempo and do not replace the notes. Simple (ride on the eighths, kick on
  the quarters, snare every other beat from beat 2) fits any time signature and is always
  offered; Upbeat, Soft and Heavy declare 4/4 and are hidden elsewhere. A drum metronome counts
  in on an open hi-hat, not a click.

Settled when it was planned: samples are **vendored under `public/samples/v1/`**, not fetched
from a CDN — the app is local-first and M9.1 makes it a PWA. Sources are verified and their
licences checked: Salamander piano and FluidR3_GM guitar/bass are **CC-BY 3.0** and need
attribution shipped with them; the Sonic Pi drum samples are **CC0**. Budget 3 MB total. The
metronome choice lives **per exercise with the global setting as fallback**, exactly as
`countInBars` does.

**This is deliberately before M7b.** M7b's plan made mode and progression drills wait on
"whether maj7 vs dom7 is audible on the synth — the trigger for sampled instruments". Doing this
first removes the question rather than answering it.

**The gate needs a guitar** — levels, whether each beat earns its place, and the default voice.
Note that the old click's 2 kHz reasoning does **not** carry over to the kit: the snare and ride
are high and cut through on their own, and the kick is there for feel rather than timekeeping.

**Generated backing** (✅ merged and pushed 2026-09-25; agreed 2026-09-23)
- **The gate (2026-09-25):** the player listened and everything sounds good — levels, Pulse /
  Strum / Swing, voicings, the restart at every pass, 7ths by default; the chord lane at the
  tab's label size is fine for now, and the improv strip helps. Spelling checked by looking in
  E♭ Dorian and F♯ Dorian (F♯ Lydian is written G♭ Lydian by the key axis, as everywhere).
  Fast-forwarded into `main` and pushed with the Sounds gate's closing commit; the branch is
  deleted. The notes below are the run's history.
- **Where it stands (2026-09-24).** Branch `generated-backing`, over `main`: the plan
  (`c733492`), task 1 (`2d1087f`), task 2 (`3645f72`), task 3 (`54b3f2f`), task 3's review fix
  (`19c7b77`), a STATUS note (`b8eda8d`), task 4 (`3a2e40c`) and **task 5 (showing the
  chords)**, the latest commit. Not merged, not pushed. `main` itself is one commit ahead of
  `origin` (`4672906`, closing the Sounds gate's open questions), also unpushed — the gate pushes
  both. 735 unit tests in 55 files, 69 E2E, `pnpm check` and the full E2E green at task 5.
- **Done:** pure progressions (`src/domain/backing/generated/`: types, `pickProgression`,
  custom-text parse/format, `chordTimeline`); pure rendering (`compTab`, `comps.ts`,
  `voiceChord`, `renderPass`); sound (`src/audio/GeneratedBacking.ts`, `BASS_PRESET`,
  `AudioPort.generated`, the `generated` choice, the session handing it every pass, per-item
  settings in routines, the Backing-menu entry naming the roll's pick). Heard by the player:
  **levels are right** (8 dB under the notes).
- **Task 3's review** (doc 13, "Task 3 — review"): chords struck once a bar died away on the
  trimmed samples, and there was no dynamics. The patterns were rewritten — **Pulse** (default),
  **Strum**, **Swing** — each striking the chord more than once a beat, with a ghost level `g`
  in the piano line. **These await the player's listen**; take it at task 4's review.
- **Task 4 — settings (done, approved 2026-09-24; doc 13 "Task 4 — outcome").** Saved on the
  exercise and on each routine item (`resolveGeneratedBacking`: the row's, the definition's, the
  default). One component, `GeneratedBackingEditor`, on the config page, in the practice settings
  dialog and in a routine item's Edit: source, custom lines (saved only when every line parses),
  style, 7ths/triads. Chords are spelled in the roll's key in the practice dialog, roman numerals
  elsewhere. A change re-picks only the progression (`replanGenerated`). *Improvise to a
  target* now defaults to Custom `1 4 5 1` · `2 5 1*2` · `1 6 4 1`, Pulse, 7ths — each ends on
  the tonic, so a 4-bar phrase lands over i. **Take at the review:** the Pulse/Strum/Swing
  listen carried from task 3 (Swing is reachable now), and those three lists.
- **Task 5 — showing the chords (done, awaiting review; doc 13 "Task 5 — outcome").**
  `SessionState.chords`; a chord lane over the tab (symbol where each chord starts, carried ones
  in parentheses, the one under the playhead highlighted on its line); an "Over the chords"
  strip in the improv counter. **Open for the review:** the lane is at the tab's label size
  (11px) as specified and doesn't grow with the tab size — small next to the digits at the
  largest size; scaling it with the tab is a one-line change.
- **Next, task 6 — the gate:** levels, patterns and voicings by ear; the lane's readability
  while playing; fixes; merge `main` and `generated-backing`, push both.
- Six tasks on branch `generated-backing`, a commit and a player review each — **read
  `docs/plan/13-GENERATED-BACKING.md` first**; its "Decisions already taken" were answered by
  the player and should not be reopened.
- In short: "Generated" in the Backing menu plays sampled bass and piano chords **under** the
  notes (like the drone; drums stay the metronome's). The progression is scale degrees — vamp
  on 1, the mode's go-to progressions, or custom lists — picked from the roll's seed, restarted
  every pass. Chords always show: a lane over the tab, a strip in the improv counter, the current
  one highlighted. Routines play each item's own progression.

**M7b — Ear training and "hear it"** (after generated backing)
- 7.8 `ear-training` (L) — interval, scale degree, chord quality first. Already decided: the
  drill is an axis (fixed / hold / roll); intervals rise by default, falling and harmonic as
  settings; the answer grid shows the whole level (1: m3 M3 P4 P5 P8; 2 adds M2 m6 M6 m7; 3:
  all twelve); a wrong answer offers "hear yours" and "hear the right one"; lean toward misses.
- 7.9 `PreviewPlayer` (S) — "hear it" for a phrase, a chord, a scale.
- Mode and progression drills follow, once the gate answers whether maj7 vs dom7 is audible on
  the synth — the trigger for sampled instruments.

**M8 — The rest of the catalog** (all thirteen exercises)
- **The first exercise in 3/4 or 6/8 gets Simple checked by ear** at its gate — whether the
  generated beat works there or wants a hand-written one in `beats.ts`. Nothing in the app is
  in either signature yet, so it has never been heard (Sounds, 2026-09-23).
- 8.1 ladder tempo plans, pick-stroke marks, articulation audio (M) · 8.2 speed picking (S) ·
  8.3 legato (S) · 8.4 `remapToStringSet` + string skipping (M) · 8.5 triad shapes, R/3/5/7
  labels, triads & arpeggios (M) · 8.6 clickable `FretboardInput` + note finding (M) · 8.7
  CAGED/positional shapes as a `shapeSystem` option (M).
- Ask first: the player plays 3nps, not CAGED — is 8.7 wanted at all?

**M9 — Polish**
- 9.1 PWA: offline, icons, install, backing saying plainly it needs a connection (M) · 9.2
  post-session summary with "adopt as target" (M) · 9.3 "roll a routine from my gaps" (M) ·
  9.4 tablet layout, type for reading at distance (M) · 9.5 empty states, first-run starter
  routine, error boundaries (M) · 9.6 accessibility and keyboard audit (S) · 9.7 tuning
  presets (DADGAD…), capo, left-handed (M).

**M10 — Optional sync** — only if wanted after living with export/import (doc 07).

**Parked — in no milestone yet**
- Custom transport over the video (`controls: 0`) — **closed 2026-09-22**, and closed by the
  player, not deferred: following YouTube's controls gave them everything they wanted. The
  research is still recorded under task 3 if it is ever reopened. Scrubbing the video's own
  progress bar still moves it out from under the exercise; nobody has asked.
- Sync markers (a tempo map) on a track, to align the playhead — the player wants it eventually.
- Moving the player's tracks into a static data file shipped with the app, merged by id (doc 06).
- ~~Generated backing — deferred past M9.~~ **Promoted 2026-09-23** to "Generated backing"
  above. See `docs/plan/13-GENERATED-BACKING.md`.
- ~~Sampled instruments — decided by the M7b gate.~~ **Promoted 2026-09-22** to the
  "Sounds" run above, with drum metronomes alongside it. See `docs/plan/12-SOUNDS.md`.
- M7a leftovers, ask whether wanted: a criteria editor for routines; reference videos on a theory
  exercise's practice screen; a free-time toggle in the transport; one video player kept alive
  through a whole routine (only if Safari's "Press play on the video" prompt gets tiresome).

## Open questions for the player

**Left from M7a:**
- "Improvise to a target" had not been tried when M7a merged — ask how it went.
- "Set to now" was reported flaky; it could not be reproduced after the time display moved to
  hundredths. If it recurs, get the browser and what was done just before.
- Which browser the player uses — Safari may still ask for a press of the video's play button
  once per exercise, and at a routine's start and after each theory set.

Later, if it starts to matter: in dark, the explorer's heaviest heat shades toward chalk, and
the white root dots there rely on their ring (fine for now, per the restyle review).

These need a guitar:
- 35 bpm for one-note-per-string.
- Where position-shifting's slide falls.
- 3rds in 3nps shapes.
- The arpeggio inside each shape.
- Whether the seven shapes flow up the neck.
- Whether one bar of count-in is enough between routine items at a big tempo change.
- Whether "Stay on this" feels right mid-routine.

## Decisions, newest first

**Sounds run (2026-09-22/23)** — doc 12's Outcome sections have the detail
- Guitar samples every semitone; piano and bass every minor third. Steel acoustic guitar and
  acoustic bass over the electric ones. mp3 for everything.
- No bass voice for the notes; default instrument guitar, migrated once.
- The kit's count-ins are code, not a setting: stick for the click, open hat for a beat.
- Load only what the chosen metronome can play; Off loads nothing and counts in on the synth
  click. A missing kit plays the click, never silence.
- Metronome voices swap mid-run on a fixed grid; the menu stays usable while playing.
- A routine's overview has no metronome menu: each item's is its own, set while it plays.
- Guitar is the default instrument; the open hat is the drum count-in. Both confirmed by ear.
- Beats beyond Simple are drum tab in `beats.ts`, for the player to tweak. Soft dropped; Upbeat
  (straight, jazz-funk), Swing and Heavy (metal). No new samples. The kick is heard, not felt.

**Feedback round 3**
- Between routine items the count-in is the next item's own, however short — no floor.
- A loading state for a starting track is noise; the transport just looks like it is playing.
- One button hides the whole info column; the per-panel minimizes handle one at a time.

**Feedback round 2**
- The count-in is per exercise (and per routine item), set from the transport, not app-wide.
- A minimized side panel shrinks to its title in place; it never disappears on you.
- Transport verbs are icons; only theory's Start / Again keeps its words.

**Feedback round 1** (see above for what was built)
- A struck-out key or mode only stops a roll; anything chosen on purpose still plays.
- String sets are all strings unless an exercise or the player says otherwise; an exercise can
  limit an axis outright with `allowedValues`.
- Stop inside the count-in logs nothing: restarting a few times leaves no trail.

**M7a review, second pass**
- 75% fine; timing good enough for now — **sync markers** to align the playhead come later.
- Tapping works well but was awkward: the first press (or T) now starts the video, T works
  without clicking first, and there is Start over. Times show to the hundredth, so ±0.05 s
  nudges exactly (they had rounded to tenths: −0.05 did nothing, +0.05 jumped 0.1).
- The drone's level is right. A theory set stopping a routine's track is right.

**M7a review, first pass**
- 75% works fine; the drone helps — and should keep the synth notes, so it plays under them.
- Play with a track sat on "Starting the track…" and fell back to the notes in the player's
  browser: the video's play went out after awaits, outside the click. Now it goes out inside
  it, and a browser that still holds it back gets asked for one press of the video's play.

**Start of M7** (doc 06 has the design, doc 08 the tasks)
- Split into M7a (backing, reference videos, free improv) and M7b (ear training, hear it).
- One video table, two scopes: shared tracks (key, mode, bpm; matched exactly) and an
  exercise's own videos, with a play-along switch — off makes it a reference video. No
  built-in flag: every video is equal; later they move into a static data file, merged by id.
- Nothing is chosen automatically. The default stays the synth notes with the metronome; a
  track or the drone replaces the notes, a track mutes the metronome. The choice is remembered.
- Speed follows the exercise's tempo in 5% steps (YouTube accepts 0.25–2 by 0.05 — tested).
  Routines: one track through, its speed changing per item; theory items pause it.
- Bar 1 is set by tapping along; the count-in plays over the intro; the clock follows the video.
- The right column stays open while a video is on; videos can be enlarged.

**Restyle review**
- Unmocked screens, the tab and the playhead approved. Graph paper dropped. Muted text at 64%.

**Start of the restyle** (doc 11 has all of it)
- Notebook, in light and dark; an Appearance setting (System / Light / Dark, default System);
  styling only otherwise, existing E2E tests untouched.
- The exported report is always light. Errors use the destructive red, not the new blue.

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
back. **Screenshot in both themes** — a context with `colorScheme: 'dark'`:
- Symlink the project's `node_modules` into the scratchpad so the import resolves.
- Scripts must not live in the repo root, or lint picks them up.
- A fresh browser has an empty IndexedDB, so navigate by exercise name through the library,
  not by stored ids.
- Wait for the thing you want. `play()` awaits the audio engine, so the screen changes a
  moment after the click.
- **Deterministic screenshots**, for before/after pixel diffs: `page.clock.setFixedTime(…)`
  (rolls seed from `Date.now()`) and an init script making `crypto.randomUUID` a counter kept in
  localStorage (exercise ids feed the seeds and the order). Then only where playback pauses
  varies between runs. Compare in a page canvas — no image library needed.
- **Seeding practice history:** against the dev server, `page.evaluate` can
  `await import('/src/data/index.ts')` and write reps through `createRepositories(db())` — the
  rollup and stats update as they would in use. A few weeks of plausible reps is enough to
  look at the heatmap, report and explorer. For the real write path, raise the tempo
  (Shift+] repeatedly) and play one pass of Position shifting — about 40 s.

- **Probing app state from a script:** on a dev server that has hot-reloaded, the app imports
  changed modules with a `?t=` suffix, so a bare `await import('/src/store/practice.ts')` gets a
  *second, empty copy* of the store — calls go nowhere and reads come back as defaults. Drive
  the UI, or read and write IndexedDB directly (`e2e/helpers.ts`' `readStore` shows how).
- **Audio levels without ears:** render through `Tone.Offline` in the page and compare RMS and
  peak (Sounds tasks 2 and 3 did this for voices and the kit). Tone is at
  `node_modules/.vite/deps/tone.js` — find the exact URL in `performance.getEntriesByType`.

## Things that bit, and would bite again

- **Autoplay passed every test and failed in the player's browser.** The screenshots ran
  Chromium with `--autoplay-policy=no-user-gesture-required`, which hid that Safari and
  Firefox only start a video with sound inside the click. Never pass that flag when checking
  playback; the E2E fake YouTube has a `blocking` mode for the strict case.

- **The metronome was silent on the real clock, and every test passed.** `ToneClock`'s
  repeats handed back `transport.ticks` — where the transport is when Tone runs the callback,
  up to a lookahead early — not the tick the step was due on. Task 4's grid keeps a step only
  if `tickInBar % gridTicks === 0`, so almost nothing sounded: no count-in, no click, no drums.
  `FakeClock` passes exact ticks, so no unit test could see it; the player heard it. A repeat
  now gets its own grid tick, snapped from `getTicksAtTime(time)`. To check the metronome
  without ears, wrap the engine's `clickSink.click` and `kit.play` in the page and count calls,
  and hang a `Tone.Meter` on the destination (patching `AudioScheduledSourceNode.start` sees
  nothing — Tone's nodes go around it).
- **Moving an iframe in the DOM reloads it.** A YouTube player's node is mounted once
  (`PlayerSlot`) and enlarged by restyling its panel in place. That is also why a routine can't
  carry the overview's player into the running screen, and why a theory set rebuilds it.
- **A runner emit re-enters the store.** `runner.setTempo` emits a snapshot synchronously, and
  the practice store's subscriber refreshes the backing — which set the tempo. Commit state
  before touching the runner (and `refreshBacking` has a re-entry guard). Likewise, never pause
  a runner from inside its own emit: it is mid-`beginPass` and starts the clock after you.
- **Probing the dev server's stores after an HMR edit.** Vite then serves a module as
  `…/practice.ts?t=…`; importing the bare path gets a second, empty store. Import the URL from
  `performance.getEntriesByType('resource')`.
- **The router is a hash router**: screenshot `http://localhost:5173/#/settings`, not `/settings`.
- **`erasableSyntaxOnly` and `exactOptionalPropertyTypes`**: no constructor parameter
  properties; optional fields can't be set to `undefined` (fixtures build without the key).
- **`FakeClock.advanceSeconds` rounds each step to whole ticks**, which swallows small tempo
  nudges; the follower's tests carry the fraction.

- **A stale `vite preview` on :4173 made E2E test yesterday's build.** Playwright reuses a
  running server, and `vite preview` serves whatever is in `dist/`. Three restyle commits "passed"
  E2E against M6 code before this was noticed. **Run `pnpm build` before `pnpm test:e2e`** if a
  preview might be running (`lsof -iTCP:4173`).
- **Tailwind orders utilities by their properties**, not by where they are declared. Adding a
  `font-family` to `.kicker` sorted it ahead of `text-sm`, which then won on shadcn `Label`s. The
  kicker's face is set in `@layer base` instead.
- **shadcn's `accent` is not ours.** Its classes say `bg-accent` meaning a subtle tint; here that
  is the brand color. Ghost/outline hovers and a Select's focused item are pointed back at the
  tint by unlayered rules in `index.css`.

- **Escape in a popover or drawer left the exercise.** Radix closes it during the keydown
  dispatch; React re-renders synchronously, the hotkey effect re-attaches its window listener,
  and the same event reaches it. `useRunnerHotkeys` now ignores keys whose target is inside a
  dialog or popover — don't rely on `enabled` alone for that.
- **`Date.now()` in render fails lint** (`react-hooks/purity`). Stores keep a `today` set on
  load; screens read it.

- **Two E2E tests flake under parallel load** (seen 2026-09-16, twice in ~6 full runs):
  `appearance.spec` "stays dark from the first paint after a reload" and `gallery.spec`
  "returns to Play when a phrase reaches its end". Both reload or wait on audio timing; both
  pass on their own and on a re-run. If CI is red on one of these, re-run before digging.

- **CI was red for three pushes once.** The ESLint-boundaries test builds a TypeScript program
  and took over 5 s on the CI runner; it now has a 30 s timeout. Checking CI after a push is the
  player's call, not something to do unasked — `pnpm check` and the E2E are run before pushing,
  so the run is a duplicate of what has already passed. **If asked to check it**: the API gives
  run status without credentials, and failure messages are on the check-run's `annotations`
  endpoint (there is no `gh` CLI on this machine).
- **Playwright's web server can time out locally** (`pnpm build && pnpm preview` on :4173). If
  it does, start `pnpm preview --port 4173` yourself; the config reuses a running server. And
  never chain `;` after a test run in a command that also merges or pushes.
- **ESLint flat config: the last matching block wins a rule outright.** That is why
  `test/eslint-boundaries.test.ts` exists.
- **Tailwind layering.** A `@layer components` or `@layer base` rule loses to a utility.
  `.kicker` is an `@utility`; the `data-slot` overrides in `index.css` are unlayered. The shared
  `Input`'s text size wins over a heading class — use a plain `<input>` for big inline fields.
- **`cn` drops `text-meta` when a color follows it.** It reads both as `text-*` of one group
  and keeps the last, so `cn('text-meta', 'text-ink-muted')` renders at body size. Combine a
  size token with a conditional color in a template string, as `MenuOption` does.
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
