import { describe, expect, it } from 'vitest';
import { DROP_D_GUITAR, STANDARD_GUITAR } from '@/domain/instrument';
import { EIGHTH, QUARTER, SIXTEENTH } from '../types';
import type { Phrase, TabNote } from '../types';
import { phraseBuilder } from '../builder';
import { soundingNotes, soundingPitch } from '../sounding';

const p = (string: number, fret: number) => ({ string, fret });

/** A built phrase with extra notes laid in, as a converter would write them. */
function withNotes(phrase: Phrase, extra: TabNote[]): Phrase {
  return {
    ...phrase,
    notes: [...phrase.notes, ...extra].sort(
      (a, b) => a.startTick - b.startTick || a.string - b.string,
    ),
  };
}

describe('soundingNotes', () => {
  it('rings a note through its ties, and moves graces off and onto the beat', () => {
    const written = phraseBuilder()
      .rhythm(QUARTER)
      .note(p(0, 3))
      .note(p(0, 3), { tied: true })
      .note(p(0, 3), { tied: true })
      .note(p(1, 7))
      .note(p(2, 9))
      .build();
    const phrase = withNotes(written, [
      {
        string: 1,
        fret: 5,
        startTick: 3 * QUARTER,
        durationTicks: SIXTEENTH,
        grace: 'before-beat',
      },
      {
        string: 2,
        fret: 7,
        startTick: 4 * QUARTER,
        durationTicks: SIXTEENTH,
        grace: 'on-beat',
      },
    ]);

    const played = soundingNotes(phrase).map((s) => [
      s.note.fret,
      s.startTick,
      s.durationTicks,
    ]);
    expect(played).toEqual([
      // Picked once, ringing for all three quarters.
      [3, 0, 3 * QUARTER],
      // The grace ends on the beat its main note is picked on.
      [5, 3 * QUARTER - SIXTEENTH, SIXTEENTH],
      [7, 3 * QUARTER, QUARTER],
      // On the beat: the grace takes the beat, and its main note follows it.
      [7, 4 * QUARTER, SIXTEENTH],
      [9, 4 * QUARTER + SIXTEENTH, QUARTER - SIXTEENTH],
    ]);
  });

  it('ties only along one string, and stops at the first note that is picked', () => {
    const phrase = phraseBuilder()
      .rhythm(EIGHTH)
      .note(p(0, 5))
      .note(p(1, 5), { tied: true })
      .note(p(0, 5))
      .build();
    // The tie on string 1 continues nothing on string 0, so string 0's notes
    // keep their own lengths.
    expect(soundingNotes(phrase).map((s) => s.durationTicks)).toEqual([EIGHTH, EIGHTH]);
  });
});

describe('soundingPitch', () => {
  it('sounds a harmonic at its pitch, in the tuning given', () => {
    const at = (fret: number, harmonic?: TabNote['harmonic'], instrument = STANDARD_GUITAR) =>
      soundingPitch(instrument, {
        string: 0,
        fret,
        startTick: 0,
        durationTicks: QUARTER,
        ...(harmonic ? { harmonic } : {}),
      });

    expect(at(3)).toBe('G2');
    // Natural: above the open string — an octave, a twelfth, two octaves.
    expect(at(12, { kind: 'natural' })).toBe('E3');
    expect(at(7, { kind: 'natural' })).toBe('B3');
    expect(at(5, { kind: 'natural' })).toBe('E4');
    expect(at(12, { kind: 'natural' }, DROP_D_GUITAR)).toBe('D3');
    // Not a node: as fretted.
    expect(at(6, { kind: 'natural' })).toBe('Bb2');
    // Pinch and artificial: above the fretted note, an octave unless told.
    expect(at(3, { kind: 'pinch' })).toBe('G3');
    expect(at(3, { kind: 'artificial', fret: 7 })).toBe('D4');
  });
});
