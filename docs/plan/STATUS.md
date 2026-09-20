# Status — start here

**Last updated:** 2026-09-20. **Feedback round 4 is built and waiting at its gate** — five
transport and generator fixes from another session with the app in hand, listed under "Feedback
round 4" below. Before that, "Backing tracks — ads and the YouTube host" finished as far as it is
going: tasks 1 and 2 are merged and live, and task 3 (turning off YouTube's controls) is **parked
at the player's call** — the gain was cosmetic and it had turned up a reproduced failure. **M7b is
next once round 4 is merged.** The ad task corrected the advert signal that whole run was planned
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
| Backing tracks — ads and the YouTube host | tasks 1–2 ✅ merged, live; task 3 **parked** by choice — see below |
| Feedback round 4 — transport and turning notes | built, **at its gate** — see below |
| M7b — Ear training and "hear it" | **next**, after round 4 — see "Remaining work" |
| M8 — Rest of the catalog · M9 — Polish · M10 — Optional sync | not started |

M5 was deliberately built before M4. Everything is on `main`, and every merged branch has been
deleted — `main` is the only branch, local and origin in sync at `4ac008a`. 670 unit tests in 46
files, 57 E2E, `pnpm check` green.

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
| `src/data/` | Dexie (schema v4: exercises, routines, sessions, reps, exerciseStats, practiceDays, settings), repositories (Dexie, tested over `fake-indexeddb`; reached through `repos()`), stats, `transfer.ts` (export/import). |
| `src/session/` | Framework-free `PracticeSession` (`ExerciseSession`, `RoutineSession`): runner, sound routing, saves; `BackingController` (choice → source, track/runner tempo hand-off). Injected `AudioPort` + repositories; scenario-tested over `FakeClock` and `fake-indexeddb`. Imports audio as types only (lint-enforced). |
| `src/store/` | Zustand: `practice` (a thin adapter holding one `PracticeSession` and mirroring its state), `exercises`, `routines`, `settings`, `progress` (days, today, last key/mode), `report`, `keyModeView` (the practice screen's reference open state). |
| `src/routes/` | Screens: `home` (practice strip + routines), `routines` (builder), `exercises` (library, config), `practice` (exercise, routine, theory, settings dialog), `report` (page, model, export), `fretboard` (explorer, key × mode grid), `settings`, `dev/gallery`. |
| `src/components/` | `music` (Fretboard with a heat layer, TabStaff, KeyModeView, KeyModeTrigger), `charts` (HeatmapGrid, DayBarChart), `theory`, `variation` (AxisPolicyEditor), `ui` (shadcn incl. popover and sheet, + our own). |
| `src/styles/` | `theme.css`: every token, light values in `@theme`, dark ones under `:root[data-theme="dark"]`, and the shadcn mapping. `index.css`: base type, the `kicker` / `face-title` / `num` / `bg-graph` / `sheet` / `highlight` utilities, and the unlayered `data-slot` overrides. |
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
  - Metronome, Count-in and Loop toggles
  - a settings dialog
  - tab size (`-` / `=`) and bar lines
  - the neck trimmed to the frets in use, or hidden.
- **Settings**: tuning (standard, drop D, 7-string), sound, display (appearance, neck, tab size),
  and Export / Import (merge or replace, with a summary first).
- **Keys**:
  - Space: pause
  - Enter: play or start; mid-pass, restart from the top (in a routine too)
  - Backspace: stop, back to the top
  - `[` `]`: tempo — under a track, one 5% speed step
  - T: tap along, in the track form
  - R: re-roll
  - M: metronome
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

## Feedback round 4 — at its gate (2026-09-20)

Five things from another session with the app in hand. All five are on `feedback-round-4`,
`pnpm check` is green, and each was driven in the browser and looked at rather than only tested.

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
  played out rather than finished by the click. **Under a backing track the click does nothing** —
  YouTube cannot be dragged along in step, so the two would drift. The whole grid cell is the
  target, not the digit, and the note buttons are deliberately out of the tab order: a phrase can
  run to hundreds of notes and tabbing through them to reach the transport would be worse than
  the shortcut is worth.

`FakeClock.seek` was made positional to match Tone's transport — what lies ahead of the new
position is due again, what lies behind it is not. Without that, seeking back over a phrase
replayed its notes in the browser and not in tests.

**Known, and not from this round:** `e2e/gallery.spec.ts` "returns to Play when a phrase reaches
its end" fails in a full `pnpm test:e2e` run and passes on its own. It does the same on an
unmodified tree, so it is a pre-existing flake in the dev gallery, not a regression.

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
- **Found, not fixed — an unplayable shape.** `scaleShape(DROP_D_GUITAR, A lydian, startDegree 4,
  minFret 1)` spans sixteen frets: the low D string runs 1-2-4, and the next scale note is below
  the open A string, so it jumps to fret 11. With `minFret` 2 or more the same shape is fine. The
  invariant test's `minFret` loop starts at 3 because of it.
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

**3. Disable YouTube's own controls (S) — PARKED 2026-09-20, at the player's call.**
Not wanted for now: the gain is cosmetic and the risk is not. Everything below stays true and
researched, so picking it up later starts from measurements rather than from scratch — but do not
start it without reading the `needsClick` bullet, which is a reproduced failure, not a worry.

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

**M7b — Ear training and "hear it"** (after the ad work)
- 7.8 `ear-training` (L) — interval, scale degree, chord quality first. Already decided: the
  drill is an axis (fixed / hold / roll); intervals rise by default, falling and harmonic as
  settings; the answer grid shows the whole level (1: m3 M3 P4 P5 P8; 2 adds M2 m6 M6 m7; 3:
  all twelve); a wrong answer offers "hear yours" and "hear the right one"; lean toward misses.
- 7.9 `PreviewPlayer` (S) — "hear it" for a phrase, a chord, a scale.
- Mode and progression drills follow, once the gate answers whether maj7 vs dom7 is audible on
  the synth — the trigger for sampled instruments.

**M8 — The rest of the catalog** (all thirteen exercises)
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
- Turning off YouTube's own controls (`controls: 0`) — task 3 above, parked 2026-09-20. The
  research is done and recorded there; the blocker is that an advert can stall in a state only
  YouTube's own controls can clear.
- Sync markers (a tempo map) on a track, to align the playhead — the player wants it eventually.
- Moving the player's tracks into a static data file shipped with the app, merged by id (doc 06).
- Generated backing — deferred past M9; 75% on a real track was fine, so likely unneeded.
- Sampled instruments — decided by the M7b gate.
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

## Things that bit, and would bite again

- **Autoplay passed every test and failed in the player's browser.** The screenshots ran
  Chromium with `--autoplay-policy=no-user-gesture-required`, which hid that Safari and
  Firefox only start a video with sound inside the click. Never pass that flag when checking
  playback; the E2E fake YouTube has a `blocking` mode for the strict case.

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
  `.kicker` is an `@utility`; the `data-slot` overrides in `index.css` are unlayered. The shared
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
