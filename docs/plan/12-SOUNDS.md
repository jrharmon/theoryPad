# 12 — Sampled instruments and drum metronomes

_Agreed 2026-09-22. Supersedes the "Sampled instruments — decided by the M7b gate" parked item
in STATUS.md and the "samples-later path" sketch in `06-AUDIO.md` §Voices._

Two changes, one body of work, because they share a sample pipeline and a loading story:

1. **The notes stop being a synth.** `SampledVoice` over `Tone.Sampler`, shipping **piano,
   guitar and bass**, chosen in Settings → Sound. Polyphonic, so chords work.
2. **The metronome stops being one click.** It becomes a *choice of voice*: Off, Click, or one
   of four drum beats that play the metronome's job at the exercise's tempo.

**This goes before M7b.** M7b's plan says mode and progression drills wait on "whether maj7 vs
dom7 is audible on the synth — the trigger for sampled instruments". Doing this first removes
that question instead of answering it, so M7b stops depending on a judgement call.

---

## Decisions already taken

Asked and answered before this doc was written. Do not relitigate them; if one turns out wrong,
record why.

1. **Samples are vendored in the repo**, under `public/samples/`, served from our own origin.
   The app is local-first and M9.1 turns it into a PWA; a CDN would mean sound needs a
   connection, Playwright would hit the network, and a third party could move the files. The
   price is a few MB of permanent git history and a licence check on every file we ship.
2. **Three sampled voices: piano, guitar and bass.** Same class, three manifests — the cost is
   choosing and trimming sample sets, not code. Bass is mostly for the generated backing that
   `06-AUDIO.md` defers, but it is nearly free to add now.
3. **The synth stays.** It is the fallback while samples load, when a load fails, and for
   anyone who prefers it. Nothing may block Play on a download.
4. **Drums are a metronome voice, not a backing source.** This is the player's framing and it is
   the one that makes the feature small: a drum beat does the metronome's job, more musically.
   It is not a `BackingSource`, it does not own the tempo, and it does not replace the notes.
   Turning drums on over a backing track would be a mess — so would the click, and the player
   simply does not do that. No interlock is built.
5. **The metronome button becomes a menu**, like Backing: Off · Click · Drums — Simple ·
   Drums — Upbeat · Drums — Soft · Drums — Heavy.
6. **Drums count in on an open hi-hat**, not a click. A stick-click count-in into a drum beat
   sounds like two different machines.
7. **Simple fits any time signature** and is always offered. Every other beat declares its
   signature and is only offered when the exercise's phrase matches.

---

## Part 1 — Sample assets

### Layout

```
public/samples/v1/
  CREDITS.md
  piano/    C1.mp3 Eb1.mp3 Gb1.mp3 A1.mp3 …   (every minor third)
  guitar/   E2.mp3 G2.mp3 Bb2.mp3 …
  bass/     B0.mp3 D1.mp3 F1.mp3 …
  kit/      kick.mp3 snare.mp3 hat-closed.mp3 hat-open.mp3 ride.mp3 crash.mp3 stick.mp3
```

The `v1/` segment is deliberate. GitHub Pages sends a short `Cache-Control`, and M9.1 will want
to precache these; a versioned path means a file never changes under a cache. Re-cut samples go
in `v2/`, they do not overwrite `v1/`.

### Sources, verified 2026-09-22

| Voice | Source | Licence | Size |
| --- | --- | --- | --- |
| piano | Salamander Grand Piano v3 (Alexander Holm), mirrored at `https://tonejs.github.io/audio/salamander/` | **CC-BY 3.0** | 60–80 KB/note |
| guitar | FluidR3_GM `acoustic_guitar_steel` (chosen by ear over `electric_guitar_clean`), `https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/gh-pages/FluidR3_GM/` | **CC-BY 3.0** | ~19 KB/note |
| bass | FluidR3_GM `acoustic_bass` (chosen by ear over `electric_bass_finger`), same host | **CC-BY 3.0** | ~16 KB/note |
| kit | Sonic Pi `etc/samples/` (`sonic-pi-net/sonic-pi`, branch `dev`) | **CC0** | 20–150 KB/file, FLAC |

All four were probed and return 200. `FluidR3_GM` also has `acoustic_guitar_steel` and
`acoustic_bass` if the clean electric and finger bass do not suit — listen to both.

