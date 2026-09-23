import { describe, expect, it } from 'vitest';
import { FOUR_FOUR, SIX_EIGHT, THREE_FOUR, ticksPerBar } from '@/domain/phrase';
import type { TimeSignature } from '@/domain/phrase';
import { drumPatterns, patternById, patternsFor } from '..';
import type { DrumHit } from '..';

const simple = patternById('simple')!;

/** Each tick's sounds, e.g. `0: kick ride`. */
function grid(hits: DrumHit[]): string[] {
  const at = new Map<number, string[]>();
  for (const h of hits) at.set(h.tick, [...(at.get(h.tick) ?? []), h.sound]);
  return [...at].map(([tick, sounds]) => `${tick}: ${sounds.sort().join(' ')}`);
}

describe('Simple', () => {
  it('in 4/4: ride on the eighths, kick on every beat, snare on 2 and 4, a louder downbeat', () => {
    const bar = simple.bar(FOUR_FOUR, 0);
    expect(grid(bar)).toEqual([
      '0: kick ride',
      '240: ride',
      '480: kick ride snare',
      '720: ride',
      '960: kick ride',
      '1200: ride',
      '1440: kick ride snare',
      '1680: ride',
    ]);
    expect(simple.gridTicks(FOUR_FOUR)).toBe(240);
    const kicks = bar.filter((h) => h.sound === 'kick').map((h) => h.velocity);
    expect(kicks[0]).toBeGreaterThan(Math.max(...kicks.slice(1)));
    // Nothing carries across the bar line: every bar is the same.
    expect(simple.bar(FOUR_FOUR, 7)).toEqual(bar);
  });

  it('in 3/4: the snare on 2 only', () => {
    expect(grid(simple.bar(THREE_FOUR, 0))).toEqual([
      '0: kick ride',
      '240: ride',
      '480: kick ride snare',
      '720: ride',
      '960: kick ride',
      '1200: ride',
    ]);
  });

  it('in 6/8: the ride on the beat, not on sixteenths; the snare on 2, 4 and 6', () => {
    expect(simple.gridTicks(SIX_EIGHT)).toBe(240);
    expect(grid(simple.bar(SIX_EIGHT, 0))).toEqual([
      '0: kick ride',
      '240: kick ride snare',
      '480: kick ride',
      '720: kick ride snare',
      '960: kick ride',
      '1200: kick ride snare',
    ]);
  });
});

describe('the patterns', () => {
  it('offer only Simple outside 4/4, and all four in it', () => {
    expect(patternsFor(THREE_FOUR).map((p) => p.id)).toEqual(['simple']);
    expect(patternsFor(SIX_EIGHT).map((p) => p.id)).toEqual(['simple']);
    expect(patternsFor({ beats: 4, unit: 4 }).map((p) => p.id)).toEqual([
      'simple',
      'upbeat',
      'soft',
      'heavy',
    ]);
  });

  it('keep every hit on their grid, inside the bar, in tick order', () => {
    const signatures: TimeSignature[] = [FOUR_FOUR, THREE_FOUR, SIX_EIGHT];
    for (const pattern of drumPatterns()) {
      for (const ts of pattern.timeSignature ? [pattern.timeSignature] : signatures) {
        for (const barIndex of [0, 1, 2, 3]) {
          const hits = pattern.bar(ts, barIndex);
          const ticks = hits.map((h) => h.tick);
          expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
          for (const h of hits) {
            expect(h.tick % pattern.gridTicks(ts), `${pattern.id} ${h.sound}`).toBe(0);
            expect(h.tick).toBeLessThan(ticksPerBar(ts));
            expect(h.velocity).toBeGreaterThan(0);
            expect(h.velocity).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it('crash Heavy on the downbeat of bar 1 of every four, in place of the hat', () => {
    const heavy = patternById('heavy')!;
    const crashes = [0, 1, 2, 3, 4, 5, 6, 7].map((bar) =>
      heavy.bar(FOUR_FOUR, bar).some((h) => h.sound === 'crash'),
    );
    expect(crashes).toEqual([true, false, false, false, true, false, false, false]);
    expect(grid(heavy.bar(FOUR_FOUR, 0))[0]).toBe('0: crash kick');
    expect(grid(heavy.bar(FOUR_FOUR, 1))[0]).toBe('0: hat-closed kick');
  });
});
