import type { KeyMode } from '@/domain/music';
import { chroma, degreeOf, scaleNotes } from '@/domain/music';
import type { Instrument, ScaleNotePosition } from '@/domain/instrument';
import { fretForPitchOnString, lowestFret, noteAt } from '@/domain/instrument';

export type SweepStop = { kind: 'return-to-root' } | { kind: 'cycles'; count: number };

export interface OneNotePerStringOptions {
  instrument: Instrument;
  keyMode: KeyMode;
  /** Model indices, ascending. */
  strings: readonly number[];
  /** Scale steps from one note to the next: 1 walks the scale, 2 skips a note. */
  step: 1 | 2;
  stop: SweepStop;
}

/** One trip across the strings and back, without repeating the turning string: 0 1 2 1. */
export function stringSweep(strings: readonly number[]): number[] {
  if (strings.length <= 1) return [...strings];
  return [...strings, ...strings.slice(1, -1).reverse()];
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** How many notes a sweep plays, including the closing note on the starting string. */
export function sweepLength(
  sweepSize: number,
  scaleSize: number,
  step: number,
  stop: SweepStop,
): number {
  if (stop.kind === 'cycles') return sweepSize * stop.count + 1;
  const degreePeriod = scaleSize / gcd(step, scaleSize);
  return (sweepSize * degreePeriod) / gcd(sweepSize, degreePeriod) + 1;
}

/**
 * One note of the scale per string, sweeping low string to high and back.
 *
 * This is a note-finding exercise, not a fingering. The player is expected to
 * find each note anywhere on its string, and jumping around the neck is the
 * point — so the fret is simply where the note first falls from the nut. It
 * is there for playback, not for reading.
 *
 * `return-to-root` stops on the tonic on the starting string. That always
 * happens: the string repeats every sweep and the degree every seven notes
 * (step 2 is coprime to seven), so both line up at their least common
 * multiple — 70 notes on six strings, 28 on three, plus the closing root.
 */
export function oneNotePerString(options: OneNotePerStringOptions): ScaleNotePosition[] {
  const { instrument, keyMode, strings, step, stop } = options;
  const notes = scaleNotes(keyMode);
  const sweep = stringSweep(strings);
  const rootChroma = chroma(keyMode.tonic);
  const total = sweepLength(sweep.length, notes.length, step, stop);

  return Array.from({ length: total }, (_, i) => {
    const string = sweep[i % sweep.length]!;
    const pc = notes[(i * step) % notes.length]!;
    const fret = fretForPitchOnString(instrument, string, pc, lowestFret(instrument));
    if (fret === null) throw new Error(`${pc} is not reachable on string ${string}`);
    const degree = degreeOf(keyMode, pc);
    if (!degree) throw new Error(`${pc} is not in ${keyMode.tonic} ${keyMode.mode}`);
    const position = { string, fret };
    return {
      ...position,
      pitchClass: pc,
      note: noteAt(instrument, position),
      degree,
      isRoot: chroma(pc) === rootChroma,
    };
  });
}
