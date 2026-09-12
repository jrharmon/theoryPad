import { z } from 'zod';
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
      label: humanize(String(value)),
    }));
    return { ...base, kind: 'choice', options };
  }
  if (inner instanceof z.ZodBoolean) return { ...base, kind: 'toggle' };
  if (inner instanceof z.ZodArray) {
    const element = unwrap(inner.element as z.ZodType);
    if (element instanceof z.ZodEnum) {
      const options = (element.options as string[]).map((value) => ({ value, label: humanize(value) }));
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
  return definition.params.parse(definition.defaults.params ?? {}) as unknown;
}
