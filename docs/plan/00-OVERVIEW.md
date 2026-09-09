# TheoryPad — Project Plan Overview

**Status:** planning. No application code exists yet. Nothing in this directory is implemented.

---

## What we are building

TheoryPad is a **local-first, single-page web app for practising guitar and music theory**.

Its defining idea, taken from the design session: **exercises can be randomly varied each
time you play them.** Instead of reciting something memorised start-to-finish, you react to a
fresh set of parameters. A _routine_ chains several exercises together and runs hands-off —
hit start, pick up the guitar, don't touch the computer until it ends.

**Variation is the differentiator, not a requirement.** A static exercise is a first-class
exercise: it simply declares no variation axes, and every other part of the system — the
runner, the renderer, the log — treats it identically. A partly-varied exercise (three axes
declared, two pinned by the player) is just as ordinary. Nothing is blocked from being useful
because it doesn't roll dice.

Two things follow from that and shape the whole architecture:

1. **Exercises are generators, not content.** An exercise definition declares which
   _variation axes_ it varies, if any (key, neck position, rhythm, target degree…), and a
   function that turns a resolved set of axis values into a playable phrase. Tab is generated,
   not authored.
2. **The app must run with no server.** Static bundle, IndexedDB, offline-capable. No
   accounts, no backend, no cost.

There is **no microphone input and no pitch detection** anywhere in this design. The app
tells you what to play and keeps time; you judge how it went.

---

## Decisions already locked in

These came out of the planning conversation on 2026-09-07 and are **settled** unless
explicitly revisited. Agents should not re-litigate them.

| Area                    | Decision                                                                                                                                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework               | React 19 + TypeScript (strict) + Vite                                                                                                                                                                                                                |
| Package manager         | pnpm                                                                                                                                                                                                                                                 |
| Styling / components    | Tailwind v4 + shadcn/ui, themed with the Modernist tokens                                                                                                                                                                                            |
| Design fidelity         | Mockups are **reference, not spec**. Match the spirit, not the pixels.                                                                                                                                                                               |
| Music theory            | `tonal` + a thin TheoryPad domain layer on top                                                                                                                                                                                                       |
| Tab / notation          | Bespoke component over a structured note model. No VexFlow, no alphaTab.                                                                                                                                                                             |
| Audio                   | Tone.js for everything, behind a facade that lets sampled instruments drop in later                                                                                                                                                                  |
| Backing tracks          | YouTube tracks indexed by key + mode, in two scopes: **an exercise's own tracks, then a shared pool**. Tempo comes from YouTube's pitch-preserving playback rate, so one track covers a range. Generated (Tone.js) backing is the deferred fallback. |
| Video                   | Optional, hand-curated YouTube reference/demo video per exercise. Separate from the backing pool.                                                                                                                                                    |
| Storage                 | IndexedDB via Dexie, sync-ready schema, JSON export/import. No cloud in v1.                                                                                                                                                                          |
| Exercise definitions    | TypeScript modules exporting a typed manifest, explicit registry                                                                                                                                                                                     |
| Routing / state         | React Router v7 (declarative) + Zustand                                                                                                                                                                                                              |
| Validation              | Zod for exercise params and imported data                                                                                                                                                                                                            |
| Testing                 | Vitest + React Testing Library + Playwright, tiered                                                                                                                                                                                                  |
| Deployment              | Static build + PWA, GitHub Pages, GitHub Actions CI                                                                                                                                                                                                  |
| Devices                 | Desktop-first; responsive enough to be usable on a tablet. No phone layouts.                                                                                                                                                                         |
| Instrument              | Tuning and string count fully generic and **tested against drop-D and 7-string fixtures from M1**; UI ships standard 6-string E, right-handed                                                                                                        |
| Shape system            | Three-note-per-string first. CAGED/positional shapes are planned but deferred.                                                                                                                                                                       |
| Notation                | Tab only. No standard notation staff.                                                                                                                                                                                                                |
| Variation control       | **Per-axis policies** (roll / roll-from-subset / fixed / hold). No global "wildness" dial.                                                                                                                                                           |
| Practice modes          | Standalone single-exercise practice **and** chained routines. Both first-class.                                                                                                                                                                      |
| Routines                | User-authored, with a "roll me a routine from my gaps" generator later                                                                                                                                                                               |
| Audience                | One local user. No profiles, no sharing, no auth.                                                                                                                                                                                                    |
| Build strategy          | Single-threaded agent tasks against sharp specs. Token efficiency over speed.                                                                                                                                                                        |
| Practice summary        | A sortable table (exercise · times played · tempos used · target · time) over a date range, exportable as one self-contained HTML file. No prose, no teacher-specific version.                                                                       |
| Exercise classification | **Tags**, not a single family — a legato speed drill through a scale is all three.                                                                                                                                                                   |

