import { describe, expect, it } from 'vitest';
import { SCALE_IDS } from '../types';
import type { KeyMode, ModeId, ScaleId } from '../types';
import { hasDoubleAccidental, pitchClass } from '../pitch';
import { tonicsForMode } from '../spelling';
import {
  hasDegree,
  noteAtDegree,
  makeDegree,
  scaleDegrees,
  scaleNotes,
  signatureNote,
  stepPattern,
} from '../scale';
import { harmonyOf, keyModeName, modesOf, parentMode } from '../scales';
import { diatonicChords, romanNumeral } from '../chords';
import { hasKeySignature, keySignature, relativeMajor } from '../keySignature';

const km = (tonic: string, scale: ScaleId, mode: ModeId = modesOf(scale)[0]!): KeyMode => ({
  tonic: pitchClass(tonic),
  scale,
  mode,
});

/** Every scale × mode × tonic, canonically spelled. */
const EVERY_KEY: KeyMode[] = SCALE_IDS.flatMap((scale) =>
  modesOf(scale).flatMap((mode) =>
    tonicsForMode({ scale, mode }).map((tonic) => ({ tonic, scale, mode })),
  ),
);

describe('every scale, mode and tonic', () => {
  it('spells cleanly, from a tonic with a usual name, and steps up one octave', () => {
    const sizes: Record<ScaleId, number> = {
      major: 7,
      'minor-pentatonic': 5,
      'major-pentatonic': 5,
      blues: 6,
      'harmonic-minor': 7,
      'phrygian-dominant': 7,
      'melodic-minor': 7,
    };
    for (const key of EVERY_KEY) {
      const label = `${key.tonic} ${key.scale} ${key.mode}`;
      const notes = scaleNotes(key);
      expect(notes, label).toHaveLength(sizes[key.scale]);
      expect(notes[0], label).toBe(key.tonic);
      expect(['E#', 'B#', 'Fb', 'Cb'], label).not.toContain(key.tonic);
      expect(notes.some(hasDoubleAccidental), `${label} -> ${notes.join(' ')}`).toBe(false);
      if (notes.length === 7) {
        expect(new Set(notes.map((n) => n[0])).size, `${label} -> ${notes.join(' ')}`).toBe(7);
      }
      expect(
        stepPattern(key).reduce((a, b) => a + b, 0),
        label,
      ).toBe(12);
    }
  });

  it('keeps the notes when only the shape changes', () => {
    for (const scale of ['minor-pentatonic', 'major-pentatonic', 'blues'] as const) {
      const shapes = modesOf(scale).map((mode) => scaleNotes(km('A', scale, mode)).join(' '));
      expect(new Set(shapes).size, scale).toBe(1);
    }
  });
});

describe('scale formulas', () => {
  it.each<[ScaleId, string, string, string]>([
    ['minor-pentatonic', 'A', '1 ♭3 4 5 ♭7', 'A C D E G'],
    ['major-pentatonic', 'C', '1 2 3 5 6', 'C D E G A'],
    ['blues', 'E', '1 ♭3 4 ♭5 5 ♭7', 'E G A Bb B D'],
    // E♭ blues' ♭5 would be B𝄫; it is written A.
    ['blues', 'Eb', '1 ♭3 4 ♭5 5 ♭7', 'Eb Gb Ab A Bb Db'],
    ['harmonic-minor', 'A', '1 2 ♭3 4 5 ♭6 7', 'A B C D E F G#'],
    ['phrygian-dominant', 'E', '1 ♭2 3 4 5 ♭6 ♭7', 'E F G# A B C D'],
    ['melodic-minor', 'A', '1 2 ♭3 4 5 6 7', 'A B C D E F# G#'],
  ])('gives %s its degrees and notes', (scale, tonic, degrees, notes) => {
    const key = km(tonic, scale);
    expect(
      scaleDegrees(key)
        .map((d) => d.label)
        .join(' '),
    ).toBe(degrees);
    expect(scaleNotes(key).join(' ')).toBe(notes);
  });
});

describe('tonic spelling', () => {
  it.each<[ScaleId, string]>([
    // Borrowed from Aeolian, except G♯, which would need F𝄪.
    ['harmonic-minor', 'C C# D Eb E F F# G Ab A Bb B'],
    ['melodic-minor', 'C C# D Eb E F F# G Ab A Bb B'],
    // Borrowed from Phrygian, except D♯, which would need F𝄪.
    ['phrygian-dominant', 'C C# D Eb E F F# G G# A Bb B'],
    ['minor-pentatonic', 'C C# D Eb E F F# G G# A Bb B'],
    ['blues', 'C C# D Eb E F F# G G# A Bb B'],
    ['major-pentatonic', 'C Db D Eb E F F# G Ab A Bb B'],
  ])('picks conventional tonics for %s', (scale, expected) => {
    expect(tonicsForMode({ scale, mode: modesOf(scale)[0]! }).join(' ')).toBe(expected);
  });
});

