import type { Phrase, TimeSignature } from '@/domain/phrase';
import { PPQ, requiredSubdivision, ticksPerBar, ticksPerBeat } from '@/domain/phrase';

/**
 * How tab breaks into lines.
 *
 * Real tab breaks into systems rather than running one long line off the page,
 * and generated exercise phrases get long. The limit is physical: a column
 * narrower than a two-digit fret and its slide mark makes 14 16 17 read as
 * 141617. So a line holds as many bars as fit the width actually available at
 * the current size — a wide screen, or a hidden neck diagram, simply gets more.
 *
 * Zoom scales the tab itself. Zooming in makes it bigger, so fewer bars fit;
 * zooming out fits more. Either way the numbers never touch.
 */

/** However wide the screen, a line longer than this stops being readable. */
export const MAX_BARS_PER_LINE = 8;

/** Zoom steps either side of the default size. */
export const ZOOM_MIN = -2;
export const ZOOM_MAX = 2;
const ZOOM_SCALES = [0.7, 0.85, 1, 1.2, 1.45];

export function zoomScale(zoom: number): number {
  const step = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(zoom)));
  return ZOOM_SCALES[step - ZOOM_MIN]!;
}

/** Narrowest a column can be before a two-digit fret with a slide mark touches its neighbor. */
export function minColumnWidth(fretSize: number): number {
  return fretSize * 1.7;
}

export function columnsPerBar(phrase: Phrase, subdivision?: number): number {
  const ticksPerColumn = PPQ / (subdivision ?? tabGrid(phrase));
  return ticksPerBar(phrase.timeSignature) / ticksPerColumn;
}

/**
 * Bars per line when the width is not known yet (first render, or a test
 * environment with no layout): about 24 columns, which is readable anywhere.
 */
export function fallbackBarsPerLine(columns: number): number {
  const fit = Math.floor(24 / Math.max(1, columns));
  return Math.min(4, Math.max(1, fit));
}

/** As many bars as fit `available` pixels at this fret size, and at least one. */
export function barsPerLine(
  columns: number,
  available: number | null,
  fretSize: number,
): number {
  if (!available || available <= 0) return fallbackBarsPerLine(columns);
  const fit = Math.floor(available / (Math.max(1, columns) * minColumnWidth(fretSize)));
  return Math.min(MAX_BARS_PER_LINE, Math.max(1, fit));
}

/**
 * The grid a phrase is drawn on: as fine as its notes need, and fine enough
 * that its beats fall on column edges. A 6/8 bar of dotted halves needs no
 * more than quarters for its notes, but its dotted-quarter beat needs eighths.
 */
export function tabGrid(phrase: Phrase): number {
  const needed = requiredSubdivision(phrase);
  const beat = beatTicks(phrase.timeSignature);
  return beat % (PPQ / needed) === 0 ? needed : needed * 2;
}

/**
 * The beat the tab marks: the signature's unit, except in compound time
 * (6/8, 9/8, 12/8), where eighths are felt in threes.
 */
export function beatTicks(timeSignature: TimeSignature): number {
  const beat = ticksPerBeat(timeSignature);
  const compound =
    timeSignature.unit === 8 && timeSignature.beats % 3 === 0 && timeSignature.beats > 3;
  return compound ? beat * 3 : beat;
}
