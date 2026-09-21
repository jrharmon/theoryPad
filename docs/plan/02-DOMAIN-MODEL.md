# 02 — Domain Model

Everything in this document lives under `src/domain/` and is **pure**: no React, no DOM, no
`Date.now()`, no `Math.random()`. Time and randomness are injected.

Types below are the intended shape, not final code. An implementing agent may adjust naming
for consistency but should not change the semantics without raising it.

---

## 1. Music primitives (`domain/music/`)

A thin, opinionated layer over `tonal`. **`tonal` is imported nowhere else in the app.**

Why wrap it: `tonal` returns loosely-typed objects and empty-string sentinels, spreads the
same concept across several modules, and does not know about scale degrees the way we want
to talk about them. The wrapper gives us branded types and exhaustive unions, so an agent
writing an exercise cannot pass a mode name that doesn't exist.

```ts
export type PitchClass = string & { readonly __brand: 'PitchClass' }; // "C", "F#", "Bb"
export type NoteName = string & { readonly __brand: 'NoteName' }; // "D4", "F#3"
export type Midi = number & { readonly __brand: 'Midi' }; // 0-127

export type ModeName =
  'ionian' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'aeolian' | 'locrian';

/** Room to grow. Not used in v1 but the type exists so nothing hard-codes 7 modes. */
export type ScaleName =
  | ModeName
  | 'harmonic-minor'
  | 'melodic-minor'
  | 'major-pentatonic'
  | 'minor-pentatonic'
  | 'blues';

export interface KeyMode {
  tonic: PitchClass;
  mode: ModeName;
}

/** A degree of the parent scale, with its alteration relative to major. */
export interface Degree {
  number: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  alteration: -1 | 0 | 1; // ♭, natural, ♯
  /** "1", "♭3", "♯4" — display form */
  label: string;
}

export type ChordQuality =
  'maj' | 'min' | 'dim' | 'aug' | 'maj7' | 'min7' | 'dom7' | 'min7b5' | 'dim7' | 'minMaj7';

export interface DiatonicChord {
  degree: Degree;
  root: PitchClass;
  triad: ChordQuality;
  seventh: ChordQuality;
  /** "Dm", "Em7", "F", "Cmaj7" */
  triadSymbol: string;
  seventhSymbol: string;
  /** Honest about missing extensions: "Em11", or null where no diatonic 9th exists. */
  ninthSymbol: string | null;
  /** The chord family: tonic (1, 3, 6), subdominant (2, 4), dominant (5, 7). */
  function: 'tonic' | 'subdominant' | 'dominant';
}
```

Core API (all pure functions):

```ts
scaleNotes(km: KeyMode): PitchClass[]              // 7 notes, correctly spelled
scaleDegrees(km: KeyMode): Degree[]
diatonicChords(km: KeyMode): DiatonicChord[]       // 7 entries
chordTones(root: PitchClass, q: ChordQuality): PitchClass[]
degreeOf(km: KeyMode, pc: PitchClass): Degree | null
signatureDegree(mode: ModeName): Degree            // the note that defines the mode
keySignature(km: KeyMode): { sharps: number; flats: number; relativeMajor: PitchClass }
intervalBetween(a: PitchClass, b: PitchClass): IntervalName
transpose(pc: PitchClass, semitones: number): PitchClass  // spelling-aware
```

### The enharmonic rule

Correct spelling is the thing hand-rolled theory engines get wrong, so state it once:
**a scale always uses each letter name exactly once.** D Dorian is `D E F G A B C`, never
`D E F G A B B#`. Db major is `Db Eb F Gb Ab Bb C`, never `C# D# F F# G# A# C`. The wrapper
derives spelling from the parent major key and the mode's offset, and there is a table-driven
test over all 12 tonics × 7 modes asserting exactly this.

`signatureDegree` encodes what makes each mode sound like itself — the natural 6th in Dorian,
the ♭2 in Phrygian, the ♯4 in Lydian, the ♭7 in Mixolydian. Several exercises and the whole
key/mode reference screen key off it.

---

## 2. Instrument & fretboard (`domain/instrument/`)

```ts
export interface Instrument {
  id: string;
  name: string; // "Guitar — standard"
  /**
   * Open-string pitches, LOWEST to HIGHEST. Length defines the string count.
   * Standard: ["E2","A2","D3","G3","B3","E4"]
   * Drop D:   ["D2","A2","D3","G3","B3","E4"]
   * 7-string: ["B1","E2","A2","D3","G3","B3","E4"]
   */
  tuning: NoteName[];
  fretCount: number; // 22
  handedness: 'right' | 'left';
  capo: number; // 0
}

export interface FretPosition {
  string: number; // 0-based index into tuning
  fret: number; // 0 = open
}
```

