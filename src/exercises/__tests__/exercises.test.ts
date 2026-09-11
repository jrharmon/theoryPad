import { describe, expect, it } from 'vitest';
import { chroma, pitchClass, scaleNotes } from '@/domain/music';
import type { Instrument } from '@/domain/instrument';
import { STANDARD_GUITAR, TEST_INSTRUMENTS, isValidPosition, pitchClassAt } from '@/domain/instrument';
import type { AxisPolicies } from '@/domain/variation';
import { axisDefinition, mulberry32, rollVariation, variationKeyMode } from '@/domain/variation';
import { EXERCISE_DEFINITIONS, exerciseDefinition } from '../registry';
import type { AnyExerciseDefinition, PlayedInstance } from '../types';

/**
 * Invariants every played exercise must hold, run over the whole registry so
 * a new exercise is checked without anyone writing these again.
 */

const D_DORIAN: AxisPolicies = {
  mode: { mode: 'fixed', value: 'dorian' },
  key: { mode: 'fixed', value: 'D' },
};

function generate(
  definition: AnyExerciseDefinition,
  seed: number,
  instrument: Instrument = STANDARD_GUITAR,
  policies: AxisPolicies = D_DORIAN,
): PlayedInstance {
  const variation = rollVariation({
    axes: definition.axes,
    seed,
    instrument,
    policies: { ...definition.defaults.axisPolicies, ...policies },
  });
  // The registry erases each definition's params type; this is the parsed default.
  const params: unknown = definition.params?.parse(definition.defaults.params ?? {});
  const instance = definition.generate({
    variation,
    keyMode: variationKeyMode(variation) ?? { tonic: pitchClass('D'), mode: 'dorian' },
    instrument,
    params,
    rng: mulberry32(seed),
    repIndex: 0,
  });
  if (instance.kind !== 'played') throw new Error(`${definition.id} is not played`);
  return instance;
}

const PLAYED = EXERCISE_DEFINITIONS.filter((d) => d.kind === 'played');
const SEEDS = [1, 2, 3, 42, 12345];

describe.each(PLAYED.map((d) => [d.id, d] as const))('%s', (_id, definition) => {
  it.each(TEST_INSTRUMENTS.map((i) => [i.id, i] as const))(
    'plays only real positions, in the key (%s)',
    (_i, instrument) => {
      const inKey = new Set(scaleNotes({ tonic: pitchClass('D'), mode: 'dorian' }).map(chroma));
      for (const seed of SEEDS) {
        const { phrase, brief } = generate(definition, seed, instrument);
        expect(phrase.notes.length, `seed ${seed}`).toBeGreaterThan(0);
        expect(brief.headline).not.toMatch(/undefined|,\s*\.|\s\s/);
        for (const note of phrase.notes) {
          expect(isValidPosition(instrument, note), JSON.stringify(note)).toBe(true);
          expect(inKey.has(chroma(pitchClassAt(instrument, note)))).toBe(true);
        }
      }
    },
  );

  it('is the same for the same seed', () => {
    expect(generate(definition, 7)).toEqual(generate(definition, 7));
  });

  it('is a static exercise once every axis is pinned', () => {
    // Doc 03: pinning every axis is how a varied exercise becomes a fixed
    // one, with no special case anywhere. Different seeds, identical output.
    const context = { instrument: STANDARD_GUITAR, resolved: { mode: 'dorian', key: 'D' } };
    const pinned: AxisPolicies = { ...D_DORIAN };
    for (const id of definition.axes) {
      if (pinned[id]) continue;
      const axis = axisDefinition(id);
      pinned[id] = { mode: 'fixed', value: axis.key(axis.candidates(context)[0]) };
    }
    const first = generate(definition, 1, STANDARD_GUITAR, pinned);
    for (const seed of SEEDS) {
      expect(generate(definition, seed, STANDARD_GUITAR, pinned).phrase).toEqual(first.phrase);
    }
  });
});

describe.each(['interval-sequences', 'one-note-per-string', 'position-shifting'])(
  '%s golden file',
  (id) => {
    it('produces a stable phrase for a fixed seed', async () => {
      const instance = generate(exerciseDefinition(id), 12345);
      await expect(
        JSON.stringify(
          {
            headline: instance.brief.headline,
            instruction: instance.brief.instruction,
            bars: instance.phrase.bars.filter((b) => b.label).map((b) => [b.index, b.label]),
            notes: instance.phrase.notes.map((n) =>
              [n.string, n.fret, n.startTick, n.role, n.display ?? n.articulation ?? null],
            ),
          },
          null,
          2,
        ),
      ).toMatchFileSnapshot(`../../../test/golden/${id}-12345.json`);
    });
  },
);

describe('one-note-per-string', () => {
  const instance = () => generate(exerciseDefinition('one-note-per-string'), 3);

  it('shows note names instead of frets, and nothing on the neck', () => {
    const { phrase, neck } = instance();
    for (const note of phrase.notes) expect(note.display).toMatch(/^[A-G](#|b)?$/);
    expect(neck.notes).toEqual([]);
  });

  it('puts every note on a different string from the one before', () => {
    const { phrase } = instance();
    for (let i = 1; i < phrase.notes.length; i += 1) {
      expect(phrase.notes[i]!.string).not.toBe(phrase.notes[i - 1]!.string);
    }
  });
});

describe('position-shifting', () => {
  it('marks its shifts as slides, both ways', () => {
    const { phrase } = generate(exerciseDefinition('position-shifting'), 3, STANDARD_GUITAR, {
      ...D_DORIAN,
      direction: { mode: 'fixed', value: 'up-down' },
    });
    const slides = phrase.notes.map((n) => n.articulation).filter(Boolean);
    expect(slides).toContain('slide-up');
    expect(slides).toContain('slide-down');
  });
});
