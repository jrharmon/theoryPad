# Architecture review — 2026-09-17

**Status:** reviewed with the player 2026-09-17 — **agreed**, decisions recorded under
**Decisions** at the end. Nothing has been changed in code yet. An implementing agent works
through the **Work plan**, one step per commit, **before M7b starts**.

**Scope:** `main` at `bede19f`. About 20k lines of source, 8.3k lines of unit tests (≈700
tests), 57 E2E. I read the orchestration layer in full (`store/practice.ts`, both runners), the
data layer, the styles, a sample of exercise definitions and screens, and the inventories of
every large test suite. I deliberately skipped small nits; each finding below is something that
costs real time or causes real bugs.

**Overall:** the pure core is in good shape. `src/domain/` is clean, deterministic and well
tested; the exercise-definition model is a good abstraction; the comments explain *why*, not
*what*. The problems are concentrated at the **edges of the pure core** — the store that
orchestrates audio, backing and persistence, the styling layer, and a few copy-paste patterns
that have grown with each feedback round. Tests are inverted relative to risk: dense where bugs
are rare, absent where the recent feedback-round bugs actually lived.

Severity: **High** — structural, gets worse with every feature. **Medium** — worth doing in a
cleanup pass. **Low** — do opportunistically.

---

## 1. Architecture and design

### A1 — `store/practice.ts` is a 750-line god object with no tests · High

One Zustand store owns: runner lifecycle (exercise *and* routine), session rows, lazy audio
loading, the entire backing-track state machine (`refreshBacking`, `startBacking`,
`catchUpBacking`, `fitSpeedTo`, `applySpeed`, tempo hand-off between track and runner),
persistence of every practice-screen setting to two other stores, and the audio sound routing
(`soundFor`). None of it has a unit test (`src/store/__tests__/` only covers routine helpers).

Symptoms visible in the code:
- A re-entrancy guard (`refreshing`) exists because `refreshBacking` → `runner.setTempo` →
  emit → subscriber → `refreshBacking`. That is a feedback loop being patched, not designed out.
- Backing logic is spread across the exercise subscriber, the routine subscriber and
  `refreshBackingNow`, which picks the pre-track tempo in a different order for each
  (routine: target first; exercise: current first) — a subtle fork that is easy to break.
- `queueMicrotask(() => void catchUpBacking(current))` and "after the runner has finished
  starting its clock, not inside it" — ordering depends on microtask timing.
- Every public action branches `if (routine) … else runner…`.

**Recommendation.** Extract a plain, framework-free `PracticeSession` class (under
`src/exercises/runner/` or a new `src/session/`) that owns the runner/routine, the audio routing
and a separate `BackingController` (choice → resolved source → start/stop/speed/tempo). Give it
injected dependencies: `clock`, an `AudioPort` (metronome/phrase/drone/video factories),
`repositories`, `now`. The Zustand store shrinks to a thin adapter: hold the session, mirror its
snapshot into state, forward actions. The controller can then be tested with `FakeClock` and a
fake audio port, exactly like the runners are today.

A single-exercise session should be modelled as a routine of one item (or both behind one
interface) so the `if (routine)` forks go away.

### A2 — Theory and played exercises share one state machine via `isTheory` flags · Medium

`ExerciseRunner` checks `isTheory` / `isFreeTime` in ~15 places (`pause`, `stop`, `finishPass`,
`beginNext`, `beginPass`, `generate`…). Each new exercise kind (M7b ear training is next) will
add another flag and another set of branches. Related: `ExerciseDefinition.kind` is not tied to
what `generate` returns, so the type system cannot stop a `'theory'` definition returning a
played instance, and every consumer re-checks `instance.kind`.

**Recommendation.** Before M7b, split timing policy out of the runner: a small strategy per kind
(`metered`, `free`, `set`) that answers "does this pass use the clock, how does it end, what does
loop mean". Make `ExerciseDefinition` a discriminated union on `kind` so `generate` returns the
matching instance type.

Also in `ExerciseRunner`:
- `beginNext` re-implements most of `beginPass` (count-in scheduling, `scheduleEnd`,
  `onRepStart`). Extract one `startPass({ from, countInBars, continuation })`.
- The caller's config object is mutated as runtime state (`config.params`, `config.tempo`,
  `config.loop`, `config.heldAxisValues`…); `readonly` only protects the reference. Copy what
  changes into private fields so config means "what it was opened with".
- `state === 'playing' || 'paused' || 'count-in'` appears 4 times; name it `isInPass`.
- `beginNext` spreads `subjectWeights` into `RepStartInfo`, which has no such field.