### String indexing convention — read this before writing any fretboard code

**`string: 0` is the LOWEST-pitched string in `tuning`. Index ascends with pitch.**

Note what this does _not_ say: it does not say "low E". The lowest string is whatever
`tuning[0]` happens to be — E2 in standard, D2 in drop D, B1 on a seven-string. Nothing in the
codebase may assume otherwise.

The convention is the opposite of how tab is drawn (highest string on top) and of how
guitarists number strings (1st string = highest). Both are _display_ concerns, handled once in
the renderer. Every model, generator and test uses low-to-high indexing. Getting this wrong
produces plausible-looking, entirely inverted output — the classic bug in this domain.

### No hard-coded six

Alternate tunings, drop tunings and 7- and 8-string instruments are all planned. We ship
standard 6-string E in the UI, but **the code must never contain a literal `6` for string
count.** Concretely:

- Every loop over strings iterates `tuning.length`.
- `<Fretboard />` and `<TabStaff />` derive their row count from `instrument.tuning.length`.
- String sets are index arrays, so they widen naturally; the _named_ presets ("top three",
  "6-5-4") are generated from the instrument, not hard-coded.
- Generators that walk strings take the instrument, never an assumed range.

**This is proven, not promised.** From M1 onward the test fixtures include a drop-D and a
7-string instrument alongside standard tuning, and the core domain and component tests run
against all three. A `6` that sneaks in fails a test rather than surviving until the day you
pick up a seven-string.

The one place string count legitimately matters is **shape tables**. Three-note-per-string
shapes generalise to any string count by construction, which is a further reason to build them
first. Positional/CAGED shapes are inherently 6-string patterns and are declared as such, with
the instrument's string count checked before they're offered.

API:

```ts
noteAt(inst: Instrument, pos: FretPosition): NoteName
midiAt(inst: Instrument, pos: FretPosition): Midi
positionsOf(inst: Instrument, pc: PitchClass, range?: FretRange): FretPosition[]
scaleOnNeck(inst: Instrument, km: KeyMode, range?: FretRange): ScaleNotePosition[]
```

```ts
export interface ScaleNotePosition extends FretPosition {
  pitchClass: PitchClass;
  degree: Degree;
  isRoot: boolean;
}
```

### Positions and shapes

```ts
/** A playing position: a window of frets the hand occupies. */
export interface NeckPosition {
  /** Lowest fret of the window; also its display name ("7th position"). */
  fret: number;
  /** How many frets the hand covers. 4 normally, 5-6 with stretches. */
  span: number;
}

/** A named fingering pattern the exercises draw on. */
export interface ScaleShape {
  id: string; // "3nps-1", "caged-e", "position-7"
  name: string;
  /** Frets relative to the shape's root position, per string, low→high. */
  offsets: number[][];
}
```

v1 ships **three-note-per-string** shapes, and they are **generated from the tuning, not stored
as fret tables** — a table bakes in standard tuning, since every offset moves when a string
does and the major-third gap between G and B needs its own exception. The generator reproduces
the canonical G major fingering with that shift falling out of "take the next scale note
nearest the hand", and drop D, DADGAD, seven strings and bass all work unchanged.

`shapesUpTheNeck(instrument, keyMode, { minFret })` returns the shapes **ascending the neck**,
each starting on whichever degree falls next on the lowest string, carrying its own
`startDegree`. Not "shape N starts on degree N": in D dorian the first D on the low E string
is fret 10, so that ordering leaves frets 1–9 unused and runs the last shapes off the end.

Positional/CAGED shapes are genuinely conventional fingerings rather than derivable, and are
inherently six-string, so they arrive later as tables (milestone 8).

### String sets

```ts
export type StringSet = { name: string; strings: number[] };
// "6-5-4" -> [0,1,2] ; "top three" -> [3,4,5] ; "outer" -> [0,5]
```

Used by the triad, string-skipping, and one-note-per-string exercises.

---

## 3. The phrase model (`domain/phrase/`) — how tab and notes are stored

This is the answer to _"what is the best way to store note or guitar tab information?"_

### Time is measured in integer ticks

```ts
export const PPQ = 480; // pulses per quarter note
```

Every time value in the app is an **integer tick offset from the start of the phrase**. Not
beats-as-floats, not `"1.5"`, not bar/beat pairs.

