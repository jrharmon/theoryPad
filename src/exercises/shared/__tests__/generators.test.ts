import { describe, expect, it } from 'vitest';
import { chroma, pitchClass } from '@/domain/music';
import type { Instrument } from '@/domain/instrument';
import {
  DROP_D_GUITAR,
  SEVEN_STRING_GUITAR,
  STANDARD_GUITAR,
  midiAt,
  stringCount,
} from '@/domain/instrument';
import { INTERVAL_PATTERNS } from '@/domain/variation';
import { intervalFigures, intervalRun } from '../intervalRun';
import { arpeggioRun, chordDegrees } from '../arpeggioRun';
import { oneNotePerString, stringSweep, sweepLength } from '../oneNotePerString';
import { horizontalRun, rotateCounts, shiftCounts } from '../horizontalRun';
import { scaleRun, shapeFrom } from '../scaleRun';

const C_MAJOR = { tonic: pitchClass('C'), scale: 'major' as const, mode: 'ionian' as const };
const D_DORIAN = { tonic: pitchClass('D'), scale: 'major' as const, mode: 'dorian' as const };
const GUITARS = [STANDARD_GUITAR, DROP_D_GUITAR, SEVEN_STRING_GUITAR].map(
  (i) => [i.id, i] as const,
);
const pattern = (id: string) => INTERVAL_PATTERNS.find((p) => p.id === id)!;
const EIGHT = [1, 2, 3, 4, 5, 6, 7, 8];

describe('intervalRun', () => {
  it('pairs each note with the one a 3rd above', () => {
    expect(intervalFigures(EIGHT, pattern('3rds'), 'same-direction')).toEqual([
      [1, 3],
      [2, 4],
      [3, 5],
      [4, 6],
      [5, 7],
      [6, 8],
    ]);
  });

  it('turns every other figure round when alternating', () => {
    expect(intervalFigures(EIGHT, pattern('3rds'), 'alternating').slice(0, 4)).toEqual([
      [1, 3],
      [4, 2],
      [3, 5],
      [6, 4],
    ]);
  });

  it('stops where the top note would leave the shape instead of wrapping', () => {
    expect(intervalFigures(EIGHT, pattern('6ths'), 'same-direction')).toEqual([
      [1, 6],
      [2, 7],
      [3, 8],
    ]);
    expect(intervalFigures([1, 2], pattern('7ths'), 'same-direction')).toEqual([]);
  });

  it('builds groups as well as intervals', () => {
    expect(intervalFigures([1, 2, 3, 4, 5], pattern('groups-of-3'), 'same-direction')).toEqual([
      [1, 2, 3],
      [2, 3, 4],
      [3, 4, 5],
    ]);
  });

  it('opens a descent on a descending figure, whichever the pairing', () => {
    const same = intervalRun({
      positions: EIGHT,
      pattern: pattern('3rds'),
      pairing: 'same-direction',
      direction: 'descending',
    });
    expect(same.slice(0, 4)).toEqual([8, 6, 7, 5]);
    const alt = intervalRun({
      positions: EIGHT,
      pattern: pattern('3rds'),
      pairing: 'alternating',
      direction: 'descending',
    });
    expect(alt.slice(0, 4)).toEqual([8, 6, 5, 7]);
  });

  it('answers the figure it turns on with the same notes coming back', () => {
    const run = intervalRun({
      positions: [1, 2, 3, 4],
      pattern: pattern('3rds'),
      pairing: 'same-direction',
      direction: 'up-down',
    });
    expect(run).toEqual([1, 3, 2, 4, 4, 2, 3, 1]);
  });
});

describe('arpeggioRun', () => {
  it('names the diatonic chord tones on any degree', () => {
    expect(chordDegrees(1)).toEqual([1, 3, 5, 7]);
    expect(chordDegrees(6)).toEqual([6, 1, 3, 5]);
    expect(chordDegrees(2, 3)).toEqual([2, 4, 6]);
  });

  it.each(GUITARS)('keeps only chord tones, in the shape’s order (%s)', (_id, instrument) => {
    const shape = scaleRun({
      instrument,
      keyMode: D_DORIAN,
      direction: 'ascending',
      minFret: 5,
      startDegree: 1,
    });
    const arpeggio = arpeggioRun(shape, 1);
    expect(arpeggio.length).toBeGreaterThanOrEqual(8);
    expect(new Set(arpeggio.map((p) => p.degree.number))).toEqual(new Set([1, 3, 5, 7]));
    expect(arpeggio[0]!.isRoot).toBe(true);
    const midis = arpeggio.map((p) => midiAt(instrument, p));
    for (let i = 1; i < midis.length; i += 1) expect(midis[i]!).toBeGreaterThan(midis[i - 1]!);
  });
});

