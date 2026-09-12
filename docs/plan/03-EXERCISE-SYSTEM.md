# 03 — The Exercise System

This is the pluggable system. The goal you set: _most exercises should be extremely easy to
define, using shared components, but with escape hatches so they aren't limited._

The shape of the answer: **an exercise is a pure function from a resolved variation to a
playable thing, plus metadata declaring what it varies — if anything.** Everything else — the runner, the
metronome, the tab renderer, the neck diagram, the logging — is shared machinery that knows
nothing about any specific exercise.

---

## The contract

`src/exercises/types.ts`:

```ts
export interface ExerciseDefinition<P = void> {
  /** Stable slug. Persisted in the rep log forever — never change it. */
  id: string;
  name: string;
  /** Controlled vocabulary — see KNOWN_TAGS. An exercise usually carries 2-4. */
  tags: ExerciseTag[];
  kind: 'played' | 'theory';
  /** One sentence, shown in the exercise library. */
  summary: string;
  /** Longer explanation of what this trains and why. Markdown. */
  description?: string;

  /**
   * Which axes this exercise varies. Session axes are implicit.
   * An empty array is entirely valid — that is a static exercise, and every other part of
   * the system treats it identically.
   */
  axes: AxisId[];

  /** Per-instance configuration, if any. Zod schema → typed params + a generated form. */
  params?: z.ZodType<P>;

  /** Sensible starting config when the user adds this to their library. */
  defaults: {
    targetTempo: number | null;
    /** Passes it plays in a routine. Standalone practice has no reps. */
    reps: number;
    tempoPlan?: TempoPlan;
    params?: P;
    /** Per-axis policy overrides. Anything omitted defaults to { mode: 'roll' }. */
    axisPolicies?: Partial<Record<AxisId, AxisPolicy>>;
  };

  /** Does a metronome make sense here at all? 'never' hides the free-time toggle's opposite. */
  timing?: 'metronome' | 'free' | 'either'; // default 'either'

  /** THE function. Pure. Given everything rolled, produce what to play/answer. */
  generate(ctx: GenerationContext<P>): ExerciseInstance;

  /** How long one rep takes, for routine duration estimates. */
  estimateRepSeconds(instance: ExerciseInstance, tempo: number | null): number;

  /** Optional: replace the default renderer entirely. The escape hatch. */
  Renderer?: React.ComponentType<ExerciseRendererProps>;

  /** Optional: extra panels alongside the default renderer. The cheap escape hatch. */
  panels?: ExercisePanel[];
}
```

```ts
export interface GenerationContext<P> {
  variation: RolledVariation; // resolved axis values; `axes` is empty for a static exercise
  keyMode: KeyMode; // convenience: the session key + mode
  instrument: Instrument;
  params: P;
  rng: Rng; // seeded; use this, never Math.random
  repIndex: number;
}

export type ExerciseInstance = PlayedInstance | TheoryInstance;

export interface PlayedInstance {
  kind: 'played';
  brief: Brief;
  phrase: Phrase;
  /** What the neck diagram shows. Usually derived from the phrase + key. */
  neck: NeckOverlay;
  /** Optional generated backing. */
  backing?: BackingPlan;
}

export interface TheoryInstance {
  kind: 'theory';
  brief: Brief;
  questions: TheoryQuestion[];
}

export interface Brief {
  /** One sentence stating the whole rolled variation. The big headline. */
  headline: string; // "Ascending 4ths in D Dorian, 7th position."
  /** What to actually do, including rep count and tempo. */
  instruction: string;
  /** Which axes to surface in the strip above the tab, in order. */
  highlightAxes: AxisId[];
}

export interface NeckOverlay {
  /** Every note to draw, with its role. */
  notes: { position: FretPosition; degree: Degree; role: NoteRole }[];
  /** Frets to emphasise in the fret-number row. */
  emphasisFrets?: number[];
}
```

### Why a function and not data

Because "generate a phrase" is genuinely computation: mapping a shape onto a neck position,
applying a rhythm pattern, choosing which degree to land on, handling the edge cases where a
shape runs off the end of the fretboard. Expressing that as JSON means building an
interpreter, and every new exercise capability then requires a schema change _and_ an
interpreter change. A TypeScript function is type-checked, autocompleted, debuggable, and can
do anything.