Reasons this matters: 480 divides cleanly by 2, 3, 4, 5, 6, 8, 12, 16 — so eighths, triplets,
sixteenths, quintuplets and swing are all exact integers. Float beat positions produce
`0.30000000000000004` comparison failures the moment you have triplets, and those bugs show
up as notes silently missing from the tab. Integers also map straight onto `Tone.Ticks`.

Convenience constants: `WHOLE = 4*PPQ`, `QUARTER = PPQ`, `EIGHTH = PPQ/2`,
`SIXTEENTH = PPQ/4`, `TRIPLET_EIGHTH = PPQ/3`.

```ts
export interface TabNote {
  string: number; // 0-based, low→high
  fret: number;
  startTick: number;
  durationTicks: number;
  /** Loudness/emphasis for playback, 0-1. Default 0.8; accents 1.0; ghosts 0.4. */
  velocity?: number;
  articulation?: Articulation;
  /** Fretting-hand finger. 0 = open, 1-4, 't' = thumb. Optional; shown as a hint. */
  finger?: 0 | 1 | 2 | 3 | 4 | 't';
  /** Drives colouring in the tab and on the neck. */
  role?: 'root' | 'target' | 'chord-tone' | 'passing' | 'none';
  /** Free text shown under the note, e.g. "♭3". */
  annotation?: string;
  /** Tied from the previous note on the same string. */
  tied?: boolean;
}

export type Articulation =
  | 'hammer-on'
  | 'pull-off'
  | 'slide-up'
  | 'slide-down'
  | 'slide-into'
  | 'bend'
  | 'bend-release'
  | 'vibrato'
  | 'palm-mute'
  | 'ghost'
  | 'staccato'
  | 'let-ring';

export interface Bar {
  index: number;
  startTick: number;
  timeSignature: TimeSignature;
  /** Shown beneath the bar, e.g. "Bar 4 · land on B". */
  label?: string;
}

export interface TimeSignature {
  beats: number;
  unit: 1 | 2 | 4 | 8 | 16;
}

export interface Phrase {
  ppq: number; // always PPQ, carried so serialised phrases are self-describing
  timeSignature: TimeSignature;
  bars: Bar[];
  notes: TabNote[]; // sorted by startTick, then string
  totalTicks: number;
  /** Optional per-section tempo instruction; see the tempo model below. */
  tempoPlan?: TempoPlan;
  /** Repeat the whole phrase N times within one rep. Default 1. */
  repeat?: number;
}
```

### Why not MusicXML / Guitar Pro / ABC?

Because we are **generating** phrases, not importing them, and every consumer is ours: the
tab renderer, the fretboard overlay, and the Tone.js player. Those formats carry an enormous
amount of engraving detail we don't need, and none of them carry what we _do_ need — the
degree/role annotations that make the pedagogy work. A phrase is ~5 fields per note and
serialises to compact JSON.

If we ever want Guitar Pro export, it becomes a one-way serializer over this model. That is a
strictly easier problem than adopting their model now.

### Building phrases

Generators do not construct `Phrase` objects by hand. `domain/phrase/builder.ts` provides a
small fluent builder that handles tick accounting:

```ts
const phrase = phraseBuilder({ timeSignature: FOUR_FOUR })
  .rhythm(EIGHTH) // default duration for subsequent notes
  .notes(positions) // lay a sequence out sequentially
  .bar({ label: 'Bar 4 · land on B' })
  .build();
```

This is where "sixteen eighth notes ascending" becomes a phrase, and it is where the tick
math is tested once instead of in every exercise.

### Rendering (see doc 05)

The tab component derives its grid from the phrase: columns =
`bars × beatsPerBar × renderSubdivision` (default 4 → sixteenth-note resolution). A note is
placed in `floor(startTick / ticksPerColumn)`. Arbitrary bar counts fall out; the mockup's
16 columns are simply 4 bars × 4 beats at quarter-note resolution.

Notes that don't land on a rendered subdivision (a quintuplet at 16th resolution) get placed
in the nearest column and flagged; the renderer can raise `renderSubdivision` when the phrase
contains tuplets. `Phrase` therefore carries a computed `minSubdivision` helper.

---

## 4. Variation axes (`domain/variation/`)

The mechanism behind "exercises can be randomly varied." Note _can_ — see "Static exercises"
below. An exercise that declares no axes is a perfectly valid exercise.

