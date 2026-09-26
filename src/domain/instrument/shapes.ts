import type { DegreeNumber, KeyMode, PitchClass, ShapeId } from '@/domain/music';
import {
  chroma,
  degreeOf,
  makeDegree,
  modesOf,
  noteAtDegree,
  scaleKind,
  scaleNotes,
  shapeNumber,
} from '@/domain/music';
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
 * Three notes per string is the default for seven-note scales. A pentatonic
 * box is the same generator at two notes a string (see `boxShape`), which is
 * all the five pentatonic shapes are: consecutive scale notes, two a string,
 * starting on the shape's step on the lowest string.
 */

export interface ScaleShapeOptions {
  keyMode: KeyMode;
  /**
   * The scale step the shape starts on, from 1 — the degree number in a
   * seven-note scale; in a pentatonic, step 2 is the ♭3 or the 2.
   */
  startDegree?: DegreeNumber;
  /** Lowest fret the shape may use. */
  minFret?: number;
  /**
   * Notes to place on each string: one count for every string, or one per
   * entry in `strings`. Four on a string where the rest have three is a
   * position shift — the extra note carries the hand into the next shape.
   */
  notesPerString?: number | readonly number[];
  /** String indices to use, ascending. Defaults to the whole instrument. */
  strings?: number[];
}

/**
 * How far the hand reaches. Three notes a string already asks for a six-fret
 * stretch, so a move further than that between strings is a leap rather than a
 * shift, and the shape belongs somewhere else on the neck.
 */
const HAND_SPAN = 6;

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

/** A shape, and whether the run left the hand behind while building it. */
interface Attempt {
  positions: ScaleNotePosition[];
  /**
   * A string whose note the hand could only reach by leaving the shape
   * behind — so the shape does not belong at this fret at all.
   */
  outOfReach: boolean;
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

  const countFor = (k: number): number =>
    typeof notesPerString === 'number' ? notesPerString : (notesPerString[k] ?? 0);

