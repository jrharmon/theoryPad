import { describe, expect, it } from 'vitest';
import { pitchClass } from '@/domain/music';
import { SEVEN_STRING_GUITAR, STANDARD_GUITAR } from '@/domain/instrument';
import type { AxisId } from '../types';
import { freshAxes, rollVariation, variationKeyMode, variationKeys } from '../roll';

const base = { seed: 1234, instrument: STANDARD_GUITAR };
const ALL: AxisId[] = [
  'mode', 'key', 'neckPosition', 'stringSet', 'targetScaleDegree', 'rhythmPattern', 'direction',
];

describe('rollVariation', () => {
  it('resolves exactly the axes the exercise declares', () => {
    const rolled = rollVariation({ ...base, axes: ['neckPosition', 'direction'] });
    expect(Object.keys(rolled.axes).sort()).toEqual(['direction', 'neckPosition']);
  });

  it('handles a static exercise that declares no axes', () => {
    // Nothing special-cases this; it is the same code path with an empty list.
    const rolled = rollVariation({ ...base, axes: [] });
    expect(rolled.axes).toEqual({});
    expect(freshAxes(rolled)).toEqual([]);
    expect(variationKeys(rolled)).toEqual({});
  });

  it('is deterministic in its seed', () => {
    const a = rollVariation({ ...base, axes: ALL });
    const b = rollVariation({ ...base, axes: ALL });
    expect(variationKeys(a)).toEqual(variationKeys(b));
  });

  it('gives different variations for different seeds', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed += 1) {
      seen.add(JSON.stringify(variationKeys(rollVariation({ ...base, seed, axes: ALL }))));
    }
    expect(seen.size).toBeGreaterThan(20);
  });

  it('carries the seed through', () => {
    expect(rollVariation({ ...base, seed: 77, axes: ALL }).seed).toBe(77);
  });

  it('always resolves to a legal candidate', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const rolled = rollVariation({ ...base, seed, axes: ALL });
      expect(rolled.axes.targetScaleDegree!.value).toBeGreaterThanOrEqual(1);
      expect(rolled.axes.targetScaleDegree!.value).toBeLessThanOrEqual(7);
      const position = rolled.axes.neckPosition!.value as { fret: number; span: number };
      expect(position.span).toBeGreaterThan(0);
    }
  });
});

describe('axis policies', () => {
  it('rolls freely by default', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 60; seed += 1) {
      seen.add(rollVariation({ ...base, seed, axes: ['neckPosition'] }).axes.neckPosition!.key);
    }
    expect(seen.size).toBeGreaterThan(3);
  });

  it('pins a fixed axis whatever the seed', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const rolled = rollVariation({
        ...base,
        seed,
        axes: ['mode', 'key'],
        policies: { mode: { mode: 'fixed', value: 'dorian' }, key: { mode: 'fixed', value: 'D' } },
      });
      expect(rolled.axes.mode!.key).toBe('dorian');
      expect(rolled.axes.key!.key).toBe('D');
      expect(rolled.axes.mode!.source).toBe('fixed');
    }
  });

  it('rolls only from a subset when one is given', () => {
    const allowed = new Set(['3', '5', '7']);
    for (let seed = 0; seed < 60; seed += 1) {
      const rolled = rollVariation({
        ...base,
        seed,
        axes: ['neckPosition'],
        policies: { neckPosition: { mode: 'roll', from: ['3', '5', '7'] } },
      });
      expect(allowed.has(rolled.axes.neckPosition!.key)).toBe(true);
    }
  });

  it('keeps a held axis at its previous value', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const rolled = rollVariation({
        ...base,
        seed,
        axes: ['direction'],
        policies: { direction: { mode: 'hold' } },
        held: { direction: 'descending' },
      });
      expect(rolled.axes.direction!.key).toBe('descending');
      expect(rolled.axes.direction!.source).toBe('hold');
    }
  });

  it('rolls a held axis that has nothing to hold yet', () => {
    const rolled = rollVariation({
      ...base,
      axes: ['direction'],
      policies: { direction: { mode: 'hold' } },
    });
    expect(rolled.axes.direction!.source).toBe('roll');
  });

  it('rolls rather than failing when a held value is no longer valid', () => {
    // Changing instrument can invalidate a string set that was being held.
    const rolled = rollVariation({
      ...base,
      instrument: SEVEN_STRING_GUITAR,
      axes: ['stringSet'],
      policies: { stringSet: { mode: 'hold' } },
      held: { stringSet: 'no-such-set' },
    });
    expect(rolled.axes.stringSet!.source).toBe('roll');
  });

  it('rolls from everything when a subset matches nothing', () => {
    // Better than throwing part-way through a practice session.
    const rolled = rollVariation({
      ...base,
      axes: ['neckPosition'],
      policies: { neckPosition: { mode: 'roll', from: ['999'] } },
    });
    expect(rolled.axes.neckPosition).toBeDefined();
  });

  it('refuses a fixed value that does not exist', () => {
    expect(() =>
      rollVariation({
        ...base,
        axes: ['mode'],
        policies: { mode: { mode: 'fixed', value: 'lydianish' } },
      }),
    ).toThrow(/lydianish/);
  });
});

