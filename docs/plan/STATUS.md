# Status — start here

**Last updated:** 2026-09-13, **M7a built on `m7-audio` and at the gate** — not merged, not
pushed. Written as a hand-off: a fresh session should be able to take the M7a review, or start
M7b after it, from this file, `CLAUDE.md`, and the plan docs it points to.

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
| **M7a — Backing tracks, reference videos, free improv** | **at the gate** on `m7-audio` — review, then merge |
| M7b — Ear training and "hear it" | after M7a's review |
| M8 — Rest of the catalog · M9 — Polish · M10 — Optional sync | not started |

M5 was deliberately built before M4. `main` has everything to the restyle; M7a is ten commits
on `m7-audio` (the plan, then 7.1–7.7, then its E2E). 785 unit tests, 56 E2E, `pnpm check` green.
After the review: fast-forward `main` to `m7-audio`, push, check CI and the deploy.

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
| `src/styles/` | `theme.css`: every token, light values in `@theme`, dark ones under `:root[data-theme="dark"]`, and the shadcn mapping. `index.css`: base type, the `kicker` / `face-title` / `num` / `bg-graph` / `sheet` / `highlight` utilities, and the unlayered `data-slot` overrides. |
| `src/domain/backing/` | Pure backing maths: speed in 5% steps, the clock↔video timeline (`alignTrack`, `tickAtVideoTime`, `followFactor`), YouTube link and time parsing, tap-along tempo, the drone's notes. |
| `src/audio/backing/` | `YouTubePlayer` (IFrame API, loaded on first use, youtube-nocookie), `VideoBacking`, `TrackFollower` (the clock follows the video), `clickAlong`. `src/audio/Drone.ts` is the drone. |
| `src/data/videos.ts` | Matching tracks to a key (exact, spelling-blind) with saved criteria, a remembered choice, coverage, validation. `src/data/seed/videos.ts` is the first-run track. |
| `src/store/` (M7) | `videos` (the table), `backing` (the backing state's shape); `practice` holds the chosen backing and its live source. |
| `src/components/media/` | `PlayerSlot` (mounts a player's node once — moving an iframe reloads it), `VideoEmbed` (thumbnail until clicked), `useEnlarge`/`EnlargeScrim`. |
| `src/app/appearance.ts` | The Appearance setting → `<html data-theme>`: `resolveTheme`, `applyAppearance`, `useAppearance` (AppShell). `index.html`'s inline script does the same before first paint from a localStorage mirror. |

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
  - Enter: play or start
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

## Next: the M7a review, then M7b

Review M7a hands-on (the questions below), fold in what it says, merge, push, check CI. Then
M7b — doc 08 has it, with the decisions already taken: `ear-training` (interval, scale degree,
chord quality first; the drill is an axis; level 1/2/3 option sets; "hear yours" and "hear the
right one"; lean toward misses) and `PreviewPlayer` ("hear it" for a phrase, a chord, a scale).
Ask the player first about anything not already decided there.

## Open questions for the player

**At the M7a gate** — only the player can judge these:
- Is 75% (and lower) musically usable, or does it sound wrong enough to want a click instead?
- Does the tab stay with the track after the count-in, through a pause, across routine items?
  (Measured at ±15 ms in the browser; the ear is the real test.)
- Is tapping along a good enough way to set bar 1 and the bpm? Does Check with a click prove it?
- Does the drone help, and is it too loud or too dull?
- Does "Improvise to a target" read from the guitar; is the last bar the right moment for yellow?
- A theory set in a routine stops the track and the next item restarts it from bar 1 — right?
- Not built, ask whether wanted: a criteria editor for routines; reference videos on theory
  exercises' practice screen; a free-time toggle in the transport.

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