```ts
export type AxisScope = 'session' | 'exercise';

export interface AxisDefinition<T = unknown> {
  id: AxisId;
  scope: AxisScope;
  label: string; // "Neck position"
  /** Candidate values, given what has already been rolled. */
  candidates(ctx: AxisContext): T[];
  format(value: T): string; // "7th position"
}
```

### The axis registry (v1)

| Axis                 | Scope    | Example values                                              |
| -------------------- | -------- | ----------------------------------------------------------- |
| `key`                | session  | any of 12 tonics                                            |
| `mode`               | session  | the 7 modes                                                 |
| `neckPosition`       | exercise | open, 3rd, 5th, 7th, 10th, 12th                             |
| `stringSet`          | exercise | 6-5-4, 5-4-3, 4-3-2, 3-2-1, all strings                     |
| `targetScaleDegree`  | exercise | 1-7, weighted toward the mode's signature degree            |
| `rhythmPattern`      | exercise | straight 8ths, straight 16ths, gallop, swung 8ths, triplets |
| `direction`          | exercise | ascending, descending, up-down, down-up                     |
| `intervalPattern`    | exercise | 3rds, 4ths, 5ths, 6ths, 7ths, sequential                    |
| `shapeSystem`        | exercise | 3-note-per-string, positional                               |
| `voicing`            | exercise | closed, drop 2, drop 3, spread triad                        |
| `inversion`          | exercise | root, 1st, 2nd                                              |
| `backingProgression` | exercise | modal vamp, i-IV, ii-V-i, 8-bar form                        |
| `permutation`        | exercise | 1234, 1324, 1423, 4321 (technique drills)                   |

Session-scoped axes are rolled **once per session** and shared by every exercise in a routine,
so the practice hangs together musically. **Only `key` and `mode` are session-scoped.** Every
other axis is rolled independently for each exercise in a routine — a position or rhythm that
suits one exercise means nothing to the next, so a routine never shares them.

### Per-axis policies — how variation is actually controlled

There is no global "wildness" dial. It was a design-session invention and it doesn't survive
contact with a varied exercise catalog: "wildness 3" means something different for a mode
exercise than for a picking drill, and the player can't predict either. Instead, **every axis
is controlled directly**:

```ts
export type AxisPolicy =
  /** Roll freely from every candidate. The default. */
  | { mode: 'roll' }
  /** Roll, but only from this subset. "Position: 3rd, 5th or 7th only." */
  | { mode: 'roll'; from: unknown[] }
  /** Pin it. "Always A minor." */
  | { mode: 'fixed'; value: unknown }
  /** Keep whatever it was last time this exercise ran. */
  | { mode: 'hold' };
```

- **Exercise-scoped policies** are stored on the configured `Exercise`:
  `axisPolicies: Partial<Record<AxisId, AxisPolicy>>`. Any declared axis without an entry
  defaults to `{ mode: 'roll' }`.
- **Session-scoped policies** (`key`, `mode`) are stored on the `Routine`, since they are
  shared across the whole run — `sessionAxisPolicies`.

This reads directly in the UI: the routine builder and the exercise config page each show one
row per axis with a control — _Key: `[Roll ▾]` / `[Fixed: A minor]`_, _Position:
`[Roll ▾]` restricted to `[3rd] [5th] [7th]`_. Nothing to interpret.

**Named presets** are a thin convenience on top, not a separate mechanism: a preset is just a
saved bundle of policies ("Stay put" = hold everything but rhythm; "Anything goes" = roll
everything). Ships in a later milestone if you want it.

### Coverage bias

Inside `{ mode: 'roll' }`, candidates are not uniformly weighted. Each is weighted
`1 / (1 + timesSeenRecently)`, computed from the rep log. This is what makes the fretboard
explorer's "never rolled yet: 10th, 12th" honest — the roller actively pushes toward
unexplored ground instead of being merely random. It is an implementation detail of rolling,
never a user-facing concept.

### Static exercises

An exercise with `axes: []` rolls nothing. Its brief shows fixed content, its phrase is the
same every time, and the "fresh axes" highlighting simply has nothing to highlight. Nothing in
the runner, the renderer or the log special-cases this — it falls out of the same code path.

Partial cases work the same way: an exercise can declare three axes and the player can pin all
three, making it effectively static for them without changing the definition.

### Determinism

```ts
export interface Rng {
  next(): number;
  pick<T>(xs: T[]): T;
  weighted<T>(xs: Weighted<T>[]): T;
}
export function mulberry32(seed: number): Rng;
```

