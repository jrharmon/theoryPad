# 16 — Imported phrases: a blueprint that plays tab from a Guitar Pro file

**Status:** planning. Round 1 answered 2026-10-10 (decisions 1–12) and round 2 on 2026-10-11
(decisions 13–20, the last three in §11). Ready to build; nothing is built yet.

## The goal

A blueprint that plays a **set phrase**: written notes, the same every time, instead of
generated ones. To start with, the phrase is read from a Guitar Pro file. Later it can be edited
in the app. Riffs, licks, études and song sections go into the library and into routines next to
the generated exercises, so practice doesn't mean switching between two apps.

**"Phrase" is the internal name only.** The player sees an ordinary exercise made from the
**Written exercise** blueprint (decision 15). Once an exercise has been created from a
file, it is just a regular exercise. There is no phrase library, no separate phrase screen and
no phrase concept in the UI.

This moves "importing Guitar Pro files" out of doc 10 §D's "outside the design" list. Remove it
there and from FUTURE-WORK's matching line when the run starts.

---

## Decisions (round 1, 2026-10-10)

1. **Formats: `.gp` (GP7/8) and `.gpx` (GP6) only.** Our own reader, with no new dependency. No
   GP3–5: the player doesn't use them.
2. **A written exercise keeps the file's tuning.** It is drawn and played in that tuning
   whatever Settings says. **No retune prompt.** Each exercise stands alone, and mixing tunings
   in a routine is the player's choice. *(Round 2 widened this: the tuning is an exercise
   setting that every exercise can have; see decision 13.)*
3. **One import = one track**, either the whole file or a start and end bar.
4. **One phrase per exercise. No multi-phrase exercises and no lick bank**, now or as follow-up
   work. Routines put phrases in sequence.
5. **No separate phrase concept for the player.** The phrase lives inside the exercise's
   settings. Once created, it is an exercise like every other.
6. **Repeats are written out** at import.
7. **No tempo or time-signature change inside the imported range.** Such an import is refused,
   with the reason and the bar where it happens. A change *outside* the chosen bars doesn't
   matter.
8. **Rhythm by spacing**, as the tab does now. Stems and beams come only if it proves hard to
   read.
9. **The key comes from the file.**
10. **Slides, bends and vibrato that you can hear are left for later, and are listed explicitly
    as follow-up work.** FUTURE-WORK's "Slides and bends that sound" item now names written
    exercises as its first user (updated 2026-10-11).
11. **"Phrase" is internal**, not shown to the player.
12. **Short exercises and song sections, not whole songs.** This also lets the tab keep its one
    grid per phrase (see §2).

## Decisions (round 2, 2026-10-11)

13. **Every exercise can store its own tuning**, as a setting like the metronome or Play the
    notes: set on the exercise, and absent means the Settings value. The global tuning was
    enough while every exercise was generated, since a generator builds around any tuning.
    Written exercises aren't generated, so the tuning has to belong to the exercise. A written
    exercise's import sets it from the file. Any other exercise can set one too (§6a).
14. **Slides and bends you can hear** are follow-up work, named explicitly (see decision 10).
15. **The blueprint is "Written exercise" in the UI.** "Tab" alone felt too generic. The id
    stays `phrase`, and "Phrase" stays the internal name.
16. **Replace from file.** The exercise page can replace a written exercise's notes from a new
    import, keeping its name, history, tempo, settings and places in routines. It reuses the
    import sheet.
17. **A tied note shows as a small, muted `(5)`.** Without it, a held note crossing a bar line
    would look like silence.

---

## 1. The Guitar Pro format

### Versions and containers

| Version | Extension | Container | Contents |
| --- | --- | --- | --- |
| GP6 | `.gpx` | **BCFZ**: a small bitwise LZ compressor wrapping **BCFS**, a 4 KB-sector file system | `score.gpif` (XML) |
| GP7, GP8 | `.gp` | an ordinary **ZIP** | `Content/score.gpif` (XML), plus layout and view files we ignore |

Both store the music as the same XML, **GPIF**. Only the wrapper differs, so one reader covers
both. (GP3–5 are a different binary format and out of scope.)

### GPIF's structure

GPIF is normalized: it is a set of flat tables that refer to each other by id, not a nested
tree.

