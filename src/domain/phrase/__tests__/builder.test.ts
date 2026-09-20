import { describe, expect, it } from 'vitest';
import { EIGHTH, FOUR_FOUR, PPQ, QUARTER, SIXTEENTH, THREE_FOUR } from '../types';
import { emptyPhrase, phraseBuilder } from '../builder';
import { GALLOP, STRAIGHT_EIGHTHS, STRAIGHT_SIXTEENTHS, SWUNG_EIGHTHS } from '../rhythm';
import { ticksPerBar } from '../time';

const p = (string: number, fret: number) => ({ string, fret });

describe('PhraseBuilder', () => {
  it('lays notes end to end at the current rhythm', () => {
    const phrase = phraseBuilder()
      .rhythm(EIGHTH)
      .sequence([p(0, 3), p(0, 5), p(0, 7)])
      .build();

    expect(phrase.notes.map((n) => n.startTick)).toEqual([0, EIGHTH, EIGHTH * 2]);
    expect(phrase.notes.every((n) => n.durationTicks === EIGHTH)).toBe(true);
  });

  it('records the phrase’s own PPQ so a serialised phrase is self-describing', () => {
    expect(phraseBuilder().rest(QUARTER).build().ppq).toBe(PPQ);
  });

  it('sorts notes by tick, then by string', () => {
    const phrase = phraseBuilder()
      .rhythm(QUARTER)
      .chord([p(3, 5), p(1, 3), p(2, 4)])
      .note(p(0, 1))
      .build();

    expect(phrase.notes.map((n) => [n.startTick, n.string])).toEqual([
      [0, 1],
      [0, 2],
      [0, 3],
      [QUARTER, 0],
    ]);
  });

  it('sounds a chord’s notes together and advances once', () => {
    const phrase = phraseBuilder()
      .rhythm(QUARTER)
      .chord([p(3, 5), p(4, 5)])
      .note(p(0, 3))
      .build();
    expect(phrase.notes[0]!.startTick).toBe(0);
    expect(phrase.notes[1]!.startTick).toBe(0);
    expect(phrase.notes[2]!.startTick).toBe(QUARTER);
  });

  it('grows in whole bars, never ending mid-bar', () => {
    // Three quarters in 4/4 still occupies one full bar.
    const short = phraseBuilder()
      .rhythm(QUARTER)
      .sequence([p(0, 1), p(0, 2), p(0, 3)])
      .build();
    expect(short.totalTicks).toBe(ticksPerBar(FOUR_FOUR));
    expect(short.bars).toHaveLength(1);

    const longer = phraseBuilder()
      .rhythm(QUARTER)
      .sequence(Array.from({ length: 9 }, (_, i) => p(0, i)))
      .build();
    expect(longer.bars).toHaveLength(3);
    expect(longer.bars.map((b) => b.startTick)).toEqual([0, QUARTER * 4, QUARTER * 8]);

    // Even a note that overhangs the bar line rounds the phrase up.
    const overhang = phraseBuilder()
      .note(p(0, 3), {}, QUARTER * 5)
      .build();
    expect(overhang.totalTicks).toBe(QUARTER * 8);
  });

  it('respects an alternate time signature', () => {
    const phrase = phraseBuilder({ timeSignature: THREE_FOUR })
      .rhythm(QUARTER)
      .sequence([p(0, 1), p(0, 2), p(0, 3), p(0, 4)])
      .build();
    expect(phrase.bars).toHaveLength(2);
    expect(phrase.totalTicks).toBe(QUARTER * 6);
  });

  it('rests without sounding anything', () => {
    const phrase = phraseBuilder().rhythm(QUARTER).note(p(0, 3)).rest().note(p(0, 5)).build();
    expect(phrase.notes).toHaveLength(2);
    expect(phrase.notes.map((n) => n.startTick)).toEqual([0, QUARTER * 2]);
  });

  it('fills to the next bar line, and does nothing when already on one', () => {
    const b = phraseBuilder()
      .rhythm(QUARTER)
      .sequence([p(0, 1), p(0, 2)]);
    expect(b.position).toBe(QUARTER * 2);
    b.fillBar();
    expect(b.position).toBe(QUARTER * 4);
    b.fillBar();
    expect(b.position).toBe(QUARTER * 4);
  });

  it('labels the bar the cursor is in', () => {
    const phrase = phraseBuilder()
      .rhythm(QUARTER)
      .labelBar('Bar 1')
      .sequence([p(0, 1), p(0, 2), p(0, 3), p(0, 4)])
      .labelBar('Bar 2 · land on B')
      .sequence([p(0, 5), p(0, 6), p(0, 7), p(0, 8)])
      .build();

    expect(phrase.bars[0]!.label).toBe('Bar 1');
    expect(phrase.bars[1]!.label).toBe('Bar 2 · land on B');
  });

  it('leaves label off a bar that has none', () => {
    const phrase = phraseBuilder().rhythm(QUARTER).note(p(0, 1)).build();
    expect(phrase.bars[0]).not.toHaveProperty('label');
  });

  it('carries note options through', () => {
    const phrase = phraseBuilder()
      .rhythm(EIGHTH)
      .note(p(0, 3), { role: 'root', articulation: 'hammer-on', finger: 1, annotation: '1' })
      .build();
    expect(phrase.notes[0]).toMatchObject({
      role: 'root',
      articulation: 'hammer-on',
      finger: 1,
      annotation: '1',
    });
  });

  it('rejects a non-positive rhythm', () => {
    expect(() => phraseBuilder().rhythm(0)).toThrow();
    expect(() => phraseBuilder().rhythm(-1)).toThrow();
  });

  it('carries repeat onto the phrase', () => {
    expect(phraseBuilder({ repeat: 2 }).rest(QUARTER).build().repeat).toBe(2);
    expect(phraseBuilder().rest(QUARTER).build()).not.toHaveProperty('repeat');
  });
});

