import { describe, expect, it } from 'vitest';
import { pitchClass } from '@/domain/music';
import { SEVEN_STRING_GUITAR, STANDARD_GUITAR } from '@/domain/instrument';
import type { AxisId } from '../types';
import { freshAxes, rollVariation, variationKeyMode, variationKeys } from '../roll';
import { allAxisDefinitions } from '../axes';
import { toggleSubset } from '../policies';

const base = { seed: 1234, instrument: STANDARD_GUITAR };
const ALL: AxisId[] = [
  'scale',
  'mode',
  'key',
  'neckPosition',
  'stringSet',
  'targetScaleDegree',
  'rhythmPattern',
  'direction',
  'intervalPattern',
  'intervalPairing',
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

  it('replays a seed exactly, varies with the seed, and carries it through', () => {
    expect(variationKeys(rollVariation({ ...base, axes: ALL }))).toEqual(
      variationKeys(rollVariation({ ...base, axes: ALL })),
    );
    expect(rollVariation({ ...base, seed: 77, axes: ALL }).seed).toBe(77);

    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed += 1) {
      seen.add(JSON.stringify(variationKeys(rollVariation({ ...base, seed, axes: ALL }))));
    }
    expect(seen.size).toBeGreaterThan(20);
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
        policies: {
          mode: { mode: 'fixed', value: 'dorian' },
          key: { mode: 'fixed', value: 'D' },
        },
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

  it('falls back to a free roll when what was asked for cannot happen', () => {
    // Better than throwing part-way through a practice session.
    const nothingHeldYet = rollVariation({
      ...base,
      axes: ['direction'],
      policies: { direction: { mode: 'hold' } },
    });
    expect(nothingHeldYet.axes.direction!.source).toBe('roll');

    // Changing instrument can invalidate a string set that was being held.
    const staleHold = rollVariation({
      ...base,
      instrument: SEVEN_STRING_GUITAR,
      axes: ['stringSet'],
      policies: { stringSet: { mode: 'hold' } },
      held: { stringSet: 'no-such-set' },
    });
    expect(staleHold.axes.stringSet!.source).toBe('roll');

    const emptySubset = rollVariation({
      ...base,
      axes: ['neckPosition'],
      policies: { neckPosition: { mode: 'roll', from: ['999'] } },
    });
    expect(emptySubset.axes.neckPosition).toBeDefined();
  });

  it('rolls instead when a fixed value can’t be used', () => {
    // An unknown value, or a mode the rolled scale doesn't have.
    const unknown = rollVariation({
      ...base,
      axes: ['mode'],
      policies: { mode: { mode: 'fixed', value: 'lydianish' } },
    });
    expect(unknown.axes.mode?.source).toBe('roll');
    const pentatonic = rollVariation({
      ...base,
      axes: ['scale', 'mode', 'key'],
      policies: {
        scale: { mode: 'fixed', value: 'minor-pentatonic' },
        mode: { mode: 'fixed', value: 'dorian' },
      },
    });
    expect(pentatonic.axes.mode?.key).toBe('minor-pentatonic');
  });
});