```
Score            title, artist…
MasterTrack      Automations: Tempo (bpm at bar/position)
Tracks/Track     name, Staff → Properties: Tuning (MIDI pitches, low→high), CapoFret
MasterBars/MasterBar   one per bar, shared by every track:
                 Time "4/4", Key (accidental count + Major/Minor), Repeat start/end/count,
                 AlternateEndings "1 2", Section (letter + text, i.e. a rehearsal marker),
                 Directions (Segno, Coda, DaCapo…), Bars → one Bar id per track
Bars/Bar         Voices → up to 4 Voice ids (-1 = empty)
Voices/Voice     Beats → Beat ids in order
Beats/Beat       Rhythm ref, Notes → Note ids (none = a rest), GraceNotes,
                 Properties: PickStroke Up/Down, …
Notes/Note       Tie origin/destination, Vibrato, LetRing, AntiAccent (ghost), Accent,
                 Properties: String, Fret, Slide (bit flags), HopoOrigin/HopoDestination,
                 PalmMuted, Muted (dead), Harmonic + HarmonicType + HarmonicFret,
                 Bended + BendOrigin/Middle/DestinationValue, Tapped
Rhythms/Rhythm   NoteValue (Whole…128th), AugmentationDot, PrimaryTuplet num/den
```

To read it: walk `MasterBars` in order. For each bar take the chosen track's `Bar`, then its
`Voices`, then each voice's `Beats`. A beat's `Rhythm` gives its length in ticks (a quarter note
is 480 ticks, a dot multiplies by 1.5, a tuplet by den/num), and its `Notes` are the notes that
start on that beat.

### Checked against your files

There are 32 Guitar Pro files in `~/Downloads`: 24 `.gp` files (the Intervals clinic figures
and four Intervals songs) and 8 `.gpx` files (YouTube lesson exercises). A throwaway reader
unwrapped and parsed all of them; the BCFZ/BCFS unwrapping is about 50 lines. Confirmed by the
data, not taken on trust:

- **String 0 is the lowest string**, and `Tuning` lists pitches low to high, exactly as in our
  model. `tuning[string] + fret` matched the file's own MIDI pitch on every note checked.
- **Every track has exactly one tuning.** A file can have several tracks.
  - The **Intervals figure files** use the clinic's three-guitar template. Each has three
    tracks named for the band's setups: "7 String – Drop A", "6 String – Drop D" and
    "6 String – Drop C". **Only one of the three has notes in any figure file**; the other two
    are empty. So **the import offers only tracks that have notes in the chosen bars.**
  - The all-in-one file uses all three tracks, because different figures are on different
    guitars.
  - Tunings in use: standard, drop D, drop C, and 7-string drop A. The app's tuning model
    already holds any of them (`Instrument.tuning` is a list of notes of any length). Only the
    Settings menu offers just a few presets, and that doesn't matter here: the phrase brings
    its own tuning.
- **Bends** are in hundredths of a whole tone: 100 is a full bend, 50 a half, 25 a quarter. The
  files contain bend (0→50→100), bend and release (0→50→0) and pre-bend (50→50→50).
- **Slide flags** are a bitmask: 1 shift, 2 legato, 4 out downward, 8 out upward, 16 in from
  below, 32 in from above. They can combine (18 = in from below + legato).
- **Whammy bar** properties appear on 463 beats, but every value is 0, so no file actually uses
  the whammy bar.
- **One voice per bar** everywhere.
- **Rhythm density, phrase by phrase:**
  - Every figure and lesson exercise needs at most 6 tab columns per beat (sextuplets).
  - Most need 2–4.
  - Only full songs reach 12–16 (32nds alongside triplets), and decision 12 rules those out.
- `Walk-With-Me-In-Hell.gpx` has notes without a `String` property that the throwaway reader
  didn't expect. Check it in run A.

**How many of the 32 files use each feature:**

| Feature | Files | |
| --- | --- | --- |
| Section markers | 25 | "[Figure 3E] C Major – Legato", "VERSE 1 – Theme A" |
| Palm mute | 22 | 534 notes |
| Vibrato | 19 | |
| Ties | 19 | |
| Hammer-on / pull-off | 18 | |
| Slides | 18 | mostly legato, then out-down, in-below, in-above, shift |
| Free text | 18 | |
| Ghost notes | 11 | |
| Grace notes | 10 | nearly all on the beat |
| Dead notes | 7 | |
| Bends | 6 | 15 notes |
| Harmonics | 6 | natural, tapped, semi (pinch) |
| Pick strokes | 6 | the lesson `.gpx` files |
| Repeats | 4 | alternate endings in 1, D.S. al Coda in 1 |
| Fermatas, accents, brush | 3 each | |
| Let ring, tapping | 2 each | |
| Trill | 1 | |
| Time signatures | — | 4/4, 6/8 and 6/4, never changing within a file |
| Tempo changes within a file | 3 | the all-in-one changes tempo per figure |

