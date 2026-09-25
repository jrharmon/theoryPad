import { describe, expect, it } from 'vitest';
import { chroma, pitchClass, scaleNotes } from '@/domain/music';
import {
  SEVEN_STRING_GUITAR,
  STANDARD_GUITAR,
  isValidPosition,
  midiAt,
  pitchClassAt,
} from '@/domain/instrument';
import { mulberry32, rollVariation, variationKeyMode } from '@/domain/variation';
import type { GenerationContext } from '../../types';
import { estimateItemSeconds } from '../../estimate';
import { modesThroughKey, type ModesThroughKeyParams } from '../definition';

const DEFAULTS: ModesThroughKeyParams = { variant: 'plain', shapesPerRep: 7, minFret: 1 };

function generate(
  seed = 12345,
  overrides: Partial<GenerationContext<ModesThroughKeyParams>> = {},
) {
  const instrument = overrides.instrument ?? STANDARD_GUITAR;
  const variation = rollVariation({
    axes: modesThroughKey.axes,
    seed,
    instrument,
    policies: { mode: { mode: 'fixed', value: 'dorian' }, key: { mode: 'fixed', value: 'D' } },
  });

  const context: GenerationContext<ModesThroughKeyParams> = {
    variation,
    keyMode: variationKeyMode(variation) ?? { tonic: pitchClass('D'), mode: 'dorian' },
    instrument,
    params: DEFAULTS,
    rng: mulberry32(seed),
    repIndex: 0,
    ...overrides,
  };

  const instance = modesThroughKey.generate(context);
  if (instance.kind !== 'played') throw new Error('expected a played instance');
  return instance;
}

