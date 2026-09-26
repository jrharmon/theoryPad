import { describe, expect, it } from 'vitest';
import type { KeyMode } from '../../../music';
import { MODE_CHARACTER, pitchClass } from '../../../music';
import { FOUR_FOUR, ticksPerBar } from '../../../phrase';
import { mulberry32 } from '../../../variation';
import type { GeneratedBackingSettings, Progression } from '..';
import { chordTimeline, formatProgression, parseProgression, pickProgression } from '..';

const BAR = ticksPerBar(FOUR_FOUR);
const C_IONIAN: KeyMode = { tonic: pitchClass('C'), scale: 'major', mode: 'ionian' };

function settings(source: GeneratedBackingSettings['source']): GeneratedBackingSettings {
  return { source, style: 'pulse', chords: 'sevenths' };
}

function parsed(text: string): Progression {
  const result = parseProgression(text);
  if (!result.ok) throw new Error(result.error);
  return result.progression;
}

function bars(count: number, repeat?: number) {
  return {
    totalTicks: count * BAR,
    timeSignature: FOUR_FOUR,
    ...(repeat !== undefined ? { repeat } : {}),
  };
}

describe('pickProgression', () => {
  it('vamps on 1, picks from the mode’s go-to list, or from the custom lists, by seed', () => {
    const dorian: KeyMode = { tonic: pitchClass('D'), scale: 'major', mode: 'dorian' };
    expect(pickProgression(settings({ kind: 'vamp' }), dorian, mulberry32(1))).toEqual([
      { degree: 1, bars: 1 },
    ]);

    const goTo = MODE_CHARACTER.dorian.progressions!.map((p) =>
      p.degrees.map((degree) => ({ degree, bars: 1 })),
    );
    const picks = Array.from({ length: 40 }, (_, seed) =>
      pickProgression(settings({ kind: 'goTo' }), dorian, mulberry32(seed)),
    );
    for (const pick of picks) expect(goTo).toContainEqual(pick);
    expect(new Set(picks.map((p) => formatProgression(p))).size).toBe(goTo.length);
    // The same roll picks the same progression.
    expect(pickProgression(settings({ kind: 'goTo' }), dorian, mulberry32(7))).toEqual(
      picks[7],
    );

    const lists = [parsed('2 5 1*2'), parsed('1 6 4 5')];
    const custom = settings({ kind: 'custom', progressions: lists });
    const customPicks = Array.from({ length: 20 }, (_, seed) =>
      pickProgression(custom, dorian, mulberry32(seed)),
    );
    expect(new Set(customPicks)).toEqual(new Set(lists));
  });

  it('vamps when a custom source has nothing in it', () => {
    const empty = settings({ kind: 'custom', progressions: [[]] });
    expect(pickProgression(empty, C_IONIAN, mulberry32(1))).toEqual([{ degree: 1, bars: 1 }]);
  });
});

describe('custom progression text', () => {
  it('reads degrees with optional bars, and writes them back', () => {
    expect(parseProgression('  2 5\t1*2 ')).toEqual({
      ok: true,
      progression: [
        { degree: 2, bars: 1 },
        { degree: 5, bars: 1 },
        { degree: 1, bars: 2 },
      ],
    });
    expect(formatProgression(parsed('2 5*1 1*2'))).toBe('2 5 1*2');
  });

  it('refuses anything but degrees 1–7 held for whole bars', () => {
    for (const text of ['', '   ', '8', '0', '1 x', 'ii V I', '1*0', '1*', '1*1.5', '-1']) {
      expect(parseProgression(text).ok, text).toBe(false);
    }
  });
});

describe('chordTimeline', () => {
  it('lays the progression out from bar 1 and loops it, spelled in the key', () => {
    expect(chordTimeline(parsed('2 5 1*2'), C_IONIAN, 'sevenths', bars(8))).toEqual([
      { startTick: 0, durationTicks: BAR, degree: 2, symbol: 'Dm7' },
      { startTick: BAR, durationTicks: BAR, degree: 5, symbol: 'G7' },
      { startTick: 2 * BAR, durationTicks: 2 * BAR, degree: 1, symbol: 'Cmaj7' },
      { startTick: 4 * BAR, durationTicks: BAR, degree: 2, symbol: 'Dm7' },
      { startTick: 5 * BAR, durationTicks: BAR, degree: 5, symbol: 'G7' },
      { startTick: 6 * BAR, durationTicks: 2 * BAR, degree: 1, symbol: 'Cmaj7' },
    ]);
  });

  it('takes chord qualities from the mode, and triads when asked', () => {
    const symbols = (mode: KeyMode['mode'], chords: 'sevenths' | 'triads') =>
      chordTimeline(
        parsed('1 4'),
        { tonic: pitchClass('Eb'), scale: 'major', mode },
        chords,
        bars(2),
      ).map((s) => s.symbol);
    expect(symbols('dorian', 'sevenths')).toEqual(['Ebm7', 'Ab7']);
    expect(symbols('aeolian', 'triads')).toEqual(['Ebm', 'Abm']);
  });

  it('cuts the progression where a short pass ends, even mid-bar', () => {
    const pass = { totalTicks: 2 * BAR + BAR / 2, timeSignature: FOUR_FOUR };
    expect(
      chordTimeline(parsed('2 5 1*2'), C_IONIAN, 'sevenths', pass).map((s) => [
        s.startTick,
        s.durationTicks,
      ]),
    ).toEqual([
      [0, BAR],
      [BAR, BAR],
      [2 * BAR, BAR / 2],
    ]);
  });

  it('holds a repeated chord as one span, across the loop but never across a copy', () => {
    const spans = (text: string, pass: ReturnType<typeof bars>) =>
      chordTimeline(parsed(text), C_IONIAN, 'triads', pass).map((s) => [
        s.symbol,
        s.startTick / BAR,
        s.durationTicks / BAR,
      ]);

    expect(spans('1', bars(4))).toEqual([['C', 0, 4]]);
    expect(spans('1 4 5 1', bars(6))).toEqual([
      ['C', 0, 1],
      ['F', 1, 1],
      ['G', 2, 1],
      ['C', 3, 2],
      ['F', 5, 1],
    ]);
    // Each copy of a repeated phrase starts the progression again from bar 1.
    expect(spans('1', bars(2, 2))).toEqual([
      ['C', 0, 2],
      ['C', 2, 2],
    ]);
    expect(spans('1 4 5', bars(2, 2))).toEqual([
      ['C', 0, 1],
      ['F', 1, 1],
      ['C', 2, 1],
      ['F', 3, 1],
    ]);
  });
});
