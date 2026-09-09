# Handoff: Fretwork — variation-driven guitar practice web app

## Overview

Fretwork is a desktop web app for intermediate guitarists working on theory and improvisation. Its defining idea: **every exercise is randomly varied each session**, so the player is never reciting something memorised start-to-finish but always reacting to a fresh set of parameters. A practice routine chains several exercises together and runs hands-off — hit start, pick up the guitar, don't touch the computer until it finishes.

This bundle contains ten screen mockups covering the routine builder, two treatments of a running exercise, a fretboard explorer, a weekly practice report, a key/mode reference, and three theory-question exercise states.

## About the design files

The files in `mockups/` are **design references created in HTML** — prototypes showing intended look, structure and behaviour. They are not production code to copy directly.

The task is to **recreate these designs in the target codebase's environment** (React, Vue, Svelte, etc.) using its established patterns, component library and routing. If no codebase exists yet, pick the most appropriate framework for the project and implement the designs there. Note that the mockup file is a single streaming-HTML document with all ten screens laid out side by side on a canvas for review; in the real app each is a route or a state, not a scrolling page.

`mockups/_ds/…/styles.css` is the real design-system stylesheet and **is** worth porting more or less as-is: it is the source of truth for every colour, font, spacing and radius value. `mockups/support.js` is a preview runtime and should be ignored entirely.

## Fidelity

**High-fidelity.** Colours, typography, spacing, dividers and copy are final and taken from the Modernist design system. Recreate the UI faithfully, sourcing values from the design tokens rather than hard-coding them.

