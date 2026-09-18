# 01 — Architecture

## Stack

| Concern              | Choice                                 | Notes                                                                                    |
| -------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Language             | TypeScript 6.0.3 (pinned), `strict`         | `noUncheckedIndexedAccess` on too — we index arrays constantly (strings, frets, degrees) |
| UI                   | React 19                               |                                                                                          |
| Bundler / dev server | Vite 8                                 | Static output, no SSR, no server runtime                                                 |
| Package manager      | pnpm                                   | Lockfile committed                                                                       |
| Styling              | Tailwind CSS v4                        | CSS-first config via `@theme`; Modernist tokens live there                               |
| Components           | shadcn/ui                              | Copied into `src/components/ui/`, owned by us, built on Radix                            |
| Icons                | `lucide-react`                         | The design system already calls for Lucide                                               |
| Routing              | React Router v8, declarative mode      | Hash router (see "Deployment")                                                |
| App state            | Zustand                                | Slice-per-concern, no Redux ceremony                                                     |
| Music theory         | `tonal`                                | Wrapped, never imported outside `src/domain/music/`                                      |
| Audio                | `tone`                                 | Wrapped, never imported outside `src/audio/`                                             |
| Persistence          | `dexie` + `dexie-react-hooks`          | IndexedDB                                                                                |
| Validation           | `zod`                                  | Exercise params, imported JSON, settings                                                 |
| Charts               | Hand-rolled SVG/CSS                    | The report's bar chart and heatmap are trivial; a charting lib is not worth 100KB        |
| Unit/component tests | Vitest 5 + React Testing Library + jsdom |                                                                                          |
| E2E                  | Playwright                             | Chromium only                                                                            |
| PWA                  | `vite-plugin-pwa`                      | Workbox under the hood                                                                   |
| Lint/format          | ESLint 10 (flat config) + Prettier      |                                                                                          |

