import { describe, expect, it } from 'vitest';
import { MODE_NAMES } from '../types';
import type { Chroma } from '../types';
import { pitchClass } from '../pitch';
import { preferredTonic } from '../spelling';
import {
  degreeOf,
  isInScale,
  scaleDegrees,
  scaleNotes,
  signatureDegree,
  signatureNote,
  stepPattern,
} from '../scale';

const ALL_CHROMAS = Array.from({ length: 12 }, (_, i) => i as Chroma);

/** Every canonical key/mode pair: 12 tonics x 7 modes. */
const ALL_KEYS = MODE_NAMES.flatMap((mode) =>
  ALL_CHROMAS.map((c) => ({ tonic: preferredTonic(c, mode), scale: 'major' as const, mode })),
);

describe('scaleNotes', () => {
  it('uses each letter name exactly once, in every key and mode', () => {
    for (const km of ALL_KEYS) {
      const notes = scaleNotes(km);
      const letters = notes.map((n) => n[0]);
      expect(new Set(letters).size, `${km.tonic} ${km.mode} -> ${notes.join(' ')}`).toBe(7);
    }
  });

  it('starts on the tonic', () => {
    for (const km of ALL_KEYS) {
      expect(scaleNotes(km)[0]).toBe(km.tonic);
    }
  });

  it.each([
    ['D', 'dorian', 'D E F G A B C'],
    ['C', 'ionian', 'C D E F G A B'],
    ['A', 'aeolian', 'A B C D E F G'],
    ['G', 'mixolydian', 'G A B C D E F'],
    ['F', 'lydian', 'F G A B C D E'],
    ['E', 'phrygian', 'E F G A B C D'],
    ['B', 'locrian', 'B C D E F G A'],
    // The seven modes of C, which must all be the white notes.
    ['Eb', 'ionian', 'Eb F G Ab Bb C D'],
    ['F#', 'ionian', 'F# G# A# B C# D# E#'],
    ['C#', 'phrygian', 'C# D E F# G# A B'],
  ] as const)('spells %s %s correctly', (tonic, mode, expected) => {
    expect(
      scaleNotes({ tonic: pitchClass(tonic), scale: 'major' as const, mode }).join(' '),
    ).toBe(expected);
  });
});

describe('scaleDegrees', () => {
  it.each([
    ['ionian', '1 2 3 4 5 6 7'],
    ['dorian', '1 2 ♭3 4 5 6 ♭7'],
    ['phrygian', '1 ♭2 ♭3 4 5 ♭6 ♭7'],
    ['lydian', '1 2 3 ♯4 5 6 7'],
    ['mixolydian', '1 2 3 4 5 6 ♭7'],
    ['aeolian', '1 2 ♭3 4 5 ♭6 ♭7'],
    ['locrian', '1 ♭2 ♭3 4 ♭5 ♭6 ♭7'],
  ] as const)('gives %s the right formula', (mode, expected) => {
    const degrees = scaleDegrees({ tonic: pitchClass('C'), scale: 'major' as const, mode });
    expect(degrees.map((d) => d.label).join(' ')).toBe(expected);
  });

  it('gives the same formula regardless of tonic', () => {
    for (const mode of MODE_NAMES) {
      const reference = scaleDegrees({
        tonic: preferredTonic(0 as Chroma, mode),
        scale: 'major' as const,
        mode,
      }).map((d) => d.label);
      for (const c of ALL_CHROMAS) {
        const km = { tonic: preferredTonic(c, mode), scale: 'major' as const, mode };
        expect(
          scaleDegrees(km).map((d) => d.label),
          `${km.tonic} ${km.mode}`,
        ).toEqual(reference);
      }
    }
  });
});

describe('degreeOf', () => {
  it('finds every scale note, and rejects notes outside the key', () => {
    const km = { tonic: pitchClass('D'), scale: 'major' as const, mode: 'dorian' as const };
    expect(degreeOf(km, pitchClass('B'))?.label).toBe('6');
    expect(degreeOf(km, pitchClass('F'))?.label).toBe('♭3');
    expect(degreeOf(km, pitchClass('F#'))).toBeNull();
    expect(isInScale(km, pitchClass('C'))).toBe(true);
    expect(isInScale(km, pitchClass('C#'))).toBe(false);
  });

  it('matches by pitch, not by spelling', () => {
    const km = { tonic: pitchClass('Eb'), scale: 'major' as const, mode: 'ionian' as const };
    // Eb major contains Ab; someone may hand us G#.
    expect(degreeOf(km, pitchClass('G#'))?.label).toBe('4');
  });
});

describe('signature degree', () => {
  // All rooted on D, so the note column is checkable by hand:
  //   D ionian     D E F# G  A  B  C#
  //   D dorian     D E F  G  A  B  C
  //   D phrygian   D Eb F  G  A  Bb C
  //   D lydian     D E F# G# A  B  C#
  //   D mixolydian D E F# G  A  B  C
  //   D aeolian    D E F  G  A  Bb C
  //   D locrian    D Eb F  G  Ab Bb C
  it.each([
    ['ionian', '7', 'C#'],
    ['dorian', '6', 'B'],
    ['phrygian', '♭2', 'Eb'],
    ['lydian', '♯4', 'G#'],
    ['mixolydian', '♭7', 'C'],
    ['aeolian', '♭6', 'Bb'],
    ['locrian', '♭5', 'Ab'],
  ] as const)('for %s is %s', (mode, label, note) => {
    const km = { tonic: pitchClass('D'), scale: 'major' as const, mode };
    expect(signatureDegree(km).label).toBe(label);
    expect(signatureNote(km)).toBe(note);
  });
});

describe('stepPattern', () => {
  it('gives the major scale W-W-H-W-W-W-H', () => {
    expect(
      stepPattern({ tonic: pitchClass('C'), scale: 'major' as const, mode: 'ionian' }),
    ).toEqual([2, 2, 1, 2, 2, 2, 1]);
  });

  it('gives dorian W-H-W-W-W-H-W', () => {
    expect(
      stepPattern({ tonic: pitchClass('D'), scale: 'major' as const, mode: 'dorian' }),
    ).toEqual([2, 1, 2, 2, 2, 1, 2]);
  });

  it('always sums to an octave', () => {
    for (const km of ALL_KEYS) {
      const sum = stepPattern(km).reduce((a, b) => a + b, 0);
      expect(sum, `${km.tonic} ${km.mode}`).toBe(12);
    }
  });
});
