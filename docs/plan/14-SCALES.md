# 14 — Scales: pentatonics, blues, harmonic and melodic minor

_Agreed 2026-09-25, from the player's feedback list after "Generated backing". **Tasks 1–5 done,
with a revision at task 3's review that dropped pentatonic shapes as a setting (decision 16).
Task 5 is awaiting review; task 6 is next** (see "Where task 6 starts" at the end). It
goes **after feedback round 7 and before M7b**, on its own branch (`scales`), with a commit per
task and a stop for review after each task, as in the last two runs._

Today every key has a **mode** of the major scale, and nothing else. This run adds a **scale**
between them. You pick the key, then the scale, then the mode, and the modes offered depend on
the scale. _Revised before task 1 (2026-09-25): harmonic and melodic minor have no modes, and
Phrygian dominant is a scale of its own — see decision 10._

| Scale | Its "modes" |
| --- | --- |
| **Major** (today's only scale) | Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian |
| **Minor pentatonic** | none — the position picks the box (decision 16) |
| **Major pentatonic** | none |
| **Blues** (minor blues: minor pentatonic plus the ♭5) | none |
| **Harmonic minor** | none — the Mode control is hidden |
| **Phrygian dominant** (the 5th mode of harmonic minor, as a scale) | none |
| **Melodic minor** (one form up and down, as jazz uses it) | none |

**A mode changes the notes; a shape never does.** A mode of the major scale is a different set
of notes on the same tonic. A pentatonic box is the same notes somewhere else on the neck, so,
as for the 3nps shapes of Major, the rolled position picks it — there is no Shape setting
(decision 16). The box starting on the scale's second note is still what players call shape 2.

---

## Decisions already taken

These were asked and answered on 2026-09-25. Don't reopen them. If one turns out wrong, record
why here.

1. **Scale is a setting like key and mode.** It is a session axis. A routine owns it the same way
   it owns key and mode, and a standalone exercise gets it in the practice strip and in What
   varies. The editor shows **Key, then Scale, then Mode**.
2. **Major, minor and blues pentatonics are separate scales.** ~~Each with Shapes 1–5.~~
   Replaced by decision 16.
3. ~~A pentatonic shape changes the fingering, not the root.~~ Replaced by decision 16.
4. ~~All seven modes of harmonic and melodic minor.~~ **Reopened and replaced by decision 10**
   before any code: most of the fourteen are obscure, several need double accidentals or a B♯ /
   E♯ root (C Ultralocrian, F Altered), and they would clutter every mode list.
5. **Every played exercise takes every scale.**
6. **Theory exercises map pentatonics to their parent mode.** Major pentatonic becomes Ionian.
   Minor pentatonic and Blues become Aeolian. **Harmonic and melodic minor are used as
   themselves**: their own chords and their own modes in the questions.
7. **Harmonic and melodic minor are off for rolls by default.** Nothing rolls them until the
   player adds them to the scales that can be rolled. Picking one explicitly (Fixed) still plays
   it.
8. **Generated backing:**
   - Minor pentatonic uses Aeolian's progressions, and major pentatonic uses Ionian's.
   - Blues gets a 12-bar with dominant 7ths.
   - Harmonic minor gets i–iv–V7.
   - Melodic minor starts as a vamp on the i chord.
9. **Standalone exercises get a Scale setting.** It defaults to Fixed: Major, which is exactly
   today's behavior.

Asked and answered before task 1, 2026-09-25:

10. **Only Major has modes.** (As agreed: "modes, shapes, or neither" — the shapes went with
    decision 16.) Every other scale, the pentatonics included, has none: the Mode control is hidden, and in the model each has one mode whose id is the
    scale's own (`harmonic-minor`, `phrygian-dominant`, `melodic-minor`). A future scale such
    as whole tone arrives the same way, with no baggage. So the scale menu reads *Major, Minor
    pentatonic, Major pentatonic, Blues, Harmonic minor, Phrygian dominant, Melodic minor*.
11. **Seven-note scales without modes still get the 3nps shapes**, exactly as Major does: a
    rolled position picks the box, and *Modes up the neck* walks all seven. There is no Shape
    setting for them (Major has none either); adding one later is additive. Confirmed at task
    1's review.
12. **The circle-of-fifths drill is Major-only.** Harmonic minor, Phrygian dominant and melodic
    minor have no key signature of their own (A harmonic minor is written in A minor's
    signature with G♯ as an accidental), so the drill leaves them out rather than ask a trick
    question. Pentatonics and blues sit inside a Major mode, so they go through it.
13. **Spelling.** Harmonic and melodic minor on G♯/A♭ are **A♭** (G♯ would need an F𝄪).
    Everywhere else the new scales borrow a related Major mode's spelling — see the model.
14. **Backing tracks.** Pentatonics and blues match their parent mode's tracks (A minor
    pentatonic finds A Aeolian tracks). Harmonic minor, Phrygian dominant and melodic minor
    match none this run; the track form stays Major-only. Generated backing covers them.