### A3 — The in-memory repository is dead weight; data access is hard-wired · Medium

`createMemoryRepositories` (~200 lines) is a full second implementation of every repository,
including the stats and practice-day rollups. Nothing in the app or in any other test uses it —
only the shared repository suite, which exists partly to test it. Its doc comment ("domain and
store tests use this") is wrong. A local-first app with IndexedDB always available has no
production use for it, and tests already have `fake-indexeddb` for the real Dexie repositories.

Separately, stores call `createRepositories(db())` inline 23 times across 7 stores.

**Decision: delete it.**
- Remove `src/data/repositories/memory.ts`, its export from `src/data/index.ts`, and the
  memory half of `repositories.test.ts` (the suite keeps running against Dexie on
  `fake-indexeddb`).
- Replace the 23 inline `createRepositories(db())` calls with one accessor (e.g. `repos()` in
  `src/data/`), so there is a single place a test can reset or swap the database.
- New store/session tests (T1) use the real Dexie repositories over `fake-indexeddb`.

### A4 — Circular store dependencies papered over with dynamic imports · Medium

`await import('./exercises')` / `('./routines')` appears 8 times in `practice.ts`, and
`await import('@/audio')` 6 times — even though `audio` is already held in a module variable. The
dynamic store imports exist to break an import cycle, and the audio ones duplicate the lazy
load. This makes the dependency graph invisible and every action async for no domain reason.

**Recommendation.** Falls out of A1: the session receives callbacks/ports (`saveExercise`,
`saveRoutineItem`) instead of importing sibling stores, and audio is loaded once through a single
`loadAudio()` helper.

### A5 — Duplicated store infrastructure · Low

`queued()` / `writeQueues` (per-row serialized writes) is copy-pasted between
`store/exercises.ts` and `store/routines.ts`; the `inFlight` load guard is a similar pattern.
Extract `serialWrites()` and `onceInFlight()` into `src/store/util.ts` (with one test each), or
push serialization down into the repository `update` so no caller can get it wrong.

### A6 — Small correctness/clarity smells in `practice.ts` · Low

- `rollSessionKeyMode()` does not roll anything — it always returns C ionian, and is called three
  times per session. Rename to a constant (`FALLBACK_KEY_MODE`).
- `seed: Math.floor(Date.now() % 2 ** 31)` is written in both `prepare` and `prepareRoutine`
  along with the identical session row; extract `openSession(routineId)`.
- Misplaced doc comments: "Ticks into the phrase; polled on rAF" sits on `sessionId`; two
  stacked JSDoc blocks above `askForClick` (the first belongs to `startBacking`).
- `export { newId }` at the bottom re-exports an unrelated data helper from the practice store.
- Many `void promise` fire-and-forget writes (`reps.add`, `update`) swallow failures silently. At
  minimum route them through one `persist()` helper that logs/surfaces errors.
- `loadSubjectWeights` uses `Date.now()` directly; inject `now` like everything else.

### A7 — Exercise definitions repeat themselves · Low

- Zod `.default(...)` values in each `params` schema are repeated verbatim in
  `defaults.params` (6 definitions). Derive `defaults.params` from `params.parse({})`, or drop
  `defaults.params` when a schema exists.
- `estimateRepSeconds: phraseEstimate(80)` repeats `defaults.targetTempo: 80`; let
  `phraseEstimate()` read the definition's default tempo.
- `axisValue<NeckPosition>(variation, 'neckPosition', …)` — the caller supplies the type by hand
  and nothing checks it against the axis. An `AxisValueMap` keyed by `AxisId` would make
  `axisValue(variation, 'neckPosition')` infer the type and remove every cast.
- Brief sentences are built from long nested template literals with inline ternaries. Pull the
  pieces into named consts; it is the least readable code in the exercise layer.

---

## 2. Code style

### S1 — Prettier is configured but not enforced · Medium

`.prettierrc` exists, but `pnpm check` and CI do not run `format:check`, and **143 files** are
currently out of format (lines well past `printWidth: 96` are common). Formatting drift makes
diffs noisy for every future agent.

**Recommendation.** One mechanical commit: `pnpm format`, then add `format:check` to `check`.
Keep it a separate commit from any logic change so review stays readable.

### S2 — Conditional-spread noise from `exactOptionalPropertyTypes` · Low

`...(x ? { x } : {})` appears throughout (runner config, `rollVariation` call, repositories,
reconfigure). It is the price of `exactOptionalPropertyTypes`, which is a reasonable setting, but
the idiom hurts readability. Add a tiny `definedProps({ a, b, c })` helper that drops
`undefined` keys and use it where three or more of these stack up.

### S3 — Otherwise good

Naming, module boundaries (`domain` purity, `tonal`/`tone`/`dexie` confinement enforced by
lint) and comment quality are strong. No action.

---

## 3. Unit test effectiveness

The domain tests are behaviour-focused and well named ("never re-rolls on its own, however often
it is played"), and `exercises.test.ts` — invariants run over the whole registry and every test
instrument — is the model the rest should follow. The problems are about **where** the tests
are and **how many** micro-tests some suites carry.

### T1 — Coverage is inverted relative to risk · High

The code most likely to break has no unit tests: `store/practice.ts` (backing hand-off, tempo
under a track, routine catch-up, stop/restart, count-in persistence). The three feedback rounds
changed exactly this code, and the only safety net is E2E. Meanwhile `FakeClock` — a *test
double* — has 26 tests.

**Recommendation.** After A1, write ~10–15 scenario tests for `PracticeSession` /
`BackingController` against `FakeClock` + fake audio port + Dexie repositories on
`fake-indexeddb`. Suggested scenarios,
each one test validating everything observable about the outcome:
1. Exercise happy path: prepare → play → pass ends → rep persisted with axes, tempo, frets;
   held values saved to the exercise.
2. Routine happy path across a played item → theory item → played item (clock, count-in,
   backing paused and rebuilt, reps tagged with item ids).
3. Choosing a track: tempo snaps to the nearest 5% speed; leaving it restores the prior tempo.
4. Re-roll moves the key → backing re-resolves (drone retunes; track changes or drops).
5. Track fails to start → dropped, error surfaced, notes play.
6. Stop inside count-in logs nothing; stop mid-pass logs abandoned; restart counts in again.
7. Count-in and loop changes persist to the right place (exercise vs routine item vs settings).

### T2 — Micro-test clusters that should collapse into invariants · Medium

Suites where several tests assert different facets of the *same call* and would be clearer (and
catch the same bugs) as one happy-path test plus the genuinely distinct edge cases:

| Suite | Now | Suggested |
| --- | --- | --- |
| `domain/instrument/__tests__/shapes.test.ts` (`scaleShape`) | 14 tests: ascends in pitch, ascends within string, consecutive degrees, never outside key, hand span, three per string… | One invariant test over `TEST_INSTRUMENTS` × keys checking all properties of a valid shape; keep the canonical-G fingering golden, `minFret`, string subset, end-of-neck. ~5 tests. |
| `domain/time/__tests__/FakeClock.test.ts` | 26 tests on a test double, incl. "runs a long routine instantly", "never drifts" and "loops … without drifting" | ~8: scheduling order/exactness, pause/resume, seek, loop, clear. Drift and speed are already proven by every runner test. |
| `domain/variation/__tests__/rng.test.ts` | Statistical tests (`spreads roughly evenly`, `stays in [0,1)`) on a vendored mulberry32 | Keep determinism, weighted pick edge cases, shuffle integrity, `hashSeed` collisions. Drop distribution tests. |
| `audio/__tests__/Metronome.test.ts` | 17 tests, several single-assert (`has no count-in by default`, `can be told not to accent`, `unsubscribes a listener`) | One 4/4 happy path asserting beats, accents, bar/beat reporting and count-in marking together; one for 6/8; then muted/silenced/mid-clock count-in/pause. ~7. |
| `domain/instrument/__tests__/fretboard.test.ts` | `noteAt` ×4, `string indexing` ×4 facets | Fold into per-function invariant tests over `TEST_INSTRUMENTS`. |
| `exercises/runner/__tests__/ExerciseRunner.test.ts` | Mostly good. Redundant: "starts idle…", "never advances off the brief…" (covered by "plays when told to"), "runs a whole exercise in no time at all", "ignores pause outside of playing" | Merge into the happy path; keep the rest. |

Target: roughly **25–30% fewer tests with no loss of meaningful coverage**. Don't chase a number;
delete a test only when another test would fail for the same bug.

### T3 — Component tests asserting non-functional details · Medium

`components/music/__tests__/TabStaff.test.tsx` (32 tests) mixes real behaviour with assertions
about how things happen to look, plus near-duplicates.

**The rule (agreed):** a class, style or attribute may be asserted **only when applying it is the
component's job** — e.g. a component whose purpose is to mark the target note, where that marking
*is* a class or `data-role`. Purely visual choices (which colour a mark is drawn in, that the
large size has a different inline style) do not belong in unit tests. **No screenshot tests** —
they break on every purely visual change and are expensive to maintain; visuals are verified by
looking during development (CLAUDE.md), not by an automated diff.

Apply it to TabStaff:
- **Remove** — non-functional: "renders every articulation mark in the accent"
  (`className` contains `text-accent-text`); "renders bigger at the large size" (inline `style`
  differs); asserting `data-columns` / `data-system` / `data-testid` values where the test could
  instead assert which notes are on which line or in which column.
- **Keep** — functional: "marks the target note so it can be coloured" (marking is the
  component's job), articulation marks placed before/after the note, pick strokes shown only
  when asked, playhead position and line, auto-scroll once per line / not when disabled.
- **Merge** near-duplicates: "one row per string" + "highest string on top" + "inverts on a
  seven-string" → one test over `TEST_INSTRUMENTS`; "column their tick falls in" + "spaces by
  subdivision" + "fine enough for triplets" + "every note of a sixteenth run" → one table-driven
  test; the three line-wrapping tests → one.

Apply the same rule when reviewing the other component tests (`Fretboard.test.tsx` etc.).

### T4 — E2E helpers are duplicated inline · Low

Raw `indexedDB.open(...)` promise plumbing is pasted into 5 places across 4 spec files, though
`e2e/helpers.ts` exists. Move `readStore(page, name)` / `writeRow(page, store, row)` there.

---

## 4. Styling: reuse and maintainability

The token architecture (roles in `@theme`, dark overrides, shadcn mapped onto tokens) is the right
idea and the comments explaining Tailwind layering are valuable. The implementation has drifted in
four ways.

### C1 — No type scale: ~160 arbitrary pixel font sizes · High

`text-[13px]` ×58, `text-[12px]` ×30, `text-[15px]` ×16, `text-[14px]` ×16, `text-[11px]` ×12,
plus 17/10/28/20/18px — about 160 in all, and `h3`–`h6` in `index.css` hard-code px too. CLAUDE.md
says "don't hard-code a hex or a font", but size is the one axis with no tokens, so every screen
picks by eye. Changing body density means a find-and-replace across 40 files.

**Recommendation.** Define a named scale in `@theme` (`--text-caption: 11px`, `--text-meta: 12px`,
`--text-body-sm: 13px`, `--text-body: 15px`, `--text-lead: 17px`, `--text-title…`) with line
heights, map the existing values onto it (collapsing 13/14 and 12/11 where the design allows),
then replace arbitrary sizes. Add a lint rule (or a grep in `check`) banning `text-[Npx]`.

### C2 — Muted-ink opacity is ad hoc · Medium

`text-ink/64` ×70, `/70` ×22, `/50` ×10, `/45` ×9, `/35` ×4, `/65` ×2, `/40`, `/25` — eight levels
where the style guide defines one ("muted is `text-ink/64`; anything fainter is only for hints").
`/65` and `/70` are almost certainly meant to be `/64`. The value 64% is also duplicated in the
`kicker` utility and `--muted-foreground`.

**Recommendation.** Three role tokens: `--color-ink-muted` (64%), `--color-ink-faint` (hints,
~45%), `--color-ink-disabled` (~35%), used as `text-ink-muted` etc., and referenced from `kicker`
and `--muted-foreground`. Replace the eight levels with the three.

### C3 — Role tokens duplicate raw values, doubling the dark theme · Medium

In light, `paper`, `nav`, `chrome`, `transport`, `neck`, `toggle-off`, `fresh` are all
`#ffffff`; `nav-ink`, `chrome-ink`, `transport-ink`, `tab-digit`, `neck-nut`, `neck-heat` are all
`#24262b`; `accent-text`/`nav-active`/`avatar-ink`/`toggle-on-ink` share one blue. Because each
role holds a literal instead of `var(--color-paper)` / `var(--color-ink)`, the dark block has to
restate ~70 values by hand, and a new role means two edits that can silently disagree.
Additionally, most of the `neutral-*` and `accent-*` ramps (15 tokens) are unused but still
carry dark overrides; `--radius-lg` and `--radius-xl` are both 12px.

**Recommendation.** Two tiers: a small **palette** (the only place hex lives, redefined in dark)
and **roles** that reference the palette with `var()` and only get a dark override when the role
genuinely maps differently (e.g. `transport`, `highlight`, `playhead`). Delete unused ramp steps.
Expect the dark block to drop from ~70 to ~25 declarations. Screenshot every screen in both themes
before and after — this is exactly the kind of change tests will not catch.

### C4 — The toggle look is copy-pasted, not a component · High

The "toggle on" class string
`rounded-toggle bg-toggle-on text-toggle-on-ink inset-ring inset-ring-toggle-on-ring hover:bg-toggle-on/85`
is duplicated in 10 places across 7 files, inside **four separate local toggle components**:
`Toggle` in `TransportBar.tsx`, a different `Toggle` (segmented) in `FretboardExplorer.tsx`,
`OnOff` and `AppearanceChoice` in `SettingsPage.tsx`, plus another `Toggle` in the dev gallery.
Worse, the unlayered global rule in `index.css` detects "on" via `:not(.bg-toggle-on)` — CSS keyed
on a utility class name, so renaming the utility silently breaks the secondary button style.

**Recommendation.** Add our own primitives to `src/components/ui/` (per CLAUDE.md, alongside
`kicker`/`field`): `ToggleButton` (pressed/unpressed) and `SegmentedControl` (options, value,
attached or spaced). Style "on" from `aria-pressed="true"` / a `data-state="on"` attribute, and
change the global override to key on that attribute instead of `.bg-toggle-on`. Replace all local
toggles.

### C5 — Repeated page-level patterns without a primitive · Low

- Page intro `max-w-[640px] text-[15px] text-ink/70` under a title ×6 → `PageHeader`
  (title, intro).
- Loading/rolling placeholder `px-8 py-8 text-[13px] text-ink/64` ×6 → `LoadingState` (and note
  `EmptyState` itself uses `text-ink/65`, a third variant of muted).
- Local `Section`/`Row` in `SettingsPage.tsx` and `Section` in `Gallery.tsx`; `Stat` in
  `ReportPage.tsx` — promote the settings row/section pair if a second screen needs them.
- `rounded-[8px]` ×6 where `rounded-control` exists.

---

## 5. Things considered and **not** flagged

- `src/domain/` purity, the lint-enforced import boundaries, and the seeded-RNG design — solid.
- The exercise registry and the whole-registry invariant tests — keep as the pattern.
- `exactOptionalPropertyTypes` itself — keep; only the idiom around it is noisy (S2).
- Comment volume is high, but it records decisions and past bugs; it is an asset for agents.
- UI component size (`TrackForm` 540 lines, `SettingsPage` 400) is large but already split into
  sub-components; not worth restructuring beyond C4/C5.

---

## Work plan (agreed — do all of it before M7b)

Ordered so each step is independently reviewable and mergeable, cheapest-and-safest first. Each
step ends with `pnpm check` green, and any visual step with screenshots in **both themes**.

1. **S1** — run Prettier over the repo; add `format:check` to `check`. Mechanical, own commit.
2. **C4 + C5** — `ToggleButton`, `SegmentedControl`, `PageHeader`, `LoadingState`; replace local
   copies; re-key the global CSS override on `aria-pressed`. Screenshot every screen touched.
3. **C1 + C2** — type-scale and muted-ink tokens; replace arbitrary sizes and opacity levels; add
   the `text-[Npx]` ban. **Merge near-identical values** (e.g. 11→12px, 14→13px, `/65` and `/70`
   → muted) — the player prefers uniformity over preserving tiny differences. Screenshot all
   screens, both themes, and call out anything that shifted noticeably.
4. **C3** — palette/role token split; delete unused ramps. Screenshot all screens, both themes.
5. **A3 + A5** — delete the in-memory repository and its half of the suite; one `repos()`
   accessor; shared `serialWrites`.
6. **A1 + A4 + A6** — extract `PracticeSession` and `BackingController`; slim the store; remove
   dynamic store imports. **Then T1**: the scenario tests. Largest step — do it on its own branch,
   and run the E2E suite plus a hands-on check with a backing track before merging.
7. **A2** — timing strategy and discriminated `ExerciseDefinition`. Do this **before M7b** starts,
   since ear training would otherwise add a third set of `isX` branches.
8. **T2 + T3 + T4** — test consolidation, applying the functional-only rule in T3. Aim for
   roughly 25–30% fewer unit tests; remove a test only when it isn't impactful (another test
   catches the same bug, or it asserts something non-functional). Do after steps 5–6 so no test is rewritten twice.
9. **A7 + S2** — definition DRY-ups and `definedProps`. Opportunistic.

## Decisions (2026-09-17)

1. **In-memory repository:** no production purpose in a local-first app, and no test depends on
   it → **delete** (A3).
2. **Font sizes and muted levels:** near-identical values **merge**; uniformity beats tiny
   differences (C1, C2).
3. **Test reduction:** removing ~25–30% of unit tests is fine where they aren't impactful.
   Class/style assertions stay **only when functional**; **no screenshot tests** (T3).
4. **Sequencing:** the whole cleanup happens **before M7b**.
