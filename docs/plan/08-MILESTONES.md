# 08 — Milestones

Eleven milestones. Each ends in something you can **look at and judge**, and each is a review
gate — we stop, you try it, we adjust the plan before the next one starts. That is the
alignment mechanism you asked for, and it is also what keeps token spend down: course
corrections happen at milestone boundaries, not after 3,000 lines have been written on a wrong
assumption.

Each milestone lists its tasks as the units an agent gets handed. One task ≈ one agent
session. **Definition of done for every task: `pnpm check` is green and the milestone's
verification steps pass.**

Effort labels: **S** ≈ one focused agent session · **M** ≈ a substantial one · **L** ≈ should
probably be split if it grows.

---

## M0 — Foundations & rails ✅ *complete (2026-09-08)*

_Nothing musical. Get the machine running so every later task is cheap._

| #   | Task                                                                                              | Size |
| --- | ------------------------------------------------------------------------------------------------- | ---- |
| 0.1 | Scaffold: Vite + React 19 + TS strict, pnpm, path alias `@/`, `.gitignore`, initial commit        | S    |
| 0.2 | Tailwind v4 + shadcn/ui init; `styles/theme.css` with the Modernist tokens; radius 0; Archivo     | S    |
| 0.3 | ESLint 9 flat config + Prettier + the import-boundary rules from doc 01                           | S    |
| 0.4 | Vitest + RTL + jsdom setup; Playwright setup; `pnpm check` script                                 | S    |
| 0.5 | GitHub Actions: CI (`check` + `build`) and Pages deploy                                           | S    |
| 0.6 | App shell: hash router, `AppShell` with nav header, placeholder routes for every screen in doc 05 | S    |
| 0.7 | `CLAUDE.md` at repo root (see doc 09)                                                             | S    |

**Deliverable:** an empty but correctly-wired app with navigation, deployed to GitHub Pages.

**Verify:** `pnpm dev` runs; nav works; `pnpm check` green; CI green; the Pages URL loads.

**Outcome.** `pnpm check`, `pnpm build` and `pnpm test:e2e` all green; 15 unit tests, 2 E2E.
Two things worth carrying forward:

- **TypeScript pinned to 6.0.3** — typescript-eslint has no TS 7 support yet. See doc 01.
- **The ESLint layer boundaries silently did not fire on the first attempt.** In flat config,
  the last matching block wins a rule outright rather than merging, so four overlapping
  `no-restricted-imports` blocks left only the last one in effect. Task 0.8 was added: a test
  that lints on-disk fixtures and asserts every boundary still fires. Worth remembering the
  general lesson — a guard rail nobody tests is not a guard rail.

---

## M1 — Music domain & rendering primitives ✅ *complete (2026-09-09)*

_The hardest, most bug-prone layer, built first and tested hard. Also the most motivating —
it ends with sound and a moving playhead._

| #   | Task                                                                                                                                                                                                                                                            | Size |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 1.1 | `domain/music/`: the tonal wrapper — scales, degrees, diatonic chords, key signatures, transposition, signature degree. **Table-driven tests over all 12 tonics × 7 modes.**                                                                                    | M    |
| 1.2 | `domain/instrument/`: Instrument model, `noteAt`, `positionsOf`, `scaleOnNeck`, position windows, string sets. **3-note-per-string shape table only** — CAGED/positional deferred. Fixtures for standard, drop D and 7-string; all tests run against all three. | M    |
| 1.3 | `domain/phrase/`: tick model, `Phrase`/`TabNote`, the phrase builder, bar/beat conversion, rhythm application. Tests.                                                                                                                                           | M    |
| 1.4 | `<Fretboard />` — both sizes, all label modes, role colouring. RTL tests.                                                                                                                                                                                       | M    |
| 1.5 | `<TabStaff />` — grid derivation from a phrase, articulation glyphs, bar labels, playhead overlay. RTL tests.                                                                                                                                                   | M    |
| 1.6 | `audio/`: `Clock` interface, `ToneClock`, `FakeClock`, `AudioEngine` skeleton, `Metronome`, `SynthVoice`, `PhrasePlayer`. Unit tests against `FakeClock`.                                                                                                       | M    |
| 1.7 | A dev-only `/dev/gallery` route: renders fixture phrases and overlays, with play/pause. **This is the thing you look at.**                                                                                                                                      | S    |

