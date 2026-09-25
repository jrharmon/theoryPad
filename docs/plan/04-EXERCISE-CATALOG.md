# 04 — Exercise Catalog

Thirteen exercises for the initial build. Each entry is a spec an agent can implement from
without reading anything else except docs 02 and 03.

Format for each: **tags** · **what the player does** · **axes declared** · **params** ·
**generation** · **renders** · **audio** · **defaults** · **milestone**.

**The four groupings below are document organisation only.** The model has no families — every
exercise carries tags (doc 03), because a legato speed drill through a scale is genuinely all
three of those things.

**Shape system:** everything below assumes **three-note-per-string** shapes, which is what
ships. The `shapeSystem` axis and its `'positional'` value are declared in the model but only
offer 3nps until the CAGED tables land in M8 (task 8.7). Where an exercise's `params` mention
`shapeSystem`, treat `'positional'` as unimplemented and throw a clear error rather than
silently falling back.

**Timing:** each exercise declares `timing: 'metronome' | 'free' | 'either'` (default
`'either'`). Free-time mode is a per-run toggle — see doc 03.

Fields marked _(new shared generator)_ mean the exercise needs a piece added to
`src/exercises/shared/` — build it there, with tests, not inline.

---

## Family A — Scales & modes

### A1. `modes-through-key` — Seven modes through a rolled key

**Tags:** `scales` `modes` `whole-neck` `positional`

Your headline exercise, and the first one we build.

**Player does:** a random key is rolled. Play all seven mode shapes in that key, in order
(Ionian → Locrian), each starting from its own position on the neck, ascending and descending.

**Axes:** `shapeSystem`, `direction`, `rhythmPattern`, `neckPosition` (the starting point for
mode 1; the rest follow up the neck). No `targetScaleDegree` since feedback round 7 — see A3.

**Params:**

```ts
{
  variant: 'plain' | 'arpeggio-then-scale' | 'pause-on-root',   // default 'plain'
  modesPerRep: 1 | 7,     // default 7 — one rep covers all seven
  order: 'sequential' | 'random',                                // default 'sequential'
}
```

Built on 3nps shapes, where the seven mode shapes stack naturally up the neck — this exercise
is the main reason 3nps is the default shape system.

The three variants are the ones you described:

- **plain** — just the seven shapes.
- **arpeggio-then-scale** — for each mode, play its diatonic 7th chord arpeggio _ascending_,
  then the full mode scale _descending_. This is the strongest of the three pedagogically: it
  welds the chord to the scale.
- **pause-on-root** — every root is a quarter note and every other note an eighth; after
  each shape, wait for the next bar. Deliberately not musical, so it ignores the rolled
  rhythm. _(Settled at the M3 start: the player does not care how it lines up with bars.)_

**Generation:** for each mode _m_ of the rolled key, find its 3-note-per-string (or positional)
shape, place it at the appropriate neck position, and emit a `scaleRun` — or, for the arpeggio
variant, `arpeggioRun(seventh chord of degree m, ascending)` followed by
`scaleRun(mode m, descending)`. Concatenate with a bar rest between modes. Mark roots and the
target degree via `markRoles`.

**Renders:** tab (7 sections, one per mode, each bar-labelled with the mode name) + neck
overlay showing the current mode's shape. Because the phrase is long, the tab view scrolls
horizontally with the playhead — _(new shared behaviour: `TabStaff` auto-scroll)_.

**Audio:** metronome. Optional generated modal vamp on the rolled key.

**Defaults:** `targetTempo: 76`, `reps: 1`, `tempoPlan: { kind: 'target' }`, `timing: 'either'`.

**Milestone:** M2 (the vertical slice), variants in M3.

---

### A2. `one-note-per-string` — Finding notes across the strings

**Tags:** `scales` `modes` `fretboard-knowledge` `whole-neck`

**Player does:** a key is rolled. Play the next note of the scale on the next string, sweeping
low string to high and back, until you land on the root on the string you started from — or
for a fixed number of sweeps.

**This is a note-finding exercise, not a fingering.** _(Corrected at the M3 start — the first
version of this entry specified "the fret nearest the previous note, within `maxFretJump`",
which fails within four notes: a step per string moves the hand 3–4 frets every string.)_ It is
not meant to flow like a scale. The whole point is jumping from string to string and finding
the note on the fly; you are always limited by how fast you find it, never by getting your
hand there. So:

