# 05 — UI, Components & Screens

## Design approach

The Modernist system from the design session is **reference, not contract**. We take its
tokens and its structural conventions — those carry the identity and cost nothing — and get
everything else from shadcn/ui.

**Keep** (cheap, high identity value):

- Zero border radius everywhere. Note dots on the fretboard are the sole exception.
- 2px rules between major sections, 1px between rows. Structure shown with rules, not
  whitespace or shadows.
- Everything flush left, including labels inside wide buttons.
- Accent (`#ec3013`) used sparingly: primary action, active/selected state, small emphasis,
  and one "poster" statement per screen.
- Small-caps kicker labels above blocks (11px, letter-spacing .12em, uppercase, muted).
- `font-variant-numeric: tabular-nums` on every timer, tempo and bar count.
- Archivo, weights 400/600/800.
- Grid panels with equal tracks and 1px cell dividers.

**Drop:** exact pixel measurements, the hand-authored layouts, the two-treatment split for the
running view. Match the feel; don't chase the mockup.

Put a condensed version of the "Keep" list in `CLAUDE.md` so agents apply it without reading
the handoff.

---

## Component inventory

### `components/ui/` — shadcn primitives

Installed as of M2: `button`, `badge`, `input`, `label`, `select`, `separator`, `card`.
Still to come as screens need them: `dialog` and `sheet` (the key/mode drawer), `popover`,
`toggle-group` (segmented controls), `slider`, `tooltip`, `tabs`.

Alongside them, three of our own following the same convention (we own these files):
`kicker.tsx`, `field.tsx`, `empty-state.tsx`.

Theming is done once, in `src/styles/theme.css`: shadcn's semantic tokens (`--primary`,
`--border`, `--muted-foreground`…) are mapped onto the Modernist palette, so generated
components come out in the design without editing their source. **Do not hand-edit a shadcn
component's internals** — change the tokens instead.

Three things that were not obvious and cost time:

- The CLI reads the **root** `tsconfig.json`, which is solution-style with no `paths`.
  Without the alias duplicated there it writes components into a literal `@/` directory.
- `--radius` is 0, but `rounded-full` does not read it and `Badge` uses it. Squareness is
  enforced by an **unlayered** `[data-slot] { border-radius: 0 }` rule — `data-slot` is the
  attribute shadcn puts on every component, so a future `shadcn add` cannot reintroduce a
  radius. It must stay unlayered: a rule in `@layer base` loses to a utility.
- `.kicker` is declared with `@utility`, not in `@layer components`, for the same reason —
  it kept losing to shadcn's own `text-sm`.

### `components/music/` — the bespoke, high-value components

These are the ones worth real design effort and real tests. Build each once, parameterised.

#### `<Fretboard />`

```ts
interface FretboardProps {
  instrument: Instrument;
  overlay: NeckOverlay;
  fretRange?: { low: number; high: number }; // default 0-12
  size?: 'compact' | 'large'; // 26px vs 38px rows
  labelMode?: 'degree' | 'note' | 'finger' | 'chord-tone' | 'none';
  emphasisFrets?: number[];
  onFretClick?: (pos: FretPosition) => void; // makes it interactive
}
```

CSS grid: `grid-template-columns: <labelCol> repeat(nFrets, 1fr)`, with
**`instrument.tuning.length` rows** — never a literal 6. String lines are row backgrounds;
fret wires are `border-left` on each cell; the nut is a heavier left edge at fret 0. Note dots
are circles containing their label. Roles map to fills: root = neutral-800, target = accent,
other = neutral-300.

**Rendering order is highest-to-lowest**: screen row 0 is `tuning[tuning.length - 1]`, the
last screen row is `tuning[0]`. This inversion happens here and in `TabStaff`, and nowhere
else in the codebase. Row height is fixed, so a 7-string simply renders taller.

Fret-number row beneath; frets in the current rolled position take the accent.

#### `<TabStaff />`

```ts
interface TabStaffProps {
  phrase: Phrase;
  instrument: Instrument;
  size?: 'compact' | 'large';
  subdivision?: 1 | 2 | 4; // render resolution; default 4 (16ths)
  playheadTick?: number | null; // null = hidden
  showBarLabels?: boolean;
  showPickStrokes?: boolean;
  autoScroll?: boolean; // follow the playhead on long phrases
}
```

One row per string, highest on top (same inversion as `Fretboard`, derived from
`tuning.length`). Each row is a grid of `bars × beatsPerBar × subdivision` columns. A note goes in column
`floor(startTick / ticksPerColumn)`. String lines drawn as row backgrounds; fret numbers get a
background-coloured chip with 1px horizontal padding so they visually break the line — that
detail is what makes it read as tab rather than a table of numbers.

