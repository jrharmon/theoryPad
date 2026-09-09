# TheoryPad

A local-first web app for practising guitar and music theory. Exercises can be randomly varied
each session — but a static exercise (no declared axes) is equally valid. No server, no
accounts: static bundle + IndexedDB.

## Before you start

Full plans are in `docs/plan/`. Your task spec names which ones to read.
**Do not read `design_handoff_fretwork/`** — it is superseded and contradicts current
decisions (notably its `cleanTempo` model, which we dropped).

## Commands

- `pnpm dev` — dev server
- `pnpm check` — typecheck + lint + unit tests. **Must be green before you're done.**
- `pnpm test -- <path>` — a single test file
- `pnpm test:e2e` — Playwright

## Non-negotiables

- `src/domain/` is pure: no React, no DOM, no `Date.now()`, no `Math.random()`. Inject time
  and randomness. ESLint enforces this; `test/eslint-boundaries.test.ts` enforces ESLint.
- `tonal` only in `src/domain/music/`. `tone` only in `src/audio/`. `dexie` only in
  `src/data/`. Everything else goes through those wrappers.
- **`string: 0` is the LOWEST-pitched string in `tuning`** — not "low E". Index ascends with
  pitch. Display inverts it; the model never does.
- **Never write a literal `6` for string count.** Derive it from `instrument.tuning.length`.
  Tests run against standard, drop-D and 7-string fixtures.
- All musical time is integer ticks at PPQ = 480. Never float beats.
- All randomness goes through the injected seeded `Rng`.
- `targetTempo` changes only on explicit user action. Never write `currentTempo` back to it.
- Variation is controlled by per-axis policies (`roll` / `roll from subset` / `fixed` /
  `hold`). There is no global "wildness" setting — don't add one.
- Exercise `id` strings are persisted in the rep log forever. Never rename one.

## Style

- Zero border radius (fretboard note dots excepted). 2px rules between sections, 1px between
  rows. Everything flush left, including button labels. Accent `#ec3013` used sparingly —
  primary action, active state, small emphasis. Tabular numerals on all timers, tempos and
  counts (`.tabular`). Small-caps section labels use `.kicker`.
- Tailwind utilities + tokens from `src/styles/theme.css`. Don't hard-code a hex or a font.
- Prefer composing `src/exercises/shared/` generators over new code. If a piece is missing,
  add it to `shared/` **with tests** — never inline it in an exercise.

## Testing

Heavy unit coverage on `src/domain/`. Component tests only where there is real logic. Audio is
tested through `FakeClock`, never for real.

## Toolchain notes

- **TypeScript is pinned to 6.0.3.** TS 7 (the Go-native compiler) is out, but
  typescript-eslint does not support it yet, which would cost us type-aware linting. Revisit
  when typescript-eslint ships TS 7 support.
- Node 25 dropped corepack, so pnpm is installed globally rather than via corepack.
