import { describe, expect, it } from 'vitest';
import type { TabNote } from '@/domain/phrase';
import { EIGHTH, QUARTER, SIXTEENTH, phraseBuilder } from '@/domain/phrase';
import {
  FALLBACK_LINE_COLUMNS,
  MAX_BARS_PER_LINE,
  ZOOM_MAX,
  ZOOM_MIN,
  columnAt,
  layOutBars,
  minColumnWidth,
  packLines,
  zoomScale,
} from '../tabLayout';

const p = (fret: number) => ({ string: 0, fret });
const run = (ticks: number, count: number) =>
  phraseBuilder()
    .rhythm(ticks)
    .sequence(Array.from({ length: count }, (_, i) => p(i % 12)))
    .build();

describe('tab layout', () => {
  it('gives each bar the grid its own notes need', () => {
    // Bar 1 in quarters, bar 2 in sixteenths, bar 3 with a sextuplet.
    const phrase = phraseBuilder()
      .rhythm(QUARTER)
      .sequence([p(0), p(1), p(2), p(3)])
      .rhythm(SIXTEENTH)
      .sequence(Array.from({ length: 16 }, (_, i) => p(i)))
      .rhythm(80)
      .sequence(Array.from({ length: 6 }, (_, i) => p(i)))
      .build();
    const bars = layOutBars(phrase);
    // Once any bar needs more, none goes below eighths; the sextuplet's bar
    // alone is spread out to hold it.
    expect(bars.map((b) => b.columns)).toEqual([8, 16, 24]);
    expect(bars.map((b) => b.firstColumn)).toEqual([0, 8, 24]);
    expect(columnAt(bars, 4 * QUARTER + SIXTEENTH)).toBe(9);
    expect(columnAt(bars, 8 * QUARTER + 80)).toBe(25);
    // A phrase all in quarters keeps a column a beat; a fixed grid is the same everywhere.
    expect(layOutBars(run(QUARTER, 8)).map((b) => b.columns)).toEqual([4, 4]);
    expect(layOutBars(phrase, 4).map((b) => b.columns)).toEqual([16, 16, 16]);
  });

  it('puts a beat on a column edge, even in compound time', () => {
    const sixEight = phraseBuilder({ timeSignature: { beats: 6, unit: 8 } })
      .note(p(0), {}, 6 * EIGHTH)
      .build();
    const [bar] = layOutBars(sixEight);
    expect(bar!.columns).toBe(6);
    expect(bar!.columnsPerBeat).toBe(3);
  });

  it('ignores grace notes in choosing a grid', () => {
    const phrase = run(QUARTER, 4);
    const grace: TabNote = { ...p(5), startTick: 0, durationTicks: 30, grace: 'before-beat' };
    expect(layOutBars({ ...phrase, notes: [grace, ...phrase.notes] })[0]!.columns).toBe(4);
  });

  it('fits as many bars on a line as the width allows, at least one and at most eight', () => {
    const bar = 16 * minColumnWidth(19);
    expect(packLines([16, 16, 16, 16, 16], bar * 2.5, 19)).toEqual([2, 2, 1]);
    // A bar wider than the line still gets a line of its own.
    expect(packLines([48, 8], bar, 19)).toEqual([1, 1]);
    expect(packLines(Array(10).fill(8), 100_000, 19)).toEqual([MAX_BARS_PER_LINE, 2]);
  });

  it('fits more when the tab is smaller, fewer when it is bigger', () => {
    const bars = Array(12).fill(8);
    const lines = (fretSize: number) => packLines(bars, 1000, fretSize).length;
    expect(lines(19 * zoomScale(ZOOM_MIN))).toBeLessThan(lines(19));
    expect(lines(19 * zoomScale(ZOOM_MAX))).toBeGreaterThan(lines(19));
  });

  it('falls back to about 24 columns, and four bars, before the width is known', () => {
    expect(FALLBACK_LINE_COLUMNS).toBe(24);
    expect(packLines([8, 8, 8, 8], null, 19)).toEqual([3, 1]);
    expect(packLines([4, 4, 4, 4, 4, 4], null, 19)).toEqual([4, 2]);
    // Two bars of sixteenths is 32 columns, where two-digit frets run together.
    expect(packLines([16, 16], null, 19)).toEqual([1, 1]);
  });

  it('clamps zoom to its steps', () => {
    expect(zoomScale(0)).toBe(1);
    expect(zoomScale(99)).toBe(zoomScale(ZOOM_MAX));
    expect(zoomScale(-99)).toBe(zoomScale(ZOOM_MIN));
  });
});