describe('freshness', () => {
  it('marks nothing fresh on a first roll', () => {
    // There is no previous value to have changed from, and highlighting every
    // axis would say nothing.
    expect(freshAxes(rollVariation({ ...base, axes: ALL }))).toEqual([]);
  });

  it('marks an axis fresh only when it actually changed', () => {
    const first = rollVariation({ ...base, axes: ['neckPosition', 'direction'] });
    const held = variationKeys(first);

    const second = rollVariation({
      ...base,
      seed: 999,
      axes: ['neckPosition', 'direction'],
      held,
    });

    for (const axis of Object.values(second.axes)) {
      expect(axis.fresh).toBe(axis.key !== held[axis.id]);
    }
  });

  it('never marks a fixed or held axis fresh', () => {
    const rolled = rollVariation({
      ...base,
      axes: ['mode', 'direction'],
      policies: { mode: { mode: 'fixed', value: 'lydian' }, direction: { mode: 'hold' } },
      held: { mode: 'dorian', direction: 'ascending' },
    });
    expect(rolled.axes.mode!.fresh).toBe(false);
    expect(rolled.axes.direction!.fresh).toBe(false);
  });
});

describe('coverage bias', () => {
  it('prefers values it has not seen recently', () => {
    // Without this, "roll" is merely random and the never-visited parts of the
    // neck stay never-visited.
    const coverage = {
      neckPosition: { '0': 20, '3': 20, '5': 20, '7': 20, '10': 0, '12': 20 },
    };

    let unexplored = 0;
    for (let seed = 0; seed < 200; seed += 1) {
      const rolled = rollVariation({ ...base, seed, axes: ['neckPosition'], coverage });
      if (rolled.axes.neckPosition!.key === '10') unexplored += 1;
    }
    // One of six positions, so an unbiased roll would land near 33.
    expect(unexplored).toBeGreaterThan(100);
  });

  it('suppresses without excluding', () => {
    // A value played five times is weighted 1/6 against the others' 1 — it
    // comes up much less, but the bias is a preference, not a ban.
    const coverage = { direction: { ascending: 5 } };
    const counts = new Map<string, number>();
    for (let seed = 0; seed < 400; seed += 1) {
      const key = rollVariation({ ...base, seed, axes: ['direction'], coverage }).axes.direction!
        .key;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(4);
    expect(counts.get('ascending')!).toBeGreaterThan(0);
    for (const [key, count] of counts) {
      if (key !== 'ascending') expect(count).toBeGreaterThan(counts.get('ascending')!);
    }
  });

  it('weights by one over one-plus-seen', () => {
    // Stated explicitly because the exact curve is a design decision: seen
    // twice halves against seen once, rather than dropping off a cliff.
    const counts = new Map<string, number>();
    const coverage = { direction: { ascending: 0, descending: 1, 'up-down': 3, 'down-up': 7 } };
    for (let seed = 0; seed < 4000; seed += 1) {
      const key = rollVariation({ ...base, seed, axes: ['direction'], coverage }).axes.direction!
        .key;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    // Expected shares are 1 : 1/2 : 1/4 : 1/8.
    expect(counts.get('ascending')! / counts.get('descending')!).toBeCloseTo(2, 0);
    expect(counts.get('descending')! / counts.get('up-down')!).toBeCloseTo(2, 0);
    expect(counts.get('up-down')! / counts.get('down-up')!).toBeCloseTo(2, 0);
  });

  it('asks for the mode’s signature degree more often', () => {
    // Dorian's natural 6th is what makes it dorian, so it is the most useful
    // degree to be told to land on.
    const counts = new Map<string, number>();
    for (let seed = 0; seed < 300; seed += 1) {
      const rolled = rollVariation({
        ...base,
        seed,
        axes: ['mode', 'key', 'targetScaleDegree'],
        policies: { mode: { mode: 'fixed', value: 'dorian' }, key: { mode: 'fixed', value: 'D' } },
      });
      const key = rolled.axes.targetScaleDegree!.key;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const sixth = counts.get('6') ?? 0;
    const others = [...counts.entries()].filter(([k]) => k !== '6').map(([, v]) => v);
    expect(sixth).toBeGreaterThan(Math.max(...others));
  });
});

describe('session axes', () => {
  it('rolls the mode before the key, so the spelling follows the mode', () => {
    // Db phrygian needs double flats; C# phrygian does not. The key axis can
    // only know that if the mode is already resolved.
    for (let seed = 0; seed < 80; seed += 1) {
      const rolled = rollVariation({ ...base, seed, axes: ['mode', 'key'] });
      const keyMode = variationKeyMode(rolled)!;
      expect(keyMode.tonic).not.toMatch(/(##|bb)/);
    }
  });

  it('exposes the resolved key and mode', () => {
    const rolled = rollVariation({
      ...base,
      axes: ['mode', 'key'],
      policies: { mode: { mode: 'fixed', value: 'dorian' }, key: { mode: 'fixed', value: 'D' } },
    });
    expect(variationKeyMode(rolled)).toEqual({ tonic: 'D', mode: 'dorian' });
  });

  it('falls back to the session key when the exercise does not roll one', () => {
    const rolled = rollVariation({ ...base, axes: ['neckPosition'] });
    const fallback = { tonic: pitchClass('G'), mode: 'mixolydian' as const };
    expect(variationKeyMode(rolled, fallback)).toEqual(fallback);
    expect(variationKeyMode(rolled)).toBeNull();
  });

  it('respells a fixed key into the rolled mode', () => {
    const rolled = rollVariation({
      ...base,
      axes: ['mode', 'key'],
      policies: {
        mode: { mode: 'fixed', value: 'phrygian' },
        key: { mode: 'fixed', value: 'Db' },
      },
    });
    // Db phrygian would need double flats, so it is written C#.
    expect(rolled.axes.key!.key).toBe('C#');
  });
});

describe('instrument awareness', () => {
  it('offers string sets that fit the instrument', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const rolled = rollVariation({
        ...base,
        seed,
        instrument: SEVEN_STRING_GUITAR,
        axes: ['stringSet'],
      });
      for (const s of (rolled.axes.stringSet!.value as { strings: number[] }).strings) {
        expect(s).toBeLessThan(SEVEN_STRING_GUITAR.tuning.length);
      }
    }
  });

  it('never offers a position past the end of the neck', () => {
    const short = { ...STANDARD_GUITAR, fretCount: 12 };
    for (let seed = 0; seed < 40; seed += 1) {
      const rolled = rollVariation({ ...base, seed, instrument: short, axes: ['neckPosition'] });
      const position = rolled.axes.neckPosition!.value as { fret: number; span: number };
      expect(position.fret + position.span).toBeLessThanOrEqual(12);
    }
  });
});

describe('display', () => {
  it('formats values for the brief', () => {
    const rolled = rollVariation({
      ...base,
      axes: ['mode', 'neckPosition', 'direction'],
      policies: {
        mode: { mode: 'fixed', value: 'dorian' },
        neckPosition: { mode: 'fixed', value: '7' },
        direction: { mode: 'fixed', value: 'up-down' },
      },
    });
    expect(rolled.axes.mode!.display).toBe('Dorian');
    expect(rolled.axes.neckPosition!.display).toBe('7th position');
    expect(rolled.axes.direction!.display).toBe('Up then down');
  });

  it('ordinalises positions correctly', () => {
    const display = (fret: string) =>
      rollVariation({
        ...base,
        axes: ['neckPosition'],
        policies: { neckPosition: { mode: 'fixed', value: fret } },
      }).axes.neckPosition!.display;

    expect(display('0')).toBe('Open position');
    expect(display('3')).toBe('3rd position');
    expect(display('5')).toBe('5th position');
    expect(display('12')).toBe('12th position');
  });
});
