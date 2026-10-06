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
import { z } from 'zod';
import { QUARTER, rhythmTotalTicks } from '@/domain/phrase';
import type { RhythmPattern } from '@/domain/phrase';
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
 * `repeatTurn` plays the turning note of `up-down` and `down-up` twice — up to
 * the 7th and straight back down from it, the turn a change of picking
 * direction on the same note. Without it the way back starts on the next note
 * down. `turnRepeats` decides which.
 */
export function applyDirection<T>(items: T[], direction: Direction, repeatTurn = true): T[] {
  const reversed = [...items].reverse();
  // A single note is not a turn, so it is not doubled.
  const back = (way: T[]) => (repeatTurn || items.length <= 1 ? way : way.slice(1));
  switch (direction) {
    case 'ascending':
      return [...items];
    case 'descending':
      return reversed;
    case 'up-down':
      return items.length <= 1 ? [...items] : [...items, ...back(reversed)];
    case 'down-up':
      return items.length <= 1 ? [...items] : [...reversed, ...back(items)];
  }
}

/** Whether a run that turns plays its turning note twice. */
export const TURNAROUNDS = ['auto', 'repeat-note', 'no-repeat'] as const;
export type Turnaround = (typeof TURNAROUNDS)[number];

/** The setting, for an exercise whose runs can turn. */
export const turnaroundParam = z
  .enum(TURNAROUNDS)
  .default('auto')
  .describe(
    'Whether a run that turns plays the turning note twice. Auto repeats it when that starts the way back on the beat.',
  );

/** Whether `notes` notes of `rhythm` end on a beat, with the pattern back at its start. */
function endsOnBeat(rhythm: RhythmPattern, notes: number): boolean {
  return (
    notes % rhythm.durations.length === 0 && rhythmTotalTicks(rhythm, notes) % QUARTER === 0
  );
}

/**
 * Whether a run turning after `legLength` notes plays the turning note twice.
 *
 * Auto repeats it only when that puts the way back on the beat and not
 * repeating would not: 3nps triplets are 18 notes up, so the repeat starts the
 * way down on a downbeat with a string to every beat. 18 sixteenths end
 * mid-beat either way, so the repeat would only be a stutter. Quarters land
 * on the beat either way, so it would be one too. Decided from the length
 * alone, never from where the turn falls in the bar, so every turn of a run
 * does the same thing.
 */
export function turnRepeats(
  turnaround: Turnaround,
  legLength: number,
  rhythm: RhythmPattern,
): boolean {
  if (turnaround !== 'auto') return turnaround === 'repeat-note';
  return endsOnBeat(rhythm, legLength) && !endsOnBeat(rhythm, legLength - 1);
}

/** Whether a direction turns, so its run is a loop that can start anywhere. */
export function turns(direction: Direction): boolean {
  return direction === 'up-down' || direction === 'down-up';
}

/**
 * Start a run on `string` (a model index; null leaves it alone), at its first
 * note there.
 *
 * A run that turns is a loop — up to the top, down to the bottom, back up —
 * so starting part-way shifts the cycle and keeps every note: up then down
 * from the 4th string plays strings 4 3 2 1 2 3 4 5 6 5. A run one way only
 * has nowhere to come back from, so it just starts later and plays fewer
 * strings.
 *
 * A loop that does not repeat its turns ends where it began, and shifted, that
 * closing note would be a repeat at the turn it now lands in, so it is dropped.
 */
export function startOnString<T extends { string: number }>(
  run: readonly T[],
  string: number | null,
  loops: boolean,
  repeatTurn = true,
): T[] {
  const at = string === null ? -1 : run.findIndex((p) => p.string === string);
  if (at <= 0) return [...run];
  if (!loops) return run.slice(at);
  const cycle = repeatTurn ? run : run.slice(0, -1);
  return [...cycle.slice(at), ...cycle.slice(0, at)];
}

/**
 * The strings a run covers when it is limited to `count` of them: from the
 * start string (null: the outer string it sets off from — the lowest going
 * up, the highest coming down), on in the direction it first travels. Model
 * indices, `first` where it starts. Clipped at the edge of the neck, so a run
 * may get fewer strings than asked, but it always starts where it was told.
 * Null for every string.
 */
export function stringWindow(options: {
  strings: number;
  start: number | null;
  count: number | null;
  firstUp: boolean;
}): { first: number; last: number } | null {
  const { strings, start, count, firstUp } = options;
  if (count === null || count >= strings) return null;
  const first = start ?? (firstUp ? 0 : strings - 1);
  const last = firstUp
    ? Math.min(strings - 1, first + count - 1)
    : Math.max(0, first - count + 1);
  return { first, last };
}

/** The notes of a shape on the strings of a window, in their order. */
export function onStrings<T extends { string: number }>(
  positions: readonly T[],
  window: { first: number; last: number } | null,
): T[] {
  if (!window) return [...positions];
  const low = Math.min(window.first, window.last);
  const high = Math.max(window.first, window.last);
  return positions.filter((p) => p.string >= low && p.string <= high);
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
