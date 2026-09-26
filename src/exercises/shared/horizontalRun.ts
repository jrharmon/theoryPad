import type { KeyMode } from '@/domain/music';
import { playsInBoxes, withoutPassingNotes } from '@/domain/music';
import type { Instrument, ScaleNotePosition } from '@/domain/instrument';
import { addBluesFifth, scaleShape, stringCount } from '@/domain/instrument';
import { shapeFrom } from './scaleRun';

export type ShiftOn = 'every-string' | 'every-other-string';

export interface HorizontalNote extends ScaleNotePosition {
  /** This note is where the hand moves into the next shape. */
  shift?: 'up' | 'down';
}

export interface HorizontalRun {
  startFret: number;
  up: HorizontalNote[];
  down: HorizontalNote[];
}

/**
 * Notes per string on the way up. One more on a string than its shape has —
 * four where a three-note-per-string shape has three, three where a pentatonic
 * box has two — carries the hand one shape up the neck.
 */
export function shiftCounts(strings: number, shiftOn: ShiftOn, perString = 3): number[] {
  return Array.from({ length: strings }, (_, k) =>
    shiftOn === 'every-string' || k % 2 === 0 ? perString + 1 : perString,
  );
}

/**
 * The same counts moved along one string, so the way down shifts in other
 * places but covers exactly the same notes and lands where the run started.
 * With a shift on every string there is only one route, and this returns it.
 */
export function rotateCounts(counts: readonly number[]): number[] {
  if (counts.length === 0) return [];
  return [counts[counts.length - 1]!, ...counts.slice(0, -1)];
}

function markShifts(
  positions: ScaleNotePosition[],
  counts: readonly number[],
  perString: number,
  shift: 'up' | 'down',
): HorizontalNote[] {
  const out: HorizontalNote[] = [];
  let index = 0;
  for (const count of counts) {
    for (let n = 0; n < count; n += 1) {
      // Going up, the extra note is the top one on the string; coming down,
      // the hand arrives from the shape above and the extra note is the lowest.
      const isShift = count > perString && (shift === 'up' ? n === count - 1 : n === 0);
      out.push(isShift ? { ...positions[index]!, shift } : positions[index]!);
      index += 1;
    }
  }
  return out;
}

/**
 * The scale across the neck rather than inside one box: up through three-
 * note-per-string shapes with a four-note string wherever the hand shifts,
 * then back down shifting on different strings. A box scale does the same
 * through its two-note boxes with a three-note string; blues shifts through
 * the minor pentatonic's and adds its ♭5 where the boxes do.
 *
 * Starts on the first scale note at or above `minFret` on the lowest string.
 * A run started high climbs off the end of the neck, so the start moves down
 * until the whole run fits — the caller gets the fret it actually used.
 */
export function horizontalRun(options: {
  instrument: Instrument;
  keyMode: KeyMode;
  minFret: number;
  shiftOn: ShiftOn;
}): HorizontalRun | null {
  const { instrument, keyMode, minFret, shiftOn } = options;
  const perString = playsInBoxes(keyMode.scale) ? 2 : 3;
  const upCounts = shiftCounts(stringCount(instrument), shiftOn, perString);
  const downCounts = rotateCounts(upCounts);
  const runKey = withoutPassingNotes(keyMode);
  // Ascending positions, as they are played on the way up.
  const finish = (notes: HorizontalNote[]): HorizontalNote[] =>
    keyMode.scale === 'blues' ? addBluesFifth(instrument, keyMode, notes) : notes;

  // Both routes have to fit. The way down shifts on other strings, so it can
  // need a hand position the way up does not — at the bottom of a drop-D neck
  // the three-note low string runs past the next string's open pitch — and then
  // the run starts a shape higher. The caller gets the fret it actually used.
  for (let fret = minFret; fret <= instrument.fretCount; fret += 1) {
    const up = shapeFrom({ instrument, keyMode: runKey, fret, notesPerString: upCounts });
    if (!up) continue;

    // The same notes by another route: same first note, shifts on other strings.
    const down = scaleShape(instrument, {
      keyMode: runKey,
      startDegree: up.startDegree,
      minFret: up.startFret,
      notesPerString: downCounts,
    });
    if (down.length !== up.positions.length || down[0]!.fret !== up.startFret) continue;

    return {
      startFret: up.startFret,
      up: finish(markShifts(up.positions, upCounts, perString, 'up')),
      down: finish(markShifts(down, downCounts, perString, 'down')).reverse(),
    };
  }

  return null;
}
