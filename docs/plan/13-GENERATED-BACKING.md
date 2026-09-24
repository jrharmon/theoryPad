# 13 — Generated backing: bass and piano over the key's chords

_Agreed 2026-09-23. Supersedes "Generated backing — deferred" and "The `backingProgression`
axis" in `06-AUDIO.md`, and the parked "Generated backing — deferred past M9" line in
STATUS.md. The player brought it back: an exercise should be able to teach over a specific
progression, and every key and mode should have something to play over, offline._

A new entry in the Backing menu, **Generated**. It plays a chord progression in the
exercise's key and mode, with a sampled bass and sampled piano chords. It follows the clock at
any tempo and needs no network. The progression comes from the exercise's settings and is
**picked when the variation is rolled**, so it stays the same until the next re-roll. Its chords
**always show on screen**: above the tab, and in *Improvise to a target*'s phrase counter, with
the current chord highlighted.

**This goes before M7b.** It is on its own branch, `generated-backing`, with a commit per task.
The player reviews each task before the next one starts, then merges at the gate, as in the
Sounds run.

---

## Decisions already taken

These were asked and answered on 2026-09-23. Don't reopen them. If one turns out wrong, record
why here.

1. **Bass and piano chords only.** The metronome still covers drums, if they're wanted: Swing
   under a ii-V-I, or no drums at all. The backing never mutes the metronome or brings its
   own drums. The Backing menu and the Metronome menu stay independent.
2. **The exercise's notes still sound.** Generated behaves like the drone and unlike a track: it
   plays *under* the notes. The metronome and count-in behave as they do with no backing.
   Nothing about tempo changes: the backing plays at whatever tempo the clock is at.
3. **It's a Backing-menu choice, with the progression rolled.** You still choose "Generated"
   yourself. Nothing is chosen for you, as with the tracks. It is remembered on the exercise or
   routine, like any other choice. What it plays is picked from the exercise's
   generated-backing settings using the most recent roll: re-roll and you may get a different
   progression; don't re-roll and it stays.
4. **Progressions are scale degrees**, so they fit any key and mode. The chord qualities come
   from the rolled mode: `1 4` is i-IV in Dorian and i-iv in Aeolian. The settings offer three
   sources, and you choose one:
   - **Vamp on 1**: the tonic chord only. It's useful in its own right: it lets you hear the
     mode, and some exercises will want exactly that.
   - **The mode's go-to progressions**: the ones in `modeCharacter.ts`. Each roll picks one at
     random.
   - **Custom**: one or more degree lists, entered by the player or set by an exercise's
     definition when it teaches over a particular progression. With more than one list, each
     roll picks one at random.
5. **The progression restarts at every pass's bar 1**, so every pass sounds the same. It loops
   inside the pass when the pass is longer than the progression, and is cut off where the pass
   ends.
6. **The chords are always shown** when Generated is playing: chord symbols above the tab where
   each chord starts, with the current one highlighted. *Improvise to a target* has no tab, so
   it shows them too, with the current one highlighted. This is the biggest piece of UI in the
   run, and the player judged it worth it.
7. **Routines**: a routine can choose Generated. Each played item plays **its own**
   progression, from its own copy of the exercise's settings, and switches at that item's
   count-in. A theory item is silent.

## Defaults taken (not asked; the player didn't object)

- **Comping patterns are text in a file**, `src/domain/backing/comps.ts`, written like the drum
  tab in `beats.ts`, because the player edits that file himself. The style is a setting, not
  rolled.
- **7th chords, with a switch for triads.** The symbols shown match what is played (`Dm7`, or
  `Dm` with triads on).
- **4/4 only for now.** Other signatures wait for the first exercise in 3/4 or 6/8, like the
  Simple drum beat. In another signature, the Generated entry is disabled, with a line saying
  why.
- **Not in free time.** Free time runs no clock, and the backing needs one. The menu entry is
  disabled there, with a line saying why. *Improvise to a target* runs its clock, so it's
  unaffected.
