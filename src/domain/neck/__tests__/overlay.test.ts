import { describe, expect, it } from 'vitest';
import { makeDegree, pitchClass } from '@/domain/music';
import { STANDARD_GUITAR, boxShape } from '@/domain/instrument';
import type { NeckOverlay } from '../overlay';
import {
  openingFretWindow,
  overlayFretRange,
  overlayFromScalePositions,
  stepFretWindow,
} from '../overlay';

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

describe('the neck window', () => {
  // Two shapes, frets 2–5 and 12–15, as "Modes up the neck" lays them out.
  const twoShapes = at(2, 3, 5, 12, 14, 15);
  const range = overlayFretRange(twoShapes, NECK);

  it('opens on the shape the phrase starts in, a fret of room below it', () => {
    expect(openingFretWindow(twoShapes, range, 2)).toEqual({ low: 1, high: 7 });
    // Starting at the top of the higher shape, as a descending run does.
    expect(openingFretWindow(twoShapes, range, 15)).toEqual({ low: 10, high: 16 });
  });

  it('shows the whole range when it already fits', () => {
    const one = at(5, 7, 8);
    expect(openingFretWindow(one, overlayFretRange(one, NECK), 5)).toEqual({ low: 4, high: 9 });
  });

  it('steps less than its width, and stops at the ends of the notes', () => {
    const start = { low: 1, high: 7 };
    expect(stepFretWindow(start, range, 1)).toEqual({ low: 6, high: 12 });
    expect(stepFretWindow({ low: 6, high: 12 }, range, 1)).toEqual({ low: 10, high: 16 });
    expect(stepFretWindow(start, range, -1)).toEqual(start);
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