The "extremely easy to define" part is achieved not by making the format declarative, but by
making the **shared generators** good enough that most `generate` functions are five lines.

---

## Shared generators — where the ease comes from

`src/exercises/shared/` holds the composable pieces. A new exercise is usually an assembly
of these, not new code.

```ts
// Neck material
scaleRun(opts): FretPosition[]          // a scale through a shape/position, up|down|updown
intervalRun(opts): FretPosition[]       // the scale in 3rds/4ths/5ths/6ths
arpeggioRun(opts): FretPosition[]       // a chord's tones through a shape
oneNotePerString(opts): FretPosition[]  // your "cycling across strings" pattern
triadShape(opts): FretPosition[]        // a triad on a string set, given inversion
chromaticPattern(opts): FretPosition[]  // permutation drills

// Rhythm
applyRhythm(positions, pattern, ppq): TabNote[]   // straight 8ths, 16ths, triplets, gallop, swing
padToBars(notes, timeSig): Phrase

// Roles & annotation
markRoles(notes, km, targetDegree): TabNote[]     // tags roots, target, chord tones
annotateDegrees(notes, km): TabNote[]

// Briefs
briefFor(templateId, variation, extras): Brief    // consistent phrasing across exercises

// Neck overlays
overlayFromPhrase(phrase, km, instrument): NeckOverlay
overlayFullScale(km, instrument, range): NeckOverlay

// Backing
modalVamp(km): BackingPlan
progression(km, romanNumerals): BackingPlan       // ["ii","V","i"]

// Theory question builders
pickFromOptions(prompt, correct, distractors, feedback): SinglePickQuestion
qualityTable(km, opts): TableFillQuestion
```

### A complete exercise, realistically sized

```ts
// src/exercises/interval-sequences/definition.ts
export const intervalSequences: ExerciseDefinition<Params> = {
  id: 'interval-sequences',
  name: 'Interval sequences',
  tags: ['scales', 'intervals', 'positional'],
  kind: 'played',
  summary: 'Run the scale in 3rds, 4ths, 5ths or 6ths through a rolled position.',
  axes: ['neckPosition', 'intervalPattern', 'direction', 'rhythmPattern', 'targetScaleDegree'],
  params: z.object({ shapeSystem: z.enum(['3nps', 'positional']).default('3nps') }),
  defaults: { targetTempo: 80, reps: 2 },

  generate(ctx) {
    const { keyMode, instrument, variation, params } = ctx;
    const positions = intervalRun({
      keyMode,
      instrument,
      position: variation.axes.neckPosition.value as NeckPosition,
      interval: variation.axes.intervalPattern.value as IntervalPattern,
      direction: variation.axes.direction.value as Direction,
      shapeSystem: params.shapeSystem,
    });
    const notes = markRoles(
      applyRhythm(positions, variation.axes.rhythmPattern.value as RhythmPattern, PPQ),
      keyMode,
      variation.axes.targetScaleDegree.value as Degree,
    );
    const phrase = padToBars(notes, FOUR_FOUR);
    return {
      kind: 'played',
      phrase,
      neck: overlayFromPhrase(phrase, keyMode, instrument),
      brief: briefFor('interval-run', variation, { keyMode }),
      highlightAxes: ['neckPosition', 'intervalPattern', 'targetScaleDegree'],
    };
  },

  estimateRepSeconds: (i, tempo) => phraseSeconds(i.phrase, tempo ?? 80),
};
```

That is the intended weight of a typical exercise: **declare the axes, call two or three
shared generators, return.** If a new exercise needs more than ~50 lines of `generate`, that
is a signal the shared library is missing a piece — extract it rather than writing it inline.

---

## Tags, not categories

Exercises are classified by **tags, not a single family.** A speed drill built on a legato
pattern through a scale is genuinely all three of those things, and forcing it into one bucket
means it's missing from two searches. Tags cost nothing and don't need maintaining as the
catalog grows.