describe('the scale axis', () => {
  const SESSION: AxisId[] = ['scale', 'mode', 'key', 'targetScaleDegree'];

  it('is Fixed Major unless the player says otherwise', () => {
    const rolled = rollVariation({ ...base, axes: SESSION });
    expect(rolled.axes.scale?.key).toBe('major');
    expect(variationKeyMode(rolled)?.scale).toBe('major');
  });

  it('rolls before the mode, which then comes from the scale, spelled for it', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const rolled = rollVariation({
        ...base,
        seed,
        axes: SESSION,
        policies: { scale: { mode: 'roll', from: ['blues', 'harmonic-minor'] } },
      });
      const km = variationKeyMode(rolled)!;
      if (km.scale === 'blues') {
        expect(km.mode).toBe('blues');
        // Blues lands on its own degrees, never its 2, 6 or passing ♭5.
        expect(['1', '3', '4', '5', '7']).toContain(rolled.axes.targetScaleDegree?.key);
      } else {
        expect(km).toMatchObject({ scale: 'harmonic-minor', mode: 'harmonic-minor' });
        // Spelled A♭, not G♯, which would need an F𝄪.
        expect(km.tonic).not.toBe('G#');
      }
    }
  });

  it('never rolls a struck-out scale, but plays one pinned', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const rolled = rollVariation({
        ...base,
        seed,
        axes: SESSION,
        policies: { scale: { mode: 'roll' } },
        blocked: { scale: ['harmonic-minor', 'melodic-minor', 'blues'] },
      });
      expect(['major', 'minor-pentatonic', 'major-pentatonic', 'phrygian-dominant']).toContain(
        rolled.axes.scale?.key,
      );
    }
    // Fixed still plays it.
    const fixed = rollVariation({
      ...base,
      axes: SESSION,
      policies: { scale: { mode: 'fixed', value: 'melodic-minor' } },
      blocked: { scale: ['melodic-minor'] },
    });
    expect(fixed.axes.scale?.key).toBe('melodic-minor');
  });

  it('offers a box scale only the interval patterns that fit in a box', () => {
    const roll = (scale: string, seed: number) =>
      rollVariation({
        ...base,
        seed,
        axes: ['scale', 'mode', 'key', 'intervalPattern'],
        policies: {
          scale: { mode: 'fixed', value: scale },
          // A 6th on five notes is an octave, so the pin gives way.
          intervalPattern: { mode: 'fixed', value: '6ths' },
        },
      }).axes.intervalPattern!;
    expect(roll('major', 1).key).toBe('6ths');
    for (let seed = 0; seed < 40; seed += 1) {
      const pattern = roll('blues', seed);
      expect(pattern.source).toBe('roll');
      expect(['3rds', '4ths', 'groups-of-3', 'groups-of-4']).toContain(pattern.key);
    }
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
      const key = rollVariation({ ...base, seed, axes: ['direction'], coverage }).axes
        .direction!.key;
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
      const key = rollVariation({ ...base, seed, axes: ['direction'], coverage }).axes
        .direction!.key;
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
        policies: {
          mode: { mode: 'fixed', value: 'dorian' },
          key: { mode: 'fixed', value: 'D' },
        },
      });
      const key = rolled.axes.targetScaleDegree!.key;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const sixth = counts.get('6') ?? 0;
    const others = [...counts.entries()].filter(([k]) => k !== '6').map(([, v]) => v);
    expect(sixth).toBeGreaterThan(Math.max(...others));
  });

  it('rarely asks you to land on the root', () => {
    // "Land each shape on the 1st" asks for nothing — you would end there
    // anyway. It stays possible, just uncommon.
    const counts = new Map<string, number>();
    for (let seed = 0; seed < 600; seed += 1) {
      const rolled = rollVariation({
        ...base,
        seed,
        axes: ['mode', 'key', 'targetScaleDegree'],
        policies: {
          mode: { mode: 'fixed', value: 'dorian' },
          key: { mode: 'fixed', value: 'D' },
        },
      });
      const key = rolled.axes.targetScaleDegree!.key;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const root = counts.get('1') ?? 0;
    const typical = counts.get('4') ?? 0;
    expect(root).toBeGreaterThan(0);
    expect(root).toBeLessThan(typical);
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
      policies: {
        mode: { mode: 'fixed', value: 'dorian' },
        key: { mode: 'fixed', value: 'D' },
      },
    });
    expect(variationKeyMode(rolled)).toEqual({
      tonic: 'D',
      scale: 'major' as const,
      mode: 'dorian',
    });
  });

  it('falls back to the session key when the exercise does not roll one', () => {
    const rolled = rollVariation({ ...base, axes: ['neckPosition'] });
    const fallback = {
      tonic: pitchClass('G'),
      scale: 'major' as const,
      mode: 'mixolydian' as const,
    };
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
      const rolled = rollVariation({
        ...base,
        seed,
        instrument: short,
        axes: ['neckPosition'],
      });
      const position = rolled.axes.neckPosition!.value as { fret: number; span: number };
      expect(position.fret + position.span).toBeLessThanOrEqual(12);
    }
  });
});