### The tempo model (a deliberate change from the handoff)

The handoff's `cleanTempo` / "was that rep clean?" self-assessment loop is **dropped**. It
adds friction and a whole scoring subsystem for little gain. Replaced with:

- **`targetTempo`** — the exercise's configured, intended tempo. Persisted. Changing it is
  always an **explicit** user action, never automatic and never a side effect of practising.
- **`currentTempo`** — transient. What the metronome is actually running at right now. The
  player moves it freely (up to test themselves, down to woodshed) and it is **not** written
  back to config. Reset from `targetTempo` when the exercise next starts.
- **`maxTempo`** — optional, manually entered, record-keeping only. A number you type in when
  you're proud of something. It does not affect any exercise behaviour.

Exercises may derive their starting tempo from `targetTempo` (e.g. a speed drill starting at
85% and laddering up), but the configured value is the anchor.

A later milestone adds a **post-session summary** that lists every exercise you ran with its
target vs. the tempo you actually settled on, and a one-click "adopt this as the new target".

### Free-time practice

Not every exercise wants a click. Any played exercise can run in **free time**: no metronome,
no count-in, no playhead. The tab and neck diagram are shown, an optional backing track plays,
and you work through the material at whatever pace you like. The rep ends when you say it does
(Enter, or the Done button); elapsed time is still logged. It's a per-run toggle, available
from M2, and it pairs naturally with a fixed backing track.

---

## The document set

Read these in order. Each is meant to be readable on its own so an agent can be pointed at
exactly the ones its task needs — that is the whole point of splitting them up.

| #   | Document                                     | What it settles                                                                     |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| 01  | [Architecture](01-ARCHITECTURE.md)           | Stack, directory layout, dev/build pipeline, test strategy, CI                      |
| 02  | [Domain Model](02-DOMAIN-MODEL.md)           | Every core data structure: music, instrument, phrase/tab, variation, tempo, session |
| 03  | [Exercise System](03-EXERCISE-SYSTEM.md)     | The pluggable exercise contract, registry, shared generators, extension points      |
| 04  | [Exercise Catalog](04-EXERCISE-CATALOG.md)   | Full spec for all 13 initial exercises                                              |
| 05  | [UI & Components](05-UI-COMPONENTS.md)       | Design system, component inventory, screens and routes                              |
| 06  | [Audio](06-AUDIO.md)                         | Tone.js architecture, metronome, phrase playback, backing tracks, YouTube           |
| 07  | [Data & Persistence](07-DATA-PERSISTENCE.md) | Dexie schema, repositories, export/import, future sync                              |
| 08  | [Milestones](08-MILESTONES.md)               | The build roadmap, with a review gate at each step                                  |
| 09  | [Agent Workflow](09-AGENT-WORKFLOW.md)       | How to task agents cheaply, task spec template, CLAUDE.md plan                      |
| 10  | [Open Questions](10-OPEN-QUESTIONS.md)       | What is still undecided and needs your input                                        |

---

## Source material

`design_handoff_fretwork/` is the output of the original design session:

- `README.md` — a detailed written spec of ten screens, the domain model, and open questions.
  **The domain reasoning is valuable. The pixel specs are reference only.**
- `mockups/Fretwork Mockups.dc.html` — all ten screens as static HTML.
- `mockups/_ds/…/styles.css` — the Modernist design system. We take its **tokens** (colour,
  type, spacing, zero-radius) into Tailwind and discard the rest.
- `screenshots/` — 2× PNGs of each screen, named by id (`1a` … `3c`).

Agents should generally **not** read the handoff. Everything they need has been distilled
into these plan documents. Reading the handoff costs thousands of tokens and reintroduces
requirements we have deliberately changed (notably `cleanTempo`).