Two known exceptions:
- **Video frames are placeholders** (diagonal hatch fills labelled "Placeholder"). Real lesson video is out of scope for this design; substitute a video player.
- **Icons are text glyphs** (`▶`, `❚❚`, `×`, `→`) standing in for [Lucide](https://lucide.dev) icons, which the design system specifies. Replace with `play`, `pause`, `x`, `arrow-right`, `skip-forward`.

---

## Design tokens

Ported verbatim from `mockups/_ds/modernist-…/styles.css`. Use these; do not invent values.

### Colour

| Token | Value | Use |
| --- | --- | --- |
| `--color-bg` | `#f3f2f2` | Page ground |
| `--color-surface` | `#eae9e9` | Card and inset fills |
| `--color-text` | `#201e1d` | All body ink; also the dark "stage" background |
| `--color-accent` | `#ec3013` | Primary actions, active states, emphasis |
| `--color-divider` | `color-mix(in srgb, #201e1d 40%, transparent)` | All rules |

Neutral ramp: `100 #f8f4f4`, `200 #eae7e7`, `300 #d7d3d3`, `400 #bab6b6`, `500 #9b9797`, `600 #7d7979`, `700 #605d5d`, `800 #444141`, `900 #2d2b2b`.

Accent ramp: `100 #fff2ef`, `200 #ffe0d9`, `300 #ffc4b8`, `400 #ff9783`, `500 #ff563c`, `600 #dd2b0f`, `700 #ae1800`, `800 #7c1405`, `900 #4d170e`.

Rules of use: accent at full strength only for primary actions, active/selected states, small emphasis, and the one-per-screen "poster" statement panel. **Paragraph-size text in accent must use `--color-accent-700`**, never `--color-accent` (contrast). Tinted row highlights are `color-mix(in srgb, var(--color-accent) 8%, transparent)`.

### Typography

Archivo throughout (Google Fonts, weights 400 / 600 / 800). Headings are weight **800**, `line-height: 1.12`, `letter-spacing: -0.015em`, margin `0 0 8px`. Body is 15px / 1.55 / weight 400.

Scale: `h1 42px`, `h2 32px`, `h3 25px`, `h4 20px`, `h5 16px`, `h6 13px` (h6 is uppercase, `letter-spacing: 0.08em`).

Display sizes used beyond the scale: 76px (the 1c brief headline), 108px (the 1c tempo numeral), 52px / 46px / 40px (screen headlines), 34px / 36px (panel headlines).

The repeated small-caps label — used as a kicker above almost every block — is: `font: 400 11px Archivo; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(32,30,29,.55)`. A 10px variant appears inside dense grid cells. When it labels the current context it takes `--color-accent-700` instead.

All tabular numbers (timers, tempi, bar counts) set `font-variant-numeric: tabular-nums`.

### Spacing & shape

`--space-1 4px`, `--space-2 8px`, `--space-3 12px`, `--space-4 16px`, `--space-6 24px`, `--space-8 32px`.

**All radii are 0.** `--radius-sm/md/lg` are all `0px` deliberately. Nothing in this app has a rounded corner, including buttons, tags, inputs and modals.

Shadows exist (`--shadow-sm/md/lg`) but are essentially unused — the design organises with rules, not elevation. Only a modal would take `--shadow-lg`.

### Structural conventions

These carry most of the visual identity and must be preserved:

- **Section rules are 2px**, `var(--color-divider)`. Rules *inside* a section are 1px. Never soften to hairlines, never replace a rule with whitespace.
- **Panels are CSS grid with equal or explicitly-sized tracks**, cells separated by 1px right-borders. Visible modular structure is the point.
- **Everything is flush left**, including labels inside wide buttons. `.btn-block` sets `justify-content: flex-start`. Never centre a heading, a paragraph, or a button label.
- **No nested cards, no floating surfaces.** A "card" is a surface-filled cell in a grid.

### Interaction states

Never browser defaults. From the stylesheet:

- Primary button: `background: --color-accent`, `color: --color-bg`; hover `--color-accent-600`; active `--color-accent-700`.
- Secondary button: 1px `--color-divider` border; hover `color-mix(in srgb, var(--color-text) 7%, transparent)`; active 14%.
- Ghost button: `color: --color-accent`; hover accent at 10%; active 18%.
- Focus: `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px }`.
- Selection: accent at 30%.
- Disabled: `opacity: 0.45`.
- Table rows: hover `color-mix(in srgb, var(--color-text) 4%, transparent)`.
- Segmented control: selected option is a solid accent fill with `--color-bg` text.

---

## Domain model

Implement this before the UI; every screen is a view onto it.

### Variation axes

An **exercise definition** declares which axes it varies. Some axes are **session-scoped** (rolled once per session, shared by every exercise in the routine so the practice hangs together musically); the rest are **exercise-scoped** (rolled per exercise, per rep).

Session-scoped:
- `key` + `mode` — e.g. D Dorian
- `wildness` — 1–5 dial governing how many axes get rolled and how far from the last value they may land. At "Moderate" (3) position and rhythm vary while key holds.
- `interExerciseGap` — seconds of countdown between chained exercises (8s in the mockups)

Exercise-scoped:
- `neckPosition` — which fret the shape starts at
- `voicing` — drop 2, drop 3, closed, etc.
- `rhythmPattern` — straight 8ths, syncopated 16ths, etc.
- `backingProgression` — modal vamp, ii–V–i, 8-bar / 16-bar form
- `targetScaleDegree` — the note each phrase must land on
- `stringSet` / `intervalPattern` — as declared per exercise

The generated variation is **revealed in full before the rep is played** (never just-in-time). Every rolled value is displayed; values that changed from defaults are highlighted with the accent-tinted cell treatment, and the UI explicitly labels which axes are fresh.

### Tempo — per exercise, not global

This was a deliberate correction and matters:

- Tempo is **not** a session setting. Each exercise stores **its own** tempo state.
- Two stored values per exercise: **`cleanTempo`** — the fastest tempo at which the player can play it completely cleanly, and what the metronome uses when the exercise runs in a chain — and **`bestTempo`** — the fastest ever reached, kept as a personal record only.
- Progress is therefore per exercise and independent. The report tracks clean-tempo movement per exercise (raised / held / dropped).
- The routine builder offers only a **global offset** (−5 / +0 / +5 bpm) applied on top of each exercise's own clean tempo. It never sets an absolute session tempo.
- Theory exercises have no tempo at all (`—` / `n/a` in tables) and are scored on accuracy and time-per-question instead.

### Exercise kinds

1. **Played** — tab is generated for the rolled variation; a metronome and optional backing track run; the player self-assesses (there is **no microphone input or pitch detection** anywhere in this design).
2. **Theory** — answered by picking from options, no guitar. Two sub-kinds: single-pick (one question, 2–6 options, number-key answerable) and table-fill (several cells, a quality picked per row, untimed).

### Routine & session

A **routine** is an ordered list of exercises, each with a **rep count** (1–3 in the mockups). Reps are fixed and small on purpose — the player is forced to move on rather than grind one thing. A session runs the whole chain unattended: each exercise shows its brief, runs its reps, then an inter-exercise countdown announces the next variation. **Pause is available at all times** (space bar, and a persistent Pause button in the running chrome).

Every rep is logged with its exercise, rolled variation, tempo and outcome, so an arbitrary date range can be reported on.

### Progress metrics

Per exercise: `cleanTempo`, `bestTempo`, reps completed, variations seen, keys/modes covered, neck positions covered. Per player: sessions, total time, variations played, count of clean tempos raised, streak, per-mode key coverage. Theory exercises track accuracy instead of tempo.

---

## Screens

Screens are identified by the badge ids used in the mockup file and in review conversation (`1a`, `2b`, `3c`…). Widths given are the design widths of each mockup card.

### 1a — Routine builder / home (1200px)

**Purpose:** review today's routine, see what the dice produced, start the hands-off run.

Layout, top to bottom:
1. `.nav` header bar: brand "FRETWORK" (18px/800, `margin-right: auto`), nav links Routines / Practice / Fretboard / Report at 14px, then a 28×28 square avatar (`--color-text` fill, `--color-bg` text, 800/11px, centred initials). Header has a 2px bottom rule.
2. Title block, `padding: 30px 32px 22px`, flex row space-between, items bottom-aligned: left is a kicker in `--color-accent-700` ("Routine · Wednesday evening") over a 46px 800 two-line headline; right is two stat pairs 36px apart, each a 40px/800 numeral over a kicker ("6 Exercises", "31 min Hands-off run" — the unit is 18px inside the numeral).
3. 2px rule.
4. **Session variation bar** — 4 equal grid columns, 1px right-borders, `padding: 18px 22px` each: *Key & mode* (26px value, ghost "Change" button below), *Tempo* (value reads "Per exercise", with an explanatory 11px line carrying the −5 / +0 / +5 nudge in `--color-accent-700`), *Wildness* ("Moderate", plus a 5-segment 8px-tall meter with 3 filled in accent and 2 in `--color-neutral-300`, then an 11px caption), *Between exercises* ("8 s" + caption). 2px bottom rule.
5. **Main split** — `grid-template-columns: 1fr 360px`, 2px divider between.

Left column: a header row (`padding: 16px 22px 10px`) with the kicker "In this routine" and a right-aligned secondary button "Re-roll all variations". Then a `.table` with columns *(index, 34px) · Exercise · Rolled this session · Clean (80px) · Best (74px) · Reps (56px) · Time (64px)*. Index cells are 800/12px at 45% ink. Exercise names are weight 600. "Rolled this session" and "Best" are `.text-muted`. Clean tempo is weight 600. Six rows; the next-up row (03) is tinted with the 8% accent mix, its index in `--color-accent-700`, and carries a `.tag.tag-accent` "Next up". Row 06 (free improv) has `—` for both tempi. Footer strip above a 2px top rule: primary "Start routine" (13px/22px padding, 15px text), secondary "Add exercise", and a right-aligned 12px note "Each exercise at its own clean tempo. Space bar pauses."

Right column, three stacked blocks separated by 2px rules, each `padding: 20px 24px`:
- *Practised · last 28 days* — a 14-column, 2-row grid of square cells, `gap: 4px`, `aspect-ratio: 1`. Fill encodes intensity: `--color-neutral-300` (none), `--color-accent-300` / `-400` (light), `--color-accent` (full), `--color-accent-600` (today). The final cell is empty with a 1px divider border (future). Axis labels "Aug 11" / "Today" beneath at 11px, 50% ink.
- *Personal bests* — three label/value rows, 13px label against 17px/800 value, 1px rules between: "Clean tempos raised this month 4 of 6", "Modes at all 12 keys 3 / 7", "Longest streak 11 days".
- *Other routines* — three `--color-surface` rows, `padding: 10px 12px`, name at 14px/600 with a muted 12px exercise count right-aligned.

### 1b — Running exercise, panelled treatment (1200px)

**Purpose:** the working view at a desk, with a demo video and the neck diagram alongside the tab.

**Running chrome** (shared by 1b, 3a, 3b, 3c): a `--color-text` bar, `--color-bg` text, `padding: 12px 24px`, flex, `gap: 16px` — "03 / 06" at 16px/800; exercise name at 13px/400, 75% opacity; a flexible segmented progress bar (`gap: 3px`, 6px tall, one segment per exercise, `flex` proportional to that exercise's duration — completed accent, current `--color-accent-400`, upcoming `rgba(243,242,242,.25)`); "14:38 left" at 15px/800 tabular; a Pause button outlined in `rgba(243,242,242,.4)`.

Body is `grid-template-columns: 1fr 340px` with a 2px divider.

Left column:
1. **Variation brief**, `padding: 22px 26px 16px`, 1px bottom rule: kicker "This time you are playing" in `--color-accent-700`; a 34px/800 headline stating the full rolled variation in one sentence ("Ascending 4ths in D Dorian, 7th position."); a 14px paragraph, `max-width: 640px`, 72% ink, giving the instruction and the rep count *with the tempo labelled as the exercise's own clean tempo*.
2. **Axis strip** — 5 equal columns, 1px right-borders, `padding: 12px 14px`: Key, Position, Interval, Land on, Your clean tempo. **The three freshly-rolled axes get `--color-accent-100` cell fills with `--color-accent-800` text**; unrolled ones stay on the ground. The tempo cell shows "92" with "best 104" beside it at 12px/400, 55% ink. 1px bottom rule.
3. **Tab**, with a header row: kicker "Tab · bars 1–4 · generated for this variation" and, right-aligned, "Red boxes are the fresh axes" at 10px.
4. **Transport strip** above a 2px top rule, `padding: 14px 26px`, flex `gap: 14px`: a 42px accent icon-button (play), "Bar 2 · beat 3" at 13px/800 tabular, then tags — `.tag-outline` "Hear it", `.tag-neutral` "Count-in on", `.tag-neutral` "Backing: modal vamp" — and a right-aligned "Pass 1 of 2".

Right column, four blocks:
- 200px video placeholder wrapped in `.grayscale`, diagonal-hatch fill, label pinned bottom-left on a `--color-bg` chip.
- *Shape on the neck* — the compact fretboard (see below), 26px rows, 12 frets, plus a fret-number row beneath with the rolled position's frets in `--color-accent-700`.
- *Up next in 8 s* — exercise name at 18px/800 and a 12px muted description naming **its own** clean tempo.
- *Last time you played this* — two date/variation rows at 13px, first with a 1px bottom rule.

### 1c — Running exercise, poster treatment (1200px)

**Purpose:** the same exercise, readable from two metres away with the guitar in your hands. This is the divergent alternative to 1b, not a replacement.

The card inverts: `--color-text` background, `--color-bg` text, no border contrast against the page.

1. Slim dark header: "FRETWORK" at 13px/800 `letter-spacing: .14em`; routine name + "exercise 3 of 6" at 13px/400, 60% opacity; right-aligned "Space = pause". 2px bottom rule in `rgba(243,242,242,.25)`.
2. **The brief**, `padding: 44px 56px 34px`: kicker "Play this now" in `--color-accent-400`; then a flex row, `gap: 48px`, items top-aligned. Left is a **76px/800 headline, `line-height: .98`, `max-width: 740px`**, three lines, with the target-degree line in `--color-accent-500`. Right is a **108px/800 tempo numeral** over two uppercase 12px lines ("your clean tempo · two passes", then "Best ever 104" in `--color-accent-400`), then a 4-square beat indicator (22px squares, `gap: 6px`; current beat accent, rest `rgba(243,242,242,.25)`) with a 11px "Beat 1 of 4" caption.
3. **Tab on the light ground** — the panel returns to `--color-bg`, `padding: 26px 56px 20px`, with the tab set at **19px/800 fret numbers on 30px rows** for distance reading. Header row: "Tab, oversized for reading at a distance" / "Shaded column = where the metronome is".
4. **Status footer** — `grid-template-columns: 1fr 1fr 1fr 260px` on the light ground, 2px top rule: Elapsed (22px/800 tabular), Left in routine, Next (18px/800 name + an 11px line "Its clean tempo: 84 bpm"), then a 12px/18px cell with a full-width secondary Pause button and a skip icon-button.

### 1d — Fretboard explorer (1200px)

**Purpose:** see the mode across the whole neck, and which positions the dice have never sent you to.

1. `.nav` header, Fretboard marked `aria-current="page"`.
2. Title block, `padding: 26px 30px 18px`, 2px bottom rule: kicker "Fretboard" over a 34px/800 headline; right-aligned segmented control All / 3rd / 5th / 7th / 10th with "All" selected (accent fill).
3. **Large fretboard**, `padding: 30px 30px 18px`: 38px rows, 12 fret columns, 2px top and bottom edges, 26px note dots. Fret-number row beneath at 10px, centred per column.
4. **Three-column footer**, 2px top rule, 1px right-borders:
   - *Legend* — three rows, each a dot beside 13px text: `--color-neutral-800` "Root · D", `--color-accent` "Target degree this session", `--color-neutral-300` "Other mode degrees".
   - *Coverage* — three label/value rows at 13px with 1px rules: "Positions practised 3rd, 5th, 7th", "Never rolled yet **10th, 12th**" (value in `--color-accent-700`), "Keys covered in Dorian D, G, A".
   - *Turn this into practice* — `--color-surface` fill, kicker, a 13px paragraph, and a `.btn-primary.btn-block` "Roll a routine from the gaps". This is the screen's one call to action and it feeds straight back into the generator.

### 1e — Weekly practice report (820px)

**Purpose:** a page the player sends their teacher each week. Narrower than the app screens because it is a document.

1. Header, `padding: 34px 40px 22px`: kicker "Practice report · 31 Aug – 6 Sep 2026" in `--color-accent-700` over a 40px/800 name; right-aligned secondary "Export PDF" and primary "Send to teacher" at 12px.
2. `.hr` (2px).
3. **Stat row** — 4 equal columns, 1px right-borders, `padding: 16px 20px`: 30px/800 numeral over a 10px kicker. "5 Sessions", "2 h 41 Total time", "28 Variations played", "3 Clean tempos raised" (this last numeral in `--color-accent`).
4. **Time by day** — kicker, then a 7-column bar chart, `gap: 8px`, `height: 120px`, bars aligned to the bottom with percentage heights; practised days in `--color-accent` or `--color-accent-400` by length, rest days a 6% stub in `--color-neutral-300`. Day labels in a matching 7-column grid beneath.
5. `.hr`.
6. **Exercise log** — kicker "Every exercise, with the variation it was rolled at", then a `.table`: *Exercise · Variations seen · Reps (56px) · Clean tempo (126px) · Best (64px)*. The clean-tempo cell carries the movement inline at 12px muted ("96 ↑ from 92", "84 held", "76 ↓ from 80"); the theory-free improv row reads "n/a" and "—".
7. **Two-column assessment**, 2px top rule, 1px divider: *Held up well* and *Fell apart*, each a kicker over a 13px paragraph at 75% ink.
8. **Poster close** — full accent fill, white text, `padding: 20px 40px`, flex space-between: a 19px/800 statement (`max-width: 520px`) and a right-aligned uppercase "Fretwork" wordmark at 11px, 85% opacity. This is the one place accent runs as a field on this screen.

### 2a — Key & mode quick view, full drawer (880px)

**Purpose:** everything needed to write or improvise over the selected mode. Opens from any key/mode control (the session bar in 1a, the key cell in 1b, the header in 1d).

Content is fully derived from key + mode; the mockup shows D Dorian.

1. Header, 2px bottom rule: kicker "Quick view · 2nd mode of C major", a 36px/800 title, a 13px description line; right side has a segmented mode switcher (Dorian selected) and a close icon-button.
2. **The notes** — a 7-column grid, 1px borders, each cell a 24px/800 note name over a 10px kicker giving degree and interval ("1 · root", "♭3 · min 3rd"…). **The signature degree — the natural 6th for Dorian — is a solid accent cell with white text** and its label reads "6 · the signature". Beneath, a 11px meta row: step pattern, accidentals, relative major.
3. `.hr`.
4. **Diatonic chords** — a `.table`: *Deg (56px) · Triad (88px) · 7th (104px) · 9th (126px) · Function & use*. Seven rows. Triad and degree cells are weight 600; the function column is muted 13px prose. **The tonic, subdominant and dominant rows are tinted** with the 8% accent mix. The 9th column is honest where no diatonic 9th exists — `Em11` in place of Em9, `—` for the vi°. Header note right-aligned: "Tap any row for its voicings on the neck".
5. **Function strip** — 3 equal `--color-surface` columns, 1px right-borders: Tonic / Subdominant / Dominant, each a 10px kicker, a 22px/800 chord symbol, and a 12px explanatory line (the subdominant's notes that it is *major*, which is what makes it Dorian; the dominant's that it is minor and resolves softly).
6. **Progressions** — a 2×3 grid inside a 1px border, `margin: 0 30px 22px`: each cell a 17px/800 chord sequence over a 12px note on when to use it. Includes one deliberately out-of-mode entry (the whole-step "So What" shift) labelled as such.
7. **Two-column footer**, 2px top rule: *What it sounds like* (two 13px paragraphs on character and genre fit) and *Writing notes* (four rows with bolded lead-ins, 1px rules: Signature note, Avoid, Weak spot, Compare).
8. Action row, 2px top rule: primary "Set session to D Dorian", secondary "Show on fretboard", ghost "Hear the vamp".

### 2b — Key & mode quick view, popover (440px)

**Purpose:** the same reference at a glance, anchored to the control it opened from, for mid-session use.

Five stacked blocks inside a 2px border, 1px rules between, `padding: 14px 18px` each:
1. Header — kicker + 22px/800 mode name; right-aligned ghost "Full view →".
2. Notes — a 7-column, `gap: 4px` strip of 7px-padded cells, 14px/800, centred: root on `--color-neutral-800`, signature note on `--color-accent`, rest on `--color-surface`. Below, an 11px line in `--color-accent-700` naming the signature.
3. Seventh chords — seven tags with degree + symbol; tonic/subdominant/dominant are `.tag-accent`, the rest `.tag-neutral`, with an 11px legend line.
4. Go-to progressions — three 14px/800 lines, `gap: 5px`.
5. Sounds like — kicker over a 12px paragraph.

### 3a — Theory exercise, single pick (820px)

**Purpose:** a theory question inside the routine chain, answerable without the guitar, still readable at a distance.

1. Running chrome (as 1b), progress reading "Q 3 / 8".
2. Context strip, 1px bottom rule, `padding: 14px 28px`: `.tag-accent` "Theory · no guitar needed", `.tag-neutral` "Pick one", right-aligned 12px "2 of 8 correct so far · 6 s each".
3. **Question**, `padding: 34px 28px 26px`, 2px bottom rule: kicker "Question" in `--color-accent-700` over a **40px/800 question, `line-height: 1.06`, `max-width: 620px`**.
4. **Option grid** — 2 columns × 3 rows of secondary buttons with all borders removed and replaced by 1px cell dividers, `border-radius: 0`, `padding: 20px 24px`, **20px label, flush left**. Six options; musical symbols use proper glyphs (♯ ♭). Hover and active come from `.btn-secondary`.
5. Footer: a 12px hint naming the keyboard shortcuts (number keys 1–6 answer, Space pauses, Enter skips) and a right-aligned ghost "Skip question".

### 3b — Theory exercise, table fill (820px)

**Purpose:** multi-part answers — spell every diatonic chord in the session key.

1. Running chrome, "Q 1 / 4".
2. Question block, 2px bottom rule: kicker "Question · session key", a 32px/800 question, a 13px note ("Pick the quality for each degree. The root is given.").
3. **Answer table** — *Degree (70px) · Root (74px) · Quality · Your answer (120px)*. Seven rows, one per degree. The Quality cell holds four option tags per row; **the chosen one takes a solid accent fill with `--color-bg` text**, unchosen are `.tag-neutral`. Answered rows show the completed symbol in the last column at weight 600. **The active row is tinted (8% accent mix) and its four options render as `.tag-outline`** — the awaiting-input state — with an italic muted "answering…" in the answer column. Rows not yet reached show a muted "Waiting" / "—".
4. Footer, 2px top rule: primary "Check answers", secondary "Clear row", right-aligned 12px "3 of 7 filled · no time limit on table questions".

### 3c — Theory exercise, wrong-answer feedback (820px)

**Purpose:** correct the mistake, teach the rule, move on without stopping the routine.

1. Running chrome.
2. **Correction poster** — full `--color-accent` fill, white text, `padding: 24px 28px`: an uppercase 11px "Not that one" at 85% opacity over a **30px/800 statement of the correct answer**.
3. **Two columns**, 2px bottom rule, 1px divider: *You picked* — the wrong answer at 22px/800 with `line-through` at `2px` thickness, 55% ink, plus a 12px line naming what that answer actually is; and *The rule* on `--color-surface` — a 13px/1.5 explanation at 80% ink.
4. **Circle-of-fifths strip** — kicker "Where this sits in the circle", then a 7-column 1px-bordered grid, each cell an 18px/800 key name over a 10px sharp count. The **answer cell is a solid accent fill**; the **cell the player picked is `--color-neutral-200`** and labelled "3♯ · you said".
5. **Footer** — `grid-template-columns: 1fr 1fr 260px`, 2px top rule: Score (20px/800 "2 / 3"), Next question in ("3 s", tabular), then primary "Next" and secondary "Ask again later".

---

## The tab component

Used at two sizes (1b compact, 1c oversized). Build it once, parameterised.

Structure: six rows, one per string, top to bottom **e B G D A E**. Each row is a CSS grid — `grid-template-columns: 28px repeat(16, 1fr)` compact, `34px repeat(16, 1fr)` oversized — with `align-items: center`, `height: 19px` compact / `30px` oversized. The **string line is drawn as a row background**, not a border:

```css
background: linear-gradient(to bottom,
  transparent calc(50% - .5px),
  rgba(32,30,29,.42) calc(50% - .5px) calc(50% + .5px),
  transparent calc(50% + .5px));
```

Fret numbers are `font: 800 12px Archivo` (19px oversized), `text-align: center`, `font-variant-numeric: tabular-nums`, and **carry a `--color-bg` background with 1px horizontal padding** so each number visually breaks the string line — this is what makes it read as tab. Empty columns are empty cells with no background. The first cell of each row is the string letter at 11px/400, 50% ink, also on a `--color-bg` background.

**Playhead:** an absolutely-positioned overlay column inside a `position: relative` wrapper — `top: -4px; bottom: -4px; width: 26px` (compact) or `-8px / 40px` (oversized), filled `color-mix(in srgb, var(--color-accent) 18%, transparent)`. In the real app this animates across the tab with the metronome; in the mockups it is static at bar 2 beat 3.

A bar-label row sits beneath the compact tab: the same grid with four `span 4` cells labelled "Bar 1"…"Bar 4 · land on B" at 10px kicker style.

The 16 columns represent four bars of four beats. Real tab needs to handle arbitrary bar counts and note durations; treat the mockup as showing the visual language, not the data model.

## The fretboard component

Also used at two sizes (1b 26px rows, 1d 38px rows).

Grid: `grid-template-columns: 26px repeat(12, 1fr)` (34px label column at the large size), `grid-template-rows: repeat(6, <rowHeight>)`. Every cell has `border-left: 1px solid rgba(32,30,29,.3)` and `display: grid; place-items: center`. The label column cell overrides `border-left: 0` and holds the string letter at 10–12px/400, 55% ink. Outer edges: 1px top/bottom compact, 2px top/bottom plus 1px right at the large size.

Note dots: a circle (`border-radius: 50%` — the only round thing in the system, and only because it is a note marker, not a UI surface), 19px compact / 26px large, `display: grid; place-items: center`, `font: 800 10px Archivo` (11px large), containing the **scale-degree number**. Fills: `--color-neutral-800` with white text for the root, `--color-accent` with white text for the session's target degree, `--color-neutral-300` with default ink for other mode degrees.

Fret numbers sit in a matching grid beneath at 9–10px kicker style, centred; frets belonging to the current rolled position are coloured `--color-accent-700`.

---

## Interactions & behaviour

Not animated in the mockups, but implied and worth getting right:

- **Session run loop.** Start routine → for each exercise: roll the exercise-scoped variation → show the brief (full reveal, no countdown on the brief itself) → run the reps at that exercise's clean tempo with metronome and optional backing → advance. Between exercises, an `interExerciseGap` countdown (8s) that states the next exercise and its variation, so the player can reposition without looking. The whole loop is keyboard- and hands-free-operable.
- **Pause** is global and always available: space bar plus a visible button in the running chrome. It halts the metronome, the playhead and the countdown.
- **Playhead** advances with the metronome across the tab and highlights the current bar and beat; the beat indicator in 1c fills one square per beat.
- **Re-roll** in the routine builder re-rolls every exercise's variation without changing the session key or wildness.
- **Theory single-pick** accepts number keys 1–6; Enter skips; a correct answer advances immediately, a wrong answer shows 3c and auto-advances after 3s, with "Ask again later" pushing the question back into the queue.
- **Theory table-fill** is untimed and validated on "Check answers"; the active row is highlighted and its options render outlined until picked.
- **Quick view** opens from any key/mode control, as a right-hand drawer (2a) or an anchored popover (2b). Its content re-derives entirely from the selected key and mode.
- **Clean tempo** is updated by the player, not inferred — the design assumes an explicit "that was clean, raise it" affordance somewhere in the post-rep flow. **That affordance is not designed yet** and is the most obvious gap in this handoff.

## State

Per session: `routineId`, `sessionKey`, `sessionMode`, `wildness`, `interExerciseGap`, `tempoOffset`, `currentExerciseIndex`, `currentRep`, `isPaused`, `elapsed`, `remaining`, and the rolled variation for the current exercise.

Per exercise (persisted): `cleanTempo`, `bestTempo`, `repHistory`, `axesCovered` (positions, keys, voicings seen), and for theory exercises `accuracyHistory`.

Per player (persisted): session log with timestamps and rolled variations — everything the report reads — plus streak and coverage aggregates.

Reports are a query over the session log for an arbitrary date range; the mockup shows a week, and the design calls for month and year ranges too.

## Assets

- **Fonts:** Archivo from Google Fonts, weights 400 / 600 / 800. Already imported at the top of `styles.css`.
- **Icons:** Lucide. Not present in the mockups — text glyphs stand in (see Fidelity).
- **Imagery:** none real. The 1b video frame is a hatched placeholder. Any photograph added later must go through the `.grayscale` wrapper (`filter: grayscale(1) contrast(1.08)`) — the design system does not permit tinted or colour imagery.
- **Audio:** metronome click, backing tracks and chord playback are all referenced in the UI and none exist yet.

## Files in this bundle

- `README.md` — this document.
- `mockups/Fretwork Mockups.dc.html` — all ten screens. Open in a browser. Screens are grouped into review "turns", newest first: turn 3 = theory exercises (3a–3c), turn 2 = key/mode quick view (2a–2b), turn 1 = the core app screens (1a–1e). Each screen carries its id as a visible badge.
- `mockups/_ds/modernist-678b34fa-8335-4859-ad88-89cc2c7324d6/styles.css` — the design-system stylesheet. **Port this.**
- `mockups/_ds/…/readme.md` — the design system's own written guidance (direction, colour and type rules, do/don't list). Read it before making any visual judgement call the spec above does not cover.
- `mockups/_ds/…/_ds_bundle.js` and `mockups/support.js` — preview runtime. Ignore both.
- `screenshots/` — a 2× PNG of each screen, named by id: `1a-routine-builder`, `1b-exercise-panelled`, `1c-exercise-poster`, `1d-fretboard-explorer`, `1e-weekly-report`, `2a-key-mode-drawer`, `2b-key-mode-popover`, `3a-theory-single-pick`, `3b-theory-table-fill`, `3c-theory-wrong-answer`. Use these for reference; take measurements from the HTML and the spec above, not from the images.

## Open questions for the developer to raise

1. How the player marks a rep clean, and how `cleanTempo` moves as a result — not designed.
2. Tab data format and how variations generate it. The mockups show four hand-authored bars.
3. Whether backing tracks are generated or pre-recorded per progression.
4. Where theory accuracy appears in the routine table (1a) and the report (1e) — both currently show tempo columns that theory exercises cannot fill.
5. Exercise authoring: there is no screen yet for defining an exercise and declaring which axes it varies.
