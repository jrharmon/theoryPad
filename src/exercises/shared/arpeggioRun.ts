import type { Degree, DegreeNumber, KeyMode, ScaleId } from '@/domain/music';
import { makeDegree, scaleDegrees } from '@/domain/music';
import type { ScaleNotePosition } from '@/domain/instrument';

/** The scale degrees of a seven-note scale's chord built on `root`: 1 → 1 3 5 7. */
export function chordDegrees(root: DegreeNumber, tones: 3 | 4 = 4): DegreeNumber[] {
  return Array.from(
    { length: tones },
    (_, k) => (((root - 1 + 2 * k) % 7) + 1) as DegreeNumber,
  );
}

/** The minor pentatonic's tonic chord, which blues shares. */
const MINOR_SEVENTH = {
  symbol: 'm7',
  degrees: [makeDegree(1, 0), makeDegree(3, -1), makeDegree(5, 0), makeDegree(7, -1)],
};

/** A box scale's own tonic chord: the four of its notes that make one. */
const BOX_CHORDS: Partial<Record<ScaleId, { symbol: string; degrees: Degree[] }>> = {
  'minor-pentatonic': MINOR_SEVENTH,
  blues: MINOR_SEVENTH,
  'major-pentatonic': {
    symbol: '6',
    degrees: [makeDegree(1, 0), makeDegree(3, 0), makeDegree(5, 0), makeDegree(6, 0)],
  },
};

/**
 * The chord to arpeggiate in a shape starting on `startDegree`: in a seven-
 * note scale the 7th chord on that degree, so each 3nps shape brings its own;
 * in a box scale the scale's tonic chord in every box — a box starting on
 * step 2 is the same notes somewhere else, not another chord. `symbol` is the
 * box chord's suffix after the tonic ("m7", "6"); absent for a seven-note one.
 */
export function shapeChord(
  keyMode: KeyMode,
  startDegree: DegreeNumber,
): { degrees: Degree[]; symbol?: string } {
  const box = BOX_CHORDS[keyMode.scale];
  if (box) return box;
  const degrees = scaleDegrees(keyMode);
  return {
    degrees: chordDegrees(startDegree).map((n) => degrees.find((d) => d.number === n)!),
  };
}

/**
 * A chord's tones picked out of a shape, in the shape's order.
 *
 * Taking them from the shape rather than generating a separate arpeggio
 * fingering keeps the hand where it is: the arpeggio is the chord that lives
 * inside the box, which is what welds it to the scale. Tones match by full
 * degree, so blues' ♭5 is never taken for its 5.
 */
export function arpeggioRun(
  positions: readonly ScaleNotePosition[],
  chord: readonly Degree[],
): ScaleNotePosition[] {
  return positions.filter((p) =>
    chord.some((d) => d.number === p.degree.number && d.alteration === p.degree.alteration),
  );
}
