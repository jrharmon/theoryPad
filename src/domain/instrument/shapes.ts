import type { DegreeNumber, KeyMode, PitchClass } from '@/domain/music';
import { chroma, degreeOf, scaleNotes } from '@/domain/music';
import type { FretPosition, Instrument, ScaleNotePosition } from './types';
import { lowestFret, noteAt, pitchClassAt, stringCount } from './fretboard';

/**
 * Scale shapes are GENERATED from the tuning, not stored as fret tables.
 *
 * A hard-coded 3nps table bakes in standard tuning — every offset shifts the
 * moment a string moves, and the B string already needs its own exception. A
 * generator has no such problem: drop D, DADGAD, a seven-string and a bass all
 * work, and the awkward major-third gap between G and B falls out of "find the
 * next scale note nearest the hand" rather than being a special case.
 *
 * Three notes per string is the default and what v1 ships. CAGED/positional
 * shapes are genuinely conventional fingerings rather than derivable, so they
 * arrive later as tables (milestone 8).
 */

export interface ScaleShapeOptions {
  keyMode: KeyMode;
  /** The scale degree the shape starts on. */
  startDegree?: DegreeNumber;
  /** Lowest fret the shape may use. */
  minFret?: number;
  /** Notes to place on each string. */
  notesPerString?: number;
  /** String indices to use, ascending. Defaults to the whole instrument. */
  strings?: number[];
}

/**
 * All frets on a string sounding a pitch class, ordered by distance from a
 * reference fret so the hand stays where it is.
 */
function fretsNear(
  instrument: Instrument,
  string: number,
  pc: PitchClass,
  reference: number,
  minFret: number,
): number[] {
  const target = chroma(pc);
  const frets: number[] = [];
  for (let fret = minFret; fret <= instrument.fretCount; fret += 1) {
    if (chroma(pitchClassAt(instrument, { string, fret })) === target) frets.push(fret);
  }
  return frets.sort((a, b) => Math.abs(a - reference) - Math.abs(b - reference) || a - b);
}

/**
 * A three-note-per-string shape (or `notesPerString` notes per string), walking
 * the scale upward across the strings.
 */
export function scaleShape(
  instrument: Instrument,
  options: ScaleShapeOptions,
): ScaleNotePosition[] {
  const {
    keyMode,
    startDegree = 1,
    minFret = lowestFret(instrument),
    notesPerString = 3,
    strings = Array.from({ length: stringCount(instrument) }, (_, i) => i),
  } = options;

  const notes = scaleNotes(keyMode);
  const rootChroma = chroma(keyMode.tonic);
  const out: ScaleNotePosition[] = [];

  let degreeIndex = startDegree - 1;
  // Where the hand sits; each new string aims to stay near the last one's start.
  let anchor = minFret;
  let isFirstString = true;

  for (const string of strings) {
    let previousFret: number | null = null;

    for (let n = 0; n < notesPerString; n += 1) {
      const pc = notes[degreeIndex % notes.length]!;

      // minFret positions the shape; it does not constrain every note. Once the
      // hand is anchored, a later string may legitimately want a lower fret —
      // forcing it above minFret sends the shape twelve frets up the neck
      // instead, which is how this first went wrong.
      const floor =
        previousFret !== null
          ? previousFret + 1
          : isFirstString
            ? minFret
            : lowestFret(instrument);
      const reference = previousFret === null ? anchor : previousFret;
      const candidates = fretsNear(instrument, string, pc, reference, floor);
      const fret = candidates[0];
      if (fret === undefined) {
        // The string cannot reach this note within the fret count; stop cleanly
        // rather than emitting an unplayable position.
        return out;
      }

      if (n === 0) {
        anchor = fret;
        isFirstString = false;
      }
      previousFret = fret;

      const position: FretPosition = { string, fret };
      const degree = degreeOf(keyMode, pc);
      if (!degree) throw new Error(`${pc} is not in ${keyMode.tonic} ${keyMode.mode}`);

      out.push({
        ...position,
        pitchClass: pc,
        note: noteAt(instrument, position),
        degree,
        isRoot: chroma(pc) === rootChroma,
      });

      degreeIndex += 1;
    }
  }

  return out;
}

/**
 * The seven 3nps shapes of a key, one per mode, each starting on its own degree
 * — the material the "seven modes through a key" exercise walks.
 *
 * The shapes are chained rather than generated independently: each starts above
 * the one before it, so together they tile the neck ascending. Generated
 * independently they would not, because a degree's first occurrence at or above
 * minFret can sit below the previous shape (in G major from fret 1, degree 7's
 * F# is at fret 2, well under degree 6's E at fret 12).
 */
export function allThreeNotePerStringShapes(
  instrument: Instrument,
  keyMode: KeyMode,
  minFret = 1,
): ScaleNotePosition[][] {
  const shapes: ScaleNotePosition[][] = [];
  let floor = minFret;

  for (let i = 0; i < 7; i += 1) {
    const shape = scaleShape(instrument, {
      keyMode,
      startDegree: (i + 1) as DegreeNumber,
      minFret: floor,
    });
    shapes.push(shape);
    const first = shape[0];
    if (first) floor = first.fret + 1;
  }

  return shapes;
}

/** The fret window a set of positions occupies. */
export function shapeSpan(positions: FretPosition[]): { low: number; high: number } | null {
  const fretted = positions.filter((p) => p.fret > 0);
  if (fretted.length === 0) return null;
  const frets = fretted.map((p) => p.fret);
  return { low: Math.min(...frets), high: Math.max(...frets) };
}