```ts
export const KNOWN_TAGS = [
  // musical content
  'scales',
  'modes',
  'arpeggios',
  'triads',
  'chords',
  'intervals',
  // technique
  'picking',
  'legato',
  'speed',
  'string-skipping',
  'sweeping',
  'stretching',
  // knowledge
  'theory',
  'fretboard-knowledge',
  'ear-training',
  'key-signatures',
  // shape of the work
  'no-guitar',
  'improv',
  'whole-neck',
  'positional',
  'horizontal',
  'warm-up',
  'timing',
] as const;

export type ExerciseTag = (typeof KNOWN_TAGS)[number];
```

Two levels, deliberately:

- **Definition tags are controlled.** `ExerciseTag` is a union, so a typo is a type error and
  the vocabulary stays coherent. A unit test asserts every registered definition uses only
  known tags.
- **Your tags on a configured `Exercise` are free-form** (`userTags: string[]`). That's where
  "working on this for my lesson" or "hard" lives, and it shouldn't need a code change.

The library screen filters on the union of both. The four groupings in doc 04 are **document
organisation only** — they don't exist in the model.

## The registry

`src/exercises/registry.ts`:

```ts
import { modesThroughKey } from './modes-through-key/definition';
// … one import per exercise

export const EXERCISE_DEFINITIONS = [
  modesThroughKey,
  oneNotePerString,
  intervalSequences,
  // …
] as const satisfies readonly ExerciseDefinition<any>[];

export const byId = new Map(EXERCISE_DEFINITIONS.map((d) => [d.id, d]));
```

**Explicit registration, not `import.meta.glob` auto-discovery.** Auto-discovery is neat but
it hides the list, breaks tree-shaking, and makes it harder for an agent to see what exists.
A unit test asserts that every directory under `src/exercises/` (excluding `shared/`) has its
definition registered, so nobody forgets.

A second unit test asserts every `id` is unique and matches its directory name — ids are
persisted in the rep log forever, so this guards against a rename silently orphaning history.

---

## Free-time mode

Any played exercise can run **in free time** — no metronome, no count-in, no playhead. It is a
per-run toggle in the transport bar, not a per-exercise setting, because whether you want a
click depends on the day: you learn a shape in free time and drill it to a click a week later.

What changes:

|               | With metronome                   | Free time                                           |
| ------------- | -------------------------------- | --------------------------------------------------- |
| Clock         | running, drives everything       | stopped                                             |
| Metronome     | clicks                           | silent                                              |
| Playhead      | tracks the beat                  | hidden; the whole phrase is shown at once           |
| Tempo control | adjusts `currentTempo`           | hidden                                              |
| Backing track | optional, tempo-matched          | optional; a fixed YouTube track fits naturally here |
| Rep ends      | after the phrase's bars complete | when you press Enter / Done                         |
| Logged        | `tempo: currentTempo`            | `tempo: null`, elapsed time still recorded          |

An exercise sets `timing: 'free'` when a click makes no sense for it (`free-improv-target`,
`fretboard-note-finding`), or `timing: 'metronome'` when it is meaningless without one
(`speed-picking`). Default is `'either'`.

This costs almost nothing because the runner is already `Clock`-driven: free time is a run
where the clock never starts and the `REP_COMPLETE` transition is triggered by input instead of
by a tick.

## Static and partly-varied exercises

`axes: []` produces a `RolledVariation` with an empty `axes` map. The brief shows the fixed
content, the axis strip renders nothing, no cell is highlighted as fresh, and `generate`
ignores the variation entirely. There is no branch anywhere for "is this exercise static" —
it is the same code path with an empty collection, which is why it costs nothing to support.

The same holds partway: an exercise declaring five axes, with the player pinning four to
`{ mode: 'fixed' }`, is effectively a one-axis exercise. Nothing in the runner notices.

Worth stating because it opens the door deliberately: **a hand-authored phrase is a legitimate
exercise.** A `generate` that ignores its context and returns a fixed `Phrase` built by the
phrase builder is perfectly valid — that is how you'd add a specific lick, a piece you're
learning, or a warm-up you always play the same way.

## Extension points, cheapest first

Deliberately staged so that most exercises use none of these, and nothing is built until
something needs it.

1. **Params** (`params: z.ZodType<P>`) — per-instance config. A Zod schema is enough to
   auto-generate a small settings form in the exercise detail page. Covers "the same exercise
   but with 3-note-per-string shapes" without a new definition.

