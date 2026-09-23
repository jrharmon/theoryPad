# 06 — Audio

`tone` is imported **only** inside `src/audio/`. Everything else talks to the facade. This is
what makes the app testable and what makes swapping synths for samples a contained change.

---

## The Clock — the foundation

Restating from doc 01 because everything here depends on it:

```ts
export interface Clock {
  readonly ticks: number; // transport position, PPQ-based
  readonly seconds: number;
  readonly state: 'stopped' | 'started' | 'paused';
  setBpm(bpm: number): void;
  schedule(cb: (audioTime: number) => void, atTick: number): number;
  scheduleRepeat(
    cb: (audioTime: number) => void,
    intervalTicks: number,
    fromTick?: number,
  ): number;
  clear(id: number): void;
  start(): void;
  pause(): void;
  stop(): void;
  seek(tick: number): void;
}
```

- **`ToneClock`** wraps `Tone.getTransport()`. `Tone.Transport` is a sample-accurate scheduler
  running on the Web Audio clock — `setInterval`/`setTimeout` drift by tens of milliseconds and
  are audibly wrong for a metronome. This is the main reason we take the Tone.js dependency.
- **`FakeClock`** exposes `advanceTicks(n)` and fires scheduled callbacks synchronously in
  order. Unit and E2E tests inject it. A 31-minute routine runs in a few milliseconds.

The **session runner, metronome, playhead, rep counting and the inter-exercise countdown all
read from the same `Clock`**, so pausing is one call and everything stops together — no
drifting subsystems.

---

## AudioEngine

```ts
export interface AudioEngine {
  readonly clock: Clock;
  readonly ready: boolean;
  /** Must be called from a user gesture. Idempotent. */
  init(): Promise<void>;
  metronome: Metronome;
  phrase: PhrasePlayer;
  backing: BackingSource | null;
  preview: PreviewPlayer; // "hear it": one note, one chord, one scale
  setMasterVolume(db: number): void;
  dispose(): void;
}
```

**Autoplay policy:** browsers will not start an AudioContext without a user gesture. `init()`
is called from the first click on Play (or anywhere the user first interacts with sound), and
the UI must show a clear "click to enable sound" state until it resolves. Getting this wrong
produces the classic silent-app bug. It gets an E2E test.

**Lazy loading:** `import('./audio/AudioEngine')` on first use. Tone.js is ~90KB gzipped and
nothing on first paint needs it.

---

## Metronome

_Voices as built in the Sounds run, task 4, and the menu in task 5 (2026-09-23). Doc 12 has
the decisions._

`Metronome` (`src/audio/Metronome.ts`) runs two repeats on the clock: the **beat**, for
listeners (the playhead, the transport), unchanged since M2; and a fixed **sixteenth-note
grid** driving a `MetronomeVoice` — `gridTicks(timeSignature)` and `at(GridEvent)`. Each voice
hears only the steps on its own grid, so a voice can be swapped mid-run with `setVoice()` —
between a routine's items — without re-scheduling anything or shifting the beat. A grid
event's bar counts from the current exercise's bar 1: `countInBetween(from, to)` moves it to
`to`, so a routine item that counts in for half a bar still gets its backbeat where its bars
are.

Two voices (`src/audio/metronomeVoices.ts`, no Tone, tested over `FakeClock`):

- **`ClickVoice`** — the synthesised click (2 kHz accent, 1.4 kHz beat; see `AudioEngine.ts`
  for why it is high), optional subdivisions. **Counts in on the stick sample** when it is
  loaded, on the click itself when not.
- **`DrumVoice`** — a `DrumPattern` from `src/domain/drums` played on the `DrumKit`. **Counts
  in on the open hi-hat**, louder on the downbeat, ignoring the pattern. Until the kit has
  every drum the pattern needs — loading, or failed — it plays the `ClickVoice` instead: the
  samples are a nicety, and the time never goes silent.

