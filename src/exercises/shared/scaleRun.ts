import type { DegreeNumber, KeyMode } from '@/domain/music';
import { chroma, playsInBoxes, scaleNotes } from '@/domain/music';
import type { Instrument, ScaleNotePosition } from '@/domain/instrument';
import {
  boxShape,
  lowestFret,
  pitchClassAt,
  scaleShape,
  shapesUpTheNeck,
} from '@/domain/instrument';
import type { Direction } from '@/domain/variation';

export interface ScaleRunOptions {
  instrument: Instrument;
  keyMode: KeyMode;
  direction: Direction;
  /** Where the shape sits. */
  minFret?: number;
  startDegree?: DegreeNumber;
  notesPerString?: number;
  strings?: number[];
}

/**
 * Turn a shape into a playable order.
 *
 * `up-down` and `down-up` play the turning note twice — up to the 7th and
 * straight back down from it. That is how the run is practised: the turn is a
 * change of picking direction on the same note, not a note to skip.
 */
export function applyDirection<T>(items: T[], direction: Direction): T[] {
  const reversed = [...items].reverse();
  switch (direction) {
    case 'ascending':
      return [...items];
    case 'descending':
      return reversed;
    // A single note is not a turn, so it is not doubled.
    case 'up-down':
      return items.length <= 1 ? [...items] : [...items, ...reversed];
    case 'down-up':
      return items.length <= 1 ? [...items] : [...reversed, ...items];
  }
}

/** A scale through one shape, in the given direction. */
export function scaleRun(options: ScaleRunOptions): ScaleNotePosition[] {
  const { instrument, keyMode, direction, minFret, startDegree, notesPerString, strings } =
    options;

  const shape = scaleShape(instrument, {
    keyMode,
    ...(minFret !== undefined ? { minFret } : {}),
    ...(startDegree !== undefined ? { startDegree } : {}),
    ...(notesPerString !== undefined ? { notesPerString } : {}),
    ...(strings !== undefined ? { strings } : {}),
  });

  return applyDirection(shape, direction);
}

export interface ShapeRun {
  startDegree: DegreeNumber;
  startFret: number;
  positions: ScaleNotePosition[];
}

/** Every shape of the key ascending the neck, each ordered by `direction`. */
export function shapeRuns(options: {
  instrument: Instrument;
  keyMode: KeyMode;
  direction: Direction;
  minFret?: number;
  count?: number;
  notesPerString?: number;
}): ShapeRun[] {
  const { instrument, keyMode, direction, minFret = 1, count, notesPerString } = options;

  return shapesUpTheNeck(instrument, keyMode, {
    minFret,
    ...(count !== undefined ? { count } : {}),
    ...(notesPerString !== undefined ? { notesPerString } : {}),
  }).map((shape) => ({
    startDegree: shape.startDegree,
    startFret: shape.startFret,
    positions: applyDirection(shape.positions, direction),
  }));
}

/** The first scale note at or above `fret` on the lowest string, and which degree it is. */
export function scaleNoteFrom(
  instrument: Instrument,
  keyMode: KeyMode,
  fret: number,
): { fret: number; degree: DegreeNumber } | null {
  const notes = scaleNotes(keyMode);
  for (let f = fret; f <= instrument.fretCount; f += 1) {
    const sounding = chroma(pitchClassAt(instrument, { string: 0, fret: f }));
    const index = notes.findIndex((n) => chroma(n) === sounding);
    if (index !== -1) return { fret: f, degree: (index + 1) as DegreeNumber };
  }
  return null;
}

/**
 * The shape a player means by "7th position": the one starting on whichever
 * scale note falls first at or above that fret on the lowest string — not the
 * root, which in C would put a 3rd-position shape at the 8th fret.
 *
 * Near the top of the neck the shape may not fit, so the start moves down
 * until it does; at the bottom a shape the hand cannot hold that low starts
 * higher instead. Either way, `startFret` is where it actually landed.
 *
 * A box scale takes its box by the same rule (`boxShape`), unless the caller
 * asks for its own notes per string.
 */
export function shapeFrom(options: {
  instrument: Instrument;
  keyMode: KeyMode;
  fret: number;
  notesPerString?: number | readonly number[];
}): ShapeRun | null {
  const { instrument, keyMode, fret } = options;
  if (playsInBoxes(keyMode.scale) && options.notesPerString === undefined) {
    return boxShape(instrument, keyMode, fret);
  }
  const { notesPerString = 3 } = options;
  const strings = instrument.tuning.length;
  const expected =
    typeof notesPerString === 'number'
      ? notesPerString * strings
      : notesPerString.reduce((sum, n) => sum + n, 0);

  for (let f = fret; f >= lowestFret(instrument); f -= 1) {
    const start = scaleNoteFrom(instrument, keyMode, f);
    if (!start) continue;
    const positions = scaleShape(instrument, {
      keyMode,
      startDegree: start.degree,
      minFret: start.fret,
      notesPerString,
    });
    if (positions.length === expected) {
      // A shape the hand cannot hold this low starts higher instead, so the
      // fret it landed on is the shape's own, not the one that was asked for.
      return { startDegree: start.degree, startFret: positions[0]!.fret, positions };
    }
  }
  return null;
}