**Two of these are CC-BY, which requires attribution.** `public/samples/v1/CREDITS.md` names
each source, its author, its licence and its URL, and Settings → Sound links to it. This is not
optional politeness; shipping CC-BY assets without credit is a licence breach.

Sonic Pi's drum samples are the useful find: explicitly CC0, and they cover every role, which
Tone's own `acoustic-kit` does not (it has no open hat and no ride). Verified present:
`drum_heavy_kick`, `drum_bass_hard/soft`, `drum_snare_hard/soft`, `drum_cymbal_closed`,
`drum_cymbal_open`, `drum_cymbal_pedal`, `drum_splash_hard`, `drum_cowbell`, the toms.
There is no file named "ride" — audition `drum_cymbal_soft` and `drum_cymbal_pedal` for the
role, and if neither works, `ride` falls back to `hat-closed` and Simple still sounds right.

### Budget

**Total payload ≤ 3 MB.** Roughly: piano ~1.1 MB (E1–C7 at minor thirds, ~16 files), guitar
~350 KB, bass ~300 KB, kit ~60 KB. If a voice will not fit, widen its spacing before dropping
notes off the ends — the ranges below are the ones that matter.

- **guitar** must reach **B1** (7-string low B) at the bottom and **E6** at the top. Check
  against standard, drop D and 7-string, as every other test in this repo does.
- **bass** B0–G3. **piano** E1–C7, which covers the guitar's range with headroom for "hear it".

### Pipeline

`scripts/fetch-samples.mjs` — downloads, trims to the chosen pitches, converts FLAC → mp3 with
`ffmpeg`, writes the files and regenerates `CREDITS.md`. Run once; **commit the mp3s**. The
script exists so the cut is reproducible and reviewable, not so it runs at build time. It is not
wired into `pnpm build` and must not be.

### Task 1 — outcome (2026-09-22)

Cut by `scripts/fetch-samples.mjs` after the player auditioned every candidate on a scratch
page. **2.86 MB total**: piano 1.67 MB, guitar 936 KB, bass 178 KB, kit 82 KB.

- **Guitar every semitone**, B1–E6 (54 files): at minor thirds it was "very noticeably" worse
  by ear — the shifted notes sounded synthetic, as "Things that will bite" §2 feared.
- **Piano and bass every minor third.** Piano has no choice: Salamander was recorded only on
  A, C, D♯, F♯, so E1–C7 is 24 files (Eb1–C7), not the ~16 estimated above. Bass is anchored
  on E so the E strings are real samples: Bb0–G3 (12). Nothing shifts more than a semitone.
- **Kit, picked by ear:** kick `drum_heavy_kick`, snare `drum_snare_hard`, hat-closed
  `drum_cymbal_closed`, hat-open `drum_cymbal_open`, ride `drum_cymbal_soft`, crash
  `drum_splash_hard`, stick `perc_snap`. Sonic Pi also has real rides (`ride_tri`, `ride_via`);
  they lost the audition. Long tails are cut with a fade (open hat 1.2 s, ride 1.5 s, crash
  2.5 s) and leading silence removed.
- **Stick stays.** The player wants the count-in sound to be a choice: open hat, or a click,
  even under the full kit. Task 4 decides where that choice lives.
- **mp3 throughout.** The pitched sources are already mp3 (~40–48 kbps), so another format
  would only be a bigger copy. The kit is encoded here (LAME `-q:a 2`, 82 KB against ~330 KB as
  FLAC). Measured in Chromium, each kit mp3's onset matches its FLAC twin within 0.2 ms — the
  LAME gapless header is honoured, so no encoder padding makes a drum late. Safari unmeasured.
- **Every source is pinned to a commit**, and the kit encode is bit-exact: a re-run gives the
  same bytes.
- **Memory is the real cost, not format.** Decoded, the piano is ~133 MB (Salamander notes run
  up to 24 s, stereo), guitar ~63 MB, bass ~13 MB. Task 2 loads only the chosen voice, and
  should trim each buffer to ~4 s after decoding (no re-encode), which brings piano to ~25 MB;
  the guitar's notes are already 3.1 s.

---

## Part 2 — `SampledVoice` and the voice slot

