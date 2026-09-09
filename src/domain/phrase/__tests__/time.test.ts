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
  makeBars,
  phraseSeconds,
  requiredSubdivision,
  secondsToTicks,
  ticksPerBar,
  ticksPerBeat,
  ticksToSeconds,
  tickToBarBeat,
} from '../time';
import { phraseBuilder } from '../builder';

describe('PPQ', () => {
  it('divides cleanly into every subdivision we use', () => {
    // This is the whole reason for integer ticks: no float comparisons.
    for (const divisor of [1, 2, 3, 4, 5, 6, 8, 10, 12, 16]) {
      expect(PPQ % divisor, `PPQ / ${divisor}`).toBe(0);
    }
  });

  it('makes triplets exact', () => {
    // Three eighth-note triplets fill one quarter.
    expect(EIGHTH_TRIPLET * 3).toBe(QUARTER);
    expect(Number.isInteger(EIGHTH_TRIPLET)).toBe(true);
    // The thing float beats get wrong: 1/3 + 1/3 + 1/3 !== 1.
    expect(EIGHTH_TRIPLET + EIGHTH_TRIPLET + EIGHTH_TRIPLET).toBe(QUARTER);
  });

  it('keeps note values consistent', () => {
    expect(WHOLE).toBe(QUARTER * 4);
    expect(EIGHTH * 2).toBe(QUARTER);
    expect(SIXTEENTH * 4).toBe(QUARTER);
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
  const phrase = phraseBuilder().rest(QUARTER * 16).build();

  it('locates the start', () => {
    expect(tickToBarBeat(phrase, 0)).toEqual({ bar: 0, beat: 0, offsetTicks: 0 });
  });

  it('locates a beat inside a bar', () => {
    expect(tickToBarBeat(phrase, QUARTER * 2)).toEqual({ bar: 0, beat: 2, offsetTicks: 0 });
  });

  it('locates the mockup’s "bar 2, beat 3"', () => {
    // Bar 2 beat 3 in one-based terms is bar index 1, beat index 2.
    const tick = QUARTER * 4 + QUARTER * 2;
    expect(tickToBarBeat(phrase, tick)).toEqual({ bar: 1, beat: 2, offsetTicks: 0 });
  });

  it('reports the offset within a beat', () => {
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
  it('makes a quarter note one second at 60 bpm', () => {
    expect(ticksToSeconds(QUARTER, 60)).toBe(1);
  });

  it('halves the duration at double the tempo', () => {
    expect(ticksToSeconds(QUARTER, 120)).toBe(0.5);
  });

  it('makes a 4/4 bar two seconds at 120 bpm', () => {
    expect(ticksToSeconds(ticksPerBar(FOUR_FOUR), 120)).toBe(2);
  });

  it('round-trips', () => {
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
  it('needs only quarters for a quarter-note phrase', () => {
    const phrase = phraseBuilder().rhythm(QUARTER).sequence([
      { string: 0, fret: 3 }, { string: 0, fret: 5 },
    ]).build();
    expect(requiredSubdivision(phrase)).toBe(1);
  });

  it('needs four for sixteenths', () => {
    const phrase = phraseBuilder().rhythm(SIXTEENTH).sequence([
      { string: 0, fret: 3 }, { string: 0, fret: 5 }, { string: 0, fret: 7 },
    ]).build();
    expect(requiredSubdivision(phrase)).toBe(4);
  });

  it('needs three for triplets', () => {
    const phrase = phraseBuilder().rhythm(EIGHTH_TRIPLET).sequence([
      { string: 0, fret: 3 }, { string: 0, fret: 5 }, { string: 0, fret: 7 },
    ]).build();
    expect(requiredSubdivision(phrase)).toBe(3);
  });

  it('needs twelve when a phrase lands on both grids', () => {
    // Notes at 0 and 120 sit on the sixteenth grid; 320 sits on the triplet
    // grid and not the sixteenth one. Only a twelfth-of-a-quarter grid holds
    // all three.
    const phrase = phraseBuilder()
      .rhythm(SIXTEENTH)
      .sequence([{ string: 0, fret: 3 }, { string: 0, fret: 5 }])
      .rest(SIXTEENTH * 2 - EIGHTH_TRIPLET)
      .rhythm(EIGHTH_TRIPLET)
      .sequence([{ string: 0, fret: 7 }])
      .build();
    expect(phrase.notes.map((n) => n.startTick)).toEqual([0, 120, 320]);
    expect(requiredSubdivision(phrase)).toBe(12);
  });
});
