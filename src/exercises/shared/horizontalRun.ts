import type { KeyMode } from '@/domain/music';
import type { Instrument, ScaleNotePosition } from '@/domain/instrument';
import { scaleShape, stringCount } from '@/domain/instrument';
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
 * Notes per string on the way up. Four on a string, where a three-note-per-
 * string shape would have three, carries the hand one shape up the neck.
 */
export function shiftCounts(strings: number, shiftOn: ShiftOn): number[] {
  return Array.from({ length: strings }, (_, k) =>
    shiftOn === 'every-string' || k % 2 === 0 ? 4 : 3,
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
  shift: 'up' | 'down',
): HorizontalNote[] {
  const out: HorizontalNote[] = [];
  let index = 0;
  for (const count of counts) {
    for (let n = 0; n < count; n += 1) {
      // Going up, the extra note is the top one on the string; coming down,
      // the hand arrives from the shape above and the extra note is the lowest.
      const isShift = count > 3 && (shift === 'up' ? n === count - 1 : n === 0);
      out.push(isShift ? { ...positions[index]!, shift } : positions[index]!);
      index += 1;
    }
  }
  return out;
}

/**
 * The scale across the neck rather than inside one box: up through three-
 * note-per-string shapes with a four-note string wherever the hand shifts,
 * then back down shifting on different strings.
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
  const upCounts = shiftCounts(stringCount(instrument), shiftOn);
  const downCounts = rotateCounts(upCounts);

  const up = shapeFrom({ instrument, keyMode, fret: minFret, notesPerString: upCounts });
  if (!up) return null;

  // The same notes by another route: same first note, shifts on other strings.
  const down = scaleShape(instrument, {
    keyMode,
    startDegree: up.startDegree,
    minFret: up.startFret,
    notesPerString: downCounts,
  });
  if (down.length !== up.positions.length) return null;

  return {
    startFret: up.startFret,
    up: markShifts(up.positions, upCounts, 'up'),
    down: markShifts(down, downCounts, 'down').reverse(),
  };
}
