import { describe, expect, it } from 'vitest';
import {
  EIGHTH,
  EIGHTH_TRIPLET,
  FOUR_FOUR,
  PPQ,
  QUARTER,
  SIXTEENTH,
  SIX_EIGHT,
  THREE_FOUR,
  WHOLE,
} from '../types';
import {
  barBeatToTick,
  countInTicks,
  makeBars,
  phraseSeconds,
  requiredSubdivision,
  secondsToTicks,
  ticksPerBar,
  ticksPerBeat,
  ticksToSeconds,
  tickToBarBeat,
  tripletGroups,
} from '../time';
import { phraseBuilder } from '../builder';
import { EIGHTH_TRIPLETS, SWUNG_EIGHTHS } from '../rhythm';

describe('PPQ', () => {
  it('divides cleanly into every note value, triplets included', () => {
    // This is the whole reason for integer ticks: no float comparisons.
    for (const divisor of [1, 2, 3, 4, 5, 6, 8, 10, 12, 16]) {
      expect(PPQ % divisor, `PPQ / ${divisor}`).toBe(0);
    }
    expect(WHOLE).toBe(QUARTER * 4);
    expect(EIGHTH * 2).toBe(QUARTER);
    expect(SIXTEENTH * 4).toBe(QUARTER);
    // Three eighth-note triplets fill one quarter exactly — the thing float
    // beats get wrong: 1/3 + 1/3 + 1/3 !== 1.
    expect(Number.isInteger(EIGHTH_TRIPLET)).toBe(true);
    expect(EIGHTH_TRIPLET + EIGHTH_TRIPLET + EIGHTH_TRIPLET).toBe(QUARTER);
  });
});

describe('ticksPerBeat / ticksPerBar', () => {
  it('handles common signatures', () => {
    expect(ticksPerBeat(FOUR_FOUR)).toBe(QUARTER);
    expect(ticksPerBar(FOUR_FOUR)).toBe(QUARTER * 4);
    expect(ticksPerBar(THREE_FOUR)).toBe(QUARTER * 3);
    // A 6/8 beat is an eighth note, so the bar is six of them.
    expect(ticksPerBeat(SIX_EIGHT)).toBe(EIGHTH);
    expect(ticksPerBar(SIX_EIGHT)).toBe(EIGHTH * 6);
  });
});

describe('tick <-> bar/beat', () => {
  const phrase = phraseBuilder()
    .rest(QUARTER * 16)
    .build();

  it('locates a tick as a bar, a beat and an offset into it', () => {
    expect(tickToBarBeat(phrase, 0)).toEqual({ bar: 0, beat: 0, offsetTicks: 0 });
    expect(tickToBarBeat(phrase, QUARTER * 2)).toEqual({ bar: 0, beat: 2, offsetTicks: 0 });
    // "Bar 2, beat 3" in one-based terms is bar index 1, beat index 2.
    expect(tickToBarBeat(phrase, QUARTER * 6)).toEqual({ bar: 1, beat: 2, offsetTicks: 0 });
    expect(tickToBarBeat(phrase, QUARTER * 4 + EIGHTH)).toEqual({
      bar: 1,
      beat: 0,
      offsetTicks: EIGHTH,
    });
  });

  it('round-trips through barBeatToTick', () => {
    for (let bar = 0; bar < 4; bar += 1) {
      for (let beat = 0; beat < 4; beat += 1) {
        const tick = barBeatToTick(phrase, bar, beat);
        expect(tickToBarBeat(phrase, tick)).toEqual({ bar, beat, offsetTicks: 0 });
      }
    }
  });

  it('throws for a bar the phrase does not have', () => {
    expect(() => barBeatToTick(phrase, 99)).toThrow();
  });
});

describe('ticks <-> seconds', () => {
  it('converts by the tempo, both ways', () => {
    expect(ticksToSeconds(QUARTER, 60)).toBe(1);
    expect(ticksToSeconds(QUARTER, 120)).toBe(0.5);
    expect(ticksToSeconds(ticksPerBar(FOUR_FOUR), 120)).toBe(2);
    for (const bpm of [60, 76, 92, 120, 180]) {
      for (const ticks of [QUARTER, EIGHTH, ticksPerBar(FOUR_FOUR)]) {
        expect(secondsToTicks(ticksToSeconds(ticks, bpm), bpm)).toBe(ticks);
      }
    }
  });

  it('rejects a non-positive tempo', () => {
    expect(() => ticksToSeconds(QUARTER, 0)).toThrow();
    expect(() => ticksToSeconds(QUARTER, -1)).toThrow();
  });
});