Articulations render as small glyphs between notes (h, p, /, \, ~, b). Bar labels sit beneath
in a matching grid.

**Line breaking:** long phrases wrap into systems, as real tab does — one unbounded line runs
off the page with no way to see the rest, and generated phrases get long (modes-through-key is
21 bars). Four bars a line is conventional but far too many columns at fine subdivisions, so
`'auto'` keeps a line near 32 columns. Column indices stay absolute across systems so a note
keeps its identity wherever it wraps to.

**Playhead:** an absolutely-positioned overlay column inside a `position: relative` wrapper,
translated by a CSS custom property set from `requestAnimationFrame`. **No React state
updates while playing.** The tick is wrapped by the phrase length, so a repeating phrase keeps
its playhead over the notes on every pass instead of running off the end after the first.

#### `<KeyModeView />`

The content of the 2a drawer and 2b popover — everything derivable from a `KeyMode`. Built
once with a `variant: 'full' | 'compact'` prop and rendered into a `Sheet` or a `Popover` by
whoever opens it.

Sections: the seven notes with degree labels (signature degree in accent), diatonic chord
table (triad / 7th / 9th / function, with tonic-subdominant-dominant rows tinted), a function
strip, go-to progressions, character description, and writing notes.

Everything is computed from `diatonicChords(km)` and friends — **no hard-coded content per
key.** The prose ("what it sounds like", "writing notes") is the one exception: it is per-mode,
not per-key, so it's a seven-entry table in `domain/music/modeCharacter.ts`.

#### `<CircleOfFifths />`

Two forms: the 7-cell horizontal strip used in theory feedback (correct cell accent-filled,
picked cell neutral), and optionally a full wheel later. Strip first.

#### `<AxisPolicyEditor />`

The control that replaced the wildness dial. One row per axis the exercise declares:

```
Key          [ Roll ▾ ]     ( ) restrict to: [C] [D] [F] [G] [A]
Position     [ Roll ▾ ]     (•) restrict to: [3rd] [5th] [7th]  [10th] [12th]
Rhythm       [ Fixed ▾ ]    straight 8ths
Land on      [ Roll ▾ ]
Direction    [ Hold ▾ ]     (currently: ascending)
```

Used in two places with the same component: the exercise config page (exercise-scoped axes)
and the routine builder (session-scoped `key` and `mode`). Renders nothing for an exercise
that declares no axes.

#### `<BeatIndicator />`, `<HeatmapGrid />`, `<DayBarChart />`

Small, pure, presentational. The heatmap (practice intensity over 28 days) and day bar chart
(time by day) are hand-rolled CSS grid / flex — not worth a charting dependency.

### `components/practice/`

`RunningChrome` (the persistent dark bar: position in routine, segmented progress, time
remaining, pause), `VariationBrief` (kicker + headline + instruction), `AxisStrip` (the
equal-column grid of resolved axes, fresh ones accent-tinted; renders nothing when an exercise
declares no axes), `TransportBar` (play/pause, bar·beat readout, tempo control, free-time
toggle, tags for backing/count-in), `CountdownGap` (the inter-exercise announcement),
`TheorySinglePick`, `TheoryTableFill`, `TheoryFeedback`.

#### `<BackingControl />`

Sits in the transport bar whenever a track resolved. Shows what's playing, where it came from,
and the speed:

```
Backing: A minor vamp · shared · 100 bpm     Speed [0.75× ▾] → 75 bpm     [mute] [swap]
```

The speed dropdown is populated from the source's `availableRates()`, so it renders as discrete
steps for a YouTube track and (later) as a slider for generated backing — one component, both
sources. Each option is labelled with its resulting bpm, not just the multiplier, because the
bpm is the number you care about. `swap` opens the picker of other matching tracks.

Rates below 0.5× are shown but flagged, since YouTube's audio degrades noticeably down there.

### The practice summary

Deliberately **not** the mockup's report. No prose fields, no "held up well / fell apart", no
poster close, no teacher framing — the same table is useful to you and to your teacher, so
there is only one of them.

A date range, four numbers, and one table:

```
Practice · 31 Aug – 6 Sep            5 sessions · 2h 41m · 28 variations · 13 exercises

Exercise                    Played   Tempos used    Target   Total time
Seven modes through a key       6     72–80            76        34m
Interval sequences              4     80               80        22m
Legato runs                     9     96–108          100        18m
Diatonic drill                  3     —                 —        11m
```

`Tempos used` is the range actually played (from the rep log), shown against the configured
target — which is where you'd notice you've been sitting above target for a fortnight and
should probably raise it. Sortable; that's the whole interaction.

Export is the same table as a self-contained HTML file (styles inlined, no external assets) so
it emails and prints cleanly, plus a CSV of the raw rows.