**Deliverable:** a gallery page showing a real fretboard and real tab for a hand-authored
phrase, where pressing play gives you a metronome and a playhead moving in time.

**Verify:** the D Dorian scale spells `D E F G A B C`; the fretboard dots land on the right
frets; the metronome is steady at 60 and at 180; the playhead tracks the click. **You should
eyeball the fretboard and tab against a real guitar here** — errors in this layer poison
everything downstream.

**Risk retired:** enharmonic spelling, string indexing, tick math, audio scheduling, and any
hard-coded assumption of six strings. These are the things most likely to be quietly wrong.

**Outcome.** 312 unit tests, 6 E2E, all gates green. Four things worth carrying into M2:

- **Spelling needed a decision tonal does not make.** It spells scales correctly but produces
  double accidentals in remote tonic/mode pairs (`Db phrygian` → `Db Ebb Fb Gb Ab Bbb Cb`).
  The wrapper now rejects those, prefers the fewest accidentals, and breaks exact ties from an
  explicit table — F# over Gb, Eb over D#, Ab over G#, Bb over A#. A blanket "prefer flats"
  rule gives `Gb major`, which was the first attempt and wrong for guitar.
- **Scale shapes are generated, not tabulated.** A 3nps fret table bakes in standard tuning;
  the generator reproduces the canonical G major fingering with the B-string shift falling out
  on its own, and drop D / seven-string / bass work unchanged.
- **`shapesUpTheNeck` ascends from the nut**, each shape starting on whichever degree falls
  next, rather than starting on degree 1 and chaining. The chained version left frets 1–9
  unused in D dorian and ran the last shapes off the neck. M2's `modes-through-key` should
  build on this and sort by `startDegree` if it wants mode order.
- **The instrument test matrix earns its keep.** Two bugs were invisible on standard tuning
  and caught only by the drop-D and seven-string fixtures.

---

## M2 — The vertical slice: one exercise, end to end ✅ *complete (2026-09-10)*

_Proves the whole architecture with the smallest possible amount of content._

| #    | Task                                                                                                                                                            | Size |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 2.1  | `domain/variation/`: seeded RNG, axis registry, `AxisPolicy` resolution, the roller, coverage bias. Tests for all four policy modes and for an empty axis list. | M    |
| 2.2  | `exercises/types.ts` + `registry.ts` + the first `shared/` generators (`scaleRun`, `applyRhythm`, `markRoles`, `overlayFromPhrase`, `briefFor`)                 | M    |
| 2.3  | `data/`: Dexie schema, repositories, in-memory fake, `fake-indexeddb` tests                                                                                     | M    |
| 2.4  | `store/`: Zustand session slice + settings slice; the runner state machine from doc 03, driven by `Clock`. **Unit tested with `FakeClock` — no UI.**            | M    |
| 2.5  | The `modes-through-key` exercise (variant `plain` only). Golden-file test.                                                                                      | M    |
| 2.6  | `/exercises` library + `/exercises/:id` detail with config form (target tempo, max tempo, reps, params)                                                         | M    |
| 2.7  | `/practice/exercise/:id` — the running view from doc 05: chrome, brief, axis strip, tab, transport, neck rail                                                   | L    |
| 2.8  | Free-time mode: transport toggle, clock-stopped run path, manual rep completion                                                                                 | S    |
| 2.9  | Wire rep logging + `ExerciseStats` maintenance (same transaction) + `rebuildStats()` and its equivalence test                                                   | M    |
| 2.10 | Keyboard map; E2E test of one full standalone practice run                                                                                                      | S    |

**Deliverable:** you can open the app, pick "Seven modes through a key", press practice, get a
rolled key, read the brief, play along to the metronome with the tab scrolling, finish, and
see the rep in IndexedDB.

**Verify:** run it with a guitar. Is the generated material actually playable? Is the brief
clear? Does the tempo behave (adjust `currentTempo`, confirm `targetTempo` is untouched)? Does
free time feel right, or does it need more than "press Enter when done"?

