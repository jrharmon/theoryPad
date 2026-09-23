import { describe, expect, it } from 'vitest';
import { FOUR_FOUR, SIX_EIGHT, THREE_FOUR, ticksPerBar } from '@/domain/phrase';
import type { TimeSignature } from '@/domain/phrase';
import { drumPatterns, drumTab, METRONOME_GRID_TICKS, patternById, patternsFor } from '..';
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
  it('offer only Simple outside 4/4, and every beat in it', () => {
    expect(patternsFor(THREE_FOUR).map((p) => p.id)).toEqual(['simple']);
    expect(patternsFor(SIX_EIGHT).map((p) => p.id)).toEqual(['simple']);
    expect(patternsFor({ beats: 4, unit: 4 }).map((p) => p.id)).toEqual([
      'simple',
      'upbeat',
      'swing',
      'heavy',
    ]);
  });

  it('keep every hit on their grid, inside the bar, in tick order', () => {
    const signatures: TimeSignature[] = [FOUR_FOUR, THREE_FOUR, SIX_EIGHT];
    for (const pattern of drumPatterns()) {
      for (const ts of pattern.timeSignature ? [pattern.timeSignature] : signatures) {
        expect(pattern.gridTicks(ts) % METRONOME_GRID_TICKS, pattern.id).toBe(0);
        for (let barIndex = 0; barIndex < pattern.bars; barIndex++) {
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
});

describe('drum tab', () => {
  const tab = (body: string) =>
    drumTab({ id: 'test', name: 'Test', detail: '', signature: '4/4', tab: body });

  it('reads a line per drum, bars between bars, and each bar’s own grid', () => {
    // Bar 1 in eighths, bar 2 in eighth triplets.
    const beat = tab(`
      HH |x-x-x-x-|x--x--x--x--|
      SN |--X---g-|---X-----X-g|
      BD |x-------|X-----x-----|
    `);
    expect(beat.bars).toBe(2);
    expect(beat.timeSignature).toEqual(FOUR_FOUR);
    // The finest step any hit needs: the triplet snare at 1760 makes it 160.
    expect(beat.gridTicks(FOUR_FOUR)).toBe(160);
    expect(grid(beat.bar(FOUR_FOUR, 0))).toEqual([
      '0: hat-closed kick',
      '480: hat-closed snare',
      '960: hat-closed',
      '1440: hat-closed snare',
    ]);
    expect(grid(beat.bar(FOUR_FOUR, 1))).toEqual([
      '0: hat-closed kick',
      '480: hat-closed snare',
      '960: hat-closed kick',
      '1440: hat-closed snare',
      '1760: snare',
    ]);
    const velocity = (bar: number, sound: string, tick: number) =>
      beat.bar(FOUR_FOUR, bar).find((h) => h.sound === sound && h.tick === tick)?.velocity;
    expect(velocity(0, 'snare', 480)).toBe(1);
    expect(velocity(0, 'hat-closed', 0)).toBe(0.8);
    expect(velocity(0, 'snare', 1440)).toBe(0.35);
    // It loops, the count-in's negative bars included.
    expect(beat.bar(FOUR_FOUR, 2)).toEqual(beat.bar(FOUR_FOUR, 0));
    expect(beat.bar(FOUR_FOUR, -1)).toEqual(beat.bar(FOUR_FOUR, 1));
  });

  it('refuses a typo, naming the line', () => {
    expect(() => tab('XX |x-x-x-x-|')).toThrow(/unknown drum "XX"/);
    expect(() => tab('SN |x-o-x-x-|')).toThrow(/"o" in bar 1/);
    expect(() => tab('SN |x-x-x-x-|\nBD |x-------|x-------|')).toThrow(/2 bars/);
    expect(() => tab('SN |x-x-x-x-|\nBD |x------|')).toThrow(/bar 1 has 7 cells/);
    // Five to a bar isn't a grid the metronome runs.
    expect(() => tab('SN |x-x-x|')).toThrow(/metronome's grid/);
    expect(() => tab('SN x-x-x-x-')).toThrow(/line "SN x-x-x-x-"/);
  });
});