Every roll is driven by a seeded RNG derived from `hash(sessionId, exerciseId, repIndex)`.
Consequences: variations are reproducible, tests are deterministic, and a rep log row can
store just the seed plus the resolved values (we store both — the values for display and
querying, the seed for exact replay).

`Math.random()` appears nowhere in `src/domain/`.

```ts
export interface RolledVariation {
  seed: number;
  /** Resolved value per axis, plus whether it changed since the last roll. */
  axes: Record<AxisId, { value: unknown; display: string; fresh: boolean }>;
}
```

`fresh` drives the accent-tinted highlighting in the variation brief — the "which axes are new
this time" affordance. A `fixed` or `hold` axis is never `fresh`.

## 5. Tempo (`domain/tempo/`)

Per the decision in doc 00.

```ts
/** Persisted on the exercise. */
export interface TempoConfig {
  /** null for theory exercises and free improv. */
  targetTempo: number | null;
  /** Manually entered, record-keeping only. Never read by the runner. */
  maxTempo: number | null;
}

/** How an exercise derives its starting tempo from targetTempo. */
export type TempoPlan =
  | { kind: 'target' }                                             // start at targetTempo
  | { kind: 'percent'; pct: number }                               // e.g. 0.85
  | { kind: 'ladder'; startPct: number; stepBpm: number; everyReps: number }
  | { kind: 'none' };                                              // no metronome

resolveStartTempo(config: TempoConfig, plan: TempoPlan, repIndex: number): number | null
```

**`currentTempo` is session state, not domain state.** It lives in the Zustand session slice,
is initialised by `resolveStartTempo`, is freely adjustable during practice, and is discarded
when the exercise ends. Writing it back to `targetTempo` requires an explicit user action
("Set as target"). The rep log records the `currentTempo` actually used, so the later
post-session summary can offer "you settled at 96, your target says 88 — adopt it?".

---

## 6. Exercises, routines, sessions

See doc 03 for the full `ExerciseDefinition` contract. The persisted entities:

```ts
/**
 * A configured instance of a definition. This is what appears in routines.
 *
 * It holds only what is *yours* — how the exercise is set up. What the exercise
 * *is* (name, tags, summary, which axes it varies) lives in code on the
 * definition this points at, and is read through rather than copied.
 *
 * The split is by lifetime: a definition ships with the app, a configuration is
 * the player's and has to survive updates. Copying anything across the line
 * makes it drift — `name` was duplicated here originally, and renaming a
 * definition left every stored row on the old name.
 */
export interface Exercise {
  id: Uuid;
  definitionId: string;          // the join into code; never rename one
  params: unknown;               // validated by the definition's Zod schema
  /** Per-axis control. Anything omitted defaults to { mode: 'roll' }. */
  axisPolicies: Partial<Record<AxisId, AxisPolicy>>;
  /** Remembered values for axes with { mode: 'hold' }. */
  heldAxisValues: Partial<Record<AxisId, unknown>>;
  tempo: TempoConfig;
  defaultReps: number;           // 1-3
  /** The backing chosen for this exercise (M7) — never picked automatically. */
  backing?: BackingChoice;
  /** Narrow which shared tracks the backing menu offers. */
  backingCriteria?: { tags: string[]; bpm?: { min: number; max: number } };
  notes?: string;                // the player's own notes
  createdAt: number; updatedAt: number; deletedAt?: number;
}

/** None (the synth plays the notes), the drone, or one video. Doc 06 has the rules. */
export type BackingChoice = { kind: 'drone' } | { kind: 'video'; videoId: Uuid };

// Videos — shared backing tracks, an exercise's own tracks and its reference videos — are
// one table; the `Video` type is in doc 06.

/**
 * One exercise in a routine, with its own copy of the settings.
 *
 * Copied from the exercise when added and independent afterwards, so the same exercise can
 * appear several times — different params, different axes pinned or held — without any of
 * it touching the exercise in the library. (Agreed after M3; the first version pointed at
 * the exercise itself, so editing a routine would have changed the library copy.)
 */
export interface RoutineItem {
  id: Uuid;
  /** The exercise it was copied from. Its passes count toward that exercise's history. */
  exerciseId: Uuid;
  definitionId: string;
  /** Passes played back to back before moving on. Starts from the exercise's defaultReps. */
  reps: number;
  params: unknown;
  tempo: TempoConfig;
  axisPolicies: Partial<Record<AxisId, AxisPolicy>>;
  heldAxisValues: Record<string, string>;
}

export interface Routine {
  id: Uuid;
  name: string;
  items: RoutineItem[];
  interExerciseGapSec: number; // 8
  /** Policies for the session-scoped axes (key, mode), shared by every exercise in the run. */
  sessionAxisPolicies: Partial<Record<AxisId, AxisPolicy>>;
  createdAt: number;
  updatedAt: number;
}

export interface Session {
  id: Uuid;
  routineId: Uuid | null; // null = standalone practice
  seed: number;
  startedAt: number;
  endedAt: number | null;
  sessionKey: PitchClass;
  sessionMode: ModeName;
}

/**
 * One pass through an exercise's material. Standalone or in a routine, a pass is logged as it
 * ends; one cut short (leaving, re-rolling, changing settings) is `abandoned`. Passes in a
 * routine are logged against the exercise the item was copied from — they are its history —
 * and never touch `maxTempo`, which is only ever entered by hand.
 */
export interface Rep {
  id: Uuid;
  sessionId: Uuid;
  exerciseId: Uuid;
  /** Set when played as part of a routine. */
  routineItemId?: Uuid;
  definitionId: string;
  index: number; // pass number within this exercise in this session
  startedAt: number;
  endedAt: number | null;
  /** The tempo actually used. May differ from targetTempo. null in free-time runs. */
  tempo: number | null;
  /** Was this run in free time (no metronome)? */
  freeTime: boolean;
  /** Resolved axis values, denormalised for querying and display. */
  axes: Record<string, string>;
  seed: number;
  status: 'completed' | 'skipped' | 'abandoned';
  /** Theory exercises only. */
  score?: { correct: number; total: number };
  /** Theory: each question's subject ("key:Eb") and whether it was right. */
  answers?: { subject: string; correct: boolean }[];
}
```