15. **`shapesPerRep` is a maximum.** A scale with fewer shapes stops at its own count.

Revised at task 3's review, 2026-09-25:

16. **No pentatonic shapes as a setting.** The point of picking a mode is that it changes the
    notes relative to the root. A pentatonic shape doesn't: Shape 3 and Shape 4 are the same
    notes in different places, just as the seven 3nps shapes of a Major mode are, and those were
    never a setting (decision 11). So minor pentatonic, major pentatonic and blues have no
    modes, like harmonic minor: the Mode control is hidden, a key reads "A minor pentatonic",
    and **the rolled position picks the box** — the one starting on the first of its notes at
    or above the position on the lowest string, the rule the 3nps shapes follow. *Modes up the
    neck* walks all five boxes. Settings has no Shapes row. What this gives up: a setting to
    drill one numbered box in every key; if wanted later, it is an exercise option, not a mode.

Asked and answered before task 4, 2026-09-25:

17. **Position shifting on a box scale: a three-note string is the shift.** The box version of
    the 3nps rule — boxes are two notes a string, and a string with three slides the hand into
    the next box. *Every other string* climbs one box per pair of strings (A minor pentatonic
    from 5: E 5-8-10, A 7-10, D 7-10-12, G 9-12, B 10-13-15, e 12-15); *every string* is the
    three-per-string pentatonic diagonal, about seventeen frets. The way down shifts on the
    other strings and covers the same notes. Blues is the minor pentatonic run with the ♭5
    added on the 4th's string, as in its boxes.
18. **Interval sequences on a box scale offer 3rds, 4ths, groups of 3 and groups of 4**,
    counted in scale steps (3rds is every other note, 4ths skips two), the names pentatonic
    sequences go by. 5ths, 6ths and 7ths are left out: on five notes a "6th" is an octave and a
    "7th" passes it. A pinned one rolls another there, as a pinned mode does.
19. **Blues' ♭5 is a step, except in One note per string's skip-one.** It is in the box under
    the hand, so interval sequences and the walking sweep count it. Skipping one over six notes
    would only ever reach A, D and E, so skip-one steps through the five pentatonic notes — the
    ♭5 treated as passing, as *Land on* already does.

Asked and answered before task 5, 2026-09-26:

