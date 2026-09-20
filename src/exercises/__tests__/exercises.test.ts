import { describe, expect, it } from 'vitest';
import { chroma, pitchClass, scaleNotes } from '@/domain/music';
import type { Instrument } from '@/domain/instrument';
import {
  STANDARD_GUITAR,
  TEST_INSTRUMENTS,
  isValidPosition,
  pitchClassAt,
} from '@/domain/instrument';
import type { AxisPolicies } from '@/domain/variation';
import {
  axisDefinition,
  mulberry32,
  rollVariation,
  variationKeyMode,
} from '@/domain/variation';
import { EXERCISE_DEFINITIONS, exerciseDefinition } from '../registry';
import type { AnyExerciseDefinition, ExerciseInstance, PlayedInstance } from '../types';

/**
 * Invariants every played exercise must hold, run over the whole registry so
 * a new exercise is checked without anyone writing these again.
 */

const D_DORIAN: AxisPolicies = {
  mode: { mode: 'fixed', value: 'dorian' },
  key: { mode: 'fixed', value: 'D' },
};

function generateAny(
  definition: AnyExerciseDefinition,
  seed: number,
  instrument: Instrument = STANDARD_GUITAR,
  policies: AxisPolicies = D_DORIAN,
): ExerciseInstance {
  const variation = rollVariation({
    axes: definition.axes,
    seed,
    instrument,
    policies: { ...definition.defaults.axisPolicies, ...policies },
  });
  // The registry erases each definition's params type; this is the parsed default.
  const params: unknown = definition.params?.parse({});
  const instance = definition.generate({
    variation,
    keyMode: variationKeyMode(variation) ?? { tonic: pitchClass('D'), mode: 'dorian' },
    instrument,
    params,
    rng: mulberry32(seed),
    repIndex: 0,
  });
  return instance;
}

function generate(
  definition: AnyExerciseDefinition,
  seed: number,
  instrument: Instrument = STANDARD_GUITAR,
  policies: AxisPolicies = D_DORIAN,
): PlayedInstance {
  const instance = generateAny(definition, seed, instrument, policies);
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
        // An improvisation writes nothing; it still has bars to count.
        if (definition.tags.includes('improv')) expect(phrase.totalTicks).toBeGreaterThan(0);
        else expect(phrase.notes.length, `seed ${seed}`).toBeGreaterThan(0);
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
            notes: instance.phrase.notes.map((n) => [
              n.string,
              n.fret,
              n.startTick,
              n.role,
              n.display ?? n.articulation ?? null,
            ]),
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

const THEORY = EXERCISE_DEFINITIONS.filter((d) => d.kind === 'theory');

describe.each(THEORY.map((d) => [d.id, d] as const))('%s', (_id, definition) => {
  const questions = (seed: number) => {
    const instance = generateAny(definition, seed);
    if (instance.kind !== 'theory') throw new Error('expected theory');
    return instance;
  };

  it('asks a set of well-formed questions, each with one right answer', () => {
    for (const seed of SEEDS) {
      const { questions: set, brief } = questions(seed);
      expect(set.length).toBeGreaterThan(0);
      expect(brief.headline).not.toMatch(/undefined|\s\s/);
      for (const q of set) {
        expect(q.prompt).not.toMatch(/undefined|NaN/);
        if (q.kind === 'single-pick') {
          expect(q.options.length).toBeGreaterThanOrEqual(2);
          expect(q.options.length).toBeLessThanOrEqual(6);
          expect(q.options.filter((o) => o.id === q.correctOptionId)).toHaveLength(1);
          expect(new Set(q.options.map((o) => o.label)).size).toBe(q.options.length);
        } else {
          for (const row of q.rows) {
            expect(row.options.filter((o) => o.id === row.correctOptionId)).toHaveLength(1);
            expect(row.options.length).toBeLessThanOrEqual(6);
          }
        }
      }
    }
  });

  it('is the same for the same seed, and new for a new one', () => {
    expect(JSON.stringify(questions(4))).toBe(JSON.stringify(questions(4)));
    expect(JSON.stringify(questions(4).questions)).not.toBe(
      JSON.stringify(questions(5).questions),
    );
  });

  it('declares no tempo', () => {
    expect(definition.defaults.targetTempo).toBeNull();
  });
});

describe('free-improv-target', () => {
  const definition = exerciseDefinition('free-improv-target');

  it('writes nothing, and counts phrases in labeled bars', () => {
    const { phrase } = generate(definition, 7);
    expect(phrase.notes).toEqual([]);
    expect(phrase.bars).toHaveLength(32); // 8 phrases of 4 bars
    const labeled = phrase.bars.filter((b) => b.label?.startsWith('Phrase'));
    expect(labeled.map((b) => b.index)).toEqual([0, 4, 8, 12, 16, 20, 24, 28]);
  });

  it('marks the target degree on the neck, and names it in the brief', () => {
    const policies: AxisPolicies = {
      ...D_DORIAN,
      targetScaleDegree: { mode: 'fixed', value: '6' },
    };
    const { neck, brief } = generate(definition, 3, STANDARD_GUITAR, policies);
    expect(brief.headline).toBe('Improvise in D Dorian, ending every phrase on B.');
    expect(neck.notes.some((n) => n.role === 'target' && n.degree.number === 6)).toBe(true);
    expect(neck.notes.every((n) => n.position.fret <= 15)).toBe(true);
  });

  it('keeps to the position only when asked', () => {
    const policies: AxisPolicies = { ...D_DORIAN, neckPosition: { mode: 'fixed', value: '7' } };
    const params = {
      phraseLengthBars: 2,
      phraseCount: 4,
      constrainToPosition: true,
      showTargetOnNeck: true,
    };
    const variation = rollVariation({
      axes: definition.axes,
      seed: 1,
      instrument: STANDARD_GUITAR,
      policies,
    });
    const instance = definition.generate({
      variation,
      keyMode: { tonic: pitchClass('D'), mode: 'dorian' },
      instrument: STANDARD_GUITAR,
      params,
      rng: mulberry32(1),
      repIndex: 0,
    }) as PlayedInstance;
    const frets = instance.neck.notes.map((n) => n.position.fret);
    expect(Math.min(...frets)).toBeGreaterThanOrEqual(7);
    expect(Math.max(...frets)).toBeLessThanOrEqual(11);
    expect(instance.phrase.bars).toHaveLength(8);
    expect(instance.brief.instruction).toContain('in 7th position');
  });
});