---

## 2. What the tab shows

| Mark | In the tab | How it sounds |
| --- | --- | --- |
| Hammer-on, pull-off | `5h7`, `7p5` | softer (exists) |
| Slides, all six kinds | `5/7` `7\5` (exist); `/7` `\7` in; `7\` `7/` out | plain notes for now |
| Tie | `(5)`, small and muted, on the held note | not re-picked: the first note lasts through it |
| Palm mute | `P.M. ----` over the run of notes | quieter and shorter (exists) |
| Let ring | `let ring ----` over the run | longer (exists) |
| Vibrato | `~` (exists) | plain for now |
| Ghost note | `(5)` | quieter (exists) |
| Dead note | `x` | a very short, quiet hit |
| Accent | `>` above | louder |
| Staccato | `.` (exists) | shorter (exists) |
| Grace note | a small digit just before its note, taking no column | a short note just before, or on, the beat |
| Bend | `7b9` with `½` / `full` / `1½`; `r` release; `pb` pre-bend | plain for now |
| Harmonic | `<12>` natural; `A.H.`, `P.H.`, `T.H.` | at the harmonic's pitch |
| Tap | `T` above | plain |
| Pick strokes | `⊓` `V` above (exist) | — |
| Section marker | the bar's label (exists) | — |

**Dropped at import, and listed on the import screen** ("trill on 2 notes not shown"): trill,
tremolo picking, whammy, brush, dynamics and hairpins, fermatas, fingering, free text, lyrics,
ottava.

### Changes to the tab (`TabStaff`)

1. **More than one mark on a note.** Today a note holds one articulation. Guitar Pro stacks
   them (a slide into vibrato under palm mute), so it becomes a list.
2. **The new marks** from the table: `x`, `>`, `T`, slide in and out, grace digits, bends with
   their amount, harmonics, and the tied `(5)`.
3. **Marks that span notes.** `P.M. ----` and `let ring ----` are drawn once over a run instead
   of per note. Today `PM` is drawn on every note, which would bury a palm-muted riff.

**That's all.** The one grid per phrase stays, because short phrases need at most 6 columns a
beat. The one time signature per phrase stays too, because decision 7 refuses changes. Both
were on the first plan's list only because of whole songs.

---

## 3. What could make a phrase hard or impossible to play

| Problem | Handling |
| --- | --- |
| A tuning other than the player's | The import sets the exercise's own tuning (and capo) from the file; that tuning draws and sounds it. Nothing to retune or warn about (decisions 2 and 13). |
| Several tracks | Pick one. Only tracks with notes in the chosen bars are listed. |
| More of the file than you want | A start and end bar. Section markers show beside the bar numbers to help choose. |
| Repeats, alternate endings, D.S./D.C./Coda | Written out (§5). |
| A tempo or time-signature change inside the range | Refused, saying where (decision 7). |
| Grace notes | No column in the tab; in sound, a short note ahead of or on the beat. |
| Capo | Fret numbers as written; the brief says "Capo 2". |
| A second voice | Merged; a phrase is a flat list of notes. |
| Fermatas | Ignored and listed; the clock doesn't stop. |
| A track with no tuning (drums) | Not offered. |

---

## 4. Sound

**No new samples and no extra memory.** Everything the import needs uses the guitar samples
already loaded, by choosing a note's timing, length, volume and pitch:

- **Ghost, palm mute, let ring, staccato, hammer-on and pull-off** already work this way
  (`soundingVelocity` / `soundingDuration` in `PhrasePlayer`).
- **Accents**: `TabNote.velocity` already documents 1.0 for an accent, so an accented note
  simply gets that velocity.
- **Ties**: the tied note isn't scheduled, and the note it continues lasts through it.
- **Dead notes**: the fretted sample, very short and quiet. That's an approximation of the
  muted "chk". A real one would be one small extra sample, and only if the approximation
  grates.
- **Grace notes**: a short note scheduled just before (or on) the beat.
- **Harmonics**: the sample at the harmonic's pitch. A 12th-fret harmonic sounds an octave above
  the open string, 7th a twelfth, 5th two octaves. This is the "fewer samples, pitch-shift for
  the rest" approach you mention, and it's already how `SampledVoice` works: `Tone.Sampler`
  shifts the nearest recorded note to any pitch. The pitch will be right, but it won't have
  the bell-like tone of a real harmonic.

**The complexity:** a few more cases in the two small functions `PhrasePlayer` already has, plus
skipping tied notes and offsetting graces. Nothing structural. The structural change, giving
each note a pitch it can move during the note (slides, bends, vibrato), is what decision 10
leaves for later. It means replacing `Tone.Sampler` with per-note sources. Memory stays the
same; the voice code roughly doubles.

---

## 5. Repeats

Written out at import (decision 6). The first bar of each repeated pass gets the label "×2",
"×3", and jumps are labelled "D.S. al Coda", so the tab still reads like the original. If the
whole chosen range is one repeated block, it is stored once with `repeat: n`, which `Phrase`
already has, so "4 bars ×4" stays a 4-bar phrase on screen.

---

## 6. The phrase, and where it lives

### `Phrase` today

`src/domain/phrase/types.ts` defines what every played exercise's `generate` returns, fresh on
every roll:

- `notes`: string, fret, start tick, length, articulation, pick stroke, role…
- `bars`: each with its label.
- One time signature and `totalTicks`.

The tab, the sound, the playhead, the neck heat and the log all read it. It is never saved
today. Its strings and frets mean "on the exercise's instrument", and the clock plays it at the
exercise's tempo.

### What changes

An imported phrase is a `Phrase` with one new optional field. **There is no separate
`StoredPhrase` type.** The tuning and capo are **not** on the phrase: they are the exercise's
setting (decision 13, §6a). The import writes the file's tuning there.

```ts
interface Phrase {
  // …as today…
  /** The tempo it was written at — a fact about the music, not a practice tempo. */
  writtenTempo?: number;
}

