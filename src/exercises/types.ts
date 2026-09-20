import type { ComponentType } from 'react';
import type { z } from 'zod';
import type { KeyMode } from '@/domain/music';
import type { CountInBars } from '@/domain/phrase';
import type { Instrument } from '@/domain/instrument';
import type { NeckOverlay } from '@/domain/neck';
import type { Phrase } from '@/domain/phrase';
import type { TheoryQuestion } from '@/domain/theory';
import type { TempoPlan } from '@/domain/tempo';
import type {
  AxisId,
  AxisPolicies,
  AxisValueKeys,
  Rng,
  RolledVariation,
} from '@/domain/variation';

export const KNOWN_TAGS = [
  // Musical content
  'scales',
  'modes',
  'arpeggios',
  'triads',
  'chords',
  'intervals',
  // Technique
  'picking',
  'legato',
  'speed',
  'string-skipping',
  'sweeping',
  'stretching',
  // Knowledge
  'theory',
  'fretboard-knowledge',
  'ear-training',
  'key-signatures',
  // Shape of the work
  'no-guitar',
  'improv',
  'whole-neck',
  'positional',
  'horizontal',
  'warm-up',
  'timing',
] as const;

export type ExerciseTag = (typeof KNOWN_TAGS)[number];

/** Whether a metronome makes sense for this exercise at all. */
export type ExerciseTiming = 'metronome' | 'free' | 'either';

export interface Brief {
  /** One sentence stating the whole rolled variation. The headline. */
  headline: string;
  /** What to actually do, including reps and tempo. */
  instruction: string;
  /** Which axes to surface in the strip above the tab, in order. */
  highlightAxes: AxisId[];
}

export interface PlayedInstance {
  kind: 'played';
  brief: Brief;
  /**
   * The notes to play. May legitimately be empty — a free-improv exercise has
   * bars and a backing track but nothing written.
   */
  phrase: Phrase;
  neck: NeckOverlay;
}

export interface TheoryInstance {
  kind: 'theory';
  brief: Brief;
  /** One set. Each pass is a fresh set on the same variation. */
  questions: TheoryQuestion[];
}

export type ExerciseInstance = PlayedInstance | TheoryInstance;

export interface GenerationContext<P = void> {
  /** Resolved axis values. `axes` is empty for a static exercise. */
  variation: RolledVariation;
  /** The session key and mode. */
  keyMode: KeyMode;
  instrument: Instrument;
  params: P;
  /** Seeded. Use this, never Math.random(). */
  rng: Rng;
  repIndex: number;
  /**
   * Theory: how much to lean toward each subject, from recent answers
   * (`"key:Eb"` → 1.6). Absent or missing a subject means even.
   */
  subjectWeights?: Readonly<Record<string, number>>;
}

export interface ExerciseRendererProps {
  instance: ExerciseInstance;
  instrument: Instrument;
}

export interface ExerciseDefaults {
  /** Null for theory exercises and anything with no pulse. */
  targetTempo: number | null;
  /**
   * Passes an item plays in a routine before moving on. Standalone practice
   * has no reps: you play it as often as you like.
   */
  reps: number;
  /** Bars of count-in before the first pass. One unless the exercise wants less, or none. */
  countInBars?: CountInBars;
  tempoPlan?: TempoPlan;
  /** Per-axis overrides. Anything omitted rolls freely. */
  axisPolicies?: AxisPolicies;
}

interface DefinitionBase<P> {
  /** Stable slug. Persisted in the rep log forever — never change it. */
  id: string;
  name: string;
  /** Controlled vocabulary. An exercise usually carries two to four. */
  tags: ExerciseTag[];
  /** One sentence, for the exercise library. */
  summary: string;
  /** What this trains and why. Markdown. */
  description?: string;

  /**
   * Which axes this exercise varies. An empty array is entirely valid — that
   * is a static exercise, and every other part of the system treats it the same.
   */
  axes: AxisId[];

  /**
   * The values this exercise can use at all, per axis, by value key — a triad
   * drill offers three-string sets and nothing else. Neither the player's
   * settings nor a routine can reach outside them. Omitted means every value.
   * Which of them it starts on belongs in `defaults.axisPolicies`.
   */
  allowedValues?: AxisValueKeys;

  /**
   * What a shared backing track must be tagged with to be offered here — a
   * single-chord vamp for an exercise that stays on one chord. Added to the
   * player's own criteria; the exercise's own videos are never filtered.
   */
  backing?: { requiredTags: readonly string[] };

  /** Per-instance configuration. A Zod schema gives typed params and a form. */
  params?: z.ZodType<P>;

  defaults: ExerciseDefaults;

  /** Replace the default runner body entirely. The escape hatch. */
  Renderer?: ComponentType<ExerciseRendererProps>;
}

/** Played on the guitar: a phrase, against the clock or in free time. */
export interface PlayedDefinition<P = void> extends DefinitionBase<P> {
  kind: 'played';
  timing?: ExerciseTiming;
  /** The function. Pure: same context in, same instance out. */
  generate(context: GenerationContext<P>): PlayedInstance;
  /**
   * How long one rep takes, for routine duration estimates. Omitted, it is
   * how long the phrase lasts — at the given tempo, or this exercise's own
   * default.
   */
  estimateRepSeconds?(instance: PlayedInstance, tempo: number | null): number;
}

/** Answered, not played: a set of questions, with no clock at all. */
export interface TheoryDefinition<P = void> extends DefinitionBase<P> {
  kind: 'theory';
  /** The function. Pure: same context in, same instance out. A fresh set each pass. */
  generate(context: GenerationContext<P>): TheoryInstance;
  /** How long one set takes, for routine duration estimates. */
  estimateRepSeconds(instance: TheoryInstance): number;
}

/**
 * An exercise. The kind decides what `generate` returns, so a theory
 * definition cannot hand back a phrase, and nothing downstream has to check.
 */
export type ExerciseDefinition<P = void> = PlayedDefinition<P> | TheoryDefinition<P>;

/** An ExerciseDefinition with its params type erased, for storing in the registry. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyExerciseDefinition = ExerciseDefinition<any>;