describe('modes-through-key', () => {
  it('produces a stable phrase for a fixed seed', async () => {
    // A golden file: generated content is impossible to eyeball for
    // regressions, so it is snapshotted instead.
    const instance = generate(12345);
    await expect(
      JSON.stringify(
        {
          headline: instance.brief.headline,
          instruction: instance.brief.instruction,
          bars: instance.phrase.bars.map((b) => [b.index, b.label ?? null]),
          notes: instance.phrase.notes.map((n) => [n.string, n.fret, n.startTick, n.role]),
        },
        null,
        2,
      ),
    ).toMatchFileSnapshot('../../../../test/golden/modes-through-key-12345.json');
  });

  it('only ever asks for positions that exist on the instrument', () => {
    for (const instrument of [STANDARD_GUITAR, SEVEN_STRING_GUITAR]) {
      for (let seed = 0; seed < 25; seed += 1) {
        const instance = generate(seed, { instrument });
        for (const note of instance.phrase.notes) {
          expect(isValidPosition(instrument, note), `${instrument.name} seed ${seed}`).toBe(
            true,
          );
        }
      }
    }
  });

  it('plays only notes of the key', () => {
    const instance = generate();
    const allowed = new Set(scaleNotes({ tonic: pitchClass('D'), mode: 'dorian' }).map(chroma));
    expect(instance.phrase.notes.length).toBeGreaterThan(0);
    for (const note of instance.phrase.notes) {
      const sounding = pitchClassAt(STANDARD_GUITAR, note);
      expect(allowed.has(chroma(sounding)), `${sounding} at ${note.string}/${note.fret}`).toBe(
        true,
      );
    }
  });

  it('covers all seven shapes by default', () => {
    const instance = generate();
    const labels = instance.phrase.bars.map((b) => b.label).filter(Boolean);
    expect(labels).toHaveLength(7);
    expect(instance.neck.emphasisFrets).toHaveLength(7);
  });

  it('honours shapesPerRep', () => {
    const instance = generate(1, { params: { ...DEFAULTS, shapesPerRep: 3 } });
    expect(instance.phrase.bars.map((b) => b.label).filter(Boolean)).toHaveLength(3);
  });

  it('starts each shape on a bar line', () => {
    const instance = generate();
    for (const bar of instance.phrase.bars) {
      if (bar.label) expect(bar.startTick % 1920).toBe(0);
    }
  });

  it('marks the roots and nothing else', () => {
    const instance = generate(7);
    const roles = new Set(instance.phrase.notes.map((n) => n.role));
    expect(roles).toEqual(new Set(['root', 'none']));
  });

  it('reverses when the direction rolls descending', () => {
    const instrument = STANDARD_GUITAR;
    const variation = rollVariation({
      axes: modesThroughKey.axes,
      seed: 3,
      instrument,
      policies: {
        mode: { mode: 'fixed', value: 'dorian' },
        key: { mode: 'fixed', value: 'D' },
        direction: { mode: 'fixed', value: 'descending' },
      },
    });
    const instance = modesThroughKey.generate({
      variation,
      keyMode: { tonic: pitchClass('D'), mode: 'dorian' },
      instrument,
      params: DEFAULTS,
      rng: mulberry32(3),
      repIndex: 0,
    });
    if (instance.kind !== 'played') throw new Error('expected played');

    // The first shape now begins on its highest note.
    const firstShape = instance.phrase.notes.filter((n) => n.startTick < 1920);
    expect(firstShape[0]!.string).toBeGreaterThan(firstShape[firstShape.length - 1]!.string);
  });

  it('estimates a sensible duration', () => {
    const seconds = estimateItemSeconds(
      modesThroughKey,
      {
        params: DEFAULTS,
        tempo: { targetTempo: 70, maxTempo: null },
        axisPolicies: {},
        reps: 1,
      },
      STANDARD_GUITAR,
    );
    expect(seconds).toBeGreaterThan(30);
    expect(seconds).toBeLessThan(400);
  });

  describe('arpeggio-then-scale', () => {
    const instance = () =>
      generate(1, { params: { ...DEFAULTS, variant: 'arpeggio-then-scale' } });

    it('arpeggiates each shape’s 7th chord up, then runs the scale down', () => {
      const { phrase } = instance();
      const starts = phrase.bars.filter((b) => b.label).map((b) => b.startTick);
      expect(starts).toHaveLength(7);

      const first = phrase.notes.filter((n) => n.startTick < starts[1]!);
      const pitches = first.map((n) => midiAt(STANDARD_GUITAR, n));
      const scale = pitches.slice(-18);
      const arpeggio = pitches.slice(0, -18);

      // Four chord tones across a two-octave shape: eight to ten of them.
      expect(arpeggio.length).toBeGreaterThanOrEqual(8);
      expect(arpeggio.length).toBeLessThanOrEqual(10);
      for (let i = 1; i < arpeggio.length; i += 1)
        expect(arpeggio[i]!).toBeGreaterThan(arpeggio[i - 1]!);
      for (let i = 1; i < scale.length; i += 1) expect(scale[i]!).toBeLessThan(scale[i - 1]!);
      // The chord is built on the shape's own first note, not the key's root.
      expect(arpeggio[0]).toBe(scale[scale.length - 1]);
    });

    it('names the variant in the brief and drops direction from the strip', () => {
      const { brief } = instance();
      expect(brief.headline).toMatch(/chord then scale/);
      expect(brief.highlightAxes).not.toContain('direction');
    });
  });

  describe('pause-on-root', () => {
    const instance = () => generate(1, { params: { ...DEFAULTS, variant: 'pause-on-root' } });

    it('gives every root a beat and every other note an eighth', () => {
      const { phrase } = instance();
      for (const note of phrase.notes) {
        expect(note.durationTicks, `role ${note.role}`).toBe(note.role === 'root' ? 480 : 240);
      }
    });

    it('still starts each shape on a bar line', () => {
      const { phrase } = instance();
      const labelled = phrase.bars.filter((b) => b.label);
      expect(labelled).toHaveLength(7);
      for (const bar of labelled) {
        expect(phrase.notes.some((n) => n.startTick === bar.startTick)).toBe(true);
      }
    });

    it('leaves the rhythm out of the strip, since it does not use it', () => {
      expect(instance().brief.highlightAxes).not.toContain('rhythmPattern');
    });
  });

  it('validates its params', () => {
    expect(modesThroughKey.params!.safeParse({}).success).toBe(true);
    expect(modesThroughKey.params!.safeParse({ shapesPerRep: 9 }).success).toBe(false);
    expect(modesThroughKey.params!.safeParse({ variant: 'nope' }).success).toBe(false);
  });
});