interface TabNote {
  // `articulation?` (one) becomes:
  techniques?: Technique[];   // hammer-on, pull-off, the slides, vibrato, palm-mute,
                              // let-ring, staccato, ghost, dead, accent, tap
  bend?: { points: { at: number; tones: number }[] };  // at: 0–1 through the note
  harmonic?: 'natural' | 'artificial' | 'pinch' | 'tapped' | 'semi';
  grace?: 'before-beat' | 'on-beat';
  // `tied` already exists
}
```

A generated phrase leaves the new fields out, and nothing changes for it. No phrase is saved
today and only `position-shifting` sets `articulation`, so the change needs no data migration.

### Tempo: written and practiced

There are two separate things:

- **`writtenTempo`** is the tempo in the file. It never changes, and the brief shows it
  ("written at 185").
- **The exercise's own tempo** works as it does for every exercise. A new exercise's target
  starts at the written tempo, and from then on it changes only when the player changes it.
  Nothing in practice writes back to `writtenTempo`.

### Key

The file's key signature gives the key and Major or Minor. The exercise declares the **key and
mode axes, set to Fixed at the file's values and locked**: the machinery every exercise already
uses. That means:

- The axis strip and brief name the key.
- A routine leaves the key alone, because a locked axis reads through.
- The drone and key-matched backing tracks work.
- The neck diagram can ring the roots.

The player can edit the fixed key or mode like any locked setting. Minor maps to Aeolian, and
it can be changed to Dorian or anything else. Transposing later would just mean unlocking the
key and shifting frets.

### Where it is stored

**In the exercise's params**, as one `phrase` value (decision 5). No new table, no new store,
and nothing new in export: params already travel with the exercise. Three facts make this
simple:

- **The settings form already skips it.** `paramFields` turns only flat values (choices,
  numbers, toggles) into form fields and returns `null` for anything richer, so the phrase never
  shows as a setting.
- **A routine item reads it through.** A routine item copies its exercise's params, but locked
  params come from the exercise (`effectiveItem`). The phrase param is always read through
  (handled in code, not a lock toggle the player sees). Replacing the phrase on the exercise
  therefore reaches every routine that uses it.
- **Size is a non-issue.** A short phrase is a few KB to a few tens of KB of JSON.

`resolveParams` parses stored params against the schema, so the blueprint's schema needs a
valid default phrase: an empty one-bar phrase.

---

## 6a. Tuning per exercise (decision 13)

This is a change for **every** exercise, not just written ones.

**Today.**
- `Settings.instrument` is one `Instrument`: tuning, fret count, handedness and capo (the capo
  has no UI).
- A `PracticeSession` takes that instrument once, for the whole session.
- Several practice components read `settings.instrument` straight from the store:
  `PracticeBody`, `PracticeList`, `SettingsDialog` and `ImprovBody`.
- A routine runs every item on the same instrument.

**The setting.**
- `Exercise.tuning?: { strings: NoteName[]; capo?: number }`, absent meaning the Settings
  tuning.
- `RoutineItem` gets the same field, copied from the exercise and its own afterwards, exactly
  as `metronome` and `playNotes` are.
- Fret count and handedness stay global: they belong to the player's hands and guitar, not to
  the music.
- **The instrument an exercise plays on** is the exercise's tuning (or Settings'), plus Settings'
  fret count and handedness. One function computes it, and everything uses it:
  - generation, and the axis candidates (string sets follow the string count);
  - the tab;
  - the sound;
  - the neck diagram and the neck window.

**The session.**
- An `ExerciseSession` takes the exercise's instrument.
- A `RoutineSession` switches instrument per item, the way it already switches tempo and count-in.
- The components that read `settings.instrument` read the session's current instrument instead.

**The picker.**
- It sits in the exercise page and the practice settings dialog, beside the metronome:
  "Settings' (Standard)", then the presets.
- An exercise whose tuning is not a preset (most imports) shows it by its own name. A known
  name if it matches one ("Drop C"), otherwise its notes ("C G C F A D").
- The presets grow by the tunings already in your files: drop C, and 7-string drop A.

**Changing the tuning of a written exercise.** The frets stay as written, so it sounds and
labels in the new tuning. That's the player's choice, like any setting.

**Held axis values.** A held string set that doesn't exist in a new tuning (say "strings 1–7"
on a 6-string) fails to parse and rolls afresh. That's what any stale held value does already.

**The fret log (needs care).**
- A finished pass logs `frets`: every note by string and fret, which feeds the fretboard
  explorer's heat. With mixed tunings, "string 0, fret 5" is a different note on drop C than
  on standard. On a 7-string it isn't even the same string.
- **The fix:** a rep records the tuning it was played in (`Rep.tuning`), and the explorer's heat
  counts only reps in the tuning it is showing.
- Reps from before this have no tuning. They count as the Settings tuning, which they almost
  certainly were.
- The all-time `exerciseStats` aggregates need checking for the same thing in run B.

**Export.** Both new fields travel with exercises and routines. Older exports simply lack them,
which means "Settings' tuning", so the format version doesn't change.

---

## 7. The import flow

1. In the library: **New exercise → Written exercise** → choose a `.gp` or `.gpx` file.
2. The import sheet shows:
   - **Track**: only tracks with notes, each with its tuning ("6 String – Drop C · C G C F A D").
   - **Bars**: the whole file, or start and end bars, with section markers beside the numbers.
   - **A live tab preview.**
   - **What was dropped** ("trill on 2 notes not shown").
   - **Why it can't be imported**, if a tempo or time signature changes in the range.
   - **Name**: from the section marker if the range starts on one, otherwise the file's title.
3. **Create.** This sets the phrase, the exercise's tuning and capo, the key and mode, and a
   target tempo equal to the written tempo. From then on it's an ordinary exercise: tags,
   folder, locks, favorites, routines, tempo, metronome, tuning, backing videos, notes.

**Replace from file** (decision 16), on a written exercise's page, opens the same sheet and
replaces the phrase, the tuning and capo, the written tempo, the key and mode, and the source.
It keeps everything else: name, tags, folder, history, practice tempo, metronome, backing and
places in routines. Routine items read the phrase through, so they get the new notes.

The original file isn't kept. The exercise records its source (file name, track, bars) for the
exercise page, so "where did this come from" has an answer.

---

## 8. Code layout

| Where | What |
| --- | --- |
| `src/import/guitar-pro/` (new) | Unwrapping: ZIP via the browser's `DecompressionStream('deflate-raw')`, BCFZ/BCFS by hand. Then `DOMParser` → a plain `GpScore` object. Not in `domain/`, because it touches bytes and the DOM. No new dependency. |
| `src/domain/phrase/import/` (new, pure) | `GpScore` + track + bars → `Phrase` + the dropped list, or a refusal. Ticks, tuplets, ties, voices merged, repeats written out, effects to techniques, key. The heavy unit tests live here. |
| `src/domain/phrase/types.ts` | The `Phrase` and `TabNote` changes; `position-shifting` migrated. |
| `src/components/music/TabStaff.tsx` | The three changes in §2. |
| `src/audio/PhrasePlayer.ts` | Ties, dead notes, graces, harmonics, accents. |
| `src/exercises/phrase/` (new) | The blueprint: id **`phrase`**, never renamed; `kind: 'played'`; axes key and mode only; `timing: 'metronome'`; `generate` returns the stored phrase. |
| `src/data/entities.ts` | `Exercise.tuning?`, `RoutineItem.tuning?`, `Rep.tuning?` (§6a). |
| `src/session/`, `src/routes/practice/` | The exercise's instrument per session and per routine item. Components read it from the session, not from Settings. |
| `src/routes/fretboard/` | Heat counts only reps in the tuning shown. |
| `src/routes/exercises/` | The import sheet, Replace from file, the tuning picker, and the source line on the exercise page. |

---

## 9. Runs

**Run A — read and draw.**
- The `Phrase` and `TabNote` changes.
- The reader for `.gp` and `.gpx`.
- The converter.
- The tab changes.
- A **dev gallery page**: drop a file, choose the track and bars, see the tab and the dropped
  list.

*Gate: put your test files beside Guitar Pro and judge whether the tab reads right.*

**Run B — the blueprint.**
- **Tuning per exercise first** (§6a), since it stands on its own and every exercise gets it:
  the setting and picker, the per-item instrument in routines, and `Rep.tuning` with the
  explorer's filter.
- The blueprint, the import sheet, and Replace from file.
- The key on the axes.
- The brief: written tempo, capo, bars.
- The neck diagram: every position the phrase uses, roots ringed.
- The sound changes from §4.

*Gate: import a riff and play it, both standalone and inside a routine between generated
exercises, with a guitar. Set a generated exercise to drop D and check that its notes follow.*

**Follow-up work, named explicitly:** slides, bends and vibrato you can hear. This is already in
FUTURE-WORK ("Slides and bends that sound"), which now names written exercises.

**Left for later**, added to FUTURE-WORK when the run closes: stems and beams, if
spacing proves hard to read; transposing by unlocking the key; editing phrases in the app;
phrases defined by intervals. Interval phrases would share the rhythm, techniques and bends and
differ only in pitch (degree and octave instead of string and fret), compiling into the same
`Phrase` the way `shared/` generators do today.

---

## 10. Test files wanted

The repo is public, so **only files you make yourself are committed** as fixtures. The
downloaded and purchased ones (Intervals, the lesson `.gpx` files) are checked locally and
never committed. Unless stated: standard tuning, 4/4, about 100 bpm, one track, saved as `.gp`.

1. **`01-rhythm`**: quarters, eighths, sixteenths, a rest, a dotted eighth and a sixteenth, a
   two- and a three-note chord, an open string, a note tied across a bar line, eighth- and
   sixteenth-note triplets, a sextuplet.
2. **`02-legato-slides`**: hammer-on, pull-off, a hammer-pull run on one pick (5h7p5h8), legato
   slides up and down, a shift slide, slides in from below and above, slides out down and up.
3. **`03-marks`**: a palm-muted run, let ring over a chord, a ghost note, a dead note, an
   accent, staccato, vibrato, natural harmonics at 12, 7 and 5, a pinch harmonic, a tapped note.
4. **`04-bends`**: half, full and 1½ bends, bend and release, pre-bend, pre-bend and release,
   and a bend with vibrato.
5. **`05-grace-picking`**: grace notes before and on the beat (one sliding, one hammered), and
   sixteenths with alternate pick strokes marked.
6. **`06-structure`**: 8 bars, with section markers on bars 1 and 5, a ×2 repeat, a ×3 repeat,
   1st and 2nd endings, and a tempo change at bar 5. Importing bars 1–4 should work and 1–8
   should be refused. If you're willing, a second file with D.S. al Coda.
7. **`07-tracks`**: three guitar tracks (drop D, 7-string, and one with capo 2), one of them
   left empty, plus a drum track. Only the guitar tracks with notes should be offered.
8. **`08-compound`**: four bars of 6/8 in a non-C key with a minor key signature, to check the
   key and the compound-meter tab.

---

## 11. Questions

None open. Round 1's A–C became decisions 15–17. Round 2's D–F were answered on 2026-10-11, all
as recommended:

18. **Custom tunings:** for now, the presets plus whatever a file brings. A per-string note
    editor can come later without changing the model.
19. **Capo per exercise**, offered beside the tuning for every exercise, not only written ones.
20. **The fretboard explorer's heat counts only reps in the tuning it shows.** It stays "places
    on the neck I've played". Reps from before `Rep.tuning` count as the Settings tuning.
