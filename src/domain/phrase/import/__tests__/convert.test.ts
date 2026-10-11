import { describe, expect, it } from 'vitest';
import { QUARTER, WHOLE } from '../../types';
import type { GpBeat, GpMasterBar, GpNote, GpScore } from '../score';
import { importPhrase, rhythmTicks } from '../convert';

/** A whole note on string 0 at `fret`. */
function note(fret: number, extra: Partial<GpNote> = {}): GpNote {
  return {
    string: 0,
    fret,
    tied: false,
    slide: 0,
    hopoDestination: false,
    techniques: [],
    unsupported: [],
    ...extra,
  };
}

const wholeBeat = (n: GpNote, extra: Partial<GpBeat> = {}): GpBeat => ({
  rhythm: { value: 1, dots: 0 },
  notes: [n],
  unsupported: [],
  ...extra,
});

/**
 * One track, one whole note per bar, its fret the bar's 1-based number — so
 * the played order can be read straight off the frets.
 */
function score(
  bars: Partial<GpMasterBar>[],
  notes: (n: number) => GpNote = (n) => note(n),
): GpScore {
  return {
    title: 'Test',
    artist: '',
    tempos: [{ bar: 0, bpm: 120 }],
    masterBars: bars.map((bar) => ({
      time: { beats: 4, unit: 4 },
      key: { accidentals: 0, minor: false },
      repeatStart: false,
      repeatEnd: 0,
      alternateEndings: [],
      targets: [],
      jumps: [],
      unsupported: [],
      ...bar,
    })),
    tracks: [
      {
        name: 'Guitar',
        tuning: [40, 45, 50, 55, 59, 64],
        capo: 0,
        bars: bars.map((_, i) => [[wholeBeat(notes(i + 1))]]),
      },
    ],
  };
}

function played(s: GpScore, firstBar = 0, lastBar = s.masterBars.length - 1) {
  const result = importPhrase(s, { track: 0, firstBar, lastBar });
  if (!result.ok) throw new Error(result.reason);
  return result.value;
}
const frets = (s: GpScore, first?: number, last?: number) =>
  played(s, first, last).phrase.notes.map((n) => n.fret);

describe('importPhrase', () => {
  it('writes out a D.S. al Coda: back to the sign, then to the coda', () => {
    const s = score([
      {},
      { targets: ['Segno'] },
      { jumps: ['DaCoda'] },
      { jumps: ['DaSegnoAlCoda'] },
      { targets: ['Coda'] },
    ]);
    expect(frets(s)).toEqual([1, 2, 3, 4, 2, 3, 5]);
    const labels = played(s).phrase.bars.map((b) => b.heading);
    expect(labels[4]).toBe('D.S. al Coda');
    expect(labels[6]).toBe('Coda');
  });

  it('plays a repeat once through a D.S., and takes a repeat in the coda', () => {
    const s = score([
      { targets: ['Segno'], repeatStart: true },
      { repeatEnd: 2 },
      { jumps: ['DaCoda'] },
      { jumps: ['DaSegnoAlCoda'] },
      { targets: ['Coda'], repeatStart: true },
      { repeatEnd: 2 },
    ]);
    expect(frets(s)).toEqual([1, 2, 1, 2, 3, 4, 1, 2, 3, 5, 6, 5, 6]);
  });

  it('leaves out a jump whose sign is outside the bars, and says so', () => {
    const s = score([{ targets: ['Segno'] }, {}, { jumps: ['DaSegno'] }]);
    const value = played(s, 1, 2);
    expect(value.phrase.notes.map((n) => n.fret)).toEqual([2, 3]);
    expect(value.dropped).toEqual(['D.S. at bar 3 ignored: its sign is outside the bars']);
  });

  it('stores a range that is one repeated block once, with its count', () => {
    const value = played(score([{ repeatStart: true }, { repeatEnd: 4 }]));
    expect(value.phrase.bars).toHaveLength(2);
    expect(value.phrase.repeat).toBe(4);
  });

  it('refuses a time-signature change in the range, but not one outside it', () => {
    const s = score([{}, {}, { time: { beats: 3, unit: 4 } }]);
    expect(importPhrase(s, { track: 0, firstBar: 0, lastBar: 2 })).toEqual({
      ok: false,
      reason: 'The time signature changes to 3/4 at bar 3.',
      bar: 3,
    });
    expect(frets(s, 0, 1)).toEqual([1, 2]);
  });

  it('picks a note tied from before the range, and keeps a tie inside it', () => {
    const s = score([{}, {}, {}], (n) => note(5, { tied: n > 1 }));
    expect(played(s, 1, 2).phrase.notes.map((n) => n.tied ?? false)).toEqual([false, true]);
  });

  it('counts what it drops once per place in the file, however often it plays', () => {
    const s = score(
      [{ repeatStart: true }, { repeatEnd: 3, unsupported: ['fermata'] }, {}],
      (n) => note(n, { unsupported: n === 1 ? ['trill'] : [] }),
    );
    expect(played(s).dropped).toEqual(['trill on 1 note', 'fermata on 1 bar']);
  });

  it('gives tuplets and dots their exact length', () => {
    expect(rhythmTicks({ value: 8, dots: 1 })).toBe(QUARTER * 0.75);
    expect(rhythmTicks({ value: 16, dots: 0, tuplet: { num: 6, den: 4 } })).toBe(80);
    expect(rhythmTicks({ value: 1, dots: 2 })).toBe(WHOLE * 1.75);
  });
});
