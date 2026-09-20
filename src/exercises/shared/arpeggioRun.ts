import type { DegreeNumber } from '@/domain/music';
import type { ScaleNotePosition } from '@/domain/instrument';

/** The scale degrees of the diatonic chord built on `root`: 1 → 1 3 5 7. */
export function chordDegrees(root: DegreeNumber, tones: 3 | 4 = 4): DegreeNumber[] {
  return Array.from(
    { length: tones },
    (_, k) => (((root - 1 + 2 * k) % 7) + 1) as DegreeNumber,
  );
}

/**
 * A diatonic chord's tones picked out of a shape, in the shape's order.
 *
 * Taking them from the shape rather than generating a separate arpeggio
 * fingering keeps the hand where it is: the arpeggio is the chord that lives
 * inside the box, which is what welds it to the scale.
 */
export function arpeggioRun(
  positions: readonly ScaleNotePosition[],
  root: DegreeNumber,
  tones: 3 | 4 = 4,
): ScaleNotePosition[] {
  const wanted = new Set<number>(chordDegrees(root, tones));
  return positions.filter((p) => wanted.has(p.degree.number));
}