- **The tab shows note names in place of frets**, and **the neck diagram is empty** — either
  would give the answer away. (`TabNote.display`; the practice view drops an empty neck.)
- The stored fret is simply where the note first falls from the nut. It exists for playback.
- Quarter notes, and a slow default tempo.

**Axes:** `key`, `mode`, `stringSet`.

**Params:**

```ts
{
  stopCondition: 'return-to-root' | 'fixed-cycles',   // default 'return-to-root'
  cycles: number,                                     // default 4, used when 'fixed-cycles'
  step: 'next-scale-degree' | 'skip-one',             // default 'next-scale-degree'
}
```

**Generation:** `oneNotePerString` (shared). `return-to-root` always terminates — the string
repeats every sweep and the degree every seven notes, so they meet at the least common
multiple: 70 notes on six strings, 28 on three, plus the closing root.

**Renders:** tab only.

**Defaults:** `targetTempo: 50`, `reps: 2`, `timing: 'either'`.

**Milestone:** M3 ✅

---

### A3. `interval-sequences` — The scale in 3rds, 4ths, 5ths, 6ths

**Tags:** `scales` `intervals` `positional`

The mockup's "Ascending 4ths in D Dorian, 7th position."

**Player does:** run the scale in the rolled interval through the rolled position, ascending
then descending. (It once also rolled a target degree to "land on"; that only colored the
degree, competed with the circled roots, and was removed in feedback round 7. Only D1 has one.)

**Axes:** `key`, `mode`, `neckPosition`, `intervalPattern` (3rds–7ths, groups of 3 and 4),
`intervalPairing` (same direction: 1-3, 2-4…; alternating: 1-3, 4-2, 3-5…), `direction`,
`rhythmPattern`.

**Params:** none. Positional shapes arrive through the `shapeSystem` axis in M8.

**Generation:** `shapeFrom` + `intervalRun` (shared). The shape is the 3nps one starting on
the first scale note at or above the rolled position — not the root. Figures stop where the
top note would leave the shape rather than wrapping. A descent is built from the top, so it
always opens on a descending figure.

**Renders:** tab + neck overlay. A small extra panel showing the interval shape as a two-note
neck fragment would help — good candidate for the `panels` extension point, but not required
in v1.

**Audio:** metronome.

**Defaults:** `targetTempo: 80`, `reps: 2`, `timing: 'either'`.

**Milestone:** M3 ✅

---

### A4. `position-shifting` — Horizontal runs across the neck

**Tags:** `scales` `horizontal` `whole-neck`

**Player does:** play the scale across the neck rather than inside one box — up through the
3nps shapes, shifting as you go, then back down by a different route.

**The model** _(agreed at the M3 start)_: a string with four notes where the 3nps shape has
three is a shift. Slide into the fourth note and you are in the next shape up, one degree
higher. Four on every string is the classic 4nps diagonal. Coming down, the shifts fall on
other strings — the up counts rotated by one string, which covers exactly the same notes and
lands back where the run started. Shift points are set by the param, never rolled, so pinning
every axis still gives a static exercise.

**Axes:** `key`, `mode`, `neckPosition`, `direction`, `rhythmPattern`. Defaults roll only
`up-down` / `down-up` (a one-way run shows one route) and positions open–7th (the run climbs
ten frets or more).

**Params:** `{ shiftOn: 'every-other-string' | 'every-string' }`, default every other. With
every string there is only one route, so the way down matches the way up.

**Generation:** `horizontalRun` (shared), on `scaleShape` with a note count per string. Shift
notes carry `slide-up` / `slide-down`.

**Renders:** tab + neck overlay of both routes; the neck widens past 15 frets when the run does.

**Defaults:** `targetTempo: 72`, `reps: 2`, `timing: 'either'`.

**Milestone:** M3 ✅

---

## Family B — Theory (no guitar)

### B1. `diatonic-drill` — Notes, chords and spelling from a key signature ("Key signature drill")

**Tags:** `theory` `chords` `no-guitar` `key-signatures`

Your key-signature exercise, as one definition with three question generators selected by
params. A good demonstration of the params extension point.

