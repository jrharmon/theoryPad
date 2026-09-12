import { describe, expect, it } from 'vitest';
import { MODE_NAMES } from '../types';
import type { Chroma } from '../types';
import { preferredTonic } from '../spelling';
import { signatureDegree } from '../scale';
import { chordOnDegree, diatonicChords, romanNumeral } from '../chords';
import { MODE_CHARACTER, modeCharacter } from '../modeCharacter';

describe('modeCharacter', () => {
  it('has every section written for every mode', () => {
    expect(Object.keys(MODE_CHARACTER).sort()).toEqual([...MODE_NAMES].sort());
    for (const mode of MODE_NAMES) {
      const entry = modeCharacter(mode);
      for (const text of [entry.summary, entry.soundsLike, entry.signatureNote, entry.avoid, entry.compare]) {
        expect(text.trim().length, mode).toBeGreaterThan(0);
      }
      expect(entry.progressions.length, mode).toBeGreaterThan(0);
    }
  });

  it('names the signature degree the rest of the app highlights', () => {
    for (const mode of MODE_NAMES) {
      const km = { tonic: preferredTonic(0 as Chroma, mode), mode };
      const label = signatureDegree(km).label;
      expect(modeCharacter(mode).signatureNote, mode).toContain(label === '7' ? 'major 7th' : label);
    }
  });

  it('only names numerals the progressions actually contain', () => {
    // A progression's advice mentioning "♭VII" should be about a progression
    // with a ♭VII in it — catches prose written against the wrong degrees.
    for (const mode of MODE_NAMES) {
      const km = { tonic: preferredTonic(0 as Chroma, mode), mode };
      const all = diatonicChords(km).map(romanNumeral);
      for (const progression of modeCharacter(mode).progressions) {
        const numerals = progression.degrees.map((d) => romanNumeral(chordOnDegree(km, d)));
        const tokens = progression.use.split(/[\s,.;:–—()]+/);
        for (const named of all.filter((n) => tokens.includes(n))) {
          expect(numerals, `${mode}: "${progression.use}"`).toContain(named);
        }
      }
    }
  });
});

describe('romanNumeral', () => {
  it('spells each mode’s chords relative to its own tonic', () => {
    const numerals = (mode: (typeof MODE_NAMES)[number]) =>
      diatonicChords({ tonic: preferredTonic(0 as Chroma, mode), mode }).map(romanNumeral);
    expect(numerals('ionian')).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
    expect(numerals('dorian')).toEqual(['i', 'ii', '♭III', 'IV', 'v', 'vi°', '♭VII']);
    expect(numerals('lydian')).toEqual(['I', 'II', 'iii', '♯iv°', 'V', 'vi', 'vii']);
    expect(numerals('locrian')).toEqual(['i°', '♭II', '♭iii', 'iv', '♭V', '♭VI', '♭vii']);
  });
});