describe('display', () => {
  it('formats values for the brief, ordinalising positions', () => {
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

describe('every axis', () => {
  it('rebuilds each candidate from its key', () => {
    // A fixed or held policy stores only the key; if parse cannot rebuild the
    // value, pinning that axis silently falls back to rolling.
    const context = { instrument: STANDARD_GUITAR, resolved: {} };
    for (const axis of allAxisDefinitions()) {
      for (const candidate of axis.candidates(context)) {
        const key = axis.key(candidate);
        const parsed = axis.parse(key, context);
        expect(parsed, `${axis.id} ${key}`).not.toBeNull();
        expect(axis.key(parsed), `${axis.id} ${key}`).toBe(key);
      }
    }
  });
});

describe('toggleSubset', () => {
  const all = ['a', 'b', 'c'];

  it('toggles values in and out, in candidate order, never emptying the set', () => {
    expect(toggleSubset(all, undefined, 'b')).toEqual({ mode: 'roll', from: ['a', 'c'] });
    // Clicked back in any order, the subset stays in candidate order.
    expect(toggleSubset(all, ['c'], 'a')).toEqual({ mode: 'roll', from: ['a', 'c'] });
    // Stored as no subset rather than a full one, so a candidate added later is included.
    expect(toggleSubset(all, ['a', 'c'], 'b')).toEqual({ mode: 'roll' });
    expect(toggleSubset(all, ['b'], 'b')).toEqual({ mode: 'roll', from: ['b'] });
  });
});

describe('axis defaults, allowed values and blocked values', () => {
  const keysOver = (
    options: Partial<Parameters<typeof rollVariation>[0]>,
    axes: AxisId[] = ['mode', 'key'],
  ) => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed += 1) {
      const rolled = rollVariation({ ...base, seed, axes, ...options });
      seen.add(
        `${rolled.axes.key?.key ?? ''} ${rolled.axes.mode?.key ?? ''} ${rolled.axes.stringSet?.key ?? ''}`.trim(),
      );
    }
    return seen;
  };

  it('plays every string unless told otherwise', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const rolled = rollVariation({ ...base, seed, axes: ['stringSet'] });
      expect(rolled.axes.stringSet!.key).toBe('all');
      expect(rolled.axes.stringSet!.source).toBe('fixed');
    }
  });

  it('still rolls string sets when asked to', () => {
    expect(
      keysOver({ policies: { stringSet: { mode: 'roll' } } }, ['stringSet']).size,
    ).toBeGreaterThan(3);
  });

  it('never leaves what the exercise allows, even when pinned outside it', () => {
    const allowed = { stringSet: ['adj-3-3', 'adj-3-2'] };
    expect(
      keysOver({ allowed, policies: { stringSet: { mode: 'roll' } } }, ['stringSet']),
    ).toEqual(new Set(['adj-3-3', 'adj-3-2']));
    // The axis default (all strings) is outside it, and so is a stale pin.
    expect(keysOver({ allowed }, ['stringSet'])).toEqual(new Set(['adj-3-3', 'adj-3-2']));
    const pinned = rollVariation({
      ...base,
      axes: ['stringSet'],
      allowed,
      policies: { stringSet: { mode: 'fixed', value: 'all' } },
    });
    expect(allowed.stringSet).toContain(pinned.axes.stringSet!.key);
    const inside = rollVariation({
      ...base,
      axes: ['stringSet'],
      allowed,
      policies: { stringSet: { mode: 'fixed', value: 'adj-3-2' } },
    });
    expect(inside.axes.stringSet!.key).toBe('adj-3-2');
  });

  it('never rolls a blocked mode or key', () => {
    const seen = keysOver({ blocked: { mode: ['locrian', 'phrygian'], key: ['Db', 'F#'] } });
    for (const entry of seen) {
      const [key, mode] = entry.split(' ');
      expect(['locrian', 'phrygian']).not.toContain(mode);
      // By pitch: blocking Db blocks C# too, and F# blocks Gb.
      expect(['Db', 'C#', 'F#', 'Gb']).not.toContain(key);
    }
    expect(seen.size).toBeGreaterThan(20);
  });

  it('plays a blocked key that is pinned or held on purpose', () => {
    const blocked = { key: ['Eb'] };
    const pinned = rollVariation({
      ...base,
      axes: ['mode', 'key'],
      blocked,
      policies: {
        mode: { mode: 'fixed', value: 'ionian' },
        key: { mode: 'fixed', value: 'Eb' },
      },
    });
    expect(pinned.axes.key!.key).toBe('Eb');
    const held = rollVariation({
      ...base,
      axes: ['key'],
      blocked,
      policies: { key: { mode: 'hold' } },
      held: { key: 'Eb' },
    });
    expect(held.axes.key!.key).toBe('Eb');
  });

  it('lets a subset beat the blocked list when nothing else is left in it', () => {
    const seen = keysOver({
      blocked: { key: ['C', 'G'] },
      policies: {
        mode: { mode: 'fixed', value: 'ionian' },
        key: { mode: 'roll', from: ['C', 'G', 'D'] },
      },
    });
    expect(seen).toEqual(new Set(['D ionian']));
    const only = keysOver({
      blocked: { key: ['C', 'G'] },
      policies: {
        mode: { mode: 'fixed', value: 'ionian' },
        key: { mode: 'roll', from: ['C', 'G'] },
      },
    });
    expect(only).toEqual(new Set(['C ionian', 'G ionian']));
  });

  it('matches a key subset by pitch, whatever the mode spells it as', () => {
    // The editor offers Db; phrygian spells that key C#.
    const seen = keysOver({
      policies: {
        mode: { mode: 'fixed', value: 'phrygian' },
        key: { mode: 'roll', from: ['Db', 'E'] },
      },
    });
    expect(seen).toEqual(new Set(['C# phrygian', 'E phrygian']));
  });

  it('rolls from everything rather than nothing when every value is blocked', () => {
    const everything = Array.from(
      { length: 12 },
      (_, i) => ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][i]!,
    );
    expect(keysOver({ blocked: { key: everything } }).size).toBeGreaterThan(20);
  });
});
