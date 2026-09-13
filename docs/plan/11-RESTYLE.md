# 11 — Restyle: Notebook, light and dark

**Status:** built 2026-09-13 (R1–R6), at the gate — see *As built* below. Its own milestone
(branch `restyle-notebook`) between M6 and M7. Everything needed to implement it from a fresh session is
in this file; the mockups are `11-RESTYLE-mockups.html` next to it (open it in a browser, pick
**C · Notebook**, press **D** for dark) and published at
https://claude.ai/code/artifact/e3b03498-2fcf-4da8-901a-f8ebddb1544d.

## Decisions (made by the player — do not re-ask)

- **Direction: Notebook**, a practice journal: graph paper, graphite, ballpoint blue for actions
  and targets, highlighter yellow for "you are here" and "this changed". Rounded controls and
  panels; the transport floats. Chosen over *Fiesta* (sharpened Swiss) and *Tolex* (dark amp
  room); both are in the mockups for reference only.
- **Light and dark.** Both themes ship.
- **An in-app Appearance setting: System / Light / Dark**, in Settings → Display, **default
  System**. System follows the computer's appearance and changes live when it does.
- **Everything else is styling only.** No screen, control, copy, key or behavior changes, apart
  from the Appearance row. Existing E2E tests must pass untouched.

## Decided at the start (2026-09-13)

- **The exported HTML report is always light** — it is a document to print or share. At export
  time, read the light token values (stamp `data-theme="light"`, read, restore; synchronous, so
  nothing paints) rather than whatever theme is on.
- **Errors are red, not blue.** The accent used to double as the error color. Error text — the
  Settings import error and the theory ✗ mark — uses shadcn's `--destructive` (a `text-destructive`
  utility); ballpoint blue stays for actions and targets.