**Player does:** answers a run of theory questions about the rolled key + mode, with no guitar.

**Axes:** `key`, `mode` (session-scoped — the questions are about the session key, which ties
the theory to what you just played).

**Params:**

```ts
{
  questionTypes: Array<'name-notes' | 'name-chords' | 'spell-chord' | 'chord-function'>, // at least one
  chordDepth: 'triads' | 'sevenths' | 'both',       // default 'both'
  questionCount: number,                             // default 8, 4–16
}
```

_As built (M4):_ `useSessionKey` is gone — the exercise declares `key` and `mode` like any
other, so in a routine it asks about the routine's key automatically. `chordOrder` was not
built. The table questions (notes, qualities) come up at most once per set; spelling and
function questions work through the degrees in a shuffled order so a set never repeats one.

**Question generators:**

| Type             | Format                    | Example                                                                                   |
| ---------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| `name-notes`     | table-fill                | "Name the seven notes of D Dorian." 7 rows, degree given, note picked from options.       |
| `name-chords`    | table-fill                | "Pick the quality for each degree. The root is given." — the 3b mockup exactly.           |
| `spell-chord`    | table-fill or single-pick | "Spell Gmaj7." → four cells, or pick the correct 4-note set from options.                 |
| `chord-function` | multi-pick                | "Which chords are the subdominant family in D Dorian?" — tick every chord in the family. |

**Distractor generation matters more than the question.** A drill where the wrong answers are
obviously wrong teaches nothing. _(At the M4 review: but a drill made only of traps is a game
about spotting the trap. About one question in three sets a near miss; the rest offer plain
alternatives — the key's other notes, its other chords.)_ Rules: for note answers, use chromatic neighbours and the
enharmonic spelling (offer `A♯` when `B♭` is correct); for chord qualities, use the qualities
that appear elsewhere in the same key; for spellings, alter exactly one note. This lives in
_(new shared generator: `distractors`)_ and is worth real test coverage.

**Feedback:** every question carries a `rule` sentence and, where relevant, a `note-row`
visual highlighting the degree in question.

**Renders:** the shared theory renderers (single-pick grid, table-fill).

**Audio:** none. `targetTempo: null`.

**Defaults:** `reps: 1`, 8 questions.

**Milestone:** M4.

---

### B2. `circle-of-fifths` — Key signatures and relationships

**Tags:** `theory` `key-signatures` `no-guitar`

The 3c mockup's subject.

**Player does:** rapid single-pick questions about key signatures, relative keys and circle
position. Number-key answerable, ~6 seconds each.

**Axes:** none rolled from the session — this one deliberately roams all 12 keys regardless of
the session key, because coverage is the point. It uses its own internal weighting toward keys
you've answered wrong or seen least. _(As built in M6: each key weighs (1 + 2 × misses) ÷ (1 + times seen) over the last 30
days of answers, from `answerWeights` in `domain/progress`; a key never seen weighs 1. Mode
questions are still drawn evenly.)_

**Params:**

```ts
{
  questionTypes: Array<'signature-to-key' | 'key-to-signature' | 'relative-minor'
                     | 'relative-major' | 'neighbour-key' | 'mode-signature'>,
  questionCount: number,     // default 10
  includeModes: boolean,     // default true — "how many flats in E♭ Dorian?"
}
```

**Feedback:** always the `circle-of-fifths` visual, with the correct key filled accent and the
picked key in neutral, labelled with its sharp/flat count — exactly the 3c treatment. This is
the strongest teaching moment in the app: it shows you _where you were_ relative to _where you
should have been_.

**Renders:** single-pick grid + the circle-of-fifths strip component.

**Audio:** none.

**Defaults:** `reps: 1`, 10 questions.

**Milestone:** M4.

---

## Family C — Technique

All three share a structure: a repeating mechanical pattern, a rolled position/string set, and
a tempo that may ladder. They exist to be played fast and cleanly, not to teach theory.

### C1. `speed-picking` — Alternate picking drills

**Tags:** `speed` `picking` `scales` `positional`

**Player does:** plays a rolled pattern with strict alternate picking, at a tempo derived from
`targetTempo`.

**Axes:** `neckPosition`, `stringSet`, `permutation`, `rhythmPattern`, `direction`.

