# TheoryPad

A local-first web app for practising guitar and music theory. Exercises can be randomly varied
each session — but a static exercise (no declared axes) is equally valid. No server, no
accounts: static bundle + IndexedDB.

## Before you start

**Read `docs/plan/STATUS.md` first** — where the project is and what is next.
Full plans are in `docs/plan/`; your task spec names which others to read.
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

- Notebook: a plain page, white **sheets** for grouped content (one sheet per group,
  never a card per row), graphite ink, ballpoint blue for actions and targets, highlighter
  yellow only for "you are here" (playhead) and "this changed" (fresh axis). 8px controls,
  12px panels, pill toggles; the floating transport is the only shadow. Bricolage Grotesque
  for headings and titles (`face-title`), Figtree for everything else; numbers read while
  playing use `num`. Small-caps section labels use `.kicker`. Muted text is `text-ink/64`
  (4.5:1 on white); anything fainter is only for hints.
- **Light and dark.** Every color is a token with a light value in `@theme` and a dark value
  under `:root[data-theme="dark"]` in `theme.css`. Style through tokens; a component must not
  know which theme is on. `dark:` only for what a token cannot express. The Appearance
  setting (System / Light / Dark) stamps `data-theme` on `<html>`; `index.html` does it before
  first paint from a localStorage mirror.
- Tailwind utilities + tokens from `src/styles/theme.css`. Don't hard-code a hex or a font.
- UI is shadcn/ui, themed through the tokens in `theme.css`. **Never hand-edit a shadcn
  component's internals** — change the tokens. Our own primitives (`kicker`, `field`,
  `empty-state`) live alongside them in `src/components/ui/`.
- Tailwind layering bites: a `@layer components` or `@layer base` rule loses to a utility.
  `.kicker` is an `@utility`; global overrides keyed on `data-slot` / `data-variant` are
  deliberately unlayered.
- Prefer composing `src/exercises/shared/` generators over new code. If a piece is missing,
  add it to `shared/` **with tests** — never inline it in an exercise.

## Verify by looking

Several real bugs in this project were invisible to tests and obvious in a screenshot:
inverted scale shapes, a brief naming one key while the axis strip named another, tab digits
running together, rounded badges. When a change affects what something looks like, render it
and look before saying it works — in both themes.

## Testing

Heavy unit coverage on `src/domain/`. Component tests only where there is real logic. Audio is
tested through `FakeClock`, never for real.

## Toolchain notes

- **TypeScript is pinned to 6.0.3.** TS 7 (the Go-native compiler) is out, but
  typescript-eslint does not support it yet, which would cost us type-aware linting. Revisit
  when typescript-eslint ships TS 7 support.
- Node 25 dropped corepack, so pnpm is installed globally rather than via corepack.
