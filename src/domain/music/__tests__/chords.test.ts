import { describe, expect, it } from 'vitest';
import { MODE_NAMES } from '../types';
import type { Chroma } from '../types';
import { pitchClass, semitonesBetween } from '../pitch';
import { preferredTonic } from '../spelling';
import { chordOnDegree, chordTones, diatonicChords } from '../chords';
import { scaleNotes } from '../scale';

const ALL_KEYS = MODE_NAMES.flatMap((mode) =>
  Array.from({ length: 12 }, (_, i) => ({ tonic: preferredTonic(i as Chroma, mode), mode })),
);

describe('diatonicChords', () => {
  it('gives seven chords built only from scale notes, in every key and mode', () => {
    for (const km of ALL_KEYS) {
      const inScale = new Set(scaleNotes(km));
      const chords = diatonicChords(km);
      expect(chords).toHaveLength(7);
      for (const chord of chords) {
        for (const note of chord.notes.seventh) {
          expect(inScale.has(note), `${chord.seventhSymbol} in ${km.tonic} ${km.mode}`).toBe(true);
        }
      }
    }
  });

  it('gives the same qualities in every key of a mode', () => {
    for (const mode of MODE_NAMES) {
      const reference = diatonicChords({ tonic: preferredTonic(0 as Chroma, mode), mode }).map(
        (c) => c.seventh,
      );
      for (let i = 0; i < 12; i += 1) {
        const km = { tonic: preferredTonic(i as Chroma, mode), mode };
        expect(diatonicChords(km).map((c) => c.seventh), `${km.tonic} ${mode}`).toEqual(reference);
      }
    }
  });

  it('builds C major correctly', () => {
    const chords = diatonicChords({ tonic: pitchClass('C'), mode: 'ionian' });
    expect(chords.map((c) => c.triadSymbol)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
    expect(chords.map((c) => c.seventhSymbol)).toEqual([
      'Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5',
    ]);
  });

  it('builds D dorian correctly, including the major IV that defines it', () => {
    const chords = diatonicChords({ tonic: pitchClass('D'), mode: 'dorian' });
    expect(chords.map((c) => c.triadSymbol)).toEqual(['Dm', 'Em', 'F', 'G', 'Am', 'Bdim', 'C']);
    expect(chords.map((c) => c.seventhSymbol)).toEqual([
      'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5', 'Cmaj7',
    ]);
    // The subdominant being major is exactly what makes it Dorian rather than Aeolian.
    const subdominant = chords.find((c) => c.function === 'subdominant');
    expect(subdominant?.triadSymbol).toBe('G');
    expect(subdominant?.triad).toBe('maj');
  });

  it('marks tonic, subdominant and dominant, and nothing else', () => {
    const chords = diatonicChords({ tonic: pitchClass('D'), mode: 'dorian' });
    expect(chords.map((c) => c.function)).toEqual([
      'tonic', 'other', 'other', 'subdominant', 'dominant', 'other', 'other',
    ]);
  });

  it('reports no ninth where the diatonic ninth is a minor 9th', () => {
    // In D dorian the note above E is F, a minor 9th — so there is no Em9.
    const chords = diatonicChords({ tonic: pitchClass('D'), mode: 'dorian' });
    const eMinor = chords[1]!;
    expect(eMinor.seventhSymbol).toBe('Em7');
    expect(eMinor.ninthSymbol).toBeNull();

    // The vii of D dorian is Bm7b5; the note above B is C, also a minor 9th.
    expect(chords[5]!.ninthSymbol).toBeNull();

    // But the tonic does have one.
    expect(chords[0]!.ninthSymbol).toBe('Dm9');
  });

  it('spells the ninth chords of C major', () => {
    const chords = diatonicChords({ tonic: pitchClass('C'), mode: 'ionian' });
    expect(chords.map((c) => c.ninthSymbol)).toEqual([
      'Cmaj9', 'Dm9', null, 'Fmaj9', 'G9', 'Am9', null,
    ]);
  });

  it('exposes the chord on a degree', () => {
    const km = { tonic: pitchClass('G'), mode: 'mixolydian' as const };
    expect(chordOnDegree(km, 7).seventhSymbol).toBe('Fmaj7');
    expect(chordOnDegree(km, 1).seventhSymbol).toBe('G7');
  });
});

describe('chordTones', () => {
  it.each([
    ['C', 'maj7', 'C E G B'],
    ['D', 'min7', 'D F A C'],
    ['G', 'dom7', 'G B D F'],
    ['B', 'min7b5', 'B D F A'],
    ['Eb', 'maj', 'Eb G Bb'],
    ['F#', 'min', 'F# A C#'],
    ['Bb', 'dom7', 'Bb D F Ab'],
  ] as const)('spells %s%s', (root, quality, expected) => {
    expect(chordTones(pitchClass(root), quality).join(' ')).toBe(expected);
  });

  it('uses one letter name per chord tone', () => {
    for (const root of ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']) {
      for (const quality of ['maj', 'min', 'dim', 'maj7', 'min7', 'dom7'] as const) {
        const tones = chordTones(pitchClass(root), quality);
        const letters = tones.map((t) => t[0]);
        expect(new Set(letters).size, `${root}${quality} -> ${tones.join(' ')}`).toBe(tones.length);
      }
    }
  });

  it('produces the right intervals', () => {
    const tones = chordTones(pitchClass('Eb'), 'dom7');
    expect(tones.map((t) => semitonesBetween(pitchClass('Eb'), t))).toEqual([0, 4, 7, 10]);
  });
});