**Params:**

```ts
{
  material: 'chromatic' | 'scalar' | 'single-string',   // default 'scalar'
  notesPerString: 3 | 4,                                 // default 3
  showPickStrokes: boolean,                              // default true
}
```

**Generation:** `material: 'chromatic'` uses `chromaticPattern` with the rolled permutation
(1-2-3-4, 1-3-2-4, 4-2-3-1…); `'scalar'` uses `scaleRun` in the session key; `'single-string'`
runs the scale along one rolled string. Pick strokes (down/up) are alternating and emitted as
`annotation` on each note _(new: `TabStaff` renders a small ∏/V above the note when
`showPickStrokes`)_.

**Tempo:** default `tempoPlan: { kind: 'ladder', startPct: 0.85, stepBpm: 4, everyReps: 1 }` —
start below target, step up each rep. `targetTempo` never moves on its own.

**Defaults:** `targetTempo: 120`, `reps: 3`, `timing: 'metronome'` (this drill is meaningless
without a click), `rerollPolicy: 'per-exercise'` — the same pattern across all reps, because
repetition is the point here.

**Milestone:** M8.

---

### C2. `legato` — Hammer-ons and pull-offs

**Tags:** `legato` `speed` `scales` `positional`

**Player does:** slurred runs — only the first note of each string is picked, the rest are
hammered or pulled.

**Axes:** `neckPosition`, `stringSet`, `direction`, `rhythmPattern`.

**Params:**

```ts
{
  pattern: '3nps-runs' | 'trills' | 'rolling-sextuplets' | 'legato-sequence',
  notesPerString: 3 | 4,
  includeSlides: boolean,   // default false
}
```

**Generation:** `scaleRun` through the rolled position, then mark every note that is not the
first on its string with `articulation: 'hammer-on'` (ascending) or `'pull-off'` (descending).
Trills are a two-note oscillation on one string for a whole bar.

**Audio note:** legato notes should play quieter than picked ones — set `velocity: 0.55` on
slurred notes. Small detail, makes playback sound like legato instead of picking.

**Defaults:** `targetTempo: 100`, `reps: 3`, ladder tempo plan, `timing: 'metronome'`.

**Milestone:** M8.

---

### C3. `string-skipping` — Non-adjacent string patterns

**Tags:** `string-skipping` `picking` `arpeggios` `speed`

**Player does:** plays a scale or arpeggio across non-adjacent strings, forcing right-hand
accuracy.

**Axes:** `neckPosition`, `stringSet` (weighted toward non-adjacent sets), `intervalPattern`,
`rhythmPattern`, `direction`.

**Params:**

```ts
{
  material: 'arpeggio' | 'scale-fragment' | 'wide-intervals',
  skipSize: 1 | 2,   // strings skipped between notes; default 1
}
```

**Generation:** take the source material's positions and re-map them onto a skipped string
sequence, choosing the fret on the target string that produces the same pitch where possible
and the nearest scale tone otherwise. _(new shared generator: `remapToStringSet`)_.

**Defaults:** `targetTempo: 92`, `reps: 3`, ladder tempo plan, `timing: 'metronome'`.

**Milestone:** M8.

---

## Family D — Fretboard, ear and improv

### D1. `free-improv-target` — Improvise, landing on a target degree

**Tags:** `improv` `modes` `whole-neck` `timing`

The mockup's "06 free improv" row. No tab, no fixed tempo requirement.

**Player does:** a backing vamp plays in the session key/mode. Improvise freely, but **end
every phrase on the rolled target scale degree**. The app shows the target on the neck and
counts phrases.