describe('phraseSeconds', () => {
  it('counts the repeats', () => {
    const once = phraseBuilder().rest(ticksPerBar(FOUR_FOUR)).build();
    const twice = phraseBuilder({ repeat: 2 }).rest(ticksPerBar(FOUR_FOUR)).build();
    expect(phraseSeconds(once, 120)).toBe(2);
    expect(phraseSeconds(twice, 120)).toBe(4);
  });
});

describe('makeBars', () => {
  it('lays bars end to end', () => {
    const bars = makeBars(3, FOUR_FOUR);
    expect(bars.map((b) => b.startTick)).toEqual([0, QUARTER * 4, QUARTER * 8]);
    expect(bars.map((b) => b.index)).toEqual([0, 1, 2]);
  });
});

describe('requiredSubdivision', () => {
  it('is as fine as the phrase needs and no finer', () => {
    for (const [rhythm, subdivision] of [
      [QUARTER, 1],
      [EIGHTH_TRIPLET, 3],
      [SIXTEENTH, 4],
    ] as const) {
      const phrase = phraseBuilder()
        .rhythm(rhythm)
        .sequence([
          { string: 0, fret: 3 },
          { string: 0, fret: 5 },
          { string: 0, fret: 7 },
        ])
        .build();
      expect(requiredSubdivision(phrase), String(rhythm)).toBe(subdivision);
    }
  });

  it('needs twelve when a phrase lands on both grids', () => {
    // Notes at 0 and 120 sit on the sixteenth grid; 320 sits on the triplet
    // grid and not the sixteenth one. Only a twelfth-of-a-quarter grid holds
    // all three.
    const phrase = phraseBuilder()
      .rhythm(SIXTEENTH)
      .sequence([
        { string: 0, fret: 3 },
        { string: 0, fret: 5 },
      ])
      .rest(SIXTEENTH * 2 - EIGHTH_TRIPLET)
      .rhythm(EIGHTH_TRIPLET)
      .sequence([{ string: 0, fret: 7 }])
      .build();
    expect(phrase.notes.map((n) => n.startTick)).toEqual([0, 120, 320]);
    expect(requiredSubdivision(phrase)).toBe(12);
  });
});

describe('countInTicks', () => {
  it('counts whole bars as they are', () => {
    expect(countInTicks(FOUR_FOUR, 1)).toBe(4 * QUARTER);
    expect(countInTicks(FOUR_FOUR, 2)).toBe(8 * QUARTER);
    expect(countInTicks(FOUR_FOUR, 0)).toBe(0);
  });

  it('counts half a bar in whole beats, rounding up', () => {
    expect(countInTicks(FOUR_FOUR, 0.5)).toBe(2 * QUARTER);
    expect(countInTicks(THREE_FOUR, 0.5)).toBe(2 * QUARTER);
    expect(countInTicks(SIX_EIGHT, 0.5)).toBe(3 * EIGHTH);
  });
});

describe('tripletGroups', () => {
  const run = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ string: 0, fret: 3 + i }));

  it('brackets exactly the beats played in triplets', () => {
    // Beat 1 in quarters, beats 2–3 in triplets, beat 4 in eighths.
    const phrase = phraseBuilder()
      .rhythm(QUARTER)
      .note({ string: 0, fret: 3 })
      .withRhythm(run(6), EIGHTH_TRIPLETS)
      .rhythm(EIGHTH)
      .sequence(run(2))
      .build();
    expect(tripletGroups(phrase)).toEqual([
      { startTick: QUARTER, durationTicks: QUARTER },
      { startTick: QUARTER * 2, durationTicks: QUARTER },
    ]);
  });

  it('leaves swung eighths unmarked: swing is a feel, not a triplet', () => {
    const phrase = phraseBuilder().withRhythm(run(8), SWUNG_EIGHTHS).build();
    expect(requiredSubdivision(phrase)).toBe(3);
    expect(tripletGroups(phrase)).toEqual([]);
  });
});