**The choice** is a `MetronomeVoiceId` — `off`, `click`, `drums-simple|upbeat|soft|heavy` —
saved on the exercise (`Exercise.metronome`) or routine item, with `Settings.audio.metronome`
as the fallback: the `countInBars` precedent. **Off is the click voice, muted**: muting
never silences the count-in, because with the click off the count-in is still how you know
when to start. A beat that does not fit the phrase's signature plays Simple. `M` toggles
between off and the last choice that was on.

It is chosen from the **Metronome menu** in the transport (`MetronomeMenu.tsx`): Off, Click,
and the beats that fit the phrase's signature. It works while playing — the new voice is heard
from the next grid step — and is disabled under a backing track, which mutes it anyway.
Settings → Sound's Metronome dropdown sets the fallback. A routine's overview has no menu:
each item's metronome is its own, set from the transport while that item plays.

**Only what a choice can play is downloaded** (`metronomeSounds(id)`): Off loads nothing,
so its count-in is the synth click; Click loads the stick; a beat loads its own drums, the
open hat, and Simple's drums for the fallback. The session preloads when it opens — a
routine, every item's — and `DrumKit` fetches each sound once and never retries a failure.

Count-in is none, half a bar, 1 or 2 bars of clicks before the phrase starts, with a visible
bar/beat readout so you know when to come in. Half a bar is for slow tempos; it rounds up to
whole beats (`countInTicks`), so 4/4 counts 3, 4 and 3/4 counts two.

**It belongs to the exercise, not the app** — a drill at 35 bpm wants less warning than one at
160 — and is chosen from the Count-in menu in the transport, beside Backing, which saves it
back to the exercise. Default 1 bar. In a routine it belongs to the item being played and
counts that item in wherever it falls, first or fifth: the count-in is the only gap between
items, and how long it should be is the next exercise's business. Skipped entirely in
free-time runs.

---

## Voices — synth and samples

_As built in the Sounds run, task 2 (2026-09-22). Doc 12 has the decisions and the sample sets._

`InstrumentVoice` (`src/audio/voices/`) is the interface everything downstream plays through:
`load`, `ready`, `play(note, durationSeconds, atTime, velocity?)`, `releaseAll`, `setVolume`,
`dispose`. Two implementations:

- **`SynthVoice`** — a `Tone.PolySynth`, instant, no download.
- **`SampledVoice`** — `Tone.Sampler` over one `VoicePreset` (`presets.ts`): **piano**
  (Salamander, every minor third, Eb1–C7, each note cut to 4 s after decoding to keep memory
  near 25 MB) and **guitar** (FluidR3 steel-string acoustic, every semitone, B1–E6). Files
  resolve through `import.meta.env.BASE_URL` — `sampleDir()` — never a leading slash, because
  the deploy lives under `/theoryPad/`. Each preset's `volumeDb` levels it with the synth
  (matched by RMS over the same rendered line). Polyphonic, so chords work.

**The voice slot.** `AudioEngine` holds a `VoiceSlot`: the synth always, plus the chosen
sampled voice once it has loaded. `PhrasePlayer` takes `() => InstrumentVoice` and reads the
slot as each note plays, so nothing waits on a download — the synth plays until the samples
are in, and a load finishing mid-pass takes over from the next note. `init()` loads only the
synth. A failed load stays on the synth and is not retried until a different voice is chosen.

**Loading.** `audioPort()` in the practice store starts the chosen voice (`useSounds.choose`)
when the practice screen opens; Settings starts it when the voice changes. The transport says
"Loading sounds…" while it is in flight and "Sounds didn't load — the synth plays instead" if
it failed. `Settings.audio.voice` is `'synth' | 'piano' | 'guitar'`, default guitar; the v6
migration moved everyone off the never-chosen `'synth'`, and `withDefaults` reads the old
`'sampled'` as piano. Bass samples are committed but not a voice: guitar tab reaches E6 and a
bass sampler would stretch that into a chipmunk. They wait for generated backing.

Settings → Sound: **Instrument** (Synth · Piano · Guitar) with **Hear it** — a strummed Cmaj7
then C7 through the chosen voice — and a **Credits** line; two sample sets are CC-BY.

---

## PhrasePlayer