**Axes:** `targetScaleDegree` (weighted heavily toward the mode's signature degree),
`backingProgression`, `neckPosition` (a suggested area, not a constraint), `stringSet`.

**Params:**

```ts
{
  phraseLengthBars: 2 | 4 | 8,       // default 4
  phraseCount: number,               // default 8
  constrainToPosition: boolean,      // default false
  showTargetOnNeck: boolean,         // default true
}
```

**Generation:** produces **no phrase** — this is the first exercise where `PlayedInstance.phrase`
is an empty phrase with only bars. It returns a `NeckOverlay` showing the full mode with the
target degree in accent, plus a `BackingPlan`. The runner shows a bar/phrase counter instead
of a playhead over tab.

_This is a useful forcing function:_ it proves the runner doesn't assume every played exercise
has notes. Build it before the technique family so the assumption never sets.

**Renders:** large neck overlay, phrase counter, target-degree callout, backing controls.

**Audio:** a backing track from the pool, looked up by the session key + mode. Metronome
optional (this exercise defaults to free time). If the pool has no track for the rolled
key/mode, the exercise offers to re-roll toward a covered one rather than running silent.

**Defaults:** `targetTempo: 90` (the vamp's tempo), `reps: 1`, `timing: 'free'`.

**Milestone:** M7 (needs backing tracks).

_As built (M7a):_ named "Improvise to a target". `timing: 'either'`, not free: the clock runs so
the phrases can be counted, and the click can be muted. Backing is never automatic (doc 06), so
there is no re-roll toward a covered key — without a track it plays with the click, or over the
drone, which covers every key. `backingProgression` is not among its axes: it only means
anything for generated backing. Phrases are labeled bars (`Phrase 1 · land on F`), which is how
the screen counts them.

---

### D2. `fretboard-note-finding` — Know where the notes are

**Tags:** `fretboard-knowledge` `whole-neck` `theory`

**Player does:** one of several drills, all about locating notes on the neck. Answered by
tapping the fretboard on screen, or (untimed) by playing them and self-advancing.

**Axes:** `key`, `mode` (session), `stringSet`, `neckPosition`.

**Params:**

```ts
{
  drill: 'find-all-of-note'        // "Find every F♯ between frets 0 and 12"
       | 'name-this-fret'          // "What note is 7th fret, A string?"
       | 'find-degree-everywhere'  // "Play the ♭3 of the session key on all six strings"
       | 'octave-shapes',          // "Find the octave of this note on three other strings"
  answerMode: 'tap-fretboard' | 'multiple-choice' | 'self-paced',
  fretRange: { low: number; high: number },
  timeLimitSec: number | null,     // default null
}
```

**Generation:** hybrid kind. `tap-fretboard` and `multiple-choice` produce a `TheoryInstance`
with a custom renderer (an interactive `Fretboard` with click targets); `self-paced` produces
a `PlayedInstance` with a neck overlay and no phrase.

**This one needs an interactive fretboard** — the first place `Fretboard` gains click
handling. Keep the interaction in a `FretboardInput` wrapper so the display component stays
pure.

**Renders:** interactive fretboard, prompt, score.

**Audio:** optional — play the note when found, for reinforcement.

**Defaults:** `targetTempo: null`, `reps: 1`, `timing: 'free'`.

**Milestone:** M8.

**Feeds the fretboard explorer.** Coverage from this exercise is what populates the explorer's
"positions practised / never rolled" panel.

---

### D3. `ear-training` — Identify what you hear

**Tags:** `ear-training` `theory` `intervals` `chords` `no-guitar`

The thing a computer can do that a book cannot.

**Player does:** listens to something the app plays and identifies it.

**Axes:** `key`, `mode` (session) for the mode-identification drill; otherwise self-contained.

**Params:**

```ts
{
  drill: 'interval' | 'chord-quality' | 'mode' | 'scale-degree' | 'progression',
  difficulty: 1 | 2 | 3,          // controls which options are in play
  playbackContext: 'isolated' | 'with-tonic-reference',   // default 'with-tonic-reference'
  replaysAllowed: number,         // default 3
  questionCount: number,          // default 10
}
```

| Drill           | What plays                     | You identify                                      |
| --------------- | ------------------------------ | ------------------------------------------------- |
| `interval`      | two notes, melodic or harmonic | the interval                                      |
| `chord-quality` | a chord                        | maj / min / dim / aug / maj7 / min7 / dom7 / m7♭5 |
| `mode`          | a scale run or a vamp          | which of the seven modes                          |
| `scale-degree`  | tonic reference, then a note   | which degree it was                               |
| `progression`   | 2–4 chords in the session key  | the roman numerals                                |

**Difficulty** governs the option set: level 1 offers only clearly distinct choices (maj vs
min), level 3 offers near neighbours (maj7 vs dom7, Dorian vs Aeolian).

**`playbackContext: 'with-tonic-reference'`** plays the tonic first so the ear has an anchor.
This is how ear training actually works and should be the default.

**Renders:** a custom renderer — a replay button, an option grid, and the standard feedback
panel. No tab, no neck.

**Audio:** this exercise _is_ audio, so it is gated on the audio layer being solid. It will
also expose whether the synth voices are good enough — if maj7 vs dom7 is indistinguishable on
a Tone.js synth, that is the trigger to add sampled instruments.

**Defaults:** `targetTempo: null`, `reps: 1`.

**Milestone:** M7.

---

### D4. `triads-arpeggios` — Chord shapes on string sets

**Tags:** `triads` `arpeggios` `chords` `positional`

Bridges theory and fretboard; CAGED-adjacent without the CAGED jargon.

**Player does:** plays a rolled triad or 7th arpeggio in a rolled inversion on a rolled string
set, then moves it through the diatonic chords of the key up the neck.

**Axes:** `stringSet`, `inversion`, `voicing`, `neckPosition`, `direction`, `rhythmPattern`.

**Params:**

```ts
{
  chordType: 'triad' | 'seventh' | 'both',       // default 'triad'
  movement: 'single-chord' | 'through-the-key' | 'up-the-neck',   // default 'through-the-key'
  arpeggiate: boolean,     // default true; false = strum/hold the shape
}
```

- `single-chord` — one rolled chord, one shape, all inversions.
- `through-the-key` — all seven diatonic chords in order, same string set and inversion.
- `up-the-neck` — one chord, every inversion ascending the neck.

**Generation:** _(new shared generator: `triadShape`)_ — a data table of triad shapes per
string set per inversion per quality, since these are conventional fingerings. `arpeggioRun`
then walks the shape. `voicing` (closed / drop 2 / drop 3 / spread) selects among shape tables.

**Renders:** tab + neck overlay showing the shape, with chord tones labelled by their function
(R, 3, 5, 7) rather than scale degree — _(the `NeckOverlay` note labels need to support
chord-relative degrees, not just scale degrees; add a `labelMode` to the overlay)_.

**Audio:** metronome; "hear it" plays the chord.

**Defaults:** `targetTempo: 80`, `reps: 2`, `timing: 'either'`.

**Milestone:** M8.

---

## Summary table

| id                       | Kind    | Timing    | Tempo | Needs                                | Milestone |
| ------------------------ | ------- | --------- | ----- | ------------------------------------ | --------- |
| `modes-through-key`      | played  | either    | 76    | tab, neck, metronome                 | **M2**    |
| `interval-sequences`     | played  | either    | 80    | `intervalRun`                        | M3        |
| `one-note-per-string`    | played  | either    | 66    | `oneNotePerString`                   | M3        |
| `position-shifting`      | played  | either    | 72    | `horizontalRun`                      | M3        |
| `diatonic-drill`         | theory  | n/a       | —     | theory renderers, `distractors`      | **M4**    |
| `circle-of-fifths`       | theory  | n/a       | —     | circle-of-fifths visual              | M4        |
| `ear-training`           | theory* | n/a       | —     | solid audio, custom renderer         | M7        |
| `free-improv-target`     | played  | free      | 90    | backing tracks, empty-phrase support | M7        |
| `speed-picking`          | played  | metronome | 120   | ladder tempo, pick strokes           | M8        |
| `legato`                 | played  | metronome | 100   | articulation rendering               | M8        |
| `string-skipping`        | played  | metronome | 92    | `remapToStringSet`                   | M8        |
| `triads-arpeggios`       | played  | either    | 80    | triad shape tables                   | M8        |
| `fretboard-note-finding` | mixed   | free      | —     | interactive fretboard                | M8        |

\* `ear-training` is `kind: 'theory'` structurally (questions and answers) even though it makes
sound. The distinction in the model is "does it produce a phrase to play", not "is it silent".

---

## Deliberately deferred

Considered and left out of the initial thirteen — noted so we don't rediscover them:
written interval identification, roman-numeral progression analysis, chromatic warm-up /
spider drills, sight-reading generated tab, bending accuracy, chord-change-per-minute drills,
rhythm-only exercises on a single note, and parallel-mode comparison. Any of these is a
small addition once the system exists.
