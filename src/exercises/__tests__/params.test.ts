import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { humanize, paramFields, resolveParams } from '../params';
import { exerciseDefinition } from '../registry';

describe('paramFields', () => {
  const schema = z.object({
    variant: z.enum(['plain', 'arpeggio-then-scale']).default('plain'),
    shapesPerRep: z.number().int().min(1).max(7).default(7),
    bpm: z.number().int().min(30).max(300).default(60),
    loose: z.number().default(1),
    enabled: z.boolean().default(true),
    range: z.object({ low: z.number() }),
    cycles: z.number().int().min(1).max(12).default(4).describe('How many sweeps'),
  });
  const fields = paramFields(schema);
  const byKey = new Map(fields.map((f) => [f.key, f]));

  it('turns enums into choices with readable labels', () => {
    expect(byKey.get('variant')).toMatchObject({
      kind: 'choice',
      label: 'Variant',
      options: [
        { value: 'plain', label: 'Plain' },
        { value: 'arpeggio-then-scale', label: 'Arpeggio then scale' },
      ],
    });
  });

  it('lists a small integer range, and leaves a wide one to be typed', () => {
    const shapes = byKey.get('shapesPerRep')!;
    expect(shapes.kind).toBe('choice');
    if (shapes.kind === 'choice') expect(shapes.options.map((o) => o.value)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(byKey.get('bpm')).toMatchObject({ kind: 'number', min: 30, max: 300 });
    expect(byKey.get('loose')).toMatchObject({ kind: 'number' });
  });

  it('carries a description through as a hint', () => {
    expect(byKey.get('cycles')!.hint).toBe('How many sweeps');
  });

  it('handles booleans and skips what it cannot render', () => {
    expect(byKey.get('enabled')!.kind).toBe('toggle');
    expect(byKey.has('range')).toBe(false);
  });

  it('describes nothing for an exercise without params', () => {
    expect(paramFields(undefined)).toEqual([]);
  });

  it('humanizes ids', () => {
    expect(humanize('shiftOn')).toBe('Shift on');
    expect(humanize('every-other-string')).toBe('Every other string');
  });
});

describe('resolveParams', () => {
  const definition = exerciseDefinition('modes-through-key');

  it('fills in anything a stored config is missing', () => {
    // A param added to a definition after the exercise was configured.
    expect(resolveParams(definition, { variant: 'pause-on-root' })).toEqual({
      variant: 'pause-on-root',
      shapesPerRep: 7,
      minFret: 1,
    });
  });

  it('falls back to the defaults when stored params no longer validate', () => {
    expect(resolveParams(definition, { variant: 'retired' })).toEqual(definition.defaults.params);
  });
});
