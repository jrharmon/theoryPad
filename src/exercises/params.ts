import { z } from 'zod';
import { DEFAULT_GENERATED_BACKING, type GeneratedBackingSettings } from '@/domain/backing';
import type { AnyExerciseDefinition } from './types';

/**
 * An exercise's params, as a form. Derived from its Zod schema so a new
 * exercise gets a config form without anyone writing one.
 */
export type ParamField = {
  key: string;
  label: string;
  hint?: string;
} & (
  | { kind: 'choice'; options: { value: string | number; label: string }[] }
  /** Any number of a fixed set — at least one, when the schema says so. */
  | { kind: 'multi'; options: { value: string; label: string }[]; min: number }
  | { kind: 'number'; min?: number; max?: number }
  | { kind: 'toggle' }
);

/** "shapesPerRep" → "Shapes per rep"; "every-other-string" → "Every other string". */
export function humanize(id: string): string {
  const words = id
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Option values whose humanized form would mislead. `chord-function` is
 * persisted in saved exercises so the value cannot change, but the question
 * it now asks is about chord families.
 */
const OPTION_LABELS: Record<string, string> = {
  'chord-function': 'Chord families',
};

const optionLabel = (value: string): string => OPTION_LABELS[value] ?? humanize(value);

/** Small integer ranges read better as a pick-list than as a box to type into. */
const MAX_LISTED_NUMBERS = 24;

function unwrap(schema: z.ZodType): z.ZodType {
  let inner = schema;
  while (inner instanceof z.ZodDefault || inner instanceof z.ZodOptional) {
    inner = inner.unwrap() as z.ZodType;
  }
  return inner;
}

function fieldFor(key: string, schema: z.ZodType): ParamField | null {
  const inner = unwrap(schema);
  const label = humanize(key);
  const hint = schema.description ?? inner.description;
  const base = { key, label, ...(hint ? { hint } : {}) };

  if (inner instanceof z.ZodEnum) {
    const options = (inner.options as (string | number)[]).map((value) => ({
      value,
      label: optionLabel(String(value)),
    }));
    return { ...base, kind: 'choice', options };
  }
  if (inner instanceof z.ZodBoolean) return { ...base, kind: 'toggle' };
  if (inner instanceof z.ZodArray) {
    const element = unwrap(inner.element as z.ZodType);
    if (element instanceof z.ZodEnum) {
      const options = (element.options as string[]).map((value) => ({
        value,
        label: optionLabel(value),
      }));
      // Zod gathers a schema's constraints into its bag: `.min(1)` is minimum 1.
      const min = (inner._zod.bag as { minimum?: number }).minimum ?? 0;
      return { ...base, kind: 'multi', options, min };
    }
  }
  if (inner instanceof z.ZodNumber) {
    const min = inner.minValue ?? undefined;
    const max = inner.maxValue ?? undefined;
    const listable =
      inner.isInt && min !== undefined && max !== undefined && max - min < MAX_LISTED_NUMBERS;
    if (listable) {
      const options = Array.from({ length: max - min + 1 }, (_, i) => ({
        value: min + i,
        label: String(min + i),
      }));
      return { ...base, kind: 'choice', options };
    }
    return {
      ...base,
      kind: 'number',
      ...(min !== undefined && Number.isFinite(min) ? { min } : {}),
      ...(max !== undefined && Number.isFinite(max) ? { max } : {}),
    };
  }
  // Anything richer than a flat value needs a hand-built control.
  return null;
}

export function paramFields(schema: z.ZodType | undefined): ParamField[] {
  if (!(schema instanceof z.ZodObject)) return [];
  return Object.entries(schema.shape as Record<string, z.ZodType>).flatMap(([key, field]) => {
    const described = fieldFor(key, field);
    return described ? [described] : [];
  });
}

/**
 * Stored params, filled out and checked against the definition's schema.
 *
 * Stored params can be stale — a definition may gain a param after an
 * exercise was configured — so they are parsed rather than trusted, and
 * anything that no longer validates falls back to the defaults.
 */
export function resolveParams(definition: AnyExerciseDefinition, stored: unknown): unknown {
  if (!definition.params) return undefined;
  const parsed = definition.params.safeParse(stored ?? {});
  if (parsed.success) return parsed.data as unknown;
  return definition.params.parse({}) as unknown;
}

/**
 * What the generated backing plays for an exercise or routine item: its own
 * settings, else its definition's, else the plain default.
 */
export function resolveGeneratedBacking(
  definition: AnyExerciseDefinition,
  stored: GeneratedBackingSettings | undefined,
): GeneratedBackingSettings {
  return stored ?? definition.backing?.generated ?? DEFAULT_GENERATED_BACKING;
}

/** The param a theory set sizes itself by. */
const QUESTION_COUNT = 'questionCount';

/**
 * Whether a routine item's rep count means questions rather than passes: a
 * theory set sized by `questionCount`. In a routine the player asks for as many
 * questions as they want, so the count is the reps, not the exercise's setting.
 */
export function repsAreQuestions(definition: AnyExerciseDefinition): boolean {
  return (
    definition.kind === 'theory' &&
    definition.params instanceof z.ZodObject &&
    QUESTION_COUNT in definition.params.shape
  );
}

/**
 * How a routine item runs: its params, and how many passes. A theory item's
 * reps are its question count, asked as one set. The count is set after the
 * schema, so a routine can ask for more or fewer than the exercise's own form
 * allows.
 */
export function routineItemRun(
  definition: AnyExerciseDefinition,
  item: { params: unknown; reps: number },
): { params: unknown; passes: number } {
  const params = resolveParams(definition, item.params);
  const reps = Math.max(1, item.reps);
  if (!repsAreQuestions(definition)) return { params, passes: reps };
  return { params: { ...(params as object), [QUESTION_COUNT]: reps }, passes: 1 };
}

/** A new routine item's reps: a theory set's own question count, otherwise the exercise's. */
export function initialItemReps(
  definition: AnyExerciseDefinition | undefined,
  stored: {
    params: unknown;
    defaultReps: number;
  },
): number {
  if (definition && repsAreQuestions(definition)) {
    const count = (resolveParams(definition, stored.params) as Record<string, unknown>)[
      QUESTION_COUNT
    ];
    if (typeof count === 'number') return count;
  }
  return Math.max(1, stored.defaultReps);
}
