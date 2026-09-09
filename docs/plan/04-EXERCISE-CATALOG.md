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
mode 1; the rest follow up the neck), `targetScaleDegree`.

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
- **pause-on-root** — every time the run passes the root, hold it for a full beat before
  continuing. Generated as a longer `durationTicks` on notes with `role: 'root'`.

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

### A2. `one-note-per-string` — Cycling across strings

**Tags:** `scales` `modes` `horizontal` `whole-neck` `fretboard-knowledge`

**Player does:** a key is rolled. Play one note of the scale per string, moving from the
lowest string to the highest and back down, continuing until you land on the root on the
string you started from — or for a fixed number of cycles.

Forces horizontal, whole-neck thinking instead of box shapes. Deceptively hard.

**Axes:** `key`, `mode` (session), `direction`, `rhythmPattern`, `stringSet`, `neckPosition`
(where on the neck to start).

**Params:**

```ts
{
  stopCondition: 'return-to-root' | 'fixed-cycles',   // default 'return-to-root'
  cycles: number,                                     // default 4, used when 'fixed-cycles'
  step: 'next-scale-degree' | 'skip-one',             // default 'next-scale-degree'
  maxFretJump: number,                                // default 5 — keeps it playable
}
```

**Generation:** _(new shared generator: `oneNotePerString`)_. Walk the scale one degree at a
time; for each successive degree, choose the position on the _next_ string in the cycle whose
fret is nearest the previous note (bounded by `maxFretJump`). Reverse direction at the string
set's edges. For `return-to-root`, keep walking until the note is the tonic **and** the string
index equals the starting string; cap at some sane iteration limit and fall back to
`fixed-cycles` if no return occurs (this happens for some scale lengths — the generator must
handle it, and there is a test for it).

**Renders:** tab + neck overlay. The neck overlay is more useful than the tab here, so it gets
the larger slot.

**Audio:** metronome.

**Defaults:** `targetTempo: 66`, `reps: 2`, `timing: 'either'`.

**Milestone:** M3.

---

### A3. `interval-sequences` — The scale in 3rds, 4ths, 5ths, 6ths

**Tags:** `scales` `intervals` `positional`

The mockup's "Ascending 4ths in D Dorian, 7th position."

**Player does:** run the scale in the rolled interval through the rolled position, ascending
then descending, landing on the rolled target degree.

**Axes:** `neckPosition`, `intervalPattern`, `direction`, `rhythmPattern`, `targetScaleDegree`.

**Params:** `{ shapeSystem: '3nps' | 'positional' }` — `'positional'` throws until M8.

**Generation:** _(new shared generator: `intervalRun`)_. Take the scale degrees in the
position window as an ordered array; emit pairs `(i, i+n)` for 3rds → n=2, 4ths → n=3, etc.,
wrapping within the window. Direction controls ascending/descending/up-down.

**Renders:** tab + neck overlay. A small extra panel showing the interval shape as a two-note
neck fragment would help — good candidate for the `panels` extension point, but not required
in v1.

**Audio:** metronome.

**Defaults:** `targetTempo: 80`, `reps: 2`, `timing: 'either'`.

**Milestone:** M3.

---

### A4. `position-shifting` — Horizontal runs across the neck

**Tags:** `scales` `horizontal` `whole-neck`

**Player does:** play the scale across the whole neck rather than inside one box — start at a
rolled position, ascend while shifting position at rolled points, descend via a different
route.

**Axes:** `neckPosition` (start), `stringSet`, `direction`, `rhythmPattern`, `shapeSystem`.

**Params:**

```ts
{
  shiftStyle: 'slide' | 'stretch' | 'shape-change',   // default 'slide'
  fretRange: { low: number; high: number },            // default { low: 0, high: 15 }
  differentRouteDown: boolean,                         // default true
}
```

**Generation:** _(new shared generator: `horizontalRun`)_. Walk the scale ascending; when the
next degree would exceed the current position window, either slide on the same string
(`slide`, marked `articulation: 'slide-up'`), stretch (`stretch`), or jump to the next shape
(`shape-change`). Descending re-runs the walk with a different rolled seed offset so the route
differs.

**Renders:** tab + full-neck overlay (this exercise is about the whole neck, so the overlay
should show all 15 frets, not a position window).

**Audio:** metronome.

**Defaults:** `targetTempo: 72`, `reps: 2`, `timing: 'either'`.

**Milestone:** M3.

---

## Family B — Theory (no guitar)

### B1. `diatonic-drill` — Notes, chords and spelling from a key signature

**Tags:** `theory` `chords` `no-guitar` `key-signatures`

Your key-signature exercise, as one definition with three question generators selected by
params. A good demonstration of the params extension point.

**Player does:** answers a run of theory questions about the rolled key + mode, with no guitar.

**Axes:** `key`, `mode` (session-scoped — the questions are about the session key, which ties
the theory to what you just played).

**Params:**

```ts
{
  questionTypes: Array<'name-notes' | 'name-chords' | 'spell-chord' | 'chord-function'>,
  chordDepth: 'triads' | 'sevenths' | 'both',       // default 'both'
  chordOrder: 'sequential' | 'random' | 'by-function',
  questionCount: number,                             // default 8
  useSessionKey: boolean,                            // default true; false = roll a fresh key
}
```

**Question generators:**

| Type             | Format                    | Example                                                                                   |
| ---------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| `name-notes`     | table-fill                | "Name the seven notes of D Dorian." 7 rows, degree given, note picked from options.       |
| `name-chords`    | table-fill                | "Pick the quality for each degree. The root is given." — the 3b mockup exactly.           |
| `spell-chord`    | table-fill or single-pick | "Spell Gmaj7." → four cells, or pick the correct 4-note set from options.                 |
| `chord-function` | single-pick               | "Which chord is the subdominant in D Dorian?" — the `by-function` grouping you described. |

**Distractor generation matters more than the question.** A drill where the wrong answers are
obviously wrong teaches nothing. Rules: for note answers, use chromatic neighbours and the
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
you've answered wrong or seen least.

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
