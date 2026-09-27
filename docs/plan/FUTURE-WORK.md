# Future work

_Started 2026-09-27, when the milestone sequence ended._ The core app is built. What used to be
M7b, M8, M9 and M10, the parked items, and every "not in this run" list from the run specs are
collected here, **grouped by theme and in no order**. Nothing here is "next" until the player
picks it. When asked about future work, bring up anything in this file that fits.

**How to use it:**
- Picking an item starts a run as before: questions up front, a branch, a gate. Where an item
  names a doc 08 task (`8.5`), that task has the original plan and size.
- When an item is built, delete it here and record it in STATUS.md. When one is dropped, move
  it to "Closed" at the bottom with the reason, so it isn't proposed again.
- New ideas go in whichever group fits, or a new group.
- Things that need the player's judgment on something **already built** (guitar checks,
  flaky reports) stay in STATUS.md's "Open questions for the player", not here.

Sizes, where known: S, M, L.

---

## Ear training and hearing things

- **Ear-training exercise** (doc 08 task 7.8, L). Interval, scale degree and chord quality
  first. Decided in advance: the drill is an axis (fixed / hold / roll); intervals rise by
  default, with falling and harmonic as settings; the answer grid shows the whole level (1: m3
  M3 P4 P5 P8; 2 adds M2 m6 M6 m7; 3: all twelve); a wrong answer offers "hear yours" and
  "hear the right one"; questions lean toward misses. It is `kind: 'theory'` (doc 10, B10).
  The old gate question ("is maj7 against dom7 audible on the synth?") is moot: the notes are
  sampled now. Ask instead whether it is audible on the sampled piano and guitar.
- **Mode and progression ear drills**, after the ear-training exercise. The generated backing's
  progressions (`src/domain/backing/generated/`) already exist to draw on.
- **"Hear it"** (task 7.9, S): play a phrase, a chord or a scale on demand. There is
  groundwork: `AudioEngine.hear(chords)` (Settings' Hear it) and the mixer's preview loop.
- **Written interval identification**: a theory drill with no sound, cut from the original
  thirteen (doc 04, "Deliberately deferred").

## New played exercises

- **Speed picking** (8.2, S), which needs **ladder tempo plans, pick-stroke marks and
  articulation audio** (8.1, M). Some articulation audio already exists in `PhrasePlayer`.
- **Legato** (8.3, S).
- **String skipping**, with `remapToStringSet` (8.4, M).
- **Triads and arpeggios on string sets** (8.5, M): triad shape tables, R/3/5/7 labels, and
  three-string sets defaulting to 1-2-3.
- **Fretboard note finding**, with a clickable `FretboardInput` (8.6, M).
- From doc 04's "Deliberately deferred", each a small addition now:
  - chromatic warm-up / spider drills
  - bending accuracy
  - chord changes per minute
  - rhythm-only exercises on a single note
  - sight-reading generated tab
- **Drilling one numbered pentatonic box in every key**, as an exercise option rather than a
  mode (doc 14, decision on shapes).
- **The first exercise in 3/4 or 6/8** gets the Simple beat checked by ear at its gate, and it
  unlocks generated backing there too (see Backing below). Nothing in the app uses either
  signature yet.

## Theory drills

- **Roman-numeral progression analysis** (doc 04, deferred).
- **Parallel-mode comparison** (doc 04, deferred).

## Scales, shapes and tunings

- **CAGED / positional shapes** as a `shapeSystem` option (8.7, M). **Ask first:** the player
  plays 3nps, not CAGED, so this may not be wanted at all.
- **More scales**: diminished, whole tone, bebop, and the major blues scale (doc 14).
- **The modes of harmonic and melodic minor** (Lydian dominant, Altered and the rest).
  Doc 14, decision 10, made them mode-less for now.
- **The key × mode grid for non-Major scales** (the explorer's grid is Major's modes only).
- **Tunings, capo and left-handed** (9.7, M). Settings already offers standard, drop D and
  7-string, and the model has a `capo` field. Still to do: more presets (DADGAD…), a capo
  setting, and a left-handed neck.

## Backing and audio

- **Generated backing, beyond this run** (doc 13, "Not in this run"):
  - other time signatures (4/4 only today; waits for a 3/4 or 6/8 exercise)
  - chords shorter than a bar
  - Roman-numeral input
  - secondary dominants and chords outside the mode
  - logging the progression with the rep, and leaning toward unpracticed progressions
  - rolling the comping style
- **Sync markers (a tempo map) on a backing track**, so the playhead can follow a track whose
  tempo drifts. The player wants this eventually (doc 06).
- **Ship the player's tracks as a static data file** in the app, merged by id (doc 06).
- **Slides and bends that sound** (a pitch ramp). Visual-only today, and doc 06 judged it
  not worth it for v1.
- **Scrubbing YouTube's own progress bar** moves the video out from under the exercise.
  `reanchor` is the machinery. Nobody has asked for it.
- **M7a leftovers** (ask whether wanted):
  - a criteria editor for routines (the model has the field)
  - reference videos on a theory exercise's practice screen
  - a free-time toggle in the transport (free time works through the runner; the store has
    `setFreeTime`, with no button)
  - one video player kept alive through a whole routine, only if Safari's "press play on the
    video" prompt gets tiresome

## Practice flow, progress and routines

- **Post-session summary** (9.2, M): every exercise run, target against settled tempo, and a
  one-click "adopt as target".
- **"Roll a routine from my gaps"** (9.3, M), wired to the fretboard explorer's call to
  action.
- **Named variation presets** ("Stay put" holds everything but rhythm, "Anything goes" rolls
  everything). A thin layer over the per-axis policies (doc 02).
- **A full circle-of-fifths wheel**, beside the strip the theory feedback uses (doc 05).

## The app itself

- **PWA** (9.1, M): offline shell, icons, install, and backing saying plainly that it needs a
  connection.
- **Tablet layout** for the runner, and type sized for reading at a distance (9.4, M).
- **Empty states, a first-run starter routine, error boundaries** (9.5, M).
- **Accessibility and a full keyboard audit** (9.6, S).
- **Dark theme, fretboard explorer**: the heaviest heat shades toward chalk, and the white root
  dots rely on their ring. Fine per the restyle review; only if it starts to matter.

## Sync (optional)

- Only if wanted after living with export/import. Firebase is the recommended target: auth,
  a `SyncedRepository` wrapper, security rules, conflict handling for the three mutable
  tables, and a sync-status indicator. About one M-sized run, not a rewrite (doc 07, "If we
  later want sync"; the soft deletes, UUIDs and `updatedAt` were laid down for this).

## Outside the design, recorded so it isn't lost

Doc 10 §D keeps these out on purpose; each could come back, and none is a structural blocker:
microphone input, pitch detection, audio recording, MIDI I/O, user accounts, multi-user
profiles, a phone layout, native apps, AI-generated exercise content at runtime, importing
Guitar Pro files, standard notation.

---

## Closed

Kept so they aren't proposed again. Reopen only if the player raises them.

- **A custom transport over the video** (`controls: 0`) was closed by the player on
  2026-09-22. Following YouTube's own pause and play gave him everything he wanted. The
  research is recorded under task 3 in STATUS.md's backing section.
- **A pentatonic CAGED system**: the pentatonic boxes are their own thing (doc 14).
- **Drums inside the generated backing**: that's the metronome's job (doc 13, decision 1).