`InstrumentVoice` already exists and was designed for exactly this (`src/audio/voices/`). No
consumer changes — that was the point of the interface.

```ts
export type VoiceId = 'synth' | 'piano' | 'guitar' | 'bass';

interface VoicePreset {
  id: VoiceId;
  name: string;
  /** Sampled pitch → file name, relative to `dir`. */
  urls: Record<string, string>;
  /** Under public/samples/v1/. */
  dir: string;
  volumeDb: number;
  release?: number;
}
```

`SampledVoice implements InstrumentVoice` over `Tone.Sampler`. `load()` resolves when the
sampler reports loaded. `Tone.Sampler` is polyphonic and pitch-shifts between samples, so chords
come free — `PhrasePlayer` already schedules simultaneous notes independently and needs no
change.

**Base URL.** Files resolve through `import.meta.env.BASE_URL`, never a leading `/`. The deploy
serves from `/theoryPad/`; a rooted URL 404s there and works locally, which is the worst kind of
bug to find. This one line is the likeliest thing to go wrong in Part 2.

### Nothing blocks Play

`AudioEngine.init()` runs inside the Play click. It must never await a megabyte.

- The engine holds a **voice slot**: a `SynthVoice` at construction, swapped for the sampled
  voice once it has loaded. `PhrasePlayer` takes `() => InstrumentVoice` instead of a voice, and
  reads the slot when it schedules each note.
- The chosen voice starts loading when the **practice screen mounts** (in `audioPort()`, beside
  the existing lazy `import('@/audio')`) and when it is changed in Settings. Not on first paint.
- A failed load stays on the synth, says so once, and does not retry on every Play.
- The transport shows a quiet "loading sounds…" while it is in flight. In practice the load
  finishes long before the first Play; the fallback exists so that when it does not, nothing
  waits.

### Settings

`Settings.audio.voice` is today `'synth' | 'sampled'` and **is read nowhere** — it was written
for this and never wired up. It becomes `VoiceId`. Migration: `'sampled'` → `'piano'`, anything
unrecognised → `'synth'`.

Settings → Sound gains an **Instrument** row (Synth · Piano · Guitar · Bass) with a "hear it"
button that plays a short chord through the chosen voice — which is also the proof that
polyphony works.

**Recommended default: `guitar`.** It is a guitar app and the tab on screen is guitar tab. The
gate decides; piano is the honest alternative, and it is the clearer one for ear training.

### Task 2 — outcome (2026-09-22)

Built as above, with three changes agreed with the player before starting:

- **Guitar is the default, and everyone moves to it once.** `audio.voice` had been stored as
  `'synth'` since M0 but never shown, so nobody chose it; a v6 Dexie upgrade sets it to
  `'guitar'`. From then on the synth is a real choice. `'sampled'` still reads as piano, and
  anything unknown as the synth.
- **No bass voice.** The notes are guitar tab up to E6, and the bass samples stop at G3 — a
  sampler would shift them up two and a half octaves. `VoiceId` is `'synth' | 'piano' |
  'guitar'`; the bass samples wait for generated backing.
- **The piano is cut to 4 s per note after decoding**, with a 0.1 s fade: ~133 MB decoded
  becomes ~25 MB, with no re-encode.

Levels: each preset's `volumeDb` was set by rendering the same line through the synth and
the sampled voice offline and matching RMS — guitar +8 dB, piano −2 dB, both now within
0.3 dB of the synth. "Hear it" plays Cmaj7 then C7, strummed. The voice state lives in a
small `useSounds` store rather than the session: a session never needs to know which voice
is playing, and `AudioPort` is unchanged. The backing menu's "The synth plays the notes"
became "The notes play", since the notes are no longer necessarily the synth.

---

## Part 3 — Drum patterns, pure

`src/domain/drums/`. No audio, no Tone, fully unit-tested — `src/domain/` rules apply.