The rep log is the **single source of truth for all progress**. Coverage ("positions
practised", "keys covered in Dorian"), streaks, session counts and the whole weekly report are
**derived queries over `reps`**, never separately maintained counters. Counters drift; queries
don't. If a query gets slow we add a cache table, but the log stays authoritative.

---

## 7. Theory questions (`domain/theory/`)

```ts
export type TheoryQuestion = SinglePickQuestion | TableFillQuestion;

export interface SinglePickQuestion {
  kind: 'single-pick';
  id: string;
  prompt: string; // "Which key has four sharps?"
  options: { id: string; label: string }[]; // 2-6, number-key answerable
  correctOptionId: string;
  feedback: Feedback;
}

export interface TableFillQuestion {
  kind: 'table-fill';
  id: string;
  prompt: string;
  note?: string; // "The root is given."
  columns: { id: string; label: string; width?: number }[];
  rows: {
    id: string;
    given: Record<string, string>; // pre-filled cells
    answerColumnId: string;
    options: { id: string; label: string }[];
    correctOptionId: string;
  }[];
  feedback?: Feedback;
}

export interface Feedback {
  /** "That's E major." — what the wrong answer actually is. */
  whatYouPicked?: (pickedId: string) => string;
  /** The teaching sentence. */
  rule: string;
  /** Optional visual shown with the correction. */
  visual?:
    | { kind: 'circle-of-fifths'; correct: PitchClass; picked?: PitchClass }
    | { kind: 'note-row'; km: KeyMode; highlight?: number[] }
    | { kind: 'fretboard'; km: KeyMode; positions: FretPosition[] };
}
```

Generalising `Feedback.visual` is what makes the "wrong answer" screen reusable across every
theory exercise instead of being hard-coded to the circle of fifths.

_As built (M4), in `src/domain/theory/`:_ `whatYouPicked` is data, not a function — a
`whatItIs` map from option id to sentence. The circle visual carries `positions` (option id →
place on the circle), so the screen can mark whichever option was picked. Every question has a
`subject` for the log. A table is **one** answer: submitted whole, right only if every cell is.
A set is timed as a whole (the rep's start and end); questions are not timed individually.

---

## 8. Settings

```ts
export interface Settings {
  instrument: Instrument;
  audio: {
    metronomeEnabled: boolean;
    countInBars: 0 | 1 | 2;
    voice: 'synth' | 'sampled'; // 'sampled' unavailable in v1
    masterVolume: number;
    muteMetronomeWithYouTubeBacking: boolean;
  };
  practice: {
    defaultInterExerciseGapSec: number;
    revealBriefBeforeRep: boolean; // true; the design is emphatic about this
    defaultFretRange: { low: number; high: number }; // { low: 0, high: 15 }
  };
  ui: { showFingerings: boolean; showDegreesOnFretboard: boolean };
}
```