```ts
interface PhrasePlayer {
  load(phrase: Phrase, instrument: Instrument): void;
  play(): void;
  stop(): void;
  onTick(cb: (tick: number) => void): Unsubscribe;
}
```

Converts each `TabNote` to a pitch via `noteAt(instrument, {string, fret})` and schedules a
`Tone.Part` over the clock. Velocity comes from the note (slurred legato notes are quieter,
accents louder). Articulations that affect sound are handled simply: `palm-mute` shortens
duration and drops velocity; `ghost` drops velocity hard; `staccato` shortens; `slide` and
`bend` are visual-only in v1 (a `Tone.Frequency` ramp is possible later, and is explicitly not
worth it now).

Phrase playback is **optional during practice** — the point is that _you_ play. It is used for
"hear it" (demo the phrase before playing it) and for ear training.

---

## Videos: backing tracks and reference videos

_Decided at the start of M7 (2026-09-13), replacing the first spec's pool, `builtIn` flag and
automatic lookup._

**One table of YouTube videos, in two scopes.**

- **Shared** — a backing track any exercise or routine can use. It always has a key, a mode and
  a bpm, and is offered wherever the session's key and mode match it **exactly** (A minor and D
  Dorian share every note, but a vamp establishes the tonal centre, so D Dorian over an A-minor
  track just sounds like A minor).
- **An exercise's own** — attached to one exercise and never offered anywhere else, including
  routines. It has a **play along** switch:
  - _on_ — a custom backing track for that exercise: choosing it runs the exercise with it.
    Key and mode are optional; with them it is offered only when the session matches, without
    them always.
  - _off_ — a reference video: a lesson or a demo, watched once or twice while learning the
    exercise. Playing it plays the video and nothing else — no pass, no clock.

**Every video is equal.** There is no built-in flag: any video can be edited or deleted, and all
of them go into the export. The first track (below) is added once, on first run, as an ordinary
row with a fixed id. Later the player's collection moves into a **static data file** shipped
with the app — data, not code, and not IndexedDB — merged with the stored rows by id, so the
move is a copy with no duplicates.

### The model

```ts
export interface Video {
  id: Uuid;
  /** YouTube video id. */
  videoId: string;
  title: string;
  scope: { kind: 'shared' } | { kind: 'exercise'; exerciseId: Uuid };
  /** An exercise's own video only: false makes it a reference video. Shared are always true. */
  playAlong: boolean;
  /** Seconds into the video where bar 1 begins — after any intro. */
  startSec: number;
  /** Where to loop back from; the end of the video if absent. */
  endSec?: number;
  /** Required for shared tracks; optional for an exercise's own. */
  keyMode?: KeyMode;
  /** The recording's tempo. Required to play along. */
  bpm?: number;
  beatsPerBar: number; // 4 unless the track says otherwise
  /** For display: "modal vamp", "ii-V-i", "12-bar blues". */
  progression?: string;
  /** Free-form style tags: "rock", "funk", "drums only". */
  tags: string[];
  createdAt: number; updatedAt: number; deletedAt?: number;
}
```

The first track, and the fixture for building this: `WkIijba-HcU`, "A minor backing track",
shared, A Aeolian, 100 bpm, bar 1 at 216 s.

### Choosing backing — never automatic

Nothing is picked or rolled for you. **The default is what played before M7: the synth plays the
notes, with the metronome.** The backing menu on the practice screen (and on a routine's
overview) offers:

- **None** — the default.
- **Drone** — root and fifth of the session key, sustained, under the synth notes and the
  metronome (the notes stay: changed at the M7a review). Works in every key and mode, and
  offline.