```ts
export type DrumSound =
  | 'kick' | 'snare' | 'hat-closed' | 'hat-open' | 'ride' | 'crash' | 'stick';

export interface DrumHit {
  sound: DrumSound;
  /** Ticks from the start of the bar. */
  tick: number;
  /** 0–1. */
  velocity: number;
}

export interface DrumPattern {
  id: string;
  name: string;
  /** A one-line description for the menu. */
  detail: string;
  /** Null fits any signature; otherwise the pattern is only offered for this one. */
  timeSignature: TimeSignature | null;
  /** The grid the metronome must schedule it on. */
  gridTicks(timeSignature: TimeSignature): number;
  /** One bar of hits. `barIndex` lets a pattern crash every fourth bar. */
  bar(timeSignature: TimeSignature, barIndex: number): DrumHit[];
}
```

Plus `drumPatterns()`, `patternById(id)`, and `patternsFor(timeSignature)` — which returns the
signature-agnostic ones and those whose signature matches.

### Simple — always offered

The player's own spec: **a steady ride on the eighths, a steady kick on the quarters, and the
snare every other beat starting on the second.** Generalised so it holds in any signature:

- **kick** on every beat.
- **snare** on every second beat, 1-indexed from beat 2 — so 4/4 gives 2 and 4, 3/4 gives 2,
  6/8 gives 2, 4 and 6.
- **ride** on every half-beat **when the beat is a quarter or longer**; on the beat itself when
  the beat is already an eighth or shorter. Without that clause 6/8 (`ticksPerBeat` = 240) would
  ride on sixteenths, which is a blur. In 4/4 the rule gives eighths, as asked.
- The downbeat's ride and kick take a higher velocity, which is what makes bar 1 findable
  without an accent click.

The pattern resets every bar. Nothing carries across a bar line.

### Upbeat, Soft, Heavy — 4/4 only

Starting points, to be tuned by ear at the gate. They are `timeSignature: FOUR_FOUR`, so the
menu hides them when an exercise is in 3/4 or 6/8.

- **Upbeat** — closed hats on eighths, open hat on the "and" of 4, kick on 1, the "and" of 3,
  and 3, snare on 2 and 4. Pushes.
- **Soft** — closed hat on quarters, low-velocity snare on 2 and 4, kick on 1 and 3. Everything
  quiet. For slow exercises where a full beat is in the way.
- **Heavy** — kick on 1, the "and" of 2 and 3, snare full on 2 and 4, hats on eighths, crash on
  the downbeat of every fourth bar.

**The old click's problem does not carry over, and the design should not pretend it does.**
`AudioEngine.ts` records that the click is 2 kHz because a low percussive thud "sits in the same
register as the guitar's low strings and disappears under them" — but that was one note. A kit
is not one note. The snare and the ride are both high and cut through everything else, and they
are what keeps the time; the kick is there for feel, not for timekeeping, and it is fine if it
sits under the guitar. Mix accordingly: the snare and ride carry the beat and must be clearly
audible, the kick can be felt more than heard. The kit still needs a level pass of its own
rather than inheriting the click's.

### Task 3 — outcome (2026-09-22)

`src/domain/drums/` as specced: `DrumSound`, `DrumHit`, `DrumPattern`, the four patterns,
`drumPatterns()`, `patternById()`, `patternsFor()`. Pattern ids are `simple`, `upbeat`, `soft`,
`heavy`. Every hit lands on its pattern's grid (tested for all four, in each signature they
fit). Simple in 6/8 puts a kick on all six eighths with the snare on 2, 4 and 6 — the rule
as written; the gate decides whether 6/8 wants its own. Heavy's crash takes the downbeat's
hat rather than stacking on it.

`DrumKit` (`src/audio/DrumKit.ts`) loads the seven kit files through the base URL and plays
a hit at an audio time and velocity. Two things beyond the spec:

- **A closed hat chokes a ringing open hat**, with a 20 ms fade, as the pedal does. Without
  it Upbeat's open hat rings over the next downbeat, and the count-in's open hats smear
  into each other.
- **A per-drum mix.** The samples arrive normalised, which made the kick the loudest thing
  in the kit and the ride the quietest — backwards for a metronome. Kick −6 dB, ride +3,
  open hat −2, crash −3; then the kit as a whole at −12 dB. Rendered offline at 96 bpm,
  Simple peaks near −8 dBFS with its RMS ~5 dB under a line of the levelled guitar; Upbeat
  and Heavy sit within 3 dB of it, and Soft ~9 dB under, as intended. All to be judged by
  ear at the gate.

`DrumKit.load()` rejects if a file fails; task 4's `DrumVoice` decides what a failed kit
falls back to.