describe('oneNotePerString', () => {
  it('sweeps across the strings and back without repeating the turn', () => {
    expect(stringSweep([0, 1, 2])).toEqual([0, 1, 2, 1]);
    expect(stringSweep([3])).toEqual([3]);
  });

  it('knows how long a return to the root takes', () => {
    // Ten strings a sweep on six strings, seven degrees: they meet at 70.
    expect(sweepLength(10, 7, 1, { kind: 'return-to-root' })).toBe(71);
    expect(sweepLength(4, 7, 2, { kind: 'return-to-root' })).toBe(29);
    expect(sweepLength(10, 7, 1, { kind: 'cycles', count: 3 })).toBe(31);
  });

  it.each(GUITARS)('plays one note per string, walking the scale (%s)', (_id, instrument) => {
    const strings = Array.from({ length: stringCount(instrument) }, (_, i) => i);
    const notes = oneNotePerString({
      instrument,
      keyMode: D_DORIAN,
      strings,
      step: 2,
      stop: { kind: 'return-to-root' },
    });
    const sweep = stringSweep(strings);

    notes.forEach((note, i) => {
      expect(note.string).toBe(sweep[i % sweep.length]);
      expect(note.degree.number).toBe(((i * 2) % 7) + 1);
      // Where the note first falls from the nut — playback only, never shown.
      expect(note.fret).toBeGreaterThanOrEqual(0);
      expect(note.fret).toBeLessThan(12);
    });

    const last = notes[notes.length - 1]!;
    expect(last.isRoot).toBe(true);
    expect(last.string).toBe(strings[0]);
  });

  it('stops after a fixed number of sweeps, back on the starting string', () => {
    const notes = oneNotePerString({
      instrument: STANDARD_GUITAR,
      keyMode: C_MAJOR,
      strings: [2, 3, 4],
      step: 1,
      stop: { kind: 'cycles', count: 2 },
    });
    expect(notes).toHaveLength(9);
    expect(notes[8]!.string).toBe(2);
  });
});

describe('shapeFrom', () => {
  it('starts on the first scale note at the position, not on the root', () => {
    // C major in 3rd position starts on G; starting on the root would put it at the 8th fret.
    const shape = shapeFrom({ instrument: STANDARD_GUITAR, keyMode: C_MAJOR, fret: 3 })!;
    expect(shape.startFret).toBe(3);
    expect(shape.startDegree).toBe(5);
    expect(shape.positions).toHaveLength(18);
  });

  it.each(GUITARS)('moves down to fit near the top of the neck (%s)', (_id, instrument) => {
    const shape = shapeFrom({ instrument, keyMode: C_MAJOR, fret: instrument.fretCount })!;
    expect(shape.startFret).toBeLessThan(instrument.fretCount);
    expect(Math.max(...shape.positions.map((p) => p.fret))).toBeLessThanOrEqual(
      instrument.fretCount,
    );
  });
});

describe('horizontalRun', () => {
  it('shifts on alternate strings, and on different ones coming down', () => {
    expect(shiftCounts(6, 'every-other-string')).toEqual([4, 3, 4, 3, 4, 3]);
    expect(rotateCounts([4, 3, 4, 3, 4, 3])).toEqual([3, 4, 3, 4, 3, 4]);
    expect(shiftCounts(6, 'every-string')).toEqual([4, 4, 4, 4, 4, 4]);
  });

  function check(
    instrument: Instrument,
    shiftOn: 'every-string' | 'every-other-string',
    minFret: number,
  ) {
    const run = horizontalRun({ instrument, keyMode: C_MAJOR, minFret, shiftOn })!;
    expect(run).not.toBeNull();
    const up = run.up.map((p) => midiAt(instrument, p));
    const down = run.down.map((p) => midiAt(instrument, p));

    for (let i = 1; i < up.length; i += 1) expect(up[i]!).toBeGreaterThan(up[i - 1]!);
    // The same notes by another route, landing back where it started.
    expect([...down].reverse()).toEqual(up);
    expect(run.down[run.down.length - 1]).toMatchObject({
      string: run.up[0]!.string,
      fret: run.up[0]!.fret,
    });
    for (const p of [...run.up, ...run.down])
      expect(p.fret).toBeLessThanOrEqual(instrument.fretCount);
    return run;
  }

  it.each(GUITARS)(
    'climbs the neck and comes back by another route (%s)',
    (_id, instrument) => {
      const run = check(instrument, 'every-other-string', 3);
      expect(run.up[run.up.length - 1]!.fret).toBeGreaterThan(run.up[0]!.fret + 4);

      const upShifts = run.up.filter((p) => p.shift === 'up').map((p) => p.string);
      const downShifts = run.down.filter((p) => p.shift === 'down').map((p) => p.string);
      expect(upShifts.length).toBeGreaterThan(0);
      expect(downShifts.length).toBeGreaterThan(0);
      // With an odd string count one string shifts both ways; the routes still differ.
      expect(downShifts.sort()).not.toEqual(upShifts.sort());
    },
  );

  it.each(GUITARS)(
    'shifts on every string without leaving the neck (%s)',
    (_id, instrument) => {
      const run = check(instrument, 'every-string', 12);
      expect(run.startFret).toBeLessThanOrEqual(12);
    },
  );

  it.each(GUITARS)(
    'finds a start where both routes fit, at the nut too (%s)',
    (_id, instrument) => {
      // The way down shifts on other strings, so it can need a hand position the
      // way up does not: in drop D the three-note low string runs past the open
      // A, and the run starts a shape higher rather than one route going with it.
      const run = check(instrument, 'every-other-string', 0);
      expect(run.startFret).toBe(run.up[0]!.fret);
    },
  );

  it('marks the extra note on a string as the shift', () => {
    const run = horizontalRun({
      instrument: STANDARD_GUITAR,
      keyMode: C_MAJOR,
      minFret: 3,
      shiftOn: 'every-other-string',
    })!;
    // Low E: G A B at 3 5 7, then C at 8 carries the hand into the next shape.
    expect(run.up.slice(0, 4).map((p) => [p.fret, p.shift])).toEqual([
      [3, undefined],
      [5, undefined],
      [7, undefined],
      [8, 'up'],
    ]);
    expect(chroma(run.up[3]!.pitchClass)).toBe(chroma(pitchClass('C')));
  });
});