2. **Custom axes** — an exercise can register an axis nobody else uses by exporting it
   alongside the definition. The roller picks it up from the definition's `axes` list.

3. **Extra panels** (`panels: ExercisePanel[]`) — small components rendered in the runner
   alongside the standard tab and neck diagram. This is the escape hatch for "this exercise
   needs to show one extra thing" — e.g. the interval exercise showing the interval shape, or
   the ear-training exercise showing an answer keypad. Cheap: a panel is just
   `{ id, title, slot: 'side' | 'below', Component }`.

4. **Full custom renderer** (`Renderer`) — replaces the default runner body entirely. Used by
   theory exercises (which have no tab) and reserved for anything genuinely different. The
   renderer still receives the shared props (instance, transport controls, clock, submit
   callbacks) so it doesn't have to reimplement the session plumbing.

**Nothing beyond #1 and the theory renderer gets built in the early milestones.** The
interfaces are declared so the door is open; the implementations arrive when an exercise
actually needs them.

---

## How an exercise runs

The runner is shared and definition-agnostic: standalone practice and a routine item are the
same machine with different settings. _(Revised after M3: there are no reps in standalone
practice, and nothing ever re-rolls on its own.)_

```
IDLE
 └─ open ─▶ ROLL + GENERATE   roll exercise-scoped axes once, from the seeded RNG
              │
              ▼
            READY (brief)     the full variation and its material, shown. Nothing moves.
              │  Play
              ▼
            COUNT_IN          optional bar of clicks, before the first pass only.
              ▼
            PLAYING ⇄ PAUSED  metronome + playhead. Space toggles pause. Tempo adjustable.
              │  end of phrase → the pass is logged
              ├─ loop on, or routine passes left → next pass straight on, same material,
              │                                    clock never stops
              └─ otherwise → READY again (standalone) | DONE (routine item → next item)
```

The rules, from the player:

- **A variation is rolled when you open an exercise or start a routine, and stays put** until
  you press Re-roll. Passes, loops and a routine item's reps all play the same material.
- **Any setting can be changed by hand at any time** — the settings dialog in the practice
  view, or the config page. Changing an axis policy rolls just that axis again; the rest
  keep their values. Re-rolls push you toward variety; they never stand between you and
  practicing something specific.
- **Standalone practice has no reps, no Skip and no End.** Play runs the material once and
  comes back ready; Loop repeats it. Leaving the screen is how you finish.
- **Every pass is logged as it ends**, and a pass cut short — by leaving, re-rolling or
  changing settings — is logged as abandoned. Nothing depends on remembering to press a button.
- **In a routine, reps are passes of one item** before moving on, played back to back.
- **Max tempo is only ever entered by hand.** Nothing writes it: a pass at a high tempo says
  nothing about whether it was played well.
- **Pause is global and always available** — space bar plus a visible button. It halts the
  clock, so the metronome, playhead and backing stop together (they share one `Clock`).
- **Re-roll highlights the axes it changed.**
- Keyboard: space = pause, `[`/`]` = tempo, `Enter` = play, `R` = re-roll, `M` = metronome,
  `L` = loop, `-`/`=` = tab size, `Esc` = leave, `1`–`6` = theory answers.

Because the state machine is driven entirely by the injected `Clock`, all of the above is
unit-testable with `FakeClock` and no audio at all.

---

## Adding a new exercise — the checklist

This is the section to point an agent at.

1. `mkdir src/exercises/<kebab-id>/`
2. `definition.ts` — the `ExerciseDefinition`. Prefer shared generators over new code.
3. `generate.ts` — only if `generate` is more than ~20 lines.
4. `definition.test.ts` — at minimum: a golden-file test asserting the phrase produced by
   seed `12345` in D Dorian, and an assertion that every generated `FretPosition` is within
   the instrument's fret range and on a valid string.
5. Register it in `src/exercises/registry.ts`.
6. If it needs a shared generator that doesn't exist, add it to `shared/` **with its own
   tests** — do not write it inline.

That's it. No route to add, no store wiring, no menu entry — the exercise library, the
routine builder and the runner all read from the registry.
