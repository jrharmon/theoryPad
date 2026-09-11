import { describe, expect, it } from 'vitest';
import { makeDegree } from '@/domain/music';
import { STANDARD_GUITAR } from '@/domain/instrument';
import type { NeckOverlay } from '../overlay';
import { overlayFretRange } from '../overlay';

const NECK = { ...STANDARD_GUITAR, fretCount: 22 };

const at = (...frets: number[]): NeckOverlay => ({
  notes: frets.map((fret, string) => ({
    position: { string, fret },
    degree: makeDegree(1, 0),
    role: 'none',
  })),
});

describe('overlayFretRange', () => {
  it('draws only the frets in use, with one either side', () => {
    expect(overlayFretRange(at(7, 9, 10), NECK)).toEqual({ low: 6, high: 11 });
  });

  it('keeps the nut when an open string is played', () => {
    expect(overlayFretRange(at(0, 2, 3), NECK)).toEqual({ low: 0, high: 4 });
  });

  it('never runs past the end of the neck', () => {
    expect(overlayFretRange(at(20, 22), NECK)).toEqual({ low: 19, high: 22 });
  });

  it('falls back to the first twelve frets when there is nothing to show', () => {
    expect(overlayFretRange({ notes: [] }, NECK)).toEqual({ low: 0, high: 12 });
  });
});