**Outcome.** 504 unit tests, 20 E2E. Four things to carry forward:

- **The runner lives in `src/exercises/runner/`, not `store/`.** It depends on
  `ExerciseDefinition`, so `domain → exercises` would be a cycle; and it has no React state, so
  `store/` would have misdescribed it. `Clock`/`FakeClock` moved to `src/domain/time/` for the
  same reason — the interface is a domain concept, only the Tone-backed one is audio.
- **An exercise is generated in the key it rolled**, not the session's. The session key is the
  fallback for exercises that declare no key axis — which is how a routine shares one.
- **`src/components/ui` is hand-written, not shadcn.** shadcn still earns its place for dialog,
  popover and combobox, which arrive with the key/mode drawer in M6.
- **Tab lines target 24 columns.** Two bars of sixteenths is 32, and two-digit frets at that
  width run together.

**This is the most important review gate in the project.** Everything after it is repetition
of patterns established here.

---

## M3 — The scale & mode family ✅ *complete (2026-09-10), awaiting review*

_First test of the "adding an exercise is cheap" claim._

| #   | Task                                                                          | Size |
| --- | ----------------------------------------------------------------------------- | ---- |
| 3.1 | Shared generators: `intervalRun`, `oneNotePerString`, `horizontalRun` + tests | M    |
| 3.2 | `interval-sequences`                                                          | S    |
| 3.3 | `one-note-per-string`                                                         | S    |
| 3.4 | `position-shifting`                                                           | S    |
| 3.5 | `modes-through-key` variants: `arpeggio-then-scale`, `pause-on-root`          | S    |
| 3.6 | `TabStaff` auto-scroll for long phrases                                       | S    |
| 3.7 | `<AxisPolicyEditor />` + axis policies wired into the exercise config page    | M    |
| 3.8 | Tag vocabulary + tag filtering in the exercise library                        | S    |

**Deliverable:** four scale/mode exercises, all practisable standalone.

**Verify:** is a new exercise really ~50 lines? If not, the shared layer is wrong and we fix
it now rather than repeating the mistake nine more times. Also: pin every axis on one exercise
and confirm it behaves as a sane static exercise.

**Outcome.** 599 unit tests, 31 E2E, `pnpm check` green. 3.6 and 3.8 had already landed in the
M2 review round. The measurement:

| Exercise | `generate` | Whole file |
| --- | --- | --- |
| `interval-sequences` | 35 lines | 83 |
| `one-note-per-string` | 32 lines | 83 |
| `position-shifting` | 37 lines | 94 |
| `modes-through-key` (three variants) | 75 lines | 139 |

**The claim holds.** The biggest remaining chunk of each `generate` is the brief's prose, not
logic. Things to carry forward:

- **Two catalog entries were wrong, not just open.** `one-note-per-string` specified a
  nearest-fret walk that fails within four notes; it is a note-finding exercise and now shows
  note names instead of frets. `position-shifting` had no concrete model; it is now 3nps with
  a four-note string at each shift. Doc 04 has both.
- **"7th position" means the shape starting on the first scale note at that fret**, not the
  root. `shapeFrom` does this; using the root put a 3rd-position C major shape at the 8th fret.
- **Task 2.6's params form had never been built**, so no variant could be chosen. The config
  page now generates one from each exercise's Zod schema, and stored params are parsed before
  `generate` rather than trusted.
- **One test file checks every registered exercise** on every test tuning — real positions,
  in key, deterministic, static once every axis is pinned. A new exercise gets it for free.
- **A new axis is cheap**, and the player is happy to have many: each exercise declares only
  the ones that suit it. Only `key` and `mode` are ever shared across a routine (doc 02).

---

## M3 follow-up — The practice view, after using it ✅ *(2026-09-11)*

Notes from the M3 review, built before M5:

- **No reps in standalone practice, and no automatic re-roll anywhere.** Play runs the
  material once; Loop repeats it; Re-roll is the only way to new material. Skip, End and the
  "That's the set" screen are gone — every pass is logged as it ends, and leaving logs a pass
  in progress as abandoned. The runner's passes continue on a running clock, so a loop never
  slips a beat. `rerollPolicy` is removed from the contract. Doc 03 has the full rules.