### `components/media/` — `<VideoEmbed />`

See doc 06 for the mechanics. Facade pattern: renders a thumbnail from
`https://i.ytimg.com/vi/<id>/hqdefault.jpg` with a play overlay, and only injects the YouTube
iframe on click. Never loads YouTube's script on page load.

---

## The running-exercise view

Per your direction: **one view, between the two mockup treatments.** Not a poster, not a dense
desk panel — a readable single layout that degrades gracefully to a tablet.

```
┌────────────────────────────────────────────────────────────────┐
│ RunningChrome  03/06 · Interval sequences · ▓▓▓░░ · 14:38 · ⏸  │  dark bar
├────────────────────────────────────────────────────────────────┤
│ THIS TIME YOU ARE PLAYING                                       │
│ Ascending 4ths in D Dorian, 7th position.          ← ~36-40px  │
│ Two passes at 80 bpm, landing each phrase on the 6th.           │
├──────────┬──────────┬──────────┬──────────┬────────────────────┤
│ Key      │ Position │ Interval │ Land on  │ Tempo              │  AxisStrip
│ D Dorian │ 7th ▲    │ 4ths ▲   │ 6 (B) ▲  │ 80  (target 80)    │  ▲ = fresh
├──────────┴──────────┴──────────┴──────────┴────────────────────┤
│ TAB · bars 1-4                                                  │
│ e|————————————————————————————————————————                     │
│ B|————————————————————————————————————————     ← TabStaff      │
│ ... with playhead                                               │
├───────────────────────────────────┬────────────────────────────┤
│ ▶  Bar 2 · beat 3   [80 bpm −/+]  │  Shape on the neck         │
│    ⌗ count-in  ⌗ free time        │  <Fretboard compact />     │
│    Backing: A minor vamp  [0.75×] │  (+ reference video)        │
│                        Pass 1 of 2│                            │
└───────────────────────────────────┴────────────────────────────┘
```

Responsive behaviour: below ~1000px the right rail moves beneath the tab. Below ~760px the
axis strip wraps to two rows. Type scales up modestly at large widths so it stays readable
from a metre or two — but we are not building a distinct poster mode.

Theory exercises replace the tab/neck region entirely via their custom renderer, keeping the
running chrome and the brief.

---

## Routes

Hash router. `/` redirects to `/home`.

| Route                    | Screen                                                                                                           | Mockup       | Milestone |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| `/home`                  | Today's routine, routine list, practice heatmap, personal bests                                                  | 1a           | M5        |
| `/routines/:id`          | Routine builder — add/reorder exercises, reps, gap, session axis policies                                        | 1a           | M5        |
| `/exercises`             | Exercise library — everything in the registry, plus your configured instances; filtered by tag                   | —            | M2        |
| `/exercises/:id`         | Exercise detail — description, config (target tempo, max tempo, reps, params, video), history, **Practice this** | —            | M2        |
| `/practice/exercise/:id` | Standalone runner for one exercise                                                                               | 1b/1c merged | M2        |
| `/practice/routine/:id`  | Chained routine runner                                                                                           | 1b/1c/3a-3c  | M5        |
| `/fretboard`             | Fretboard explorer with coverage                                                                                 | 1d           | M6        |
| `/report`                | Practice summary over a date range — a table, not a document                                                     | 1e           | M6        |
| `/settings`              | Instrument, audio, practice defaults, export/import                                                              | —            | M5        |

`/exercises` and `/exercises/:id` are **not in the mockups** but are load-bearing: they are how
you configure an exercise (the tempo model needs a home) and how standalone practice starts.
They come early because they are how we test everything else.

---

## Keyboard map

The app must be operable with a guitar in your hands. Global, in the runner:

| Key       | Action                                                |
| --------- | ----------------------------------------------------- |
| `Space`   | Pause / resume                                        |
| `Enter`   | Advance (dismiss brief, skip question, next exercise) |
| `[` / `]` | `currentTempo` −1 / +1 bpm (Shift for ±5)             |
| `1`–`6`   | Answer a single-pick theory question                  |
| `R`       | Re-roll this exercise's variation                     |
| `Esc`     | End the session (with confirm)                        |

Focus management comes from Radix; the global shortcuts live in one `useRunnerHotkeys` hook so
they are registered and torn down in a single place.

---

## Accessibility floor

Not a compliance project, but cheap things worth doing because Radix gives them free: real
focus-visible rings (2px accent, 2px offset), labelled controls, `aria-current` on nav,
keyboard-reachable everything, and colour never as the sole carrier of meaning — the fresh-axis
highlight also gets a ▲ marker, and note roles carry text labels inside the dots.