**Versions as built (2026-09-08).** TypeScript is **pinned to 6.0.3**. TS 7 — the Go-native
compiler — is released and tagged `latest`, but `typescript-eslint` does not support it yet
(their issue #10940 tracks it), and losing type-aware linting costs more than the compiler
speed gains at this size. Revisit when support lands; the tsconfigs already avoid `baseUrl`,
which TS 7 removes. Node 25 has dropped `corepack`, so pnpm is installed globally rather than
pinned through `packageManager`.

**Dependency discipline:** every third-party library with a wide API surface (`tonal`, `tone`,
`dexie`) is accessed through a single wrapper module. Nothing else in the codebase imports
them directly. This is enforced by an ESLint `no-restricted-imports` rule. It buys us:
testability (fake the wrapper), swappability (samples instead of synths; a sync backend
instead of raw Dexie), and much smaller diffs when a library's API shifts.

---

## Directory layout

Single package. No monorepo.

```
theoryPad/
├─ docs/plan/                 # these documents
├─ design_handoff_fretwork/   # source material, read-only
├─ public/                    # static assets, PWA icons, audio samples (later)
├─ e2e/                       # Playwright specs
├─ src/
│  ├─ main.tsx
│  ├─ app/
│  │  ├─ router.tsx           # route table
│  │  ├─ providers.tsx        # store, db, audio, theme providers
│  │  └─ AppShell.tsx         # nav header + <Outlet />
│  ├─ routes/                 # one folder per screen; page-level composition only
│  │  ├─ home/                # routine list + today's routine (mockup 1a)
│  │  ├─ exercises/           # exercise library, exercise detail, standalone practice
│  │  ├─ practice/            # the session runner (mockups 1b/1c merged, 3a-3c)
│  │  ├─ fretboard/           # fretboard explorer (1d)
│  │  ├─ report/              # practice report (1e)
│  │  └─ settings/
│  ├─ domain/                 # PURE. No React, no DOM, no Tone, no Dexie.
│  │  ├─ music/               # the tonal wrapper: notes, intervals, scales, keys, chords
│  │  ├─ instrument/          # tuning, fretboard mapping, positions, string sets
│  │  ├─ phrase/              # Phrase/TabNote model, tick math, phrase builders
│  │  ├─ variation/           # axis registry, axis policies, the roller, seeded RNG
│  │  ├─ tempo/               # tempo plans and resolution
│  │  ├─ theory/              # theory-question models and generators
│  │  ├─ time/                # Clock interface + FakeClock (ToneClock lives in audio/)
│  │  └─ progress/            # coverage + report aggregations over the rep log
│  ├─ exercises/
│  │  ├─ registry.ts          # the explicit list of every definition
│  │  ├─ types.ts             # ExerciseDefinition and friends
│  │  ├─ shared/              # reusable generators, briefs, renderers
│  │  ├─ runner/              # the rep state machine, driven by an injected Clock
│  │  └─ <exercise-id>/       # one folder per exercise: definition.ts, generate.ts, tests
│  ├─ audio/                  # the ONLY place `tone` is imported
│  │  ├─ AudioEngine.ts       # facade + lifecycle
│  │  ├─ ToneClock.ts         # Clock implementation over Tone.Transport
│  │  ├─ Metronome.ts
│  │  ├─ voices/              # InstrumentVoice interface, SynthVoice, (later) SampledVoice
│  │  ├─ PhrasePlayer.ts
│  │  ├─ backing/             # BackingSource, YouTubeBackingSource, findBackingTrack
│  │  └─ youtube/             # IFrame API wrapper
│  ├─ data/                   # the ONLY place `dexie` is imported
│  │  ├─ db.ts                # schema + migrations
│  │  ├─ repositories/        # one per entity, typed, the app's real data API
│  │  └─ portability/         # export/import
│  ├─ store/                  # Zustand slices: session, settings, ui
│  ├─ components/
│  │  ├─ ui/                  # shadcn primitives
│  │  ├─ music/               # Fretboard, TabStaff, CircleOfFifths, KeyModeView, BeatIndicator
│  │  ├─ practice/            # RunningChrome, VariationBrief, AxisStrip, TransportBar
│  │  ├─ charts/              # HeatmapGrid, DayBarChart
│  │  └─ media/               # VideoEmbed
│  ├─ lib/                    # rng, ids, time formatting, small pure helpers
│  └─ styles/
│     ├─ theme.css            # Tailwind @theme block, Modernist tokens
│     └─ index.css
└─ test/
   ├─ setup.ts
   ├─ fixtures/               # hand-authored phrases, instruments, sessions
   └─ golden/                 # snapshot outputs of exercise generators
```

### TypeScript project layout

Three referenced projects rather than one, because they need genuinely different `types`:

| Project | Covers | `types` |
| --- | --- | --- |
| `tsconfig.app.json` | `src` | `vite/client` — **no Node types**, so app code cannot reach for `fs` or `process` |
| `tsconfig.test.json` | `test`, `e2e` | `node`, `vitest/globals` |
| `tsconfig.node.json` | the config files | `node` |

jest-dom's matchers are registered through `src/vitest.d.ts` and `test/vitest.d.ts`, which
import `@testing-library/jest-dom/vitest` — the `types` array can't reach that subpath.

### The rule that keeps this clean

**`src/domain/` is pure.** No React import, no `window`, no `Date.now()`, no `Math.random()`.
Time and randomness are always injected. Everything in there is trivially unit-testable and
that is where nearly all our test coverage lives. An ESLint boundary rule enforces the import
direction:

```
routes → components → domain
routes → store → domain
store  → session, data, audio, exercises
session → exercises, data, domain (audio as types only: it gets an AudioPort)
exercises → domain
domain → (nothing but lib)
```

Note where the **exercise runner** sits: `src/exercises/runner/`, not `src/domain/`. It depends
on `ExerciseDefinition`, and `domain → exercises` would be a cycle. It is pure in the same
sense regardless — no React, no DOM, no persistence, every clock reading injected — so it is
unit-tested exactly like domain code. The boundary lint caught this; the plan had originally
put it under `store/`, which would have implied React state it does not have.

`domain` never imports `components`, `store`, `data`, `audio`, or `exercises`.

---

## Design tokens

`src/styles/theme.css` carries the Modernist palette in Tailwind v4's `@theme` form:

```css
@import 'tailwindcss';

@theme {
  --color-bg: #f3f2f2;
  --color-surface: #eae9e9;
  --color-ink: #201e1d;
  --color-accent: #ec3013;
  /* neutral-100..900 and accent-100..900 ramps from the handoff */
  --font-sans: 'Archivo', ui-sans-serif, system-ui, sans-serif;
  --radius: 0px; /* everything square, per the design system */
}
```

shadcn is initialised with `--radius: 0` and its semantic variables (`--primary`,
`--background`, `--border`…) mapped onto these. Practical consequence: agents write plain
Tailwind utilities and shadcn components, and the Modernist look comes out for free without
anyone hand-writing CSS.

Structural conventions worth keeping from the design (they carry most of the identity and
cost nothing): 2px rules between major sections, 1px between rows, zero radius everywhere,
everything flush left, accent used sparingly. These go in `CLAUDE.md` as a short style note
so every agent applies them without reading the handoff.

Note dots on the fretboard are the one deliberate exception to zero-radius — they are note
markers, not UI surfaces.

---

## Local development

```bash
pnpm install
pnpm dev          # Vite dev server, HMR
```

Scripts:

| Script            | What it does                                                              |
| ----------------- | ------------------------------------------------------------------------- |
| `pnpm dev`        | Dev server                                                                |
| `pnpm build`      | Type-check then production build to `dist/`                               |
| `pnpm preview`    | Serve the production build locally                                        |
| `pnpm typecheck`  | `tsc --noEmit`                                                            |
| `pnpm lint`       | ESLint                                                                    |
| `pnpm format`     | Prettier write                                                            |
| `pnpm test`       | Vitest, run once                                                          |
| `pnpm test:watch` | Vitest watch                                                              |
| `pnpm test:e2e`   | Playwright                                                                |
| `pnpm check`      | **typecheck + lint + test.** The definition of done for every agent task. |

`pnpm check` must be green before any task is considered complete. It is the single command
an agent runs to self-verify, which keeps review cheap.

**PWA in development is disabled by default.** Service workers cause maddening stale-cache
bugs during iteration. `vite-plugin-pwa` runs in `devOptions.enabled: false` and is only
exercised in `pnpm preview` and CI.

---

## Build & deployment

Output is a fully static `dist/`. It can be opened from a file server, hosted anywhere, or
run offline once installed as a PWA.

**GitHub Pages**, deployed by GitHub Actions on push to `main`:

```
.github/workflows/ci.yml      # on every push/PR: pnpm check + pnpm build
.github/workflows/deploy.yml  # on main: build + upload-pages-artifact + deploy-pages
```

Because Pages serves from a subpath (`/theoryPad/`), set `base` in `vite.config.ts` from an
env var so local dev stays at `/`. Use `createHashRouter` **or** a 404.html SPA fallback —
hash routing is the lower-friction choice for Pages and we have no SEO concerns. Decision:
**hash router**, revisit if the URLs bother you.

---

## Test strategy

Four tiers, deliberately unbalanced. Most of the value is in tier 1.

### Tier 1 — Domain unit tests (Vitest). Exhaustive.

This is where the bugs actually are, and they are silent bugs: a wrong enharmonic spelling, a
scale degree off by one, a fret that maps to the wrong string. Nothing in the UI will tell
you. Cover:

- **Music layer** — scale spelling for all 12 tonics × 7 modes (84 cases, table-driven);
  diatonic triads and 7ths; interval naming; key signatures; enharmonic correctness.
- **Instrument layer** — note-at-fret for every string/fret pair; finding all positions of a
  pitch class; position windows; string sets. **Every instrument test runs against three
  fixtures: standard tuning, drop D, and a 7-string.** This is what stops a hard-coded `6`
  from surviving.
- **Phrase layer** — tick arithmetic, bar/beat conversion, note collision detection.
- **Variation roller** — seeded, therefore deterministic. Given seed X and a set of axis
  policies, assert exactly which axes rolled and to what. Cover all four policy modes, an
  empty axis list (static exercise), and the coverage bias.
- **Exercise generators** — golden-file tests. For each exercise, a fixed seed produces a
  phrase snapshotted to `test/golden/`. Catches unintended regressions in generated content,
  which is otherwise impossible to eyeball.
- **Progress/report queries** — coverage aggregation over a fixture rep log.

### Tier 2 — Component tests (RTL). Targeted.

Only for components with real logic:
`Fretboard` (right dots in the right cells with the right roles), `TabStaff` (notes land in
the correct grid columns for a given phrase; playhead position for a given tick),
theory single-pick (number keys 1–6, Enter skips), theory table-fill (row state machine),
`VariationBrief` (fresh axes highlighted).

Not for layout-only components.

### Tier 3 — E2E (Playwright). A handful.

- Run a 2-exercise routine start to finish and assert a session + reps were persisted.
- Answer a theory question wrong, see the correction, advance.
- Adjust `currentTempo` during practice, confirm `targetTempo` is unchanged afterwards.
- Export data, wipe the DB, import, confirm everything is back.

### Tier 4 — Audio. Never tested for real.

**The single most important testability decision in this project:** all timing goes through a
`Clock` interface.

```ts
export interface Clock {
  readonly nowSeconds: number;
  readonly ticks: number;
  scheduleRepeat(cb: (time: number) => void, intervalTicks: number): number;
  clear(id: number): void;
  start(): void;
  stop(): void;
  pause(): void;
  setBpm(bpm: number): void;
}
```

`ToneClock` wraps `Tone.Transport`. `FakeClock` lets a test call `advanceTicks(n)` and have
every scheduled callback fire synchronously. **The session runner, metronome, playhead, rep
counting, and inter-exercise countdown are all driven by `Clock` and are therefore fully
unit-testable with zero audio.** E2E tests inject `FakeClock` too, so a "31 minute routine"
runs in milliseconds.

Real sound output is verified by a human, not a test.

---

## Performance notes worth designing in now

- **The playhead must not re-render React 16 times a bar.** Drive it with `requestAnimationFrame`
  reading `clock.ticks`, writing a CSS custom property (`--playhead-col`) on a ref'd element.
  Zero React renders while a phrase plays.
- **The rep log is append-only and unbounded.** Report queries are Dexie range queries over an
  indexed `startedAt`, never `toArray().filter()`.
- **Tone.js is ~90KB gzipped and only needed once you press play.** Lazy-import the audio
  module so the first paint doesn't wait on it.
- Fretboard and tab are pure functions of their props; memoise them.