- **Transport toggles**: Metronome (mutes the click, never the count-in), Count-in, Loop —
  remembered app-wide. `M` and `L` toggle two of them; `Esc` leaves.
- **A settings dialog in the practice view**: tempo, params and what varies, applied on
  close; only an axis whose policy changed rolls again. Saved to the exercise.
- **Tab**: a rule at the start and end of every bar; zoom scales the tab, and bars per line
  follow the width actually available, so a wide screen or a hidden neck gets more.
- **Neck**: shows only the frets in use, one either side; can be hidden.
- **one-note-per-string**: all six strings and 35 bpm by default.
- Found on the way: two quick settings changes raced and the second undid the first; the
  store now updates in memory before writing.

---

## M4 — Theory exercises ✅ *complete (2026-09-12), awaiting review*

_Now after M5: routines matter more to daily practice than theory drills, and the M3 review's
notes were mostly about routines._

| #   | Task                                                                                            | Size |
| --- | ----------------------------------------------------------------------------------------------- | ---- |
| 4.1 | `domain/theory/`: question models, the `distractors` generator, feedback model                  | M    |
| 4.2 | `TheorySinglePick`, `TheoryTableFill`, `TheoryFeedback` components + `<CircleOfFifths />` strip | M    |
| 4.3 | Theory support in the runner: custom renderer path, scoring, no tempo                           | M    |
| 4.4 | `diatonic-drill` (all four question types)                                                      | M    |
| 4.5 | `circle-of-fifths`                                                                              | S    |

**Deliverable:** two theory exercises, playable standalone, with the wrong-answer teaching
screen.

**Verify:** are the distractors actually hard? A theory drill with obvious wrong answers is
worthless — this is the thing to judge here.

**Agreed at the start of M4:** a right answer moves on by itself; a wrong one waits, with the
correction, until you move on. Tables are filled and submitted whole — one right or wrong, not
partial credit. No countdown; a set is timed as a whole, not question by question.

**Outcome.** 670 unit tests, 43 E2E. Things to carry forward:

- **A set is a pass.** The runner has no clock for theory; the screen submits the set, and
  the rep carries its score and each question's subject and result. Each pass is a fresh
  set on the same variation — the one place new material appears without a re-roll, because
  the variation (the key) is what stays put.
- **"Going" is playing or answering, not "the clock is running".** A routine moving on from
  a theory set starts the next exercise on a fresh clock, counted in — found when a routine
  stalled on Play after a quiz.
- **Distractors are domain code with their own tests**, per kind of answer: other spelling,
  wrong accidental, semitone neighbour; one note wrong in a chord; the mirror signature; the
  parallel key; the same tonic's major for a mode.
- **Circle weighting toward misses is deferred to M6**; the data it needs is logged now.

---

## M5 — Routines, the session runner & settings ✅ *complete (2026-09-12), awaiting review*

_Where the "hands-off run" premise finally works._

| #   | Task                                                                                                                                                                       | Size |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 5.1 | Routine model + repository, with `RoutineItem` holding its own copy of an exercise's settings (doc 02); routine chaining around the runner (item passes back to back, inter-exercise gap, next-up announcement, key and mode rolled once per run, skip to the next item) — tested with `FakeClock` | M    |
| 5.2 | `/routines/:id` builder: add an exercise (copies its settings), add the same one again, edit an item's settings with the same editors as the config page, reorder/remove, passes per item, session key/mode policies, gap, duration estimate | M    |
| 5.3 | `/practice/routine/:id`: running chrome with segmented progress, `CountdownGap`, global pause                                                                              | M    |
| 5.4 | `/home`: today's routine, routine list, session variation bar, re-roll all                                                                                                 | M    |
| 5.5 | `/settings`: instrument, audio, practice defaults, export/import UI                                                                                                        | M    |
| 5.6 | Export/import implementation + round-trip E2E test                                                                                                                         | M    |
| 5.7 | E2E: a full 3-exercise routine, hands-off, on `FakeClock` (theory items join in M4)                                                                                           | S    |

