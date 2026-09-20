import { describe, expect, it } from 'vitest';
import { EIGHTH, SIXTEENTH, phraseBuilder } from '@/domain/phrase';
import {
  MAX_BARS_PER_LINE,
  ZOOM_MAX,
  ZOOM_MIN,
  barsPerLine,
  columnsPerBar,
  fallbackBarsPerLine,
  minColumnWidth,
  zoomScale,
} from '../tabLayout';

const p = (fret: number) => ({ string: 0, fret });
const eighths = phraseBuilder()
  .rhythm(EIGHTH)
  .sequence(Array.from({ length: 16 }, (_, i) => p(i)))
  .build();
const sixteenths = phraseBuilder()
  .rhythm(SIXTEENTH)
  .sequence(Array.from({ length: 16 }, (_, i) => p(i)))
  .build();

describe('tab layout', () => {
  it('fits as many bars as the width allows without columns getting too narrow', () => {
    const columns = columnsPerBar(sixteenths);
    const bar = columns * minColumnWidth(19);
    expect(barsPerLine(columns, bar * 2.5, 19)).toBe(2);
    expect(barsPerLine(columns, bar * 0.5, 19)).toBe(1);
  });

  it('fits more when the tab is smaller, fewer when it is bigger', () => {
    const columns = columnsPerBar(eighths);
    const width = 1000;
    const small = barsPerLine(columns, width, 19 * zoomScale(ZOOM_MIN));
    const normal = barsPerLine(columns, width, 19);
    const big = barsPerLine(columns, width, 19 * zoomScale(ZOOM_MAX));
    expect(small).toBeGreaterThan(normal);
    expect(big).toBeLessThan(normal);
  });

  it('never puts more than a readable number of bars on a line', () => {
    expect(barsPerLine(columnsPerBar(eighths), 100_000, 19)).toBe(MAX_BARS_PER_LINE);
  });

  it('falls back to about 24 columns before the width is known', () => {
    expect(barsPerLine(columnsPerBar(eighths), null, 19)).toBe(fallbackBarsPerLine(8));
    expect(fallbackBarsPerLine(8)).toBe(3);
    // Two bars of sixteenths is 32 columns, where two-digit frets run together.
    expect(fallbackBarsPerLine(16)).toBe(1);
  });

  it('clamps zoom to its steps', () => {
    expect(zoomScale(0)).toBe(1);
    expect(zoomScale(99)).toBe(zoomScale(ZOOM_MAX));
    expect(zoomScale(-99)).toBe(zoomScale(ZOOM_MIN));
  });
});