describe('degrees by number', () => {
  it('takes blues’ natural 5th for a bare 5, and the ♭5 only when asked', () => {
    const e = km('E', 'blues');
    expect(noteAtDegree(e, 5)).toBe('B');
    expect(noteAtDegree(e, makeDegree(5, -1))).toBe('Bb');
  });

  it('has no 2nd or 6th in minor pentatonic', () => {
    const a = km('A', 'minor-pentatonic');
    expect(hasDegree(a, 2)).toBe(false);
    expect(hasDegree(a, 7)).toBe(true);
    expect(() => noteAtDegree(a, 2)).toThrow();
  });

  it.each<[ScaleId, string]>([
    ['minor-pentatonic', 'C'],
    ['major-pentatonic', 'C#'],
    ['blues', 'Eb'],
    ['harmonic-minor', 'G#'],
    ['phrygian-dominant', 'C#'],
    ['melodic-minor', 'F#'],
  ])('finds the signature note of A %s', (scale, note) => {
    expect(signatureNote(km('A', scale))).toBe(note);
  });
});

describe('chords of harmonic minor, Phrygian dominant and melodic minor', () => {
  it.each<[string, ScaleId, string, string, string]>([
    [
      'A',
      'harmonic-minor',
      'Am Bdim Caug Dm E F G#dim',
      'AmMaj7 Bm7b5 Cmaj7#5 Dm7 E7 Fmaj7 G#dim7',
      'i ii° ♭III+ iv V ♭VI vii°',
    ],
    [
      'E',
      'phrygian-dominant',
      'E F G#dim Am Bdim Caug Dm',
      'E7 Fmaj7 G#dim7 AmMaj7 Bm7b5 Cmaj7#5 Dm7',
      'I ♭II iii° iv v° ♭VI+ ♭vii',
    ],
    [
      'A',
      'melodic-minor',
      'Am Bm Caug D E F#dim G#dim',
      'AmMaj7 Bm7 Cmaj7#5 D7 E7 F#m7b5 G#m7b5',
      'i ii ♭III+ IV V vi° vii°',
    ],
  ])('builds %s %s', (tonic, scale, triads, sevenths, numerals) => {
    const chords = diatonicChords(km(tonic, scale));
    expect(chords.map((c) => c.triadSymbol).join(' ')).toBe(triads);
    expect(chords.map((c) => c.seventhSymbol).join(' ')).toBe(sevenths);
    expect(chords.map(romanNumeral).join(' ')).toBe(numerals);
  });

  it('gives a pentatonic no chords of its own, and its parent’s through harmonyOf', () => {
    const a = km('A', 'minor-pentatonic', 'shape-3');
    expect(() => diatonicChords(a)).toThrow();
    expect(diatonicChords(harmonyOf(a)).map((c) => c.triadSymbol)).toEqual(
      diatonicChords(km('A', 'major', 'aeolian')).map((c) => c.triadSymbol),
    );
  });
});

describe('parent mode', () => {
  it.each<[ScaleId, string | null]>([
    ['minor-pentatonic', 'aeolian'],
    ['major-pentatonic', 'ionian'],
    ['blues', 'aeolian'],
    ['harmonic-minor', null],
    ['phrygian-dominant', null],
    ['melodic-minor', null],
  ])('maps %s to %s on the same root', (scale, mode) => {
    const key = km('A', scale);
    const parent = parentMode(key);
    expect(parent && parent.mode).toBe(mode);
    if (parent) expect(parent).toEqual({ tonic: 'A', scale: 'major', mode });
    // Harmony: the parent's for a pentatonic, its own otherwise.
    expect(harmonyOf(key)).toEqual(parent ?? key);
  });

  it('is the mode itself on the Major scale', () => {
    const d = km('D', 'major', 'dorian');
    expect(parentMode(d)).toEqual(d);
  });

  it('gives a pentatonic its parent’s signature, and the others none', () => {
    expect(keySignature(km('E', 'minor-pentatonic'))).toEqual(
      keySignature(km('E', 'major', 'aeolian')),
    );
    expect(relativeMajor(km('A', 'major-pentatonic'))).toBe('A');
    expect(hasKeySignature(km('E', 'phrygian-dominant'))).toBe(false);
    expect(() => relativeMajor(km('A', 'harmonic-minor'))).toThrow();
  });
});

describe('keyModeName', () => {
  it.each<[KeyMode, string]>([
    [km('D', 'major', 'dorian'), 'D Dorian'],
    [km('A', 'minor-pentatonic', 'shape-2'), 'A minor pentatonic, shape 2'],
    [km('E', 'blues', 'shape-1'), 'E blues, shape 1'],
    [km('E', 'phrygian-dominant'), 'E Phrygian dominant'],
    [km('A', 'harmonic-minor'), 'A harmonic minor'],
  ])('names %o as %s', (key, name) => {
    expect(keyModeName(key)).toBe(name);
  });
});