- **Works in every key and mode, and never drops.** Unlike a track, a re-roll can't make it
  stop fitting.
- **No new samples.** The bass samples shipped with Sounds (Bb0–G3, every minor third) get a
  preset. The piano is the existing Salamander set. Both download only when Generated is
  chosen, and choosing it never blocks Play. Until they arrive, or if the download fails, the
  backing plays on the synth.
- **Levels are set by ear at the gate.** Start the bass and piano about 8 dB under the notes.

## Why it isn't a variation axis

Doc 06 planned `backingProgression` as an axis. It stays out of `AXIS_IDS`, because:

- An axis's candidates come from the key, the mode and the instrument (`AxisContext`), but a
  custom progression is part of the exercise's settings, which an axis can't see.
- The three sources above already are the policy: Vamp is a fixed value, the go-to
  progressions roll from the mode's own list, and Custom rolls from a list you wrote. A roll
  policy on top would say the same thing twice.

So the progression is picked by `pickProgression(settings, keyMode, rng)`. Its `rng` is
seeded from the variation's seed (`hashSeed(variation.seed, 'backing')`), which gives exactly
"the most recent roll": the same roll gives the same progression, and a re-roll gives a new
pick. Changing the generated-backing settings in the practice dialog re-picks only the
progression, the same way changing one axis's policy re-rolls only that axis. It is not logged
with the rep and does not appear in the axis strip. The chord lane shows it.

---

## The model

```ts
// src/domain/backing/generated/types.ts — pure
export interface ProgressionStep { degree: DegreeNumber; bars: number } // bars ≥ 1, whole bars
export type Progression = readonly ProgressionStep[];

export type ProgressionSource =
  | { kind: 'vamp' }
  | { kind: 'goTo' }
  | { kind: 'custom'; progressions: readonly Progression[] }; // at least one

export interface GeneratedBackingSettings {
  source: ProgressionSource;
  /** A pattern id from comps.ts. Keep ids once shipped: settings save them. */
  style: string;
  chords: 'sevenths' | 'triads';
}

/** One chord as the pass plays it. */
export interface ChordSpan {
  startTick: number;   // from the pass's bar 1
  durationTicks: number;
  degree: DegreeNumber;
  symbol: string;      // spelled in the key: "Dm7", or "Dm" with triads
}
```