20. **The Key signature drill on a pentatonic names its own notes and its parent's chords.**
    *Name the notes of A minor pentatonic* asks its own notes (blues' ♭5 included) — the notes
    just played. The chord questions (qualities, spelling, families) use the parent mode's
    chords and say so: "…in A Aeolian, the parent of A minor pentatonic". This is how decision
    6 is applied.
21. **The Circle of fifths drill stays Major-only.** It roams every key on its own, and a
    pentatonic's signature is its parent mode's, so a pentatonic signature question would be
    the Aeolian or Ionian question again. The circle beside a pentatonic exercise already
    lights the parent key (task 3).

## Defaults taken (not asked; say if wrong at the first review)

- **Names.**
  - The scale menu: see decision 10.
  - A brief reads "D Dorian", "A minor pentatonic", "E blues", "E Phrygian dominant" or
    "A harmonic minor" (`keyModeName`).
  - For a scale without modes — every scale but Major — the Mode control is hidden.
- **"Off by default" uses the existing struck-out mechanism.** Settings → Keys and modes gains
  **Scales**. Harmonic minor, Phrygian dominant and melodic minor start struck out, so they
  never roll, while a Fixed choice still plays them. A new install and an existing one both get
  this default.
- **Struck-out modes** are the seven Major modes; mode ids are stored in the rep log, so never
  renamed. Each other scale's single mode has the scale's own id.
- **Existing data doesn't move.** A stored policy, rep, routine or export with no scale reads as
  Major. There is no migration beyond adding the default.
- **Position picks the box** (decision 16), for pentatonics as for 3nps shapes.
- **Modes up the neck** on a pentatonic plays all five shapes in order up the neck, starting from
  the shape that falls at `minFret`. It is the same idea as the seven 3nps shapes.
  - Its *arpeggio-then-scale* variant arpeggiates the scale's own tonic chord within each shape:
    m7 for minor pentatonic and blues, 6 for major pentatonic.
  - On harmonic and melodic minor it works as it does today: seven 3nps shapes, with each shape's
    7th chord taken from that scale's own chords.
- **Interval sequences count scale steps.** "3rds" on a pentatonic means every other note of the
  scale, which is what the pattern already does. The pattern names stay the same.
- **Circle of fifths:** see decision 12.
- **Key × mode heat grid** on `/fretboard` stays Major-only in this run. Other scales are still
  logged. The grid only shows the Major scale.
- **Fretboard explorer and the key/mode reference** support every scale.
  - The explorer gets a Scale picker.
  - The reference shows the notes, the degrees, the shapes, and the chords where the scale has
    diatonic chords. Pentatonics show their parent mode's chords, labeled as the parent's.

## The model

_As built in task 1; `src/domain/music/scales.ts` holds the tables._

- `KeyMode` becomes `{ tonic, scale, mode }`, `scale` required. Stored data with no scale reads
  as Major at the edge where it is loaded (so far: backing tracks, in the video repository).
  - `ScaleId` is `'major' | 'minor-pentatonic' | 'major-pentatonic' | 'blues' | 'harmonic-minor'
    | 'phrygian-dominant' | 'melodic-minor'`, in menu order (`SCALE_IDS`).
  - `ModeId` is `ModeName | Exclude<ScaleId, 'major'>`: Major's seven, and each other scale's
    one mode, whose id is its own. (Task 1 had `ShapeId`s for the pentatonics; decision 16
    removed them.)
  - `ModeName` (the seven) survives as the Major scale's modes, so existing code that means "a
    mode of major" can say so. `modesOf(scale)`, `isModeOf(scale, mode)`, `scaleKind(scale)`.
- **Intervals are our own tables**, one list per Major mode and per other scale; `tonal` only
  transposes. Notes are spelled by transposing the tonic by each interval.
- **Scale step vs degree.** Today's code assumes seven notes, where step *n* is degree *n*. That
  stops being true:
  - A pentatonic has five steps.
  - Blues has six, and two of them are 5ths (♭5 and 5).
  - With no Ultralocrian, `Alteration` stays `-1..1`.

  Generators that walk the scale use steps (an index into `scaleNotes`). Anything that names a
  note uses the degree. `noteAtDegree(km, n | degree)` throws where the scale has no such degree
  (`hasDegree` checks); a bare 5 in blues is the natural 5th, and the ♭5 needs the full degree.
  Callers that assume seven must be found (see "Things that will bite").
- **Parent mode.** `parentMode(km)` is the Major-scale mode, **on the same root**, whose notes
  contain the scale's: the mode itself for Major, Aeolian for minor pentatonic and blues, Ionian
  for major pentatonic, and **null** for harmonic minor, Phrygian dominant and melodic minor,
  which aren't inside any Major mode. `harmonyOf(km)` is the key whose chords go with the
  scale: its own, or the parent's for a pentatonic — theory (decision 6) and generated backing
  (decision 8) use it. Key signatures go through the parent: `keySignature`/`relativeMajor`
  throw for a scale with none, and `hasKeySignature` checks.
- **Chords.**
  - `diatonicChords(km)` works for Major, harmonic minor, Phrygian dominant and melodic minor,
    and throws for a pentatonic (pass `harmonyOf(km)`).
  - That needs the augmented triad (already a `TriadQuality`) and a new `maj7sharp5` seventh,
    written `maj7#5`.
  - Families stay "by degree", as in feedback round 6.
  - Pentatonics have no diatonic chords of their own; callers use the parent mode.
- **Spelling.** `preferredTonic(chroma, spelling)` and `tonicsForMode(spelling)` take a Major
  mode name, as before, or a `{ scale, mode }`. Each scale borrows a related Major mode's tonic
  (`spelledAs`): its parent for the pentatonics and blues, Aeolian for harmonic and melodic
  minor, Phrygian for Phrygian dominant. So "E♭ minor pentatonic" and "C♯ melodic minor". Where
  the borrowed tonic would give the scale a double accidental, the scale spells itself: A♭
  harmonic and melodic minor, E♭ (not D♯) Phrygian dominant. Blues always keeps its parent's
  tonic; where its ♭5 would be a double flat (E♭ blues' B𝄫) that one note is written as the
  plain enharmonic (A). No tonic is ever E♯, B♯, F♭ or C♭.
- **Signature degree and mode character.** Keyed by `characterId(km)`: the mode for Major, the
  scale otherwise (a shape doesn't change how a scale sounds). Signature degrees, drafted for
  the player to edit: minor pentatonic ♭3, major pentatonic 3, blues ♭5, harmonic minor 7,
  Phrygian dominant 3, melodic minor 6. Each new scale has prose in `MODE_CHARACTER`, also
  drafted. Pentatonics carry no progressions; `progressionsFor(km)` gives the parent's.

## Tasks, in order

1. **Domain: scales, modes, spelling, chords** (`src/domain/music`).
   - The tables, `KeyMode.scale`, steps vs degrees, 𝄫, and parent mode.
   - Chords of harmonic and melodic minor, signature degrees, and mode prose.
   - Unit tests: every scale × mode spells one letter per degree (pentatonics excepted); chord
     qualities of HM and MM; parent mapping.
2. **Shapes** (`src/domain/instrument`).
   - Pentatonic boxes: two notes per string, starting on step *n* for the box called shape *n*.
   - Blues boxes: the minor pentatonic box with the ♭5 added wherever it falls, so some strings
     get three notes.
   - Placement nearest a fret.
   - 3nps for HM and MM should already work; check it.
   - Screenshot all five shapes of each pentatonic on the explorer before calling it done.
3. **The scale axis and settings** (`src/domain/variation`, `src/data`, settings UI).
   - The `scale` session axis, rolled before mode. Mode candidates depend on the scale.
   - Struck-out scales, with HM and MM struck by default.
   - Persistence with Major as the absent default: exercises, routines, reps, `transfer.ts`.
   - The policy editor's Key → Scale → Mode order, and the strip.
4. **Played exercises** on every scale: Modes up the neck, Interval sequences, One note per
   string, Position shifting, Improvise to a target, plus their briefs. Screenshot each on one
   pentatonic, Blues and Harmonic minor.
5. **Theory, reference and explorer.**
   - The diatonic drill on HM and MM, using their own chords, and on pentatonics via the parent.
   - The circle of fifths via the parent signature.
   - KeyModeView and the explorer's Scale picker.
6. **Generated backing per scale.**
   - Progression lists for the new scales, alongside the existing ones, so the player can edit
     them like the drum tab.
   - Blues gets a dominant 12-bar.
7. **The gate.**

## Things that will bite

- **Seven is hard-coded in more places than the types admit.** Look for these:
  - `DEGREE_NUMBERS` and `MAJOR_STEPS`
  - the `candidates: () => [1..7]` of `targetScaleDegree` (its weighting uses `signatureDegree`)
  - `shapesPerRep` max 7 and "All seven shapes" in *Modes up the neck*
  - the theory question generators
  - the key × mode grid
  - `modeTitle`
  - the chord-family table

  Grep for `7`, `% 7`, `ModeName` and `MODE_NAMES` before starting task 1.
- **Blues has two 5ths.** Anything keyed by degree *number* (the tab's degree annotations, the
  neck overlay, the target-degree axis) needs the full degree, alteration included.
- **Improvise to a target on a pentatonic.** (`hasDegree` exists for this.) Its target candidates must come from the scale's
  own degrees. You can't land on a 2 in minor pentatonic.
- **Held values and seeds.** Adding a session axis before mode shifts the roll order. Existing
  seeds will roll differently, which is fine. Golden files will change: check that the diff is
  only that.

## What only the player can judge, at the gate

- Are the pentatonic and blues boxes the ones he plays?
- Does the position pick the box you expect?
- Are harmonic minor, Phrygian dominant and melodic minor usable as they are?
- Is the 12-bar blues backing any good?

## Not in this run

- Other scales: diminished, whole tone, bebop, and the major blues scale.
- The other modes of harmonic and melodic minor (Lydian dominant, Altered and the rest) —
  decision 10.
- A pentatonic CAGED system. The player plays 3nps for seven-note scales, and the pentatonic
  boxes are their own thing.
- The key × mode grid for non-Major scales.

---

## Outcomes

### Task 1 — Domain: scales, modes, spelling, chords (2026-09-25)

Built as "The model" above describes. New `src/domain/music/scales.ts` holds the scale table
(title, name, kind, modes, parent, `spelledAs`), the interval tables, `parentMode`,
`harmonyOf`, `hasOwnChords`, `modeTitle` (moved here; now also "Shape 2" and scale titles),
`keyModeName` (moved from `theory/diatonic.ts`) and `characterId`. `scale.ts` works in steps
and degrees; `spelling.ts` borrows spellings; `chords.ts` adds `maj7sharp5`; `keySignature.ts`
goes through the parent; `modeCharacter.ts` has entries for the six new scales and
`progressionsFor`.

The rest of the app compiles against the new `KeyMode` with **no change in behavior**: every
key built today is `scale: 'major'`; code that means a Major mode narrows (`as ModeName`) where
its task will generalize it; generated backing already takes chords through `harmonyOf`. The
one data-layer change: a stored backing track with no `scale` reads as Major (tested). No UI
changed.

Tests: `scales.test.ts` spells every scale × mode × tonic cleanly from a usual tonic name,
one letter per degree for seven-note scales; formulas and notes of each new scale; tonic lists;
blues' two 5ths; the chords and numerals of harmonic minor, Phrygian dominant and melodic
minor; parent mapping and signatures; names. The character tests now cover every scale.
`pnpm check` green (776 unit tests), E2E 69/69.

Left for later tasks, found by the seven grep: `shapes.ts` `count = 7` (task 2); the axes,
roller, entities (`sessionMode`, `blockedModes`), strike-out list, policy editor and chord
context (task 3); `shapesPerRep`, `arpeggioRun`'s `% 7`, `oneNotePerString`'s coprime-to-seven
(task 4); `diatonic.ts` (`rng.int(7)`, `[1..7]`, `% 7`, `ORDINAL`, `SEVENTH_OPTIONS` lacks
`minMaj7`/`maj7#5`), TheoryBody's `n > 7`, `circleQuestions`, `KeyModeView`/`NoteRow`
`grid-cols-7`, the explorer (task 5); `progression.ts`'s `[1-7]` parse (task 6). Phrygian
dominant's backing progressions are a draft (vamp on I, and I–♭II) for task 6 to confirm.

Reviewed: shapes recommendation (decision 11) confirmed; names fine.

### Task 2 — Shapes (2026-09-25)

`src/domain/instrument/shapes.ts`:
- **A pentatonic box is the 3nps generator at two notes a string**, starting on the shape's
  step on the lowest string — nothing tabled. In standard tuning that gives exactly the five
  standard A minor pentatonic boxes (tested fret by fret).
- **Blues** is the minor pentatonic box with the ♭5 added on the 4th's string, one fret above
  the 4: between 4 and 5 where they share a string, after the 4 where the 5 starts the next.
  So box 1 has A string 5-6-7 and G string 5-7-8; box 2 has both E strings 8-10-11 and G
  string 7-8-9.
- **`boxShape(instrument, keyMode, nearFret)`** places the key's shape at the octave copy
  whose first note is nearest `nearFret` (A minor Shape 4 near fret 3 is the open box; near
  9 it is at 12).
- **`shapesUpTheNeck`** on a pentatonic scale climbs through all five boxes from `minFret`
  (A minor from fret 1: shapes 5, 1, 2, 3, 4 at frets 3, 5, 8, 10, 12); on any other scale its
  default count is the scale's note count, so seven for everything seven-note. `NeckShape`
  carries `shape` for a box.
- **Harmonic minor, Phrygian dominant and melodic minor** get all seven 3nps shapes with no
  change to the generator (tested).
- **Major pentatonic is numbered from its own root**: C major pentatonic Shape 1 starts on C
  (fret 8), which is A minor pentatonic's Shape 2 box. For the player to confirm at the gate.

Also fixed, as "Things that will bite" predicted: the neck overlay matched its target by
degree number, so blues lit both the 5 and the ♭5. It now matches the full degree (tested).
`exercises/shared/roles.ts` still compares numbers; task 4 takes it with the target axis.

Looked at: the dev gallery (`/#/dev/gallery`) has a new "Pentatonic and blues boxes" section
with all five shapes of each scale; screenshotted in light and dark. The explorer gets its
Scale picker in task 5, where its reference panel learns about scales without chords of
their own. Every box of every pentatonic scale is whole and in reach on standard, drop D,
7-string and bass (drop D's low string stretches one blues box to six frets).
`pnpm check` green (788 unit tests), E2E 69/69.

Reviewed: these are the boxes the player plays; major pentatonic Shape 1 starts on the root —
both confirmed.

### Task 3 — The scale axis and settings (2026-09-25)

- **`scale` is a session axis**, rolled first (`SESSION_AXIS_ORDER` is scale, mode, key). Its
  default policy is **Fixed: Major**, so an exercise, routine or policy stored before scales
  existed plays exactly as before. The mode axis offers the rolled scale's modes (shapes for a
  pentatonic, the one own-named mode for harmonic minor, Phrygian dominant and melodic minor);
  the key axis spells for the scale and mode. An exercise that doesn't declare `scale` is
  Major.
- **A pinned value the roll can't use now rolls** instead of throwing: a Dorian pin when the
  scale rolls a pentatonic, or an unknown value. (It used to throw on an unknown value.)
- **Land on** (`targetScaleDegree`) offers only the scale's own degrees — no 2 or 6 in minor
  pentatonic — and never blues' ♭5, a passing note. So a bare degree number always names one
  note. Its signature weighting compares full degrees.
- **Settings → Keys and modes** has **Scales** (harmonic minor, Phrygian dominant and melodic
  minor struck out by default, for new and existing installs — tested), **Modes** (of the Major
  scale) and **Shapes** (shared by the three pentatonic scales), stored as `blockedScales` and
  `blockedModes`. A scale whose every mode is struck out is skipped when the mode rolls.
- **Routines** own the scale with the key and mode: the builder's session editor has it, and
  every item plays the routine's scale (tested).
- **The policy editor** reads Key → Scale → Mode. The mode row is "Shape" for a pentatonic,
  hidden for a scale with one mode, and "Mode or shape" (Major modes and shapes) while the
  scale rolls. A pinned mode the pinned scale doesn't have shows as Roll, which is what the
  roller does; it isn't cleared, so it comes back if the scale does. Library rows don't say
  "Scale: Major" (the default).
- **The strip** reads "A minor pentatonic, shape 2" in its "Key & scale" cell (or "Key & mode"
  for Major), fresh when the key, scale or mode changed. Briefs and the backing menu name the
  key the same way (`keyModeName`).
- **Data**: reps carry `scale` in their axes when the exercise declares it; a rep without one
  was Major. The key × mode grid counts Major passes only (`keyModeOf`), and the explorer's
  "last key" stays Major until task 5. The CSV export gains a `scale` column. Nothing needed
  migrating: `transfer.ts` round-trips as before (E2E).
- **Which exercises have it**: the five played exercises declare `scale`. Position shifting is
  limited to the scales it can play today (not the pentatonics, whose two-note boxes it can't
  shift through yet); task 4 opens it and makes every exercise play the right shapes. The
  diatonic drill does not declare it until task 5 — in a pentatonic routine it rolls its own
  Major mode meanwhile.
- **To keep a pentatonic from crashing the practice screen**, chords there go through
  `harmonyOf` (the backing menu, the improv chord counter, the generated backing editor, the
  reference panel), and the circle of fifths draws nothing for a key without a signature. That
  is the agreed behavior; task 5 still labels the reference's borrowed chords and fixes its
  seven-column note row.

Looked at: the editor (pinned pentatonic, rolling scale, harmonic minor), the practice screen
on A minor pentatonic shape 2, and Settings, in light and dark. `pnpm check` green (793 unit
tests), E2E 69/69.

Reviewed: everything reads fine — but the player questioned shapes as a setting at all, which
led to decision 16 and the revision below.

### Revision — no pentatonic shapes (2026-09-25)

Decision 16, applied to tasks 1–3:
- **Music domain:** `SHAPE_IDS`, `ShapeId` and `shapeNumber` are gone. Minor pentatonic, major
  pentatonic and blues each have one mode, whose id is the scale's own, like harmonic minor.
  Scales carry a `fingering` (`3nps` or `box`); `hasModes` (Major only) and `playsInBoxes`
  replace the scale kinds. `keyModeName` reads "A minor pentatonic".
- **Instrument:** `boxShape(instrument, keyMode, fret)` takes the box starting on the first of
  the scale's box notes at or above `fret` on the lowest string (A minor pentatonic at 6 is the
  C box at 8, not the A box at 5). A box that can't be played there — near the nut, C♯ minor
  pentatonic from the open E would need an F♯ below the open G — gives way to the next one up;
  near the top, where none fits, the start moves down. `shapesUpTheNeck` is unchanged apart
  from dropping `shape`; `startDegree` is the step a box starts on (2 for "shape 2").
- **Variation and UI:** the mode row is always "Mode" and appears only when the scale is Major
  or rolls; the "skip a scale whose shapes are all struck out" rule and the Settings Shapes
  row are gone. Nothing stored used shape ids (the branch is unmerged), so nothing migrates.
- The gallery shows each pentatonic's five boxes up the neck, labeled by the step each starts
  on.

`pnpm check` green (792 unit tests), E2E 69/69. Looked at: the editor on Blues (no Mode row),
the strip ("A blues"), and the gallery boxes.

Reviewed: "looks right".

### Task 4 — Played exercises on every scale (2026-09-25)

Decisions 17–19 were asked and answered first. Every played exercise now plays every scale; a
box scale plays its boxes.
- **Shapes at a position.** `shapeFrom` hands a box scale to `boxShape` (unless the caller
  asks for its own notes per string), so *Interval sequences* plays the box at the rolled
  position. *Modes up the neck* already walked the five boxes through `shapesUpTheNeck`.
- **Position shifting** (decision 17). `horizontalRun` counts from the scale's own notes per
  string — three, or two for a box — and a string with one more is the shift. A box scale runs
  on its five notes (`withoutPassingNotes`, new in `scales.ts`: blues without its ♭5, anything
  else unchanged) and blues then gets `addBluesFifth`, the ♭5 insertion pulled out of
  `boxAt` in `shapes.ts`. The `allowedValues` limit is gone.
- **Modes up the neck.** `shapesPerRep` is clamped to `shapeCount(keyMode)` (decision 15:
  five on a box scale); the brief reads "All five boxes in A minor pentatonic" and each bar
  "Fret 8 · shape 2". *Arpeggio then scale* takes its chord from `shapeChord`: each 3nps
  shape's own 7th chord as before, and on a box scale the scale's tonic chord in every box —
  Am7 for A minor pentatonic and blues, C6 for C major pentatonic — named in the brief.
  `arpeggioRun` now matches full degrees, so blues' ♭5 is never taken for the 5.
- **Interval sequences** (decision 18). The interval axis offers a box scale 3rds, 4ths and
  the groups (`intervalPatternsFor`); a pinned 5th, 6th or 7th rolls another there.
- **One note per string** (decision 19). Skip-one steps through `withoutPassingNotes`, so
  blues skips A D G C E; walking keeps the ♭5.
- **Roles.** `roleFor`, `noteOptionsFor` and the shared overlay take the target as a full
  degree; *Improvise to a target* passes its note's degree, so blues rings its 5 and not the
  ♭5. The unused `signatureDegreeNumber` is gone, and `landingDegrees` uses
  `withoutPassingNotes` too.
- **Text.** The descriptions of *Modes up the neck*, *Interval sequences* and *Position
  shifting* mention boxes; the improv panel reads "The scale on the neck" (was "mode").

Tests: the registry invariant ("plays only real positions, in the key") now runs every played
exercise on every scale on every test instrument; the shifting run's invariants run on Major,
minor pentatonic and blues on three guitars; the exact A minor pentatonic run of decision 17
both ways; blues' ♭5 above every 4 both ways, never carrying a slide; `shapeFrom` taking the
box; the box scales' tonic chords; blues' skip-one; blues' target; the interval axis on a box
scale. Golden files unchanged. `pnpm check` green (936 unit tests), E2E 69/69.

Looked at, A as the key, 5th position where there is one: every exercise on minor pentatonic,
blues and harmonic minor, blues in dark too, and the arpeggio variant on both box scales. The
tab matched the box at the position every time; Position shifting played exactly decision
17's run.

For the review:
- Does the pentatonic shifting run (every other string, and every string) feel right under
  the hand? Blues' ♭5 sits on the 4th's string, so where the 4 is a shift note the ♭5 follows
  the slide (E 5-8-/10-11).
- On a box scale, *Modes up the neck*'s arpeggio variant plays the same Am7 in every box.

Reviewed: no changes asked for; the player went straight on to task 5.

### Task 5 — Theory, reference and explorer (2026-09-26)

Decisions 20 and 21 were asked and answered first.
- **Key signature drill** declares `scale`, so a routine's scale reaches it. *Name the notes*
  asks the scale's own notes — four rows for a pentatonic, five for blues — and its rule says
  how the scale is made from one the player knows ("A minor pentatonic is A Aeolian without
  its 2nd and 6th", "A harmonic minor is A natural minor with its 7th raised", "E Phrygian
  dominant is E Phrygian with its 3rd raised"; `SCALE_ORIGIN` in `theory/diatonic.ts`). The
  chord questions work on `harmonyOf`: a pentatonic's are its parent's and name it ("…in A
  Aeolian, the parent of A minor pentatonic"); harmonic minor, Phrygian dominant and melodic
  minor ask about their own chords, and their 7th-chord table offers mMaj7 and maj7#5 too
  (seven options, keys 1–7; a Major key still offers five). Families stay by degree. The
  brief says "1 question", not "1 questions".
- **Circle of fifths drill**: unchanged (decision 21).
- **Reference panel** (`KeyModeView`): one note column per note (five, six or seven); a
  pentatonic's chords are headed "Chords · from A Aeolian" (the popover: "Chords of C
  Ionian"); the kicker reads "Key & scale" for a scale without modes; the signature note is
  matched by full degree, so blues marks its ♭5 and not its 5.
- **Explorer**: a Scale picker between Key and Mode; the Mode picker only for Major. Leaving a
  pentatonic for Major keeps its home — A minor pentatonic becomes A Aeolian (the parent), a
  scale without one becomes Ionian. A box scale's shape buttons read "Shape 2 · fret 8"; the
  title and the legend use the scale's name. The "last key" it opens on keeps its scale
  (`lastKeyMode`). The key × mode grid stays Major-only, as agreed.

Tests: the drill on a pentatonic (own notes, the rule, blues' five, the parent-named family
question), harmonic minor's 7th qualities and options, a whole set on every scale with every
answer among its options, and the last key in its scale. `pnpm check` green (945 unit tests),
E2E 69/69.

Looked at: the explorer on A minor pentatonic with Shape 2 picked, A blues in dark, the switch
back to Major; the drill's name-the-notes and family questions on A minor pentatonic and the
7th-chord table on A harmonic minor; the popover on C major pentatonic.

For the review:
- On a pentatonic, *Name the notes* offers only the scale's other notes (plus the occasional
  spelling trap), so it is mostly "which note is which degree". Enough, or too easy?
- The prompts naming the parent are long ("…in A Aeolian, the parent of A minor pentatonic").

### Where task 6 starts

Task 6 is **Generated backing per scale** (decision 8). Known gaps:
- `progression.ts` parses only degrees `[1-7]` — check what a scale's progression lists need
  and keep the lists editable like the drum tab.
- Minor pentatonic uses Aeolian's progressions and major pentatonic Ionian's (already so via
  `progressionsFor`). **Blues** gets a 12-bar with dominant 7ths — the chords are not the
  parent Aeolian's (I7–IV7–V7 aren't diatonic to it), so it needs its own chord source.
- Harmonic minor: i–iv–V7. Melodic minor: a vamp on i. **Phrygian dominant**'s are a draft
  from task 1 (vamp on I; I–♭II) for the player to confirm.