**Rules agreed after M3:** a routine rolls its variations when it starts and they stay put
until an explicit re-roll; any item's settings can be changed by hand; an item's passes play
the same material back to back and count toward the exercise it was copied from; nothing
ever writes `maxTempo`; moving to the next item needs no click.

**Agreed at the start of M5:** Home is a plain list — no "today's routine" — with
favorites (routines and exercises) pinned to the top. A routine opens on an overview of
everything rolled. No Previous button: a routine is for getting through the set. No gap
between items — the count-in is the pause, at the next item's tempo (at least a bar, even
with count-in off). Settings and export/import stay in M5.

**Outcome.** 640 unit tests, 39 E2E. Things to carry forward:

- **One clock runs a whole routine.** The next item counts in on the running clock rather
  than stopping and restarting it — FakeClock fires anything due within one advance, so a
  restart inside a callback cascades, and the real transport would click on a restart too.
  The metronome clicks a mid-clock count-in even when muted.
- **Every item is its own `ExerciseRunner`,** built when the routine opens, so the overview
  is real material and a re-roll of one item touches nothing else. Items are seeded by item
  id, so two copies of one exercise roll independently.
- **The practice store drives either** — its `runner` is always the current item's, so the
  tab, playhead and transport needed no routine awareness. The settings dialog is shared
  by the practice view and the item editor.
- **Instrument presets pulled forward from M9**, limited to the guitar tunings the exercise
  matrix covers: standard, drop D, 7-string.
- **5.7's hands-off routine is proven in unit tests** on `FakeClock` (every item, passes,
  count-ins, tempo changes, no input). The E2E drives a routine with Skip; a real-time
  hands-off run would take minutes.

**Deliverable:** you can build a routine and run it hands-off from start to finish.

**Verify:** actually practise with it for a few days. This is the first point the app is
genuinely usable, and the first point real usage will tell us things planning can't.

---

## M6 — Practice log, report & fretboard explorer

| #   | Task                                                                                                                                                                                                                  | Size |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 6.1 | `domain/progress/`: coverage, heatmap, time-by-day, exercise log, streak, tempo history. Fixture-based tests.                                                                                                         | M    |
| 6.2 | `<HeatmapGrid />`, `<DayBarChart />`; home page's practice heatmap and personal bests                                                                                                                                 | S    |
| 6.3 | `/report`: date range picker, stat row, time-by-day, and the exercise table (played / tempos used / target / time). No prose fields.                                                                                  | M    |
| 6.4 | `/fretboard`: full-neck explorer, position filter, legend, coverage panel                                                                                                                                             | M    |
| 6.5 | `<KeyModeView />` full + compact, wired to the drawer and popover from every key/mode control                                                                                                                         | M    |
| 6.6 | Mode character prose — 7 modes × (sounds like / signature note / avoid / compare), **practical voice**: what to play, not what genre it belongs to. Drafted for your edit, stored as `domain/music/modeCharacter.ts`. | S    |
| 6.7 | Report export: self-contained single-file HTML (styles inlined) plus CSV of the raw log                                                                                                                               | S    |

**Deliverable:** you can see what you've practised and what you've never touched, and export a
week's summary as one file.

**Verify:** does the coverage data match reality? Does the report tell you something you
didn't know?

---

## M7 — Audio richness: backing, ear training, improv

| #   | Task                                                                                                                                                                                                                    | Size |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 7.1 | `BackingTrack` model with shared/exercise scopes, seed pool, Dexie table + derived index columns, `findBackingTrack` resolution order (pinned → own → shared), `BackingPolicy`. Unit tests for every step of the order. | M    |
| 7.2 | `<VideoEmbed />` facade + reference-video config on the exercise detail page                                                                                                                                            | S    |
| 7.3 | `BackingSource` interface + `YouTubeBackingSource`, including `availableRates`/`setRate`, effective-tempo derivation, and default-rate selection against `targetTempo`                                                  | M    |
| 7.4 | `<BackingControl />` + track management UI (add/edit tracks, shared or scoped to an exercise) + the 12×7 shared-pool coverage grid                                                                                      | M    |
| 7.5 | `free-improv-target` (proves the runner handles a played exercise with no phrase)                                                                                                                                       | M    |
| 7.6 | `ear-training` (all five drills) + its custom renderer                                                                                                                                                                  | L    |
| 7.7 | `PreviewPlayer` — "hear it" for a phrase, a chord, a scale                                                                                                                                                              | S    |