- **Tracks** — shared tracks in the session's key and mode, narrowed by the exercise's (or
  routine's) saved criteria, plus the exercise's own play-along videos.

Choosing a track **replaces the synth notes** and mutes the metronome; the drone adds to them.

**Starting a track needs the click.** Safari and Firefox only let a video with sound start
inside the click that asked for it — an await in between loses it. So Play sends the play to
YouTube before anything else awaits; if the browser still holds it back, after 2.5 s the screen
asks for a press of the video's own play button, and lines the track up from there. That first
play inside the frame is permission for the rest.
The choice is remembered on the exercise (or routine); if a re-roll lands on a key the chosen
track does not match, it goes back to None and says so.

**Saved criteria** (optional, on an exercise or routine): tags a track must have, and a bpm
range. New tracks that fit appear in the menu without anyone touching the exercise.

**Required tags** (in an exercise's definition, `backing.requiredTags`): added to the saved
criteria — a one-chord exercise can ask for `single-chord`. The config page lists them. A
routine asks for every played item's, since one track plays through.

**Routines** offer the drone and shared tracks only.

### Tempo: the speed follows the exercise

YouTube slows a video without changing its pitch. Its player **accepts any rate from 0.25× to
2× in 0.05 steps** — tested 2026-09-13: 0.85 played at 0.85, 0.62 was rounded to 0.6. (Its
`getAvailablePlaybackRates()` still lists only the quarter steps; don't trust it as the full
set.)

```
speed          = exercise tempo ÷ track bpm, rounded to 5%, within 25–200%
effectiveTempo = track bpm × speed
```

An exercise at 76 over a 100 bpm track plays the track at 75%, 75 bpm. `currentTempo` follows
the effective tempo; `[` `]` step the speed by 5%; `targetTempo` is untouched, as always. The
control shows both numbers — `75% · 75 bpm` — and flags speeds below 50%, where the audio gets
mushy.

**In a routine** one track plays straight through, and its speed changes at each item's count-in
to fit that item's tempo. A theory item pauses the track; the next played item starts again
from bar 1 with a count-in.

### Timing: bar 1, the count-in, and following the video

- **Bar 1** (`startSec`) is where the backing kicks in, after the intro. The track form sets it
  by tapping along: the first tap, on a downbeat, marks bar 1, and the taps give the bpm. Nudges
  of ±0.05 s and "play from bar 1" check it. Bar markers on a timeline (a tempo map) can come
  later if a fixed bpm proves too rough.
- **The count-in plays over the intro.** The video starts one bar (at the effective tempo)
  before bar 1; the readout counts that bar as it does today, without clicks, and the tab starts
  on bar 1. When there is less than a bar before bar 1, the track's first bar is the count-in.
- **The clock follows the video**, not the other way round: its position comes from the video's
  own current time. That absorbs the player's start delay, pauses and speed changes. What it
  cannot correct is a wrong bpm.
- **Loops** jump from `endSec` (or the end) back to bar 1. YouTube's jump is not seamless;
  expect a hiccup, after which the clock locks on again.

_As built (M7a):_ `TrackFollower` (`src/audio/backing/`) polls the video every 40 ms and runs
the clock up to 15% fast or slow to close the gap, with a half-second time constant — the
clock never seeks, because a jump could step over a pass's end. `getCurrentTime()` is smooth
(it moves every ~12 ms), and YouTube is already ~0.2 s in when it reports playing, which the
count-in bar absorbs. The follower holds the clock while the video buffers, and loops on the
last whole bar before the end. In a routine, a theory set drops the player (its column goes
with the tab) and the next played item builds a fresh one; the clock is held at that item's
start until the track sounds.

### Where the player sits

YouTube requires its player to be visible and at least 200×200. It sits in the practice
screen's right column, which **stays visible while a video is on** — hiding the neck hides only
the neck. Both kinds of video have an **enlarge** button, for watching fingerings up close.

### Coverage

12 tonics × 7 modes = 84 combinations, and the shared tracks will be sparse for a long time. A
12×7 grid on Settings → Backing tracks shows which are filled, and clicking a cell lists its
tracks or starts adding one there.

### The `backingProgression` axis

Only meaningful for generated backing. When a track is in use, the progression is
whatever the recording plays, and the axis resolves to the track's `progression` string for
display rather than being rolled. Exercises should not assume they can control it.

### Generated backing — deferred

Specced here so the shape is settled, but **not built until the shared tracks prove
insufficient.** The drone (M7) is its first and smallest piece: no rhythm, no chords, just the
key's root and fifth, which is enough to practice modes over and works anywhere.

```ts
export interface BackingPlan {
  keyMode: KeyMode;
  progression: { numeral: string; bars: number }[];
  style: 'modal-vamp' | 'comp' | 'arpeggiated' | 'pad';
  includeDrums: boolean;
  loopBars: number;
}
```

Rendered by `GeneratedBackingSource` into scheduled events: bass root on beat 1 and fifth on beat
3, diatonic 7ths comped on a rolled rhythm, optional simple kick/snare/hat. Everything derives
from `diatonicChords(keyMode)`, so it works for any key at any tempo with zero assets — which
is exactly why it's the right _fallback_, and why it was the wrong default.

### One interface, two sources

```ts
export interface BackingSource {
  load(): Promise<void>;
  start(atTick?: number): void;
  pause(): void;
  stop(): void;
  /** The tempo actually coming out of the speakers; null for the drone. */
  readonly effectiveBpm: number | null;
  /** Speeds this source can play at; null when it has no tempo (the drone). */
  readonly rates: { min: number; max: number; step: number } | null;
  setRate(rate: number): void;
  readonly ready: boolean;
}
```

`YouTubeBackingSource` and (later) `GeneratedBackingSource` both implement it. The runner holds
a `BackingSource` and never asks which kind it has, so adding generation later touches nothing
above this line. `rates` is what lets one transport control serve every source: YouTube
gives 0.25–2 in 0.05 steps, a generated source any tempo, the drone none.

## YouTube integration

**Facade loading.** Never load YouTube's iframe API on page load — it is heavy and it tracks.

1. `<VideoEmbed videoId startSec endSec />` renders a static thumbnail
   (`https://i.ytimg.com/vi/<id>/hqdefault.jpg`) with a play overlay. Zero third-party code.
2. On click, load `https://www.youtube.com/iframe_api` once, then mount a player into the slot.
3. Use `www.youtube.com` as the host. This was `youtube-nocookie.com` until 2026-09-20:
   nocookie strips the viewer's YouTube session, so a Premium subscription never reached the
   iframe and every video opened with an advert. Cookies and viewing history against the
   account are the accepted price. The facade above is what keeps the privacy cost down —
   nothing third-party loads until someone clicks.
4. `startSec`/`endSec` map to the player's `start`/`end` params, so an exercise can point at
   the exact 40 seconds of a lesson that matters.

This is how reference videos play: in place, with an enlarge button, and nothing else happens.

For a backing track we need programmatic control (play/pause/loop tied to the runner's pause),
so that path uses the real iframe API behind `YouTubeBackingSource`, implementing the
`BackingSource` interface above. The runner never knows which kind it holds.

### Free time and backing tracks

A backing track and free-time mode pair naturally, and that pairing is the main reason free
time exists: the metronome is off and you play the exercise's material over the track at
whatever speed you set. The track-speed control stays available — it is a property of the
backing, not of the metronome — so slowing a track to 0.5× to learn something and stepping back
up to 1× works in free time exactly as it does with a click. The runner shows the phrase
statically, plays the track, and waits for you to say you're done.

**Offline caveat:** YouTube does not work offline, and every track is YouTube. When the
player cannot load, say plainly that backing needs a connection and go back to None; the drone
still works. This is the strongest argument for eventually building the generated
fallback — it is the only backing that works on a train.

---

## Latency and sync

- `Tone.getContext().lookAhead` defaults to 0.1s; keep it. The playhead reads
  `clock.ticks` in `requestAnimationFrame`, which is transport position, not scheduling
  position, so visual and audio stay aligned without manual compensation.
- Do not attempt to sync the generated backing to a YouTube track. They are mutually
  exclusive backing sources.
- Tempo changes during playback call `clock.setBpm()`; `Tone.Transport` handles the ramp.
  Ticks are tempo-independent, so the playhead needs no adjustment.

---

## What is deliberately not built

No microphone, no pitch detection, no audio recording, no waveform display, no MIDI I/O.
The design is explicit about this and it keeps the scope sane. If any of it comes back later
it is additive, not structural.