- **Toggles win over the secondary-button rule.** Every toggle is a `secondary` Button, and an
  unlayered rule beats any utility — so §4.3's rule skips a toggle that is on (as built, keyed on
  `.bg-toggle-on`; see below), and every pressed state (not only the transport's) carries the
  toggle-on ring.
- **Archivo is loaded today** (`@fontsource/archivo` in `main.tsx`, contrary to §3.2). R2 leaves
  it; R3 replaces the imports and removes the package.
- `popover.tsx` and `sheet.tsx` (added in M6) are shadcn too: tokens only, no hand edits.
- Theory answer buttons take the secondary-button look through `className`; they stay plain
  `<button>`s, so the DOM is unchanged. `text-white` on accent fills → `text-on-accent`.
- The explorer's neck heat stays graphite (the ink ramp, per M6); the ring that separates a dot
  from the shading uses the board's color, `ring-neck`.
- Unit tests that assert the class `text-accent-700` follow the rename to `text-accent-text` (the
  TabStaff ones; the Fretboard one stays, see below). The E2E tests are untouched.
- R2's proof is a pixel comparison of the before and after screenshot sets.

## Gate review (2026-09-13)

- The unmocked screens, the tab at playing distance and the playhead: approved as built.
- **The graph paper is dropped** — it did not look bad but added little. `--color-grid` is
  `transparent` in both themes (the old values are in comments in `theme.css`); the page is the
  plain `--color-bg`, and sheets still read against it.
- **Muted text is 64% ink.** Every `text-ink/55` and `/60` became `text-ink/64` (4.67:1 on white,
  4.53 on the page in light). 50% and below stay, for hints.
- The dark explorer heat, with white root dots ringed on the lightest cells: fine for now.

## As built — where the code differs from this spec, and why

- **Toggle-on ring** is Tailwind's `inset-ring inset-ring-toggle-on-ring`, not `ring-1 ring-inset`:
  `ring-inset` would turn the focus ring of a pressed toggle inward.
- **`.kicker`'s font-family** is set in `@layer base`, not in the utility: Tailwind orders
  utilities by their properties, and a font-family sorted `.kicker` ahead of `text-sm`, which then
  won on shadcn `Label`s carrying `.kicker`. Kicker ink is 64% (the mockup's muted), not 55%.
- **Tokens added:** `--color-fill-current` (the current routine segment; `bg-fill/60` in R3,
  `accent-400` in R2 — a class change would have broken R2's match), `--color-neck-heat` (the
  explorer's shading, graphite), `--color-toggle-off` (defined, for completeness).
- **R2 left three things for R3** because they were not visually identical: `num` on the tab and
  neck string labels and the dot labels (not tabular before), `text-on-accent` on theory fills
  (they were `text-white`, not the bg color), and the time-by-day chart's empty bars
  (`neutral-300` → `heat-0`).
- **The emphasised fret number keeps `text-accent-700`**: `e2e/gallery.spec.ts` asserts the class,
  and the existing E2E tests stay untouched. The ramp step equals `accent-text` in both themes.
- **shadcn tokens:** `--background` and `--card`/`--popover` point at paper (dialogs, the drawer
  and outline buttons are sheets); `--input` at the toggle edge, so fields match secondary buttons.
- **More unlayered rules in `index.css`**, all keyed on `data-slot`: the secondary button (scoped
  `:not(.bg-toggle-on)` — "Hide neck" is `aria-pressed` but drawn plain); the tag badge (surface
  fill, so it reads on a sheet); ghost/outline hover and a Select's focused item (shadcn's
  `bg-accent` is the brand blue here, not its subtle tint — they filled solid blue under ink
  text, a latent M2 bug that was red before); and buttons' focus-visible outline (shadcn's 50%
  halo nearly vanished around a filled blue button, and its `outline-none` hid the app's).
- **Header rules on the paper are gone on every screen**, not only Home — the principle puts
  rules inside sheets. Theory answer buttons are `rounded-control` secondary look; a table's
  option chips are pills. The routine builder's name field uses the h1 variables.
- **Placement without wrappers:** sheets were applied to existing elements (rule 1 forbids new
  DOM), so on the config page Tempo and Settings are separate sheets, and What varies' prose sits
  on the paper above its sheet.

## Contents

1. Rules for this milestone
2. Tasks and commits
3. R2 — Tokenize with today's values (zero visual change)
4. R3 — Notebook, light
5. R4 — Dark values and theme plumbing
6. R5 — The Appearance setting
7. R6 — Docs, and the gate
8. Appendix — token tables

---

## 1. Rules for this milestone

1. **Styling only, except R5.** Allowed: `src/styles/theme.css`, `src/styles/index.css`, font
   imports in `src/main.tsx`, an inline script in `index.html`, and `className` / `style` strings
   in our own components. Not allowed: DOM structure, element order, copy, `aria-*`,
   `data-testid`, props, hotkeys, behavior. If an existing E2E test fails, you changed more than
   styling — fix the change, not the test.
2. **Never hand-edit a shadcn component's internals** (`src/components/ui/{badge,button,card,
   dialog,input,label,select,separator}.tsx`). Style them through tokens, through classes at the
   call site, or through **unlayered** attribute rules in `index.css` keyed on `data-slot` /
   `data-variant` (the precedent is today's `[data-slot] { border-radius: 0 }` rule).
3. **Tailwind layering.** A rule in `@layer base` or `@layer components` loses to a utility. Global
   overrides go unlayered; reusable classes go in `@utility`.
4. **No hex in components.** Every color in a `className` comes from a token. Add a token rather
   than write `bg-[#…]`. Every token has a light value and a dark value (appendix).
5. **Style through tokens, not through `dark:`.** A component should not know which theme is on.
   Use `dark:` only for what a color token cannot express (one case: the playhead's blend mode).
6. **Verify by looking, in both themes.** Every screenshot in §7 is taken twice.
7. Working agreement as in `STATUS.md`: a commit per task, stop at the gate, merge into `main` at
   the gate after review, then push and check CI as well as the deploy.

## 2. Tasks and commits

| Task | Commit | Visual change? |
| --- | --- | --- |
| R1 | Commit this doc and its mockups; add the milestone to `08-MILESTONES.md` | none |
| R2 | Tokenize the look with today's values; fix the `dark:` variant | **none** — screenshots must match |
| R3 | Notebook, light: fonts, token values, component classes | light theme |
| R4 | Dark token values; the theme stamped on `<html>` before first paint; follows the system | dark theme on a dark system |
| R5 | The Appearance setting (System / Light / Dark) and its tests | new Settings row |
| R6 | CLAUDE.md, `05-UI-COMPONENTS.md`, `STATUS.md`, 08's Outcome; gate screenshots | none |

---

## 3. R2 — Tokenize with today's values (zero visual change)

Move every hard-coded or overloaded style decision behind a named token, **with today's
values**, so R3 and R4 only change values. Screenshot the §7 list before and after; they must
match.

### 3.1 Fix the `dark:` variant first

Tailwind v4's default `dark:` variant is `prefers-color-scheme`, and there is no
`@custom-variant` in `index.css`, so on a Mac in dark mode today the shadcn Button (outline),
Input, Select and Badge pick up dark fills on the light app. Add to `index.css`, right after the
import:

```css
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```

Nothing sets `data-theme` until R4, so `dark:` stops applying at all — which is today's intent.

### 3.2 New tokens

Color tokens go in `@theme` (so `bg-*`, `text-*`, `border-*`, `ring-*` utilities exist); the
other variables go in `:root`. "Today" is the value that reproduces the current look.

| Token | Today | Replaces / used by |
| --- | --- | --- |
| `--color-paper` | `var(--color-bg)` | Anything that must match what is under it: `TabStaff` NoteChip and string label `bg-bg` → `bg-paper`; the practice tab and neck column wrappers; sticky table headers in `ReportPage` (`bg-bg` at ~159, ~169). |
| `--color-rule` | `color-mix(in srgb, #201e1d 40%, transparent)` | **1px** row rules. Every `border-divider` on a 1px border (≈49) → `border-rule`. 2px section rules (≈22) keep `border-divider`. |
| `--color-accent-text` | `#ae1800` | Accent as text: all `text-accent-700` (≈20) → `text-accent-text`; `@utility kicker-accent`. |
| `--color-accent-tint` | `#fff2ef` | Soft accent fills (`bg-accent-100`). |
| `--color-on-accent` | `var(--color-bg)` | Text on accent fills; shadcn `--primary-foreground: var(--color-on-accent)`. |
| `--color-nav` / `-nav-ink` / `-nav-active` | bg / ink / `#ae1800` | `AppShell` header background, text, active link. |
| `--color-avatar` / `-avatar-ink` | ink / bg | `AppShell` "JH" square. |
| `--color-chrome` / `-chrome-ink` | ink / bg | `RunningChrome` bar, both branches (`bg-ink text-bg`). |
| `--color-track` / `--color-fill` | `color-mix(in srgb, #f3f2f2 25%, transparent)` / accent | `RunningChrome` progress track (`bg-bg/25`) and fill (`bg-accent`). Routine segments: done `bg-fill`, current `bg-fill/60` (was `bg-accent-400`), upcoming `bg-track`. |
| `--color-transport` / `-transport-ink` / `-transport-edge` | bg / ink / divider | The three fixed bottom bars: `PracticeExercise` (`fixed inset-x-0 bottom-0 …`), and two in `PracticeRoutine`. |
| `--color-toggle-on` / `-on-ink` / `-on-ring` / `-off` / `-off-ink` / `-edge` | ink / bg / transparent / surface / ink 45% / transparent | **Every pressed/selected state drawn as `bg-ink text-bg`**: `TransportBar` `Toggle`; `SettingsPage` `OnOff`; `ReportPage` range buttons (~141); `FretboardExplorer` toggles (~54, ~189, ~201); `TableFill` selected cell (~83). → `bg-toggle-on text-toggle-on-ink hover:bg-toggle-on/85`; the off state → `text-toggle-off-ink`. |
| `--color-tab-line` | `rgba(32,30,29,.42)` | `TabStaff` `lineBackground` — the only hard-coded color in a component. |
| `--color-tab-bar` / `-tab-digit` / `-playhead` | ink 60% / ink / accent 20% | `TabStaff` bar lines (`bg-ink/60`), NoteChip text (`text-ink`), playhead (`bg-accent/20`). |
| `--color-neck` | `transparent` | `Fretboard` fret cells' board background (not the label column). |
| `--color-neck-fret` / `-neck-nut` / `-neck-string` / `-neck-edge` / `-inlay` | ink 30% / ink 30% / ink 40% / divider / ink 15% | `Fretboard`: cell `border-ink/30`, nut left border, string line `bg-ink/40`, board `border-divider`, marker dots `bg-ink/15`. |
| `--color-dot-root` / `-root-ink` | `#444141` / bg | `Fretboard` `ROLE_CLASS.root`; `FretboardExplorer` legend (`bg-neutral-800`, ~221). |
| `--color-dot-target` / `-target-ink` | accent / bg | `ROLE_CLASS.target`; explorer legend (`bg-accent`, ~224). |
| `--color-dot-chord` / `-chord-ink` | `#d7d3d3` / ink | `ROLE_CLASS['chord-tone']`; explorer legend (`bg-neutral-300`, ~228). |
| `--color-dot-pass` / `-pass-ink` | `#eae7e7` / ink 70% | `ROLE_CLASS.passing` and `.none`. |
| `--color-fresh` / `-fresh-ink` | `#fff2ef` / `#7c1405` | `AxisStrip` fresh cell (`bg-accent-100 text-accent-800`). |
| `--color-star` | accent | `FavoriteToggle` on. |
| `--color-heat-0…3` | neutral-200 / 400 / 600 / ink | `HeatmapGrid` `SHADE`; `KeyModeGrid` shade map (line ~5); `DayBarChart` (`bg-ink` → `bg-heat-3`, empty `bg-neutral-300` → `bg-heat-0`). |
| `--color-heat-future` / `-heat-today` | neutral-300 / accent | `HeatmapGrid` future border and today outline. |

**Fonts (`@theme`):** `--font-sans` (UI), `--font-display` (h1/h2), `--font-title` (routine and
exercise names, axis values, wordmark), `--font-num` (numbers read while playing),
`--font-kicker`. Today: all `'Archivo', ui-sans-serif, system-ui, -apple-system, 'Segoe UI',
sans-serif`. (Archivo is named but never loaded today — it only renders where installed. R3
replaces it, so do not add a package for it.)

**Radii (`@theme`):** `--radius-control`, `--radius-panel`, `--radius-toggle`. Today `0px`.

**Variables (`:root`):**

| Variable | Today | Meaning |
| --- | --- | --- |
| `--rule-section-w` | `2px` | Section rule width. `border-b-2 border-divider` → `border-b-(length:--rule-section-w) border-divider` (same for `t`). |
| `--display-weight` / `--display-tracking` / `--h1-size` | `800` / `-0.015em` / `42px` | h1. |
| `--h2-size` / `--h2-weight` / `--h2-tracking` | `34px` / `800` / `-0.015em` | Brief headline (drop `text-[34px]` in `PracticeBody`; the base rule carries it). |
| `--title-weight` | `800` | `face-title` utility. |
| `--kicker-size` / `--kicker-tracking` / `--kicker-weight` | `11px` / `.12em` / `400` | `kicker` utility. |
| `--tab-digit-weight` | `800` | NoteChip: `font-extrabold` → `[font-weight:var(--tab-digit-weight)]`. |
| `--neck-nut-w` | `2px` | `Fretboard` inline `borderLeftWidth: isNut ? 2 : 1` → `isNut ? 'var(--neck-nut-w)' : 1`. |
| `--shadow-float` | `none` | The transport bar. |

If Tailwind drops a `@theme` token from the output because it is only referenced through
`var()`, declare that block `@theme static`.

### 3.3 Utilities and base rules (`index.css`)

```css
@utility face-title {            /* names and titles */
  font-family: var(--font-title);
  font-weight: var(--title-weight);
}
@utility num {                   /* numbers read at a glance while playing */
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
}
```

- Base `h1`: `font-family: var(--font-display); font-weight: var(--display-weight);
  letter-spacing: var(--display-tracking); font-size: var(--h1-size)`. Remove size classes from
  h1s (`Home`'s `text-[42px]`, and any others) so the base rule wins.
- Base `h2`: the `--h2-*` variables.
- `kicker`: size, tracking and weight from the variables, `font-family: var(--font-kicker)`.
- **`face-title`** (drop `font-extrabold`) on: the `THEORYPAD` wordmark, routine names (`Home`),
  axis values (`AxisStrip`), `EmptyState` title, and the other 17–19px `font-extrabold` names
  (grep `text-\[1[7-9]px\] font-extrabold`).
- **`num`** on: `TabStaff` NoteChip and string labels; `Fretboard` fret numbers, string labels
  and dot labels; `TransportBar` tempo value and bar/beat span; `RunningChrome` pass count and
  `01 / 04` counter; the home strip's streak and week time.

**Done when** these greps return only token-based classes, and the §7 screenshots match the
"before" set:

```bash
grep -rnE "#[0-9a-fA-F]{3,6}\b|rgba?\(" src --include='*.tsx' | grep -v __tests__
grep -rnE "bg-ink text-bg|text-accent-700|bg-accent/20|bg-ink/60|border-ink/30" src --include='*.tsx' | grep -v __tests__
```

---

## 4. R3 — Notebook, light

### 4.1 Fonts

```bash
pnpm add @fontsource-variable/bricolage-grotesque @fontsource-variable/figtree
```

```ts
// src/main.tsx, before the app's CSS
import '@fontsource-variable/bricolage-grotesque/standard.css'; // opsz + wdth + wght
import '@fontsource-variable/figtree';
```

- `--font-display`, `--font-title`: `'Bricolage Grotesque Variable', ui-sans-serif, system-ui, sans-serif`
- `--font-sans`, `--font-num`, `--font-kicker`: `'Figtree Variable', ui-sans-serif, system-ui, sans-serif`

Self-hosted on purpose: the app is local-first and must work offline. Check each package's
README for the exact CSS file if `standard.css` is missing.

### 4.2 Values

Set every token to the **Light** column of the appendix. Also set shadcn's radius tokens:
`--radius-xs 4px · sm 6px · md 8px · lg 12px · xl 12px · 2xl 14px · 3xl 16px`, and point
shadcn's `--secondary` at `var(--color-paper)`. Give shadcn's `--destructive` its own value from
the appendix: today it is `var(--color-accent-700)`, which would turn Delete blue.

### 4.3 `index.css`

**Delete** the blanket unlayered `[data-slot] { border-radius: 0 }` rule — the radius tokens now
round shadcn's components, and pill badges are right for Notebook. Keep fretboard dots round (they
already are). Add:

```css
@utility bg-graph {              /* the notebook page */
  background-color: var(--color-bg);
  background-image:
    linear-gradient(var(--color-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--color-grid) 1px, transparent 1px);
  background-size: 24px 24px;
}
@utility highlight {             /* a marker stroke behind short text */
  background-image: linear-gradient(transparent 56%, var(--color-highlight) 56%,
    var(--color-highlight) 92%, transparent 92%);
  padding-inline: 2px;
}
@utility sheet {                 /* one white panel per group — never one per row */
  background-color: var(--color-paper);
  border-radius: var(--radius-panel);
  box-shadow: 0 0 0 1px var(--color-rule);
}
```

Unlayered:

```css
[data-slot="button"][data-variant="secondary"] {
  background: var(--color-paper);
  box-shadow: inset 0 0 0 1px var(--color-toggle-edge);
}
[data-slot="button"][data-variant="secondary"]:hover { background: var(--color-surface); }
```

Base type: body `font-size: 15px; line-height: 1.55` stay.

### 4.4 Components (mocked — match the mockups)

- **`AppShell`** root: `bg-bg` → `bg-graph`. Header: `bg-nav text-nav-ink border-b border-rule`.
  Wordmark: `face-title lowercase text-[22px] font-extrabold tracking-[-.035em]` (the source text
  stays `THEORYPAD`; CSS lowercases it). Nav `gap-5` → `gap-1.5`; each link `rounded-full
  px-[11px] py-[3px]`, active `bg-accent-tint text-nav-active font-semibold`. Avatar
  `rounded-full bg-avatar text-avatar-ink`.
- **`Home`**: the header block and the practice strip lose their bottom rule (`border-b-0`; the
  strip also `pt-0`); the list wrapper `pt-1`. The `<ul>` becomes one `sheet px-5`; rows keep
  their 1px `border-rule` and add `last:border-b-0`.
- **`RunningChrome`**: `bg-chrome text-chrome-ink border-b border-rule`; track and fill
  `rounded-full`; the Pause button `rounded-full border-rule`.
- **`PracticeBody`**: the brief `border-b-0 pb-4`. In `PlayedBody`, the tab column and the neck
  column each become a `sheet px-5 pt-4 pb-[18px]` (keep `lg:sticky lg:top-4 lg:self-start` on
  the neck).
- **`AxisStrip`**: container `gap-2.5 px-8 border-b-0`; cells drop `border-l` and become
  `sheet rounded-[10px]`. A fresh cell keeps the paper background (`bg-fresh`) and its value `<p>`
  gets `w-fit highlight`; the `▲ new` marker `text-accent-text`.
- **`TabStaff`** playhead: `bg-playhead rounded-[5px] mix-blend-multiply dark:mix-blend-normal
  -top-0.5 -bottom-0.5` — a highlighter swipe over the digits. (Multiply does nothing on a dark
  ground, hence the one `dark:`.)
- **Transport bars** (the three fixed bottom wrappers): `fixed inset-x-4 bottom-3.5 z-20
  rounded-[14px] bg-transport text-transport-ink ring-1 ring-transport-edge shadow-(--shadow-float)`,
  no top border; the bar inside `px-[18px] py-2.5`. The practice sections' `pb-24` → `pb-28` so
  the last tab system clears the floating bar.
- **`TransportBar`** `Toggle`: `rounded-toggle`; on adds `ring-1 ring-inset ring-toggle-on-ring`.
- **`Fretboard`**: board `border-y border-neck-edge` (1px); fret cells `bg-neck`.
- **`FavoriteToggle`** on: `text-star`.

### 4.5 Screens not in the mockups — apply the principle, then show them at the gate

**Principle:** the page is graph paper; each *group* of content is one white `sheet` (never a
card per row); headers, briefs and kickers sit on the paper; 1px rules inside sheets; blue for
actions and targets; yellow only for "you are here" and "this changed".

| Screen | Treatment |
| --- | --- |
| Exercise library | The list becomes one sheet, like Home's routines. Tag filter chips `rounded-full`. |
| Exercise config | Params form in one sheet; the What-varies table in one sheet. |
| Routine builder | The items list one sheet; the header form on the paper. |
| Theory (`TheoryBody`) | The question area one sheet; answer buttons are secondary buttons; `TableFill` selected cell uses the toggle-on tokens; correct cells stay accent. |
| Running a routine | Overview list and summary each one sheet. |
| Report | Each table one sheet (sticky headers `bg-paper`); range buttons are toggles. |
| Fretboard explorer | The neck and the key/mode grid each one sheet; the legend uses the dot tokens. |
| Settings | Each section a sheet, stacked with `gap-4` inside `px-8`, replacing the 1px rules between sections. |
| Dialogs, Select menus | Inherit from tokens (`--popover`, radius). |

These are the milestone's open design calls: build them per the table, screenshot them, and list
them at the gate for the player to judge.

---

## 5. R4 — Dark values and theme plumbing

### 5.1 How the theme is applied

`<html>` always carries the **resolved** theme: `data-theme="light"` or `data-theme="dark"`.
The CSS never asks the system itself; the app decides and stamps.

- `theme.css`: the `@theme` block holds the light values. Add, unlayered, after it:

  ```css
  :root[data-theme="dark"] {
    /* every token's Dark value from the appendix — tokens only, nothing else */
  }
  ```

  Tailwind v4's theme tokens are custom properties on `:root`, and opacity-modified utilities
  (`text-ink/70`) compile to `color-mix()` over the variable, so everything follows. shadcn's
  semantic variables (`--background: var(--color-bg)` etc.) follow for the same reason.
- `index.css`: `html { color-scheme: light; }` and `html[data-theme="dark"] { color-scheme:
  dark; }` (native scrollbars and form controls).
- The `dark:` variant from R2 now turns on with the stamp.

### 5.2 No flash on load

Settings live in IndexedDB, which is asynchronous; waiting for them would paint light first. So
the choice is **mirrored in `localStorage`** and read by an inline script at the top of
`index.html`'s `<head>`, before any CSS:

```html
<script>
  // The resolved theme, before first paint. The Appearance setting is mirrored in
  // localStorage for this; src/app/appearance.ts is the real logic. Keep the two in step.
  (function () {
    var pref = 'system';
    try { pref = localStorage.getItem('theorypad:appearance') || 'system'; } catch (e) {}
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = pref === 'dark' || (pref === 'system' && systemDark);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  })();
</script>
```

The key is namespaced because every repo on `jrharmon.github.io` shares one origin.

### 5.3 `src/app/appearance.ts` (new)

```ts
export type Appearance = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';
export const APPEARANCE_KEY = 'theorypad:appearance';

/** Pure: which theme to show. Unit-tested for all six combinations. */
export function resolveTheme(appearance: Appearance, systemDark: boolean): Theme;

/** Stamp <html data-theme> and write the localStorage mirror (both wrapped in try/catch). */
export function applyAppearance(appearance: Appearance): void;

/**
 * Called once in AppShell. Loads settings (idempotent), applies settings.ui.appearance
 * whenever it changes, and while it is 'system' listens to
 * matchMedia('(prefers-color-scheme: dark)') 'change' so the app follows the OS live.
 * Removes the listener on change and unmount.
 */
export function useAppearance(): void;
```

- `AppShell` calls `useAppearance()`. It must call the settings store's `load()` itself — today
  only some screens do.
- In R4, before R5 exists, `useAppearance` reads `'system'`; the setting arrives in R5.
- It is app code, not domain code: `src/domain/` stays free of DOM and storage.
- After an Import (which reloads the page), the boot script reads the old mirror for one frame;
  `useAppearance` corrects it as soon as settings load. Acceptable; do not add machinery for it.

### 5.4 Values

Fill `:root[data-theme="dark"]` from the appendix's **Dark** column, including the inverted
neutral and accent ramps (so `bg-neutral-200` stays "a subtle fill" and `text-accent-700`-era
uses stay "accent text that reads on the ground").

---

## 6. R5 — The Appearance setting

### 6.1 Data

- `src/data/entities.ts`, `Settings['ui']`:

  ```ts
  /** Light or dark. 'system' follows the computer, and changes when it does. */
  appearance: 'system' | 'light' | 'dark';
  ```

- `defaultSettings()` in `src/data/repositories/dexie.ts`: `appearance: 'system'`.
- No Dexie migration: `withDefaults` already lays stored settings over the defaults, so settings
  saved before this field read `'system'`. Import goes through `withDefaults` too, and the
  export schema's `settings` is `.passthrough()`, so old export files import cleanly.
- Use `Appearance` from `src/app/appearance.ts` as the type, or define the union in `entities.ts`
  and import it there — whichever keeps `src/data` free of `src/app` imports (it must).

### 6.2 UI — Settings → Display, first row

```
Appearance   [ System ][ Light ][ Dark ]
             System follows your computer's light or dark setting.
```

- A `Row` with label **Appearance** and that hint, first in the Display section.
- Three `Button size="sm" variant="secondary"` in a `role="group" aria-label="Appearance"`
  wrapper, joined (`gap-0`, `-ml-px` after the first) — the same button idiom as `OnOff`. The
  chosen one has `aria-pressed="true"` and the toggle-on classes.
- On click: `save({ ui: { ...ui, appearance } })` (the store updates in memory first — see
  STATUS "Things that bit"). `useAppearance` sees the change and restamps; no reload.
- American spelling; sentence case, as the rest of the page.

### 6.3 Tests

Unit:
- `resolveTheme`: all six combinations of `system | light | dark` × system dark or not.
- `withDefaults`: stored settings without `appearance` read `'system'`.
- Transfer: importing an export that predates `appearance` yields `'system'`.

E2E (a new `e2e/appearance.spec.ts`; the existing 46 stay untouched):
1. A fresh context with a light system → `html[data-theme="light"]`.
2. A fresh context with `colorScheme: 'dark'` → `html[data-theme="dark"]`.
3. On a light system, choose **Dark** in Settings → dark at once; reload → dark, and it is
   already dark at `domcontentloaded` (no flash).
4. On a dark system, choose **Light** → light, and it stays light after a reload.
5. With **System** chosen, `page.emulateMedia({ colorScheme: 'dark' })` flips the stamp live, and
   back again.
6. Scope locators to the Appearance group (STATUS: unscoped locators have bitten before).

---

## 7. R6 — Docs, and the gate

### 7.1 Doc edits

**`CLAUDE.md` → Style.** Replace the first bullet (zero radius … `.kicker`) with:

> - Notebook: a graph-paper page, white **sheets** for grouped content (one sheet per group,
>   never a card per row), graphite ink, ballpoint blue for actions and targets, highlighter
>   yellow only for "you are here" (playhead) and "this changed" (fresh axis). 8px controls,
>   12px panels, pill toggles; the floating transport is the only shadow. Bricolage Grotesque
>   for headings and titles (`face-title`), Figtree for everything else; numbers read while
>   playing use `num`. Small-caps section labels use `.kicker`.
> - **Light and dark.** Every color is a token with a light value in `@theme` and a dark value
>   under `:root[data-theme="dark"]` in `theme.css`. Style through tokens; a component must not
>   know which theme is on. `dark:` only for what a token cannot express. The Appearance
>   setting (System / Light / Dark) stamps `data-theme` on `<html>`; `index.html` does it before
>   first paint from a localStorage mirror.

Replace the Tailwind-layering bullet's last clause ("the zero-radius `[data-slot]` rule is
deliberately unlayered") with "global overrides keyed on `data-slot` / `data-variant` are
deliberately unlayered". In **Verify by looking**, add "— in both themes".

**`docs/plan/05-UI-COMPONENTS.md`.** Rewrite the rules of use (lines ~11–18) to match the
CLAUDE.md bullets above; delete the radius notes (~50–54, the `[data-slot]` rule and why); in the
fretboard section (~78) note that role fills come from the `--color-dot-*` tokens; add a short
"Theme" section pointing to §5 of this doc.

**`docs/plan/08-MILESTONES.md`.** A "Restyle — Notebook, light and dark" section after M6 with
R1–R6 and, at the gate, an **Outcome** paragraph.

**`docs/plan/STATUS.md`.** Add the milestone to the table; under Decisions, the four decisions
at the top of this doc (dated 2026-09-13); under What works, the Appearance setting; under
Checking UI, "screenshot in both themes — Playwright `colorScheme: 'dark'`". Keep it a complete
hand-off, as always.

### 7.2 Gate screenshots

Take each **before R2**, **after R2** (must match), and **after R6 in light and in dark**. Read
every image.

1. Home — empty (no routines), and with several (a favorite, an empty one), the practice strip
   with data.
2. Exercise library (tag filter, favorites); an exercise's config page with a Select open.
3. Routine builder with items.
4. Practice, played: idle, count-in, playing (playhead mid-bar), paused; neck shown and hidden;
   tab at the smallest and largest zoom (digits must not touch); one-note-per-string (no neck).
5. Practice, theory: a question, a wrong answer with its correction, a table fill, a set summary.
6. Running a routine: overview, mid-routine with "Stay on this" on, the summary.
7. The practice settings dialog.
8. Settings, including the Appearance row in each state and the Export / Import summary.
9. Report; fretboard explorer; `/dev/gallery`.
10. Keyboard: tab through Home and the transport — the focus ring shows on every ground (nav,
    sheets, floating bar), in both themes.

Also: `pnpm check` green; `pnpm test:e2e` green with the existing tests untouched plus the new
appearance spec; contrast of body text, muted text and text on accent fills at least 4.5:1
(large display text 3:1) in both themes — the appendix values pass; re-check any you adjust.

### 7.3 At the gate, ask the player about

- The screens in §4.5 that were not mocked.
- Whether the tab reads comfortably at playing distance, in both themes.
- Whether the yellow playhead is findable at a glance without shouting, in both themes.
- Whether the graph-paper ground helps or is noise (it can be dropped by setting `--color-grid`
  to transparent).

---

## 8. Appendix — token tables

### Colors

| Token | Light | Dark |
| --- | --- | --- |
| `--color-bg` (graph paper) | `#f5f6f8` | `#15171c` |
| `--color-paper` (sheet) | `#ffffff` | `#1d2027` |
| `--color-surface` | `#eceff4` | `#252932` |
| `--color-ink` (graphite / chalk) | `#24262b` | `#e4e7ee` |
| `--color-grid` | `rgba(36,38,43,.045)` | `rgba(228,231,238,.035)` |
| `--color-highlight` | `#ffe14d` | `rgba(255,225,77,.34)` |
| `--color-accent` (ballpoint) | `#2347b5` | `#4a6ae0` |
| `--color-accent-text` | `#1f3fa3` | `#9db0ff` |
| `--color-accent-tint` | `#e9eefc` | `rgba(123,149,255,.16)` |
| `--color-on-accent` | `#ffffff` | `#ffffff` |
| `--color-divider` | `#e2e5eb` | `#2c313b` |
| `--color-rule` | `#e2e5eb` | `#2c313b` |
| `--color-nav` / `-nav-ink` / `-nav-active` | `#ffffff` / `#24262b` / `#1f3fa3` | `#1d2027` / `#e4e7ee` / `#b4c3ff` |
| `--color-avatar` / `-avatar-ink` | `#e9eefc` / `#1f3fa3` | `rgba(123,149,255,.16)` / `#b4c3ff` |
| `--color-chrome` / `-chrome-ink` | `#ffffff` / `#24262b` | `#1d2027` / `#e4e7ee` |
| `--color-track` / `-fill` | `#e8ebf0` / `#2347b5` | `#2c313b` / `#6d88f0` |
| `--color-transport` / `-transport-ink` / `-transport-edge` | `#ffffff` / `#24262b` / `#e2e5eb` | `#22262e` / `#e4e7ee` / `#2c313b` |
| `--color-toggle-on` / `-on-ink` / `-on-ring` | `#e9eefc` / `#1f3fa3` / `rgba(35,71,181,.35)` | `rgba(123,149,255,.16)` / `#b4c3ff` / `rgba(157,176,255,.35)` |
| `--color-toggle-off` / `-off-ink` / `-edge` | `#ffffff` / `rgba(36,38,43,.55)` / `#d5d9e1` | `#1d2027` / `rgba(228,231,238,.55)` / `#363c48` |
| `--color-tab-line` / `-tab-bar` / `-tab-digit` | `rgba(36,38,43,.28)` / `rgba(36,38,43,.55)` / `#24262b` | `rgba(228,231,238,.24)` / `rgba(228,231,238,.5)` / `#e4e7ee` |
| `--color-playhead` | `rgba(255,225,77,.75)` (multiplied) | `rgba(255,225,77,.26)` (normal) |
| `--color-neck` / `-neck-fret` / `-neck-nut` | `#ffffff` / `#cfd4dd` / `#24262b` | `#1d2027` / `#3a404c` / `#e4e7ee` |
| `--color-neck-string` / `-neck-edge` / `-inlay` | `rgba(36,38,43,.32)` / `#cfd4dd` / `#dfe3ea` | `rgba(228,231,238,.3)` / `#3a404c` / `#343a45` |
| `--color-dot-root` / `-root-ink` | `#24262b` / `#ffffff` | `#e4e7ee` / `#15171c` |
| `--color-dot-target` / `-target-ink` | `#2347b5` / `#ffffff` | `#4a6ae0` / `#ffffff` |
| `--color-dot-chord` / `-chord-ink` | `#c9d3ee` / `#24262b` | `#2f3f78` / `#e4e7ee` |
| `--color-dot-pass` / `-pass-ink` | `#eef1f6` / `rgba(36,38,43,.75)` | `#2a2e37` / `rgba(228,231,238,.78)` |
| `--color-fresh` / `-fresh-ink` | `#ffffff` / `#24262b` | `#1d2027` / `#e4e7ee` |
| `--color-star` | `#e2a400` | `#f0b400` |
| `--color-heat-0…3` | `#eceff4 #bccaf0 #6f8ad8 #2347b5` | `#252932 #2f3f78 #4a6ae0 #9db0ff` |
| `--color-heat-future` / `-heat-today` | `#dfe3ea` / `#24262b` | `#2c313b` / `#e4e7ee` |
| `--color-neutral-100…900` | `#f7f8fa #eceff4 #dfe3ea #c3c9d4 #9aa1ae #737a88 #535966 #3a3e46 #24262b` | `#1d2027 #252932 #2c313b #3a404c #555c6a #7a8190 #a3a9b6 #c9cdd6 #e4e7ee` |
| `--color-accent-100…900` | `#eef2fd #dbe3fa #b7c6f3 #8199e3 #4d6bcf #2347b5 #1f3fa3 #1a3280 #14244f` | `#182040 #1f2b5a #2f3f78 #3d56b0 #4a6ae0 #6d88f0 #9db0ff #c1ceff #e3e9ff` |
| shadcn `--destructive` | `#b42318` | `#f97066` |

Contrast checks: white on `#2347b5` ≈ 8:1 and on `#4a6ae0` ≈ 4.7:1; `#9db0ff` on `#15171c`
≈ 8.5:1; muted ink (64%) ≥ 4.5:1 on both grounds.

### Everything else (same in both themes unless shown)

| Variable | Value |
| --- | --- |
| `--font-display`, `--font-title` | `'Bricolage Grotesque Variable', ui-sans-serif, system-ui, sans-serif` |
| `--font-sans`, `--font-num`, `--font-kicker` | `'Figtree Variable', ui-sans-serif, system-ui, sans-serif` |
| `--radius-control` / `--radius-panel` / `--radius-toggle` | `8px` / `12px` / `9999px` |
| shadcn `--radius-xs…3xl` | `4px 6px 8px 12px 12px 14px 16px` |
| `--rule-section-w` | `1px` |
| `--display-weight` / `--display-tracking` / `--h1-size` | `700` / `-0.025em` / `44px` |
| `--h2-size` / `--h2-weight` / `--h2-tracking` | `32px` / `700` / `-0.02em` |
| `--title-weight` | `700` (routine names `text-[19px]`) |
| `--kicker-size` / `--kicker-tracking` / `--kicker-weight` | `11.5px` / `.08em` / `600` |
| `--tab-digit-weight` | `700` |
| `--neck-nut-w` | `3px` |
| `--shadow-float` | light `0 10px 30px rgba(28,36,56,.14)`; dark `0 12px 36px rgba(0,0,0,.5)` |
