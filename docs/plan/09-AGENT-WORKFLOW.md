# 09 — Agent Workflow

You said token efficiency matters more than wall-clock speed. This document is the plan for
spending as few tokens as possible per unit of working code.

## The core decision: single-threaded

**One agent, one task, at a time.** Not a parallel team.

The reasoning, plainly: a parallel team's cost is dominated by _context re-derivation_, not by
the code it writes. Every agent you spawn starts cold, re-reads the same files to orient, and
re-decides the same things. Three agents on this codebase means roughly three times the
context loading for the same output, plus rework whenever two of them make incompatible
assumptions — and in a project this coupled (the exercise contract touches the domain, the
runner, the renderer and the store), they will.

Sequential work with sharp specs is the cheap path. **These plan documents exist precisely so
an agent doesn't have to explore.** Each task names the two or three docs it needs, and the
agent reads those instead of grepping around the repo forming its own model.

### The one exception

Once the `ExerciseDefinition` contract is frozen and proven (after M3's review gate), writing
individual exercise definitions is genuinely independent, file-disjoint, and mechanical. That
is a reasonable place to fan out two or three agents — one per exercise — if you want M8 done
faster. Nowhere else.

---

## Task specs

Every unit of work gets a short written spec. Format:

```markdown
## Task 2.5 — modes-through-key exercise

**Read:** docs/plan/03-EXERCISE-SYSTEM.md, docs/plan/04-EXERCISE-CATALOG.md §A1,
src/exercises/types.ts, src/exercises/shared/

**Do not read:** design_handoff_fretwork/ (superseded), other exercises (none exist yet)

**Build:**

- src/exercises/modes-through-key/definition.ts implementing ExerciseDefinition
- Variant 'plain' only. Leave 'arpeggio-then-scale' and 'pause-on-root' unimplemented
  (throw a clear error) — they land in M3.
- Register in src/exercises/registry.ts

**Tests:**

- Golden-file: seed 12345, D Dorian, standard tuning → snapshot the phrase
- Every generated FretPosition is within fret range and on a valid string
- The phrase contains all 7 modes in order

**Done when:** `pnpm check` is green and `/dev/gallery` renders the generated phrase.

**Do not:** touch the runner, the store, or any shared generator's signature. If a shared
generator is missing, stop and say so rather than inlining the logic.
```

Four things make this cheap:

1. **"Read" is a whitelist.** Reading the whole repo to orient costs thousands of tokens per
   task and produces worse work than a targeted spec. Name the files.
2. **"Do not read"** matters here specifically: the design handoff is 34KB and reintroduces
   requirements we've deliberately changed (`cleanTempo`). Agents should never open it.
3. **"Do not"** bounds the blast radius. Small diffs are cheap to review, which is where _your_
   time goes.
4. **"Done when"** is a command the agent runs itself, so it self-verifies rather than handing
   you something broken.

Keep task specs in `docs/tasks/` as they're written, one file per milestone. They're also the
record of what was asked, which makes review faster.

---

## `CLAUDE.md`

A single short file at the repo root, loaded into every agent session automatically. **Keep it
under ~100 lines.** It is paid for on every single turn, so it holds only what every task
needs:

```markdown
# TheoryPad

A local-first web app for practising guitar and music theory. Exercises can be randomly varied
each session — but a static exercise (no declared axes) is equally valid. No server, no
accounts: static bundle + IndexedDB.

## Before you start

Full plans are in `docs/plan/`. Your task spec names which ones to read. **Do not read
`design_handoff_fretwork/`** — it is superseded and contradicts current decisions.

## Commands

- `pnpm dev` · `pnpm check` (typecheck + lint + test — must be green before you're done)
- `pnpm test -- <path>` for a single file

## Non-negotiables

- `src/domain/` is pure: no React, no DOM, no `Date.now()`, no `Math.random()`. Inject time
  and randomness.
- `tonal` is imported only in `src/domain/music/`. `tone` only in `src/audio/`. `dexie` only
  in `src/data/`. ESLint enforces this.
- **`string: 0` is the LOWEST-pitched string in `tuning`** — not "low E". Index ascends with
  pitch. Display inverts it; the model never does.
- **Never write a literal `6` for string count.** Derive it from `instrument.tuning.length`.
  Tests run against standard, drop-D and 7-string fixtures.
- All musical time is integer ticks at PPQ=480. Never float beats.
- All randomness goes through the injected seeded `Rng`.
- `targetTempo` only changes on explicit user action. Never write `currentTempo` back to it.
- Variation is controlled by per-axis policies (`roll` / `roll from subset` / `fixed` /
  `hold`). There is no global "wildness" setting — don't add one.
- Exercise `id` strings are persisted in the rep log forever. Never rename one.

## Style

- Zero border radius (fretboard note dots excepted). 2px rules between sections, 1px between
  rows. Everything flush left, including button labels. Accent `#ec3013` used sparingly.
  Tabular numerals on all timers, tempos and counts.
- Prefer composing `src/exercises/shared/` generators over new code. If a piece is missing,
  add it to `shared/` with tests — never inline it in an exercise.

## Testing

Heavy unit coverage on `src/domain/`. Component tests only where there's logic. Audio is
tested through `FakeClock`, never for real.
```

Everything else lives in `docs/plan/` and is loaded on demand.

---

## Working rhythm

1. You (with me) write the task spec for the next task.
2. One agent executes it. It reads only what the spec names.
3. The agent runs `pnpm check` and reports.
4. You review the diff. Small diffs, so this is fast.
5. Commit. Next task.
6. **At each milestone boundary: stop.** Use the app. Adjust the plan docs before continuing.

Updating the plan docs as we learn is not overhead — it is what keeps every subsequent task
cheap. When a milestone review changes a decision, **edit the relevant doc**, so the next agent
gets the corrected version instead of the original plus a conversational patch.

---

## Practices that save real tokens

- **Don't ask an agent to explore.** "Figure out how X works" is the most expensive prompt
  there is. If you don't know, find out once and write it in a doc.
- **One concern per task.** A task that touches the domain, the store and three components
  will need three review rounds. Split it.
- **Never ask for a "full review of the codebase."** Review diffs.
- **Let the agent run `pnpm check` rather than pasting errors back and forth.** Each
  round-trip re-sends the whole conversation.
- **Golden-file tests over prose descriptions of expected output.** Cheaper to write, cheaper
  to verify, and they catch regressions for free.
- **Fix the shared layer, not the call sites.** If two exercises need the same workaround, that
  is a missing shared generator, and building it once is cheaper than nine copies.
- **Resist scope drift inside a task.** "While I was there I also…" is how a 200-line diff
  becomes 900 and a 20-minute review becomes an hour.
- **Don't rebuild the mockups pixel-perfectly.** You've already said they're reference. Chasing
  them is pure token spend against a design that was never a requirement.

---

## Git

- Branch per milestone: `m2-vertical-slice`. Commit per task.
- The repo currently has `main` with **no commits**. M0 task 0.1 creates the first.
- CI runs `pnpm check` and `pnpm build` on every push, so a broken commit is caught without
  you reading it.
