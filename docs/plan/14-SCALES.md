# 14 — Scales: pentatonics, blues, harmonic and melodic minor

_Agreed 2026-09-25, from the player's feedback list after "Generated backing". Not started. It
goes **after feedback round 7 and before M7b**, on its own branch (`scales`), with a commit per
task and a stop for review after each task, as in the last two runs._

Today every key has a **mode** of the major scale, and nothing else. This run adds a **scale**
between them. You pick the key, then the scale, then the mode, and the modes offered depend on
the scale:

| Scale | Its "modes" |
| --- | --- |
| **Major** (today's only scale) | Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian |
| **Minor pentatonic** | Shape 1 – Shape 5 |
| **Major pentatonic** | Shape 1 – Shape 5 |
| **Blues** (minor blues: minor pentatonic plus the ♭5) | Shape 1 – Shape 5 |
| **Harmonic minor** | Harmonic minor, Locrian ♮6, Ionian ♯5, Dorian ♯4, Phrygian dominant, Lydian ♯2, Ultralocrian |
| **Melodic minor** | Melodic minor, Dorian ♭2, Lydian augmented, Lydian dominant, Mixolydian ♭6, Locrian ♮2, Altered |

**A shape works like a mode, except that it doesn't change the root.** A mode of the major
scale is a different set of notes on the same tonic. A pentatonic shape is the same five notes
in a different box on the neck. So "A minor pentatonic, Shape 2" has A as its root and plays the
box that starts on C, the scale's second note.

---

## Decisions already taken

These were asked and answered on 2026-09-25. Don't reopen them. If one turns out wrong, record
why here.

1. **Scale is a setting like key and mode.** It is a session axis. A routine owns it the same way
   it owns key and mode, and a standalone exercise gets it in the practice strip and in What
   varies. The editor shows **Key, then Scale, then Mode**.
2. **Major, minor and blues pentatonics are separate scales**, each with Shapes 1–5.
3. **A pentatonic shape changes the fingering, not the root.** See above.
4. **All seven modes of harmonic and melodic minor.** The player strikes out any they don't want.
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

## Defaults taken (not asked; say if wrong at the first review)

- **Names.**
  - The scale menu reads *Major, Minor pentatonic, Major pentatonic, Blues, Harmonic minor,
    Melodic minor*.
  - A brief reads "A minor pentatonic, shape 2" or "E Phrygian dominant".
  - For a pentatonic scale the Mode control is labeled **Shape**.
- **Mode names.**
  - The seventh mode of harmonic minor is *Ultralocrian*: 1 ♭2 ♭3 ♭4 ♭5 ♭6 𝄫7.
  - The seventh mode of melodic minor is *Altered*, spelled 1 ♭2 ♭3 ♭4 ♭5 ♭6 ♭7 with one letter
    per degree. We don't use tonal's spelling, which writes two 2nds and no 5th.
- **"Off by default" uses the existing struck-out mechanism.** Settings → Keys and modes gains
  **Scales**. Harmonic minor and melodic minor start struck out, so they never roll, while a
  Fixed choice still plays them. A new install and an existing one both get this default.
- **Struck-out modes are one list across scales.** Mode ids are unique app-wide (for example
  `phrygian-dominant`). The five shapes (`shape-1` … `shape-5`) are shared by the three
  pentatonic scales, so striking out Shape 3 strikes it out for all three.
- **Existing data doesn't move.** A stored policy, rep, routine or export with no scale reads as
  Major. There is no migration beyond adding the default.
- **Position and shape together.**
  - A pentatonic shape sits at one fret, give or take an octave.
  - An exercise that rolls a position places the shape at whichever octave copy lies nearest
    that position. Position still means "low or high on the neck".
  - The shape decides the box.
- **Modes up the neck** on a pentatonic plays all five shapes in order up the neck, starting from
  the shape that falls at `minFret`. It is the same idea as the seven 3nps shapes.
  - Its *arpeggio-then-scale* variant arpeggiates the scale's own tonic chord within each shape:
    m7 for minor pentatonic and blues, 6 for major pentatonic.
  - On harmonic and melodic minor it works as it does today: seven 3nps shapes, with each shape's
    7th chord taken from that scale's own chords.
- **Interval sequences count scale steps.** "3rds" on a pentatonic means every other note of the
  scale, which is what the pattern already does. The pattern names stay the same.
- **Circle of fifths.**
  - Harmonic and melodic minor, and their modes, are written with the key signature of the
    parent's natural minor, plus accidentals. That is the usual convention.
  - So "E Phrygian dominant" asks about A minor's signature, and a question never pretends a
    scale has a signature of its own.
- **Key × mode heat grid** on `/fretboard` stays Major-only in this run. Other scales are still
  logged. The grid only shows the Major scale.
- **Fretboard explorer and the key/mode reference** support every scale.
  - The explorer gets a Scale picker.
  - The reference shows the notes, the degrees, the shapes, and the chords where the scale has
    diatonic chords. Pentatonics show their parent mode's chords, labeled as the parent's.

## The model

- `KeyMode` becomes `{ tonic, scale, mode }`.
  - `ScaleId` is `'major' | 'minor-pentatonic' | 'major-pentatonic' | 'blues' | 'harmonic-minor'
    | 'melodic-minor'`.
  - `ModeId` is the union of every scale's mode ids.
  - `ModeName` (the seven) survives as the Major scale's modes, so existing code that means "a
    mode of major" can say so.
- **Scale step vs degree.** Today's code assumes seven notes, where step *n* is degree *n*. That
  stops being true:
  - A pentatonic has five steps.
  - Blues has six, and two of them are 5ths (♭5 and 5).
  - Ultralocrian's 7th is 𝄫7, so `Alteration` widens to `-2..1`.

  Generators that walk the scale use steps (an index into `scaleNotes`). Anything that names a
  note uses the degree. `noteAtDegree(km, n)` is defined only where the scale has that degree,
  and callers that assume seven must be found (see "Things that will bite").
- **Parent mode.** `parentMode(km)` gives the Major-scale mode used for theory (decision 6),
  generated backing (decision 8) and key signatures. The mapping:
  - Pentatonics go to Ionian or Aeolian.
  - Blues goes to Aeolian.
  - Harmonic and melodic minor go to Aeolian of the same tonic's parent minor, for the
    signature only.
- **Chords.**
  - `diatonicChords(km)` works for the Major, harmonic minor and melodic minor scales.
  - That needs the augmented triad (already a `TriadQuality`) and a new `maj7#5` seventh.
  - Families stay "by degree", as in feedback round 6.
  - Pentatonics have no diatonic chords of their own; callers use the parent mode.
- **Spelling.** `preferredTonic` and `tonicsForMode` follow the parent mode's spelling, so it's
  "E♭ minor pentatonic", not "D♯".
- **Signature degree and mode character.** Each new mode gets a signature degree (for example
  Phrygian dominant's ♮3, Lydian dominant's ♯4) and a short prose entry for the reference. Each
  pentatonic scale gets one entry, not one per shape.

## Tasks, in order

1. **Domain: scales, modes, spelling, chords** (`src/domain/music`).
   - The tables, `KeyMode.scale`, steps vs degrees, 𝄫, and parent mode.
   - Chords of harmonic and melodic minor, signature degrees, and mode prose.
   - Unit tests: every scale × mode spells one letter per degree (pentatonics excepted); chord
     qualities of HM and MM; parent mapping.
2. **Shapes** (`src/domain/instrument`).
   - Pentatonic boxes: two notes per string, starting on step *n* for Shape *n*.
   - Blues boxes: the minor pentatonic box with the ♭5 added wherever it falls, so some strings
     get three notes.
   - Placement nearest a fret.
   - 3nps for HM and MM should already work; check it.
   - Screenshot all five shapes of each pentatonic on the explorer before calling it done.
3. **The scale axis and settings** (`src/domain/variation`, `src/data`, settings UI).
   - The `scale` session axis, rolled before mode. Mode candidates depend on the scale.
   - Struck-out scales, with HM and MM struck by default.
   - Persistence with Major as the absent default: exercises, routines, reps, `transfer.ts`.
   - The policy editor's Key → Scale → Mode order, "Shape" for pentatonics, and the strip.
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
- **Improvise to a target on a pentatonic.** Its target candidates must come from the scale's
  own degrees. You can't land on a 2 in minor pentatonic.
- **Held values and seeds.** Adding a session axis before mode shifts the roll order. Existing
  seeds will roll differently, which is fine. Golden files will change: check that the diff is
  only that.

## What only the player can judge, at the gate

- Are the pentatonic and blues boxes the ones he plays?
- Is the position–shape placement right on the neck?
- Do the HM and MM modes feel usable, or do some want striking out by default too?
- Is the 12-bar blues backing any good?
- Is "Shape" the right word in the UI?

## Not in this run

- Other scales: diminished, whole tone, bebop, and the major blues scale.
- A pentatonic CAGED system. The player plays 3nps for seven-note scales, and the pentatonic
  boxes are their own thing.
- The key × mode grid for non-Major scales.
