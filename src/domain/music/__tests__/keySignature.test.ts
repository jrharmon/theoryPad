import { describe, expect, it } from 'vitest';
import { MODE_NAMES } from '../types';
import type { Chroma } from '../types';
import { chroma, pitchClass } from '../pitch';
import { preferredTonic } from '../spelling';
import { circlePosition, keySignature, relativeMajor } from '../keySignature';
import { scaleNotes } from '../scale';

describe('relativeMajor', () => {
  it.each([
    ['D', 'dorian', 'C'],
    ['E', 'phrygian', 'C'],
    ['F', 'lydian', 'C'],
    ['G', 'mixolydian', 'C'],
    ['A', 'aeolian', 'C'],
    ['B', 'locrian', 'C'],
    ['C', 'ionian', 'C'],
    ['G', 'dorian', 'F'],
    ['C#', 'phrygian', 'A'],
  ] as const)('%s %s is a rotation of %s major', (tonic, mode, expected) => {
    expect(relativeMajor({ tonic: pitchClass(tonic), mode })).toBe(expected);
  });
});

describe('keySignature', () => {
  it('gives every mode of C an empty signature', () => {
    const modesOfC = [
      ['C', 'ionian'],
      ['D', 'dorian'],
      ['E', 'phrygian'],
      ['F', 'lydian'],
      ['G', 'mixolydian'],
      ['A', 'aeolian'],
      ['B', 'locrian'],
    ] as const;
    for (const [tonic, mode] of modesOfC) {
      const sig = keySignature({ tonic: pitchClass(tonic), mode });
      expect(sig, `${tonic} ${mode}`).toMatchObject({ sharps: 0, flats: 0 });
      expect(sig.accidentals).toEqual([]);
    }
  });

  it.each([
    ['G', 'ionian', 1, 0],
    ['D', 'ionian', 2, 0],
    ['E', 'ionian', 4, 0],
    ['B', 'ionian', 5, 0],
    ['F', 'ionian', 0, 1],
    ['Bb', 'ionian', 0, 2],
    ['Eb', 'ionian', 0, 3],
    ['Db', 'ionian', 0, 5],
    ['A', 'aeolian', 0, 0],
    ['E', 'aeolian', 1, 0],
    ['G', 'dorian', 0, 1],
    ['A', 'dorian', 1, 0], // parent is G major
    ['E', 'dorian', 2, 0], // parent is D major
  ] as const)('%s %s has %i sharps and %i flats', (tonic, mode, sharps, flats) => {
    expect(keySignature({ tonic: pitchClass(tonic), mode })).toMatchObject({ sharps, flats });
  });

  it('lists accidentals in signature order', () => {
    expect(keySignature({ tonic: pitchClass('A'), mode: 'ionian' }).accidentals).toEqual([
      'F#',
      'C#',
      'G#',
    ]);
    expect(keySignature({ tonic: pitchClass('Eb'), mode: 'ionian' }).accidentals).toEqual([
      'Bb',
      'Eb',
      'Ab',
    ]);
  });

  it('never reports both sharps and flats', () => {
    for (const mode of MODE_NAMES) {
      for (let i = 0; i < 12; i += 1) {
        const km = { tonic: preferredTonic(i as Chroma, mode), mode };
        const sig = keySignature(km);
        expect(sig.sharps === 0 || sig.flats === 0, `${km.tonic} ${mode}`).toBe(true);
      }
    }
  });

  it('has a signature whose accidentals are exactly the scale’s accidentals', () => {
    for (const mode of MODE_NAMES) {
      for (let i = 0; i < 12; i += 1) {
        const km = { tonic: preferredTonic(i as Chroma, mode), mode };
        const sig = keySignature(km);
        const altered = scaleNotes(km).filter((n) => n.length > 1);
        expect(sig.sharps + sig.flats, `${km.tonic} ${mode}`).toBe(altered.length);
        expect(new Set(sig.accidentals.map((a) => chroma(a)))).toEqual(
          new Set(altered.map((a) => chroma(a))),
        );
      }
    }
  });
});

describe('circlePosition', () => {
  it('places keys around the circle of fifths', () => {
    expect(circlePosition({ tonic: pitchClass('C'), mode: 'ionian' })).toBe(0);
    expect(circlePosition({ tonic: pitchClass('G'), mode: 'ionian' })).toBe(1);
    expect(circlePosition({ tonic: pitchClass('F'), mode: 'ionian' })).toBe(-1);
    expect(circlePosition({ tonic: pitchClass('D'), mode: 'dorian' })).toBe(0);
  });
});
