import type { Bar, Phrase, TabNote, TimeSignature } from '@/domain/phrase';
import { PPQ, ticksPerBar, ticksPerBeat } from '@/domain/phrase';

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
 *
 * Each bar has its own grid, as fine as its own notes need: one bar of
 * sextuplets doesn't spread every other bar out to match. A bar's width is
 * its column count, so a busy bar is wider than a quiet one.
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

/** One bar as drawn: its own grid, and where it sits in the phrase's columns. */
export interface BarLayout {
  bar: Bar;
  startTick: number;
  endTick: number;
  ticksPerColumn: number;
  columns: number;
  /** The column it starts on, counted across the whole phrase. */
  firstColumn: number;
  /** Columns to a beat, for the beat lines. */
  columnsPerBeat: number;
}

const SUBDIVISIONS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32];

/**
 * The finest subdivision these notes need, as a divisor of a quarter note. A
 * grace note takes no column of its own, so it never asks for a finer grid.
 */
function needed(notes: readonly TabNote[], from: number): number {
  for (const div of SUBDIVISIONS) {
    const step = PPQ / div;
    if (!Number.isInteger(step)) continue;
    if (notes.every((n) => n.grace !== undefined || (n.startTick - from) % step === 0))
      return div;
  }
  return 32;
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

/**
 * A grid fine enough for the notes, with the beats on column edges: a 6/8 bar
 * of dotted halves needs no more than quarters for its notes, but its
 * dotted-quarter beat needs eighths.
 */
function onBeats(subdivision: number, timeSignature: TimeSignature): number {
  return beatTicks(timeSignature) % (PPQ / subdivision) === 0 ? subdivision : subdivision * 2;
}

/**
 * Every bar's grid and columns. `subdivision` fixes one grid for all of them.
 * A phrase that is all quarter notes keeps a column a beat; once any bar
 * needs more, no bar goes below eighths, so a bar of quarters isn't squeezed
 * to a sliver beside a bar of sixteenths.
 */
export function layOutBars(phrase: Phrase, subdivision?: number): BarLayout[] {
  const spans = phrase.bars.map((bar, i) => {
    const endTick =
      phrase.bars[i + 1]?.startTick ?? bar.startTick + ticksPerBar(bar.timeSignature);
    const notes = phrase.notes.filter(
      (n) => n.startTick >= bar.startTick && n.startTick < endTick,
    );
    return { bar, endTick, need: needed(notes, bar.startTick) };
  });
  const floor = spans.some((s) => s.need > 1) ? 2 : 1;

  let firstColumn = 0;
  return spans.map(({ bar, endTick, need }) => {
    const grid = subdivision ?? onBeats(Math.max(need, floor), bar.timeSignature);
    const ticksPerColumn = PPQ / grid;
    const columns = Math.max(1, Math.round((endTick - bar.startTick) / ticksPerColumn));
    const layout = {
      bar,
      startTick: bar.startTick,
      endTick,
      ticksPerColumn,
      columns,
      firstColumn,
      columnsPerBeat: beatTicks(bar.timeSignature) / ticksPerColumn,
    };
    firstColumn += columns;
    return layout;
  });
}

/**
 * The column a tick falls in, counted across the phrase. A tick on a bar line
 * is the next bar's first column; one at the very end is one past the last.
 */
export function columnAt(bars: readonly BarLayout[], tick: number): number {
  const bar = bars.findLast((b) => b.startTick <= tick) ?? bars[0];
  if (!bar) return 0;
  if (tick >= bar.endTick) return bar.firstColumn + bar.columns;
  return bar.firstColumn + Math.floor((tick - bar.startTick) / bar.ticksPerColumn);
}

/** Where a column starts, in ticks: the inverse of `columnAt`, for a click on an empty cell. */
export function tickAtColumn(bars: readonly BarLayout[], column: number): number {
  const bar = bars.findLast((b) => b.firstColumn <= column) ?? bars[0];
  if (!bar) return 0;
  return bar.startTick + (column - bar.firstColumn) * bar.ticksPerColumn;
}

/** Columns a line holds before the width is known (first render, or a test with no layout). */
export const FALLBACK_LINE_COLUMNS = 24;

/** Most bars a line holds before the width is known. */
const FALLBACK_MAX_BARS = 4;

/**
 * Bars into lines: as many as fit `available` pixels at this fret size, never
 * more than `MAX_BARS_PER_LINE`, and at least one bar a line however wide it
 * is. Returns how many bars each line holds.
 */
export function packLines(
  barColumns: readonly number[],
  available: number | null,
  fretSize: number,
): number[] {
  const known = available !== null && available > 0;
  const capacity = known
    ? Math.floor(available / minColumnWidth(fretSize))
    : FALLBACK_LINE_COLUMNS;
  const maxBars = known ? MAX_BARS_PER_LINE : FALLBACK_MAX_BARS;

  const lines: number[] = [];
  let bars = 0;
  let columns = 0;
  for (const width of barColumns) {
    if (bars > 0 && (columns + width > capacity || bars >= maxBars)) {
      lines.push(bars);
      bars = 0;
      columns = 0;
    }
    bars += 1;
    columns += width;
  }
  if (bars > 0) lines.push(bars);
  return lines;
}
