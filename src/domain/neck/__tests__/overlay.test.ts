import { describe, expect, it } from 'vitest';
import { makeDegree, pitchClass } from '@/domain/music';
import { STANDARD_GUITAR, boxShape } from '@/domain/instrument';
import type { NeckOverlay } from '../overlay';
import { overlayFretRange, overlayFromScalePositions } from '../overlay';

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

describe('overlayFromScalePositions', () => {
  it('marks the target by its full degree — blues’ ♭5, not its 5', () => {
    const blues = { tonic: pitchClass('A'), scale: 'blues' as const, mode: 'blues' as const };
    const { positions } = boxShape(STANDARD_GUITAR, blues, 5);
    const overlay = overlayFromScalePositions(positions, { targetDegree: makeDegree(5, -1) });
    const targets = overlay.notes.filter((n) => n.role === 'target').map((n) => n.degree.label);
    expect(targets).toEqual(['♭5', '♭5']);
  });
});