---

## Part 4 — Metronome voices

### The model

Two things, not one:

- a **voice** — `ClickVoice` or a `DrumVoice` wrapping a pattern,
- **muted** — which already exists and is already mid-bar safe.

"Off" is *the click voice, muted*. That preserves the behaviour the current code calls out and
depends on: with the click off the **count-in still sounds**, because "with the click off, the
count-in is still how you know when to start". Nothing about muting, silencing or the count-in
changes.

`Metronome`'s `ClickSink` generalises:

```ts
export interface MetronomeVoice {
  /** Ticks between the events this voice wants. */
  gridTicks(timeSignature: TimeSignature): number;
  at(event: GridEvent): void;
}

export interface GridEvent {
  audioTime: number;
  timeSignature: TimeSignature;
  /** Ticks from the start of this bar. */
  tickInBar: number;
  /** Bar from the metronome's start; negative through the count-in. */
  bar: number;
  beat: number;
  isDownbeat: boolean;
  isCountIn: boolean;
}
```

- `ClickVoice` — grid is `perBeat / subdivision`; sounds accent, beat and subdivision exactly as
  `ToneClickSink` does today. The existing frequencies and envelopes move across unchanged.
- `DrumVoice` — grid is the pattern's; fires the hits at `tickInBar`. **When `isCountIn`, it
  ignores the pattern entirely and sounds an open hi-hat on each beat**, louder on the downbeat.

`Metronome` keeps its beat `scheduleRepeat(perBeat)` untouched, so beat listeners and the
playhead are unaffected, and gains one grid repeat driving the voice. The old subdivision repeat
folds into the grid.

**Changing voice re-schedules the grid repeat, so do it between passes, not during one.** The
menu is disabled while running, like Backing. `M` still works any time, because it only mutes.

### Where the choice lives

Per exercise, with the global setting as the fallback — **exactly the `countInBars` precedent**
(`ExerciseSession.ts:70`). This is what makes the player's original ask work: "different
exercises always use the most appropriate drum pattern".

```ts
export type MetronomeVoiceId =
  | 'off' | 'click'
  | 'drums-simple' | 'drums-upbeat' | 'drums-soft' | 'drums-heavy';
```

- `Settings.audio.metronome: MetronomeVoiceId` replaces `metronomeEnabled: boolean`.
  Migration: `true` → `'click'`, `false` → `'off'`.
- `Exercise.metronome?: MetronomeVoiceId` and `RoutineItem.metronome?`, both optional, both
  saved from the transport menu the way `countInBars` and `backing` are.
- A stored id whose pattern does not fit the current phrase's signature falls back to
  `drums-simple`, not to silence. An exercise set to Upbeat that rolls into 3/4 keeps drumming.

`PracticeSession.setMetronome(on: boolean)` becomes `setMetronomeVoice(id)`, saving to the
exercise or routine item rather than app-wide. `M` toggles between `'off'` and the last non-off
choice, so the reflex "kill the click" still works.

### Task 4 — outcome (2026-09-23)

Built as Part 4 describes, with these differences, all agreed with the player or forced by
the code:

- **One fixed grid, not a re-scheduled one.** The metronome runs a sixteenth-note grid for
  the whole run and each voice filters it to its own. Swapping a voice is a pointer change,
  so it is safe mid-run — which a routine needs, since its clock never stops between items
  and each item has its own metronome. "Things that will bite" §4 no longer applies, and the
  task-5 menu does not need disabling while running.
- **Bars count from the current item's bar 1.** `countInBetween(from, to)` already knew where
  the next item starts; the grid now uses it, so a half-bar count-in between items does not
  put Heavy's crash and the snare on the wrong beats.
- **Count-in sounds are fixed in code**, per the player: the click counts in on the stick,
  every beat on the open hat. Not a setting.
