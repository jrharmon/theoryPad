import { describe, expect, it } from 'vitest';
import { STANDARD_GUITAR } from '@/domain/instrument';
import {
  describeLocks,
  effectiveItem,
  overridesSession,
  visibleAxes,
  visibleParams,
} from '../locks';
import { exerciseDefinition } from '../registry';

const modes = exerciseDefinition('modes-through-key');

const exercise = {
  params: { variant: 'pause-on-root', minFret: 3 },
  axisPolicies: {
    rhythmPattern: { mode: 'roll' as const, from: ['eighth-triplets', 'straight-sixteenths'] },
    mode: { mode: 'fixed' as const, value: 'dorian' },
    direction: { mode: 'hold' as const },
  },
  heldAxisValues: { direction: 'ascending' },
  locked: {
    params: ['variant', 'shapesPerRep'],
    axes: ['rhythmPattern', 'direction'] as const,
  },
};

describe('effectiveItem', () => {
  it('reads locked settings through from the exercise and keeps the item’s own', () => {
    const item = {
      id: 'item',
      params: { variant: 'plain', shapesPerRep: 4, minFret: 5 },
      axisPolicies: {
        rhythmPattern: { mode: 'fixed' as const, value: 'gallop' },
        key: { mode: 'fixed' as const, value: 'G' },
      },
      heldAxisValues: { direction: 'descending', key: 'G' },
    };
    expect(
      effectiveItem(item, {
        ...exercise,
        locked: { ...exercise.locked, axes: ['rhythmPattern', 'direction'] },
      }),
    ).toEqual({
      id: 'item',
      // shapesPerRep is locked at the definition's default, so the item's goes.
      params: { variant: 'pause-on-root', minFret: 5 },
      axisPolicies: {
        rhythmPattern: exercise.axisPolicies.rhythmPattern,
        direction: { mode: 'hold' },
        key: { mode: 'fixed', value: 'G' },
      },
      heldAxisValues: { direction: 'ascending', key: 'G' },
    });
    // An item whose exercise is gone altogether plays as it is.
    expect(effectiveItem(item, undefined)).toBe(item);
  });
});

describe('what a settings form shows', () => {
  it('leaves the locked out', () => {
    const locks = { params: ['variant'], axes: ['rhythmPattern' as const] };
    expect(visibleParams(modes, locks)).not.toContain('variant');
    expect(visibleParams(modes, locks)).toContain('minFret');
    expect(visibleAxes(modes.axes, locks)).not.toContain('rhythmPattern');
    expect(visibleAxes(modes.axes, locks)).toContain('mode');
  });
});

describe('overridesSession', () => {
  it('is only a Fixed policy stored on the item, with scale and mode as a pair', () => {
    // Nothing stored is the routine's, though the Scale axis defaults to Fixed Major.
    expect(overridesSession('scale', {})).toBe(false);
    expect(overridesSession('key', { key: { mode: 'roll', from: ['A', 'E'] } })).toBe(false);
    expect(overridesSession('mode', { mode: { mode: 'hold' } })).toBe(false);
    expect(overridesSession('key', { key: { mode: 'fixed', value: 'A' } })).toBe(true);
    const lydian = { mode: { mode: 'fixed' as const, value: 'lydian' } };
    expect(overridesSession('mode', lydian)).toBe(true);
    expect(overridesSession('scale', lydian)).toBe(true);
    expect(overridesSession('key', lydian)).toBe(false);
    expect(overridesSession('direction', { direction: { mode: 'fixed', value: 'up' } })).toBe(
      false,
    );
  });
});

describe('describeLocks', () => {
  it('says what is locked in values, in the definition’s order', () => {
    expect(
      describeLocks(
        {
          ...exercise,
          locked: { params: ['variant', 'minFret'], axes: ['rhythmPattern', 'direction'] },
        },
        modes,
        STANDARD_GUITAR,
      ),
    ).toEqual([
      'Direction held',
      'Straight 16ths or Eighth triplets',
      'Pause on root',
      'Min fret: 3',
    ]);
    expect(
      describeLocks(
        { ...exercise, locked: { params: [], axes: ['mode', 'key'] } },
        modes,
        STANDARD_GUITAR,
      ),
    ).toEqual(['Dorian', 'Any key']);
    expect(
      describeLocks({ ...exercise, locked: { params: [], axes: [] } }, modes, STANDARD_GUITAR),
    ).toEqual([]);
  });
});