**Deliverable:** exercises you can improvise over, and ear training.

**Verify:** does the shared pool cover enough key/mode combinations to be useful, and does
slowing a track down actually work for practice — is 0.75× musically usable, or does it sound
wrong enough that you'd rather have a click? That
answer decides whether generated backing (deferred, specced in doc 06) is worth building, and
the same checkpoint tells us whether sampled instruments are needed for ear training.

---

## M8 — The rest of the catalog

| #   | Task                                                                                  | Size |
| --- | ------------------------------------------------------------------------------------- | ---- |
| 8.1 | Ladder tempo plans + pick-stroke rendering + articulation audio (velocity, palm mute) | M    |
| 8.2 | `speed-picking`                                                                       | S    |
| 8.3 | `legato`                                                                              | S    |
| 8.4 | `remapToStringSet` + `string-skipping`                                                | M    |
| 8.5 | Triad shape tables + chord-relative overlay labels + `triads-arpeggios`               | M    |
| 8.6 | Interactive `FretboardInput` + `fretboard-note-finding`                               | M    |
| 8.7 | CAGED/positional shape tables + `shapeSystem` axis offering both                      | M    |

**Deliverable:** all thirteen exercises.

---

## M9 — Polish & the things that make it stick

| #   | Task                                                                                                                                                                           | Size |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| 9.1 | PWA: `vite-plugin-pwa`, offline shell, icons, install prompt, graceful YouTube degradation                                                                                     | M    |
| 9.2 | Post-session summary: every exercise run, target vs. settled tempo, one-click "adopt as target"                                                                                | M    |
| 9.3 | "Roll a routine from my gaps" generator, wired to the fretboard explorer CTA                                                                                                   | M    |
| 9.4 | Responsive pass: tablet landscape for the runner; type scaling for distance reading                                                                                            | M    |
| 9.5 | Empty states, first-run seeding (a starter routine + a few configured exercises), error boundaries                                                                             | M    |
| 9.6 | Accessibility pass; full keyboard audit                                                                                                                                        | S    |
| 9.7 | Alternate tunings in the UI: tuning presets (drop D, DADGAD, 7-string), capo, left-handed. The model already supports all of it — this is the settings screen and the presets. | M    |

**Deliverable:** an app you'd install and use daily without wishing for anything obvious.

---

## M10 — Optional: sync

Only if you want it after living with export/import. Scoped in doc 07. Firebase is the
recommended target. Roughly: auth UI, a `SyncedRepository` wrapper, security rules, conflict
handling for the three mutable tables, and a sync-status indicator. Estimate: one M-sized
milestone, not a rewrite — which is the whole point of the schema decisions in doc 07.

---

## Sequencing rationale

- **The domain layer comes before any UI** because a spelling or indexing bug there is
  invisible until it has propagated into ten exercises.
- **One exercise end-to-end (M2) before four more (M3)** because M2 is where we discover the
  `ExerciseDefinition` contract is wrong, and fixing it once is far cheaper than fixing it
  five times.
- **Standalone practice before routines** because it is the smaller runner, it's how you'd
  test any single exercise, and routines are then "the same runner with a playlist".
- **Theory (M4) before routines (M5)** so the routine runner is built against both exercise
  kinds from the start and never bakes in "every exercise has tab".
- **`free-improv-target` (M7) deliberately breaks the "played exercises have notes"
  assumption** — scheduled early enough that the assumption never hardens.
- **The report (M6) comes after routines (M5)** because it needs real logged data to be worth
  looking at.
- **Backing tracks (M7) are late** because nothing before them is blocked on them — and they
  got substantially smaller once the pool replaced generation as the default. Generated
  backing is now deferred past M9 entirely.

## Rough shape

M0–M2 is the bulk of the architectural risk and roughly a third of the total effort. M3, M4
and M8 are largely repetition of established patterns and should go quickly. M5 and M7 are the
two other substantial chunks. Wall-clock depends entirely on your review cadence, which is
fine — the gates are the point.
