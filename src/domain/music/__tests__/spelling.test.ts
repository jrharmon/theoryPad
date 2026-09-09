import { describe, expect, it } from 'vitest';
import { MODE_NAMES } from '../types';
import type { Chroma, ModeName } from '../types';
import { canonicalKeyMode, preferredTonic, tonicsForMode } from '../spelling';
import { chroma, hasDoubleAccidental, pitchClass } from '../pitch';
import { scaleNotes } from '../scale';

const ALL_CHROMAS = Array.from({ length: 12 }, (_, i) => i as Chroma);

describe('preferredTonic', () => {
  it('produces a clean spelling for every chroma in every mode', () => {
    for (const mode of MODE_NAMES) {
      for (const c of ALL_CHROMAS) {
        const tonic = preferredTonic(c, mode);
        expect(chroma(tonic), `${mode} chroma ${c}`).toBe(c);
        for (const note of scaleNotes({ tonic, mode })) {
          expect(hasDoubleAccidental(note), `${tonic} ${mode} -> ${note}`).toBe(false);
        }
      }
    }
  });

  // The full twelve for every mode. Several entries here are the interesting
  // ones: C# phrygian (Db would need double flats), Bb phrygian and Ab dorian
  // and Db mixolydian (exact ties, decided toward the readable spelling), and
  // G# aeolian (five accidentals against Ab's seven, so count decides).
  it.each<[ModeName, string]>([
    ['ionian', 'C Db D Eb E F F# G Ab A Bb B'],
    ['dorian', 'C C# D Eb E F F# G Ab A Bb B'],
    ['phrygian', 'C C# D D# E F F# G G# A Bb B'],
    ['lydian', 'C Db D Eb E F Gb G Ab A Bb B'],
    ['mixolydian', 'C Db D Eb E F F# G Ab A Bb B'],
    ['aeolian', 'C C# D Eb E F F# G G# A Bb B'],
    ['locrian', 'C C# D D# E F F# G G# A A# B'],
  ])('picks conventional tonics for %s', (mode, expected) => {
    expect(tonicsForMode(mode).join(' ')).toBe(expected);
  });

  it.each([
    // Each of these is an exact tie on accidental count, decided by convention.
    ['F', 'locrian', 'F'], // not E#
    ['Eb', 'aeolian', 'Eb'], // not D#
    ['F#', 'ionian', 'F#'], // not Gb — guitarists read F# major
    ['Db', 'mixolydian', 'Db'], // not C#
    ['Bb', 'lydian', 'Bb'], // not A#
  ] as const)('breaks the %s %s tie toward %s', (input, mode, expected) => {
    expect(preferredTonic(chroma(pitchClass(input)), mode)).toBe(expected);
  });
});

describe('canonicalKeyMode', () => {
  it('respells an awkward tonic without changing the pitches', () => {
    const canonical = canonicalKeyMode({ tonic: pitchClass('Db'), mode: 'phrygian' });
    expect(canonical.tonic).toBe('C#');
    expect(chroma(canonical.tonic)).toBe(chroma(pitchClass('Db')));
  });

  it('leaves an already-conventional key alone', () => {
    const km = { tonic: pitchClass('D'), mode: 'dorian' as const };
    expect(canonicalKeyMode(km)).toEqual(km);
  });
});