describe('withRhythm', () => {
  it('cycles a pattern across however many notes it is given', () => {
    const positions = Array.from({ length: 6 }, (_, i) => p(0, i));
    const phrase = phraseBuilder().withRhythm(positions, GALLOP).build();
    // Gallop is eighth, sixteenth, sixteenth — one beat per cycle.
    expect(phrase.notes.map((n) => n.durationTicks)).toEqual([
      EIGHTH,
      SIXTEENTH,
      SIXTEENTH,
      EIGHTH,
      SIXTEENTH,
      SIXTEENTH,
    ]);
    expect(phrase.notes.map((n) => n.startTick)).toEqual([
      0,
      EIGHTH,
      EIGHTH + SIXTEENTH,
      QUARTER,
      QUARTER + EIGHTH,
      QUARTER + EIGHTH + SIXTEENTH,
    ]);
  });

  it('applies the pattern’s velocities', () => {
    const positions = Array.from({ length: 4 }, (_, i) => p(0, i));
    const phrase = phraseBuilder().withRhythm(positions, STRAIGHT_SIXTEENTHS).build();
    expect(phrase.notes.map((n) => n.velocity)).toEqual([1, 0.7, 0.8, 0.7]);
  });

  it('swings the offbeat without drifting', () => {
    const positions = Array.from({ length: 8 }, (_, i) => p(0, i));
    const phrase = phraseBuilder().withRhythm(positions, SWUNG_EIGHTHS).build();
    const starts = phrase.notes.map((n) => n.startTick);
    // Downbeats stay exactly on the beat however long the run is.
    expect(starts[0]).toBe(0);
    expect(starts[2]).toBe(QUARTER);
    expect(starts[4]).toBe(QUARTER * 2);
    expect(starts[6]).toBe(QUARTER * 3);
    // Offbeats land late.
    expect(starts[1]!).toBeGreaterThan(EIGHTH);
    // Each swung pair still fills exactly one beat.
    const first = phrase.notes[0]!;
    const second = phrase.notes[1]!;
    expect(first.durationTicks + second.durationTicks).toBe(QUARTER);
  });

  it('continues from the cursor rather than restarting at zero', () => {
    const phrase = phraseBuilder()
      .rhythm(QUARTER)
      .note(p(0, 1))
      .withRhythm([p(0, 2), p(0, 3)], STRAIGHT_EIGHTHS)
      .build();
    expect(phrase.notes.map((n) => n.startTick)).toEqual([0, QUARTER, QUARTER + EIGHTH]);
  });

  it('accepts per-note options', () => {
    const phrase = phraseBuilder()
      .withRhythm([p(0, 3), p(0, 5)], STRAIGHT_EIGHTHS, (_pos, i) => ({
        role: i === 0 ? 'root' : 'passing',
      }))
      .build();
    expect(phrase.notes.map((n) => n.role)).toEqual(['root', 'passing']);
  });
});

describe('emptyPhrase', () => {
  it('gives bars and no notes', () => {
    const phrase = emptyPhrase(4);
    expect(phrase.notes).toEqual([]);
    expect(phrase.bars).toHaveLength(4);
    expect(phrase.totalTicks).toBe(ticksPerBar(FOUR_FOUR) * 4);
  });
});
