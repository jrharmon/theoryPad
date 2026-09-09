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

```ts
interface Metronome {
  configure(opts: {
    timeSignature: TimeSignature;
    accentFirstBeat: boolean;
    subdivision: 1 | 2 | 4;
    countInBars: 0 | 1 | 2;
  }): void;
  start(): void;
  stop(): void;
  onBeat(cb: (bar: number, beat: number) => void): Unsubscribe;
}
```

Two `MembraneSynth`/`MetalSynth` voices — a higher accent click on beat 1, a lower click
elsewhere. Optional subdivision clicks at lower volume.

Count-in is 1 or 2 bars of clicks before the phrase starts, with a visible bar/beat readout so
you know when to come in. Default 1 bar. Skipped entirely in free-time runs.

---

## Voices — the samples-later path

```ts
export interface InstrumentVoice {
  readonly id: string;
  load(): Promise<void>;
  triggerAttackRelease(
    note: NoteName,
    durationSec: number,
    atTime: number,
    velocity: number,
  ): void;
  releaseAll(): void;
  dispose(): void;
}
```

v1 ships **`SynthVoice`** — a `Tone.PolySynth` with a plucked/karplus-ish configuration for
guitar-ish tone, plus a `Tone.PolySynth` with softer settings for backing chords.

Later, **`SampledVoice`** wraps `Tone.Sampler` with a small multi-sampled acoustic or clean
electric guitar (a handful of pitches per octave; Tone pitch-shifts between them). Because
everything downstream only knows `InstrumentVoice`, adding it is: drop samples into `public/`,
write the class, add `'sampled'` to the settings enum. **No consumer changes.** That is the
"not hard to add samples later" requirement, satisfied structurally.

Sample assets are lazy-loaded and cached by the service worker, so they cost nothing until
selected.

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

## Backing tracks

**A curated pool, looked up by key and mode.** Generated backing is the _fallback_, and it is
deferred.

This inverts what I originally specced, and it's the better shape: a real recording sounds
enormously better than anything Tone.js will produce, and the key-mismatch problem that made
me default to generation disappears once the pool is indexed by key and mode. You said you can
find a track for every key/mode you need — so the app's job is to pick the right one, not to
synthesise a worse one.

### The track model

```ts
export interface BackingTrack {
  id: Uuid;
  source: 'youtube' | 'generated';
  /** YouTube only. */
  videoId?: string;
  startSec?: number;
  endSec?: number;
  loop?: boolean;

  title: string;
  /** The track's musical identity. Half the lookup key. */
  keyMode: KeyMode;
  /** The recording's own tempo. Playback rate scales it — see below. */
  bpm: number | null;
  /** For display: "modal vamp", "ii-V-i", "12-bar blues". */
  progression?: string;
  /** Free-form: "jazz", "rock", "clean", "drums only". */
  tags?: string[];

  /** Shared pool, or attached to one exercise. The other half of the lookup key. */
  scope: { kind: 'shared' } | { kind: 'exercise'; exerciseId: Uuid };
  /** Shipped with the app, or added by you. */
  builtIn: boolean;
}
```

One table, two scopes — rather than a shared pool plus a separate per-exercise list. A track is
the same thing wherever it lives, and one collection means one lookup function, one editor UI,
and one place to fix a broken video id.

Built-in shared tracks ship as a seed table (`src/data/seed/backingTracks.ts`); everything else
lives in Dexie. The first entry, and the fixture for building this:

```ts
{
  source: 'youtube', videoId: 'WkIijba-HcU', startSec: 216, loop: true,
  title: 'A minor backing track',
  keyMode: { tonic: 'A', mode: 'aeolian' }, bpm: 100,
  scope: { kind: 'shared' }, builtIn: true,
}
```

### Lookup and resolution order

An exercise's own tracks win. A generic modal vamp is a fine default, but an exercise built
around a particular groove, form or feel deserves the track that actually fits it.

```ts
findBackingTrack(
  tracks: BackingTrack[],
  km: KeyMode,
  opts: { exerciseId: Uuid; preferBpm?: number; policy?: BackingPolicy },
): BackingTrack | null
```

Resolution order:

1. **Pinned** — `Exercise.pinnedBackingTrackId`, if set. Used regardless of key, for the case
   where the track _is_ the exercise ("play along with this solo").
2. **Exercise-scoped tracks matching key + mode.**
3. **Shared-pool tracks matching key + mode.**
4. **Generated** (deferred — see below).
5. **`null`** — the caller offers metronome-only or free time.

The exercise controls how far down that list it's willing to go:

```ts
type BackingPolicy = 'prefer-own' | 'own-only' | 'shared-only' | 'none';
```

`'prefer-own'` is the default and walks the whole list. `'own-only'` stops after step 2 — for
an exercise where a generic vamp would be actively wrong. `'none'` never offers backing.

Matching is **exact on both tonic and mode**, at every step. A minor and D Dorian share every
note, but a vamp establishes the tonal centre, so D Dorian over an A-minor track just sounds
like A minor. This is the one musical judgment in the audio layer worth being strict about.

Among several matches, prefer the one whose achievable tempo (below) lands closest to
`preferBpm`.

### Tempo: playback rate, not a pinned bpm

YouTube can slow a video down, and **it preserves pitch when it does** — the browser's
`preservesPitch` is on by default, so 0.75× is the same key, just slower. That makes a
recording far more useful than a fixed-tempo asset: one A-minor track at 100 bpm covers a
range of practice tempos in the right key.

```
effectiveTempo = track.bpm × playbackRate
```

Two constraints to design around:

- **The rate is quantised, not continuous.** The IFrame API exposes
  `getAvailablePlaybackRates()`, typically `[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]`. For a
  100 bpm track that's 25 / 50 / 75 / 100 / 125 / 150 / 175 / 200 — coarse, and not a free
  slider. Query the list at runtime rather than hard-coding it.
- **Below about 0.5× the audio gets audibly mushy.** Offer the low rates, but don't pick one
  automatically; default selection stays within 0.5×–1.5×.

So the transport shows a **track speed control**, not a bpm field:

```
Backing: A minor vamp · 100 bpm      Speed [0.75× ▾]  →  75 bpm
```

Default rate is the one whose effective tempo is nearest the exercise's `targetTempo` — target
76 against a 100 bpm track picks 0.75× and lands on 75, which is close enough that nothing
needs asking. Only when the nearest achievable tempo is still off by more than ~20% do we
prompt: _"Closest this track gets is 125. Your target is 76. Play at 125, or drop the backing?"_

`currentTempo` follows the effective tempo, and the metronome (if on) runs at it too, so
everything stays in agreement. `targetTempo` is untouched, as always.

Generated backing has none of these constraints — arbitrary tempo, exact key. Worth remembering
when weighing whether to build it.

### Coverage

12 tonics × 7 modes = 84 combinations, and the shared pool will be sparse for a long time. A
small grid in settings shows which are filled — the same idea as the fretboard explorer's coverage,
and cheap to build. It tells you what to go looking for, and it tells the roller something
useful too: an exercise that needs backing can bias its rolled key toward combinations the pool
actually covers.

### The `backingProgression` axis

Only meaningful for generated backing. When a pooled track is in use, the progression is
whatever the recording plays, and the axis resolves to the track's `progression` string for
display rather than being rolled. Exercises should not assume they can control it.

### Generated backing — deferred

Kept in the model (`source: 'generated'`) and specced here so the shape is settled, but **not
built until the pool proves insufficient.**

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
  /** The tempo actually coming out of the speakers. */
  readonly effectiveBpm: number | null;
  /** Rates this source can play at. YouTube: quantised. Generated: continuous. */
  availableRates(): number[];
  setRate(rate: number): void;
  readonly ready: boolean;
}
```

`YouTubeBackingSource` and (later) `GeneratedBackingSource` both implement it. The runner holds
a `BackingSource` and never asks which kind it has, so adding generation later touches nothing
above this line. `availableRates()` is what lets one transport control serve both: YouTube
returns its quantised list, a generated source returns a continuous range the UI renders as a
slider.

## YouTube integration

**Facade loading.** Never load YouTube's iframe API on page load — it is heavy and it tracks.

1. `<VideoEmbed videoId startSec endSec />` renders a static thumbnail
   (`https://i.ytimg.com/vi/<id>/hqdefault.jpg`) with a play overlay. Zero third-party code.
2. On click, load `https://www.youtube.com/iframe_api` once, then mount a player into the slot.
3. Use `youtube-nocookie.com` as the host for the privacy-preserving default.
4. `startSec`/`endSec` map to the player's `start`/`end` params, so an exercise can point at
   the exact 40 seconds of a lesson that matters.

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

**Offline caveat:** YouTube does not work offline, and the backing pool is entirely YouTube
until generation lands. The PWA must degrade gracefully: show the thumbnail placeholder, say
plainly that backing needs a connection, and let the exercise run with the metronome or in
free time instead. This is the strongest argument for eventually building the generated
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