- **Where the settings live.** They are on `Exercise.generatedBacking` and
  `RoutineItem.generatedBacking` (an item's own copy, as with `countInBars` and `metronome`).
  The fallback is the definition's `backing.generated`, then
  `{ source: vamp, style: <first comp>, chords: 'sevenths' }`. These are optional fields with
  no index, so Dexie needs no new schema version. Check `transfer.ts` and its validation
  carry them through export/import.
- **The choice.** `BackingChoice` gains `{ kind: 'generated' }` and `ResolvedBacking` gains
  `{ kind: 'generated' }`. `resolveBacking` resolves it the same way in every key.
- **Custom text.** A custom progression is typed as degrees separated by spaces, with an
  optional `*bars`: `2 5 1*2` is ii for a bar, V for a bar, I for two. Parse and format
  functions live beside the types, with a test. Degrees are 1–7 and nothing else. Roman
  numerals are only for display, derived from the mode.

## The pure pieces (`src/domain/backing/generated/`)

- `pickProgression(settings, keyMode, rng): Progression`. Vamp is `[{1, bars: 1}]`. Go-to picks
  from `MODE_CHARACTER[mode].progressions`, one bar per chord. Custom picks from the lists.
- `chordTimeline(progression, keyMode, chords, phrase): ChordSpan[]` lays the progression out
  from tick 0, loops it and cuts it at the pass's end. (It takes the phrase's `totalTicks`,
  `timeSignature` and `repeat` rather than a bare pass length: it needs the copy length to
  restart at.) The same degree twice in a row is **one span**, so the lane marks changes, not
  bars; a span never crosses into the next copy (player's call, task 1). Symbols come from
  `diatonicChords`. **If a phrase has `repeat > 1`, the timeline restarts at every copy**, so
  the tab (one copy, with a repeat marker) and what you hear agree.
- `comps.ts` holds comping patterns as tab, parsed by `compTab()` in the style of `drumTab()`:

  ```
  //    1   2   3   4
  PN |x-------x-------|     g ghost  x hit  X accent  = keep ringing  - silence
  BS |1===5===1===5===|     1 3 5 7 chord tone, o the root an octave up
  ```

  Each pattern has an `id`, `name`, `detail` and `signature`, and is one bar or more; it loops
  over whatever chord is sounding. Started with Pad, Straight and Swing; after task 3's review
  they are **Pulse**, **Strum** and **Swing**, with dynamics (see "Task 3 — review"). The player tweaks and adds to these, as with the beats. A chord that changes
  mid-pattern cuts the ringing notes.
- `voiceChord(chordTones, previous): Midi[]`. Piano chords stay in a close position between
  C3 and C5, each chord voice-led to the nearest voicing of the last. The bass takes the root
  in E1–D♯2, chosen as `droneNotes` chooses its root.
- `renderPass(timeline, pattern, keyMode, chords, copyTicks?) → { bass: NoteEvent[]; piano:
  NoteEvent[] }` (`chords` and `copyTicks` added in task 2 — see its outcome), each
  event `{ tick, durationTicks, midi, velocity }`. This is pure, so it can be tested
  thoroughly and heard in the session with `FakeClock`.

## Audio (`src/audio/`)

- A **bass preset** in `voices/presets.ts`: `sampled(22, 55, 3)` over the shipped files (Bb0–G3;
  `34` was a slip — it would have skipped E1), not offered in the Instrument row.
- `GeneratedBacking implements BackingSource` (`rates: null`, `effectiveBpm: null`, like the
  drone). It holds two `SampledVoice`s (bass, piano) on their own gain below the notes.
  `loadPass(events, atTick)` schedules on the clock as `PhrasePlayer.load` does. `clear()`
  cancels the scheduled events and releases every voice. `pause()`, `resume()` and `stop()`
  work because the clock pauses, so nothing reschedules. `reanchor()` (a seek) reloads the
  pass from the new tick.
- `AudioPort.generated(): GeneratedSource` takes the place of `drone(keyMode)`. The fake gets
  the same, recording what it was given.

## The session (`src/session/`)

- `BackingController.refresh()` builds the source for `resolved.kind === 'generated'`. It
  **does not take the tempo over**: `underTrack` stays false, so the notes and metronome carry
  on as they do under the drone.
- The pass's material comes from `PracticeSession.sound()`, called at every pass start
  (continuations included, so a routine's next item switches there). It works out the chord
  timeline for the pass's phrase from the current runner's variation and settings,
  `renderPass`es it, and `loadPass`es it at `countInTicks`. That one hook gives decisions 5
  and 7 for nothing. Clear it wherever `audio.phrase.clear()` runs.
- **The session's state gains `chords: ChordSpan[] | null`**, which the store mirrors: the
  current pass's timeline while Generated is chosen, or null otherwise. It exists as soon as the
  brief is shown, before Play, so the chords can be read before playing.

## UI

- **Backing menu**: the Generated entry goes after Drone. Its detail line names what the roll
  picked, e.g. "ii – V – I · Straight", or says why it's disabled (free time, or not in 4/4).
  Routines get the same entry.
- **Settings for generated backing**: one component, used on the exercise config page (next to
  "Backing tracks offered"), in the practice settings dialog, and in a routine item's Edit. It
  has:
  - the source (Vamp on 1 · The mode's go-to progressions · Custom)
  - the custom list: add, edit, remove, with the parsed chords shown in the current key as you
    type
  - the style: pills from `comps.ts`
  - 7ths or triads
- **The chord lane in `TabStaff`**: an optional `chords` prop draws the symbol above the bar
  and beat where each chord starts, and again at the start of a line if the chord is still
  sounding (in parentheses). The chord under the playhead gets the highlighter: yellow is
  "you are here", so this fits the style rules. Use `num`/Figtree at the tab's label size, and
  check both themes and every tab size (`-` / `=`).
- **Improvise to a target**: a strip in the phrase counter showing one cycle of the
  progression as chord symbols, with the current one highlighted. The chord under the playhead
  is what matters when you're about to land a phrase.

---

## Tasks, in order

Each task ends with `pnpm check` green, a screenshot of anything visual (both themes), a
commit, and a stop for the player's review.

| # | Task | Size |
| --- | --- | --- |
| 1 | Pure progressions: types, `pickProgression`, custom-text parse/format, `chordTimeline` (loop, cut, repeat restart) | S |
| 2 | Pure rendering: `comps.ts` and `compTab()`, `voiceChord`, `renderPass`; Pad, Straight, Swing written | M |
| 3 | Sound: bass preset, `GeneratedBacking`, `AudioPort.generated`, the `generated` choice, controller and `sound()` wiring, routine per-item switching, the Backing-menu entry (default settings, so it can be heard) | M |
| 4 | Settings: data fields and definition default, export/import, the settings component in all three places, re-pick on change | M |
| 5 | Showing the chords: session `chords` state, `TabStaff` chord lane with highlight, the improv strip, E2E | M |
| 6 | Gate: levels, patterns and voicings by ear; fixes; merge | — |

### Task 1 — outcome (2026-09-23)

`src/domain/backing/generated/` (`types.ts`, `progression.ts`, `timeline.ts`), exported
from `@/domain/backing`. Eight tests.

- **Same chord twice is one span** — asked and answered: vamp shows its chord once, and a
  loop that brings the same chord back (`1 4 5 1`) holds it across the seam. Never across a
  repeat copy. The sound is unaffected: task 2 lays comp patterns on the pass's bar grid, not
  per span, so a held chord still re-strikes every bar.
- **`chordTimeline` takes the phrase** (`totalTicks`, `timeSignature`, `repeat`) instead of
  `passTicks, timeSignature` — it needs the copy length to restart at. The improv exercise
  builds a real phrase (rests, one label per phrase), so it fits too.
- **Custom text**: whitespace or commas between steps; `1*0`, `1*`, `8`, `ii`, fractions and
  an empty field are errors, each with a short message for the settings component to show.
  No upper limit on bars. `formatProgression` writes `*1` as nothing.
- **Fallbacks**: a custom source with no usable list vamps on 1; an empty progression lays
  out no chords.
- Symbols are `diatonicChords`' own (`Ebm7`, `Cm7b5`), as the Key & mode view shows them.

### Task 2 — outcome (2026-09-23)

`compTab.ts` (the parser), `comps.ts` (Pad, Straight, Swing), `voicing.ts` (`voiceChord`,
`bassRoot`), `render.ts` (`renderPass`, `NoteEvent`). Eight more tests.

- **Tab.** `PN` cells: `x` 0.8, `X` 1, `=`, `-`. `BS` cells: `1 3 5 7 o`, `=`, `-`; the bass
  has no accent (digits have no capital) and plays at 0.8. `=` rings across a bar line; `=`
  with nothing before it, an unknown line, a second `PN`, a stray cell or mismatched bars
  throw with the pattern and line named. Either line may be left out. Cells need only give
  whole ticks — no metronome-grid rule, the backing is scheduled per note.
- **The patterns as written.** Pad `X===…` over a held root. Straight: `X==-x==-X==-x==-`
  over `1===5===1===5===`. Swing, on eighth triplets: `X=---x====--` (beat 1 and the swung
  "and" of 2) over `1==3==5==3==`. All three are one bar.
- **The pattern sits on the pass's bar grid**, not on each chord, and restarts at every
  repeat copy: `renderPass` takes `copyTicks` (the phrase's `totalTicks`). It also takes
  `chords`, since the timeline doesn't carry triads-or-sevenths.
- **A ringing note that meets a chord change moves to the new chord** — cut on the old one
  and struck on the new one for the rest of its length — rather than falling silent until the
  pattern's next hit. With one-bar patterns and bar-long chords this never happens; it matters
  for a longer pattern the player writes.
- **A bass `7` under triads plays the root an octave up**, so the bass never plays a 7th the
  chord symbol doesn't show.
- **Voicing** is close position in C3–C5, scored by total voice movement **plus the distance of
  the chord's middle from middle C**. Pure nearest-voicing crept a looping progression to one
  end of the range within two cycles (A aeolian `1 6 7 1` sank to C3–A3, G mixolydian `1 7 4 1`
  climbed to D4–B4); with the pull they hold their place. One case still sinks a step per cycle,
  A aeolian `1 4 5 1` (all minor chords a step apart), to about C3 — in range; judge at the gate.
  Each repeat copy's first chord is voiced afresh, so copies sound alike. The bass root is
  E1–D♯2, like the drone's, with tones stacked above it (up to D♯3).
- No instrument reaches `renderPass`, so "a 7-string has no effect" is true by construction and
  has no test.

### Task 3 — outcome (2026-09-23)

Heard for the first time. **Checked on the real clock** in the dev server (bite 1): wrapping the
voices' `play`, 8 s of *Improvise to a target* at 90 bpm played the sampled bass 8 times and the
sampled piano 32 — two bars of Straight after a one-bar count-in, exactly. Full E2E green (two
option counts in `backing.spec` grew by one).

- **`BASS_PRESET`** is its own export beside `VOICE_PRESETS`, so the Instrument row never sees
  it; `VoicePreset.id` widened to allow `'bass'`. Level 0 dB for now.
- **`GeneratedBacking`** (`src/audio/GeneratedBacking.ts`): each instrument is sampled once its
  download lands and the synth until then (`SynthVoice('bass')` and `'pad'`) — or for good, if
  it fails. Both sit **8 dB under their own preset level** (`LEVEL_DB`), to be set by ear at the
  gate. `loadPass` drops the last pass's schedule **without** releasing voices — the pass's notes
  were already cut at its end, and releasing at the continuation would clip the last chord by the
  clock's lookahead. `clear()` does release. `pause()` releases what rings; `resume()` and
  `reanchor()` strike again whatever spans the clock's position, for the rest of its length, so
  a Pad chord doesn't go silent until the next bar after a pause or a seek.
- **Session.** `SessionState.generated: { settings, progression } | null` — the roll's pick,
  worked out whenever the runner or its variation changes, whether or not Generated is chosen,
  so the menu can name it before Play. Task 5's `chords` builds on it. `sound()` hands the
  source each pass (continuations included) through `loadGenerated`, which clears instead when
  there's no phrase (a theory item), in free time, or when the style's signature isn't the
  phrase's. `silence()` clears it too, whether or not the backing had "started".
- **Settings, for now**: the definition's `backing.generated`, else `DEFAULT_GENERATED_BACKING`
  (`comps.ts`: vamp, the first comp, sevenths). A definition's `backing.requiredTags` became
  optional so it can carry only `generated`. Routines keep a map of each item's settings.
- **Menu**: "Generated" after Drone; its detail is the roll's pick in roman numerals and the style
  ("i – ♭II · Straight", "Vamp on i · Pad"), or why it's disabled ("Needs the clock, so not in
  free time." / "Only in 4/4 for now."). `MenuOption` gained `disabled`. Checked in both themes;
  the free-time case forced through the store, since nothing in the UI sets free time today.
- **Temporary:** *Improvise to a target*'s definition points at `goTo` with Straight (Strum since the review), marked
  `TEMPORARY` — task 4 decides its real default. Everything else plays the default (Pad over a
  vamp). **Swing can't be reached until task 4's settings.**

### Task 3 — review (2026-09-24)

The player listened. **Levels are good** (8 dB under). The patterns were not:

- **Pad went.** The piano samples are trimmed to 4 s and fade well before that, so a chord
  struck once a bar dies away; longer samples would cost memory. A chord that should last is
  **struck again** instead — every pattern now hits the chord more than once a beat.
- **Dynamics, like the drum beats.** `PN` gains `g`, a ghost, at the drum tab's levels
  (`g` 0.35, `x` 0.8, `X` 1). The bass stays at one level for now — no one has asked, and
  digits have no capital to accent with.
- **The patterns now** (`comps.ts`; nothing had shipped, so the ids changed):
  - **Pulse** (default): `X=g=x=g=X=g=x=g=` — even eighths, 1 and 3 accented, upbeats ghosted —
    over `1===1===5===1===`.
  - **Strum**: `X=g=x=g=--x=x=gg` — a pop strum that skips beat 3 and pushes its upbeat — over a
    3-3-2 bass, `1=====1=5=====5=`.
  - **Swing**: `x=gX=gx=gX=g` — every beat and its swung upbeat, 2 and 4 accented — over the
    walking `1==3==5==3==`.
- Recounted on the real clock: two bars of Strum played the bass 8 times and the piano 64
  (eight four-note chords a bar).
- The tests no longer read the shipped patterns' contents, only that each parses, so editing
  one can't break a test that isn't about a typo.
- Answered, not changed: choosing a progression is task 4; showing the chords is task 5.

Task 3 is the first time it can be heard, so its review is a listen. Use the default settings
(Vamp on 1 unless the exercise's definition says otherwise). Temporarily point one exercise's
definition at `goTo`, so there are changes to hear.

### Task 4 — outcome (2026-09-24)

Settings, in all three places. Asked before building: *Improvise to a target*'s default, and
what the chords show where no key has been rolled.

- **Fields.** `Exercise.generatedBacking` and `RoutineItem.generatedBacking`, optional and
  unindexed (no Dexie version). `resolveGeneratedBacking(definition, stored)` in
  `exercises/params.ts` gives the row's, else the definition's, else
  `DEFAULT_GENERATED_BACKING`. Nothing is written when an exercise is created, so an untouched one
  follows its definition; **Reset to defaults writes the resolved default**; adding to a routine
  copies the exercise's.
- **Export/import** needed no change: rows pass through validation, and routine items are
  `unknown`. The round-trip test's exercise now carries custom settings, so a stricter schema
  that dropped them would fail it.
- **The component**, `components/backing/GeneratedBackingEditor.tsx`: source pills (Vamp on 1 ·
  Go-to · Custom, with a line saying what each does), the custom lines, style pills with the
  pattern's `detail` under them, and 7ths/Triads. A new line starts empty; a line that doesn't
  parse shows why in red and **nothing is saved until every non-empty line parses**; empty lines
  are left out; the last line can't be removed (an empty Custom is what Vamp is for).
- **What the chords show** (player's call): the practice dialog spells them in the roll's key
  (`Dm7 – G7 – Cmaj7 ×2`); the config page and a routine item's Edit show **roman numerals**, in
  the mode if a policy settles it (fixed or held; for an item, the routine's own), else Ionian,
  and say which.
- **Where.** Config page: its own sheet under "Backing tracks offered". The settings dialog
  (practice and a routine item's Edit): under "What varies", for played exercises only.
- **It keeps its own state after mount.** The exercises store writes before it updates memory,
  so following the saved value back flicked the pills to the old choice and could drop a
  quick second click — seen in a screenshot, not a test. The config page remounts it (a `key`)
  after a reset; the dialog mounts fresh on every open anyway.
- **Re-pick.** The dialog reports `generatedBacking` alongside tempo, params and policies
  (`SettingsChanges`). `ExerciseSession.reconfigure` sets it before the runner reconfigures, so
  an axis re-rolled in the same change picks from the new settings, then `replanGenerated()`
  works the plan out again from the same seed. Like any dialog change, it goes back to the
  brief. Checked in the dev server: B♭ Mixolydian's "ii – v – I · Pulse" became "Vamp on I ·
  Strum", brief and key unchanged.
- ***Improvise to a target*** (player's call): **Custom, `1 4 5 1` · `2 5 1*2` · `1 6 4 1`,
  Pulse, 7ths.** Each is four bars ending on the tonic, so a 4- or 8-bar phrase lands its
  target over i. A phrase length that isn't a multiple of four won't always end there. Landing
  on the next phrase's bar 1 instead (over `1 5 6 4`) was considered and left: it changes the
  exercise, not its backing. The `TEMPORARY` mark is gone.
- Tests: a session test (a settings change re-picks only the progression, is saved, and is what
  a reopened session plays); the routine test's improv item now brings its own settings through
  the copy; one editor test (spelled chords, nothing saved while a line is wrong, both lists once
  fixed). 734 unit tests in 55 files, 68 E2E, all green.

## Tests

Few and useful: one happy-path test per function that checks the whole outcome, then only edge cases that matter. No screenshot tests.

- **Domain**: one happy-path test per function that checks the whole output. Edge cases only
  where a bug would hide: a pass shorter than the progression, `repeat > 1`, a 7-string
  instrument having no effect, custom-text errors, voice leading staying in range across a
  whole go-to progression in every mode, and one test running every comp pattern through
  `compTab`. That last test is what catches a typo when the player edits a pattern.
- **Session**, over `FakeClock` and the fake port: choosing Generated schedules the backing
  from each pass's bar 1; the notes and metronome still play; a re-roll can change the
  progression but reopening doesn't; a routine's second item plays its own progression.
- **E2E**: choose Generated, and the chord lane shows spelled symbols with one highlighted, and
  the highlight moves while playing.

## Things that will bite

1. **Silent on the real clock while `FakeClock` passes.** This happened in the Sounds run: see
   STATUS.md, "Things that bit". Once the sound is wired in (task 3), check it on the real clock
   in the page: wrap the two voices' `play` and count calls across a pass.
2. `pnpm test:e2e` runs against `vite preview`. **`pnpm build` first**, or `dist/` has no
   samples.
3. `import.meta.env.BASE_URL` for sample URLs, never a leading slash.
4. **Two samplers and the notes all fire on the same beats.** Watch CPU, and keep the piano's
   `maxSeconds` in place. The pad holds chords for a bar, which is under 4 s at any tempo above
   60.
5. **Continuations.** The clock never stops between passes or routine items, so `loadPass`
   must clear the previous pass's leftover ringing notes, or they'll overlap the new bar 1.
6. **Spelling.** Chord symbols come from `diatonicChords`, spelled in the key, never from
   tonal's names, as elsewhere. Check a flat key (E♭ Dorian) and a sharp one (F♯ Lydian) by
   looking.

## What only the player can judge, at the gate

- The levels: bass and piano under guitar notes, and under piano notes (the notes' voice may
  be piano too; does it clash?).
- Whether Pad, Straight and Swing each earn their place, and whether their voicings sit well
  against a guitar.
- Whether the chord lane is readable at a glance while playing, at every tab size.
- Whether the improv strip helps you land a phrase.
- Whether the progression restarting at every pass sounds right on a looped exercise whose
  pass isn't a whole number of cycles.

## Not in this run

- Roman-numeral input, chords shorter than a bar, secondary dominants, and chords outside the
  mode.
- Logging the progression with the rep, and coverage leaning for progressions.
- Rolling the style.
- Drums inside the backing: that's the metronome's job (decision 1).