- **Only what the choice can play is downloaded** (the player's call, mid-task): Off
  nothing — its count-in is the synth click — Click the stick, a beat its own drums plus the
  open hat and Simple's. Checked on the dev server: Off requests no kit file, Click one,
  Upbeat five, Heavy six.
- **A failed or unfinished kit plays the click**, count-in included (the player's call).
- **Subdivision and accent moved onto `ClickVoice`**; nothing in the app set them.
- The session keeps the choice in `SessionState.metronome`, not the runner — it does not
  affect timing. `setMetronome(on)` became `setMetronomeVoice(id)` and `toggleMetronome()`;
  until task 5's menu, the transport's toggle and `M` both toggle, and Settings' row maps
  On/Off to click/off. `Settings.audio.metronomeEnabled` is read once as `metronome` (true →
  click, false → off) and dropped. A routine item copies the exercise's choice when added.

---

## Part 5 — UI

- **`MetronomeMenu.tsx`** in `src/routes/practice/`, modelled on `BackingMenu.tsx` — same
  popover, same `Option` rows with a one-line detail, same disabled-while-running treatment.
  Replaces the metronome toggle in `TransportBar`. Lists Off, Click, and the patterns
  `patternsFor(timeSignature)` returns.
- **Settings → Sound** — the Metronome row becomes the same choice (the default for an exercise
  that has not chosen its own); a new Instrument row; Volume stays; a Credits line linking the
  sample attributions.
- Both themes, checked on screen. Menu labels in American spelling.

---

## Tests

Few and impactful, per the project's rule. No screenshot tests.

- **`src/domain/drums/__tests__`** — the real coverage. One test asserting Simple's whole bar in
  4/4, and one each for 3/4 and 6/8 (the 6/8 ride clause is the thing most likely to be wrong).
  One that `patternsFor` hides the 4/4-only beats. One that Heavy's crash lands on bar 1 of 4.
- **`Metronome.test.ts`** — updated over `FakeClock`: a drum voice is asked for the right hits at
  the right ticks; the count-in uses the open hat and not the pattern. The existing mute,
  silence and `countInBetween` tests keep their current assertions.
- **`SampledVoice`** — the manifest resolves through `BASE_URL`; a failed load leaves the synth
  in the slot. No real audio, ever.
- **E2E** — one test: open the metronome menu, choose a beat, reload, the exercise still has it.
  No audio assertions.

`src/session/` imports audio as types only and lint enforces it. Keep it that way — unit tests
run in jsdom and must never fetch a sample.

---

## Task order

A branch, a commit per task, merged at the gate.

| # | Task | Size |
| --- | --- | --- |
| 1 | `scripts/fetch-samples.mjs`, the committed samples, `CREDITS.md`. No app change. | S |
| 2 | `SampledVoice`, the voice slot with synth fallback, prefetch, Settings → Sound Instrument row with "hear it". | M |
| 3 | `src/domain/drums/` and the `DrumKit` player. Unit tests. No UI. | M |
| 4 | `MetronomeVoice` refactor, `ClickVoice` + `DrumVoice`, open-hat count-in, the per-exercise field and its migration. | M |
| 5 | The metronome menu, the Settings row, the `M` hotkey, E2E. | S |
| 6 | **Gate — with a guitar.** | — |

Update `06-AUDIO.md` §Voices and §Metronome as each lands, rather than leaving the decision here.

### What only the player can judge, at the gate

- Does the sampled guitar sound like the instrument in your hands, or does piano read better?
  Which should be the default?
- Are the snare and ride clear enough over a guitar to keep time by, and is the kick sitting
  where it should — felt rather than heard?
- Are the drums louder or quieter than the notes want, and is the one master volume enough?
- Does each of Upbeat, Soft and Heavy earn its place, or is Simple plus one enough?
- Does the open-hat count-in actually read as "come in here"?
- Is Simple right in 3/4 and 6/8, or does it need a hand-written variant?

## Things that will bite

1. `import.meta.env.BASE_URL`. A rooted sample URL works on localhost and 404s on the deploy.
2. Sampler spacing. Minor thirds is the usual compromise; on a guitar the shifted notes between
   samples can sound synthetic, which is the whole thing we are trying to leave. Listen before
   committing the cut — re-cutting means new binaries in git history forever.
3. One master volume now feeds notes, click and drums. Expect a level pass.
4. Re-scheduling the grid repeat mid-run can re-phase the beat. Change voice between passes.
5. Samples are binary and permanent in git. Get the trimming right the first time.
6. `pnpm test:e2e` runs against `vite preview` — **`pnpm build` first**, or `dist/` has no
   samples in it. This has caught the project out twice already.