  /** The shape with the hand starting at `startFret`. */
  const build = (startFret: number): Attempt => {
    const out: ScaleNotePosition[] = [];

    let degreeIndex = startDegree - 1;
    // Where the hand sits; each new string aims to stay near the last one's start.
    let anchor = startFret;
    let isFirstString = true;

    for (const [k, string] of strings.entries()) {
      let previousFret: number | null = null;
      // Has this string moved the hand yet — has it a fretted note?
      let handPlaced = false;

      for (let n = 0; n < countFor(k); n += 1) {
        const pc = notes[degreeIndex % notes.length]!;

        // minFret positions the shape; it does not constrain every note. Once the
        // hand is anchored, a later string may legitimately want a lower fret —
        // forcing it above minFret sends the shape twelve frets up the neck
        // instead, which is how this first went wrong.
        const floor =
          previousFret !== null
            ? previousFret + 1
            : isFirstString
              ? startFret
              : lowestFret(instrument);
        const reference = previousFret === null ? anchor : previousFret;
        const candidates = fretsNear(instrument, string, pc, reference, floor);
        const fret = candidates[0];
        if (fret === undefined) {
          // The string cannot reach this note within the fret count; stop cleanly
          // rather than emitting an unplayable position.
          return { positions: out, outOfReach: false };
        }

        // The hand moves to a string's first fretted note. An open string asks
        // nothing of it, so it stays where it was.
        if (fret > 0 && !handPlaced) {
          if (!isFirstString && Math.abs(fret - anchor) > HAND_SPAN) {
            return { positions: out, outOfReach: true };
          }
          anchor = fret;
          handPlaced = true;
        }
        if (n === 0) isFirstString = false;
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

    return { positions: out, outOfReach: false };
  };

  const here = build(minFret);
  if (!here.outOfReach) return here.positions;

  // The hand cannot stay with the run from here. Near the nut a low string can
  // run past the next string's open pitch — in drop D the low string plays 1-2-4
  // and the next note sits at fret 11 — and the answer is to start the shape
  // higher, not to spread the hand over half the neck. An octave up the same
  // notes come round again, so there is nothing beyond that to try.
  for (let startFret = minFret + 1; startFret <= minFret + 12; startFret += 1) {
    const higher = build(startFret);
    if (!higher.outOfReach && higher.positions.length > here.positions.length) {
      return higher.positions;
    }
  }

  // Nowhere within reach fits: stop where the run left the hand behind.
  return here.positions;
}

export interface NeckShape {
  /**
   * Which scale step this shape begins on — which mode it is. For a pentatonic
   * box, the step is the shape's number.
   */
  startDegree: DegreeNumber;
  /** The pentatonic shape, for a pentatonic or blues box. */
  shape?: ShapeId;
  /** Lowest fretted note in the shape. */
  startFret: number;
  positions: ScaleNotePosition[];
}

/**
 * The shapes of a key laid out ASCENDING THE NECK, each starting on whichever
 * degree falls next on the lowest string.
 *
 * Not "shape N starts on degree N, chained upward" — that is what a naive
 * reading suggests and it does not survive contact with a real neck. In D
 * dorian the first D on the low E string is fret 10, so starting from degree 1
 * and chaining pushes the set to frets 10-20 and runs the last shapes off the
 * end, while frets 1-9 sit unused. Ascending from the nut instead gives the
 * F shape at 1, G at 3, A at 5, B at 7, C at 8, D at 10, E at 12 — which is
 * what a player means by "the seven shapes up the neck".
 *
 * Each shape carries its own `startDegree`, so a caller that wants mode order
 * (ionian, dorian, …) can sort by it.
 */
export function shapesUpTheNeck(
  instrument: Instrument,
  keyMode: KeyMode,
  options: { minFret?: number; count?: number; notesPerString?: number } = {},
): NeckShape[] {
  if (scaleKind(keyMode.scale) === 'shapes') {
    return boxesUpTheNeck(instrument, keyMode, options.minFret ?? 1, options.count);
  }
  const { minFret = 1, count = scaleNotes(keyMode).length, notesPerString = 3 } = options;
  const notes = scaleNotes(keyMode);
  const lowestString = 0;
  const shapes: NeckShape[] = [];

  for (let fret = minFret; fret <= instrument.fretCount && shapes.length < count; fret += 1) {
    const sounding = pitchClassAt(instrument, { string: lowestString, fret });
    const index = notes.findIndex((n) => chroma(n) === chroma(sounding));
    if (index === -1) continue;

    const startDegree = (index + 1) as DegreeNumber;
    const positions = scaleShape(instrument, {
      keyMode,
      startDegree,
      minFret: fret,
      notesPerString,
    });

    // Only take shapes that fit on the neck.
    if (positions.length < notesPerString * stringCount(instrument)) continue;
    // A shape the hand cannot hold this low starts higher instead, so it is not
    // this fret's shape at all — the climb reaches it again where it does start.
    if (positions[0]!.fret !== fret) continue;

    shapes.push({ startDegree, startFret: fret, positions });
  }

  return shapes;
}

/**
 * A pentatonic or blues box starting at `startFret` on the lowest string, or
 * null if the shape's first note isn't there or the box runs off the neck.
 *
 * The pentatonic box is the scale two notes a string from the shape's step.
 * Blues is the minor pentatonic box with the ♭5 added on the 4th's string,
 * one fret above it — between 4 and 5 where both share a string, or after the
 * 4 where the 5 starts the next string — so those strings get three notes.
 */
function boxAt(
  instrument: Instrument,
  keyMode: KeyMode,
  step: number,
  startFret: number,
): ScaleNotePosition[] | null {
  const blues = keyMode.scale === 'blues';
  const pentatonic: KeyMode = blues ? { ...keyMode, scale: 'minor-pentatonic' } : keyMode;
  const box = scaleShape(instrument, {
    keyMode: pentatonic,
    startDegree: step as DegreeNumber,
    minFret: startFret,
    notesPerString: 2,
  });
  if (box.length < 2 * stringCount(instrument) || box[0]!.fret !== startFret) return null;
  if (!blues) return box;

  const flatFive = makeDegree(5, -1);
  const pc = noteAtDegree(keyMode, flatFive);
  return box.flatMap((p) => {
    if (p.degree.number !== 4 || p.fret + 1 > instrument.fretCount) return [p];
    const position = { string: p.string, fret: p.fret + 1 };
    return [
      p,
      {
        ...position,
        pitchClass: pc,
        note: noteAt(instrument, position),
        degree: flatFive,
        isRoot: false,
      },
    ];
  });
}

/** The frets on the lowest string where a shape's first note sounds. */
function boxStarts(instrument: Instrument, keyMode: KeyMode, step: number): number[] {
  const first = pentatonicNotes(keyMode)[step - 1]!;
  const frets: number[] = [];
  for (let fret = lowestFret(instrument); fret <= instrument.fretCount; fret += 1) {
    if (chroma(pitchClassAt(instrument, { string: 0, fret })) === chroma(first))
      frets.push(fret);
  }
  return frets;
}

/** The five box notes: blues without its ♭5. */
function pentatonicNotes(keyMode: KeyMode): PitchClass[] {
  return scaleNotes(
    keyMode.scale === 'blues' ? { ...keyMode, scale: 'minor-pentatonic' } : keyMode,
  );
}

/**
 * The key's pentatonic or blues box — the shape its mode names — at whichever
 * octave copy starts nearest `nearFret`. A shape sits at one fret, give or
 * take an octave; position only chooses low or high on the neck.
 */
export function boxShape(instrument: Instrument, keyMode: KeyMode, nearFret = 0): NeckShape {
  const step = shapeNumber(keyMode.mode);
  if (step === null) throw new Error(`${keyMode.mode} is not a pentatonic shape`);

  let best: NeckShape | null = null;
  for (const fret of boxStarts(instrument, keyMode, step)) {
    const positions = boxAt(instrument, keyMode, step, fret);
    if (!positions) continue;
    if (best === null || Math.abs(fret - nearFret) < Math.abs(best.startFret - nearFret)) {
      best = {
        startDegree: step as DegreeNumber,
        shape: keyMode.mode as ShapeId,
        startFret: fret,
        positions,
      };
    }
  }
  if (best === null)
    throw new Error(`No room on the neck for ${keyMode.tonic} ${keyMode.mode}`);
  return best;
}

/**
 * Pentatonic or blues boxes up the neck from `minFret`: at each fret, the
 * shape whose first note sounds there on the lowest string. Five of them by
 * default, which is every shape once.
 */
function boxesUpTheNeck(
  instrument: Instrument,
  keyMode: KeyMode,
  minFret: number,
  count = modesOf(keyMode.scale).length,
): NeckShape[] {
  const notes = pentatonicNotes(keyMode);
  const shapes: NeckShape[] = [];
  for (let fret = minFret; fret <= instrument.fretCount && shapes.length < count; fret += 1) {
    const sounding = chroma(pitchClassAt(instrument, { string: 0, fret }));
    const step = notes.findIndex((n) => chroma(n) === sounding) + 1;
    if (step === 0) continue;
    const positions = boxAt(instrument, keyMode, step, fret);
    if (!positions) continue;
    shapes.push({
      startDegree: step as DegreeNumber,
      shape: `shape-${step}` as ShapeId,
      startFret: fret,
      positions,
    });
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
