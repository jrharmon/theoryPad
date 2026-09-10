import type { DegreeNumber, KeyMode } from '@/domain/music';
import type { Instrument, ScaleNotePosition } from '@/domain/instrument';
import { scaleShape, shapesUpTheNeck } from '@/domain/instrument';
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
 * `up-down` and `down-up` deliberately drop the repeated turning note, so a run
 * does not stutter on the note it changes direction at.
 */
export function applyDirection<T>(items: T[], direction: Direction): T[] {
  switch (direction) {
    case 'ascending':
      return [...items];
    case 'descending':
      return [...items].reverse();
    case 'up-down':
      return [...items, ...[...items].reverse().slice(1)];
    case 'down-up': {
      const down = [...items].reverse();
      return [...down, ...items.slice(1)];
    }
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
