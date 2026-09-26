import { describe, expect, it } from 'vitest';
import { MODE_NAMES } from '../types';
import type { Chroma } from '../types';
import { preferredTonic } from '../spelling';
import { signatureDegree } from '../scale';
import { chordOnDegree, diatonicChords, romanNumeral } from '../chords';
import { MODE_CHARACTER, modeCharacter, progressionsFor } from '../modeCharacter';
import { SCALE_IDS } from '../types';
import { characterId, hasOwnChords, modesOf } from '../scales';

/** One key per written entry: each Major mode, and the first mode of every other scale. */
const EVERY_CHARACTER = SCALE_IDS.flatMap((scale) =>
  (scale === 'major' ? MODE_NAMES : modesOf(scale).slice(0, 1)).map((mode) => ({
    tonic: preferredTonic(0 as Chroma, { scale, mode }),
    scale,
    mode,
  })),
);

describe('modeCharacter', () => {
  it('has every section written for every mode and scale', () => {
    expect(Object.keys(MODE_CHARACTER).sort()).toEqual(EVERY_CHARACTER.map(characterId).sort());
    for (const km of EVERY_CHARACTER) {
      const entry = modeCharacter(km);
      const mode = characterId(km);
      for (const text of [
        entry.summary,
        entry.soundsLike,
        entry.signatureNote,
        entry.avoid,
        entry.compare,
      ]) {
        expect(text.trim().length, mode).toBeGreaterThan(0);
      }
      // Pentatonics borrow their parent's; a scale with chords has its own.
      expect(entry.progressions !== undefined, mode).toBe(hasOwnChords(km.scale));
      expect(progressionsFor(km).length, mode).toBeGreaterThan(0);
    }
  });

  it('names the signature degree the rest of the app highlights', () => {
    for (const km of EVERY_CHARACTER) {
      const label = signatureDegree(km).label;
      expect(modeCharacter(km).signatureNote, characterId(km)).toContain(
        label === '7' ? 'major 7th' : label,
      );
    }
  });

  it('only names numerals the progressions actually contain', () => {
    // A progression's advice mentioning "♭VII" should be about a progression
    // with a ♭VII in it — catches prose written against the wrong degrees.
    for (const km of EVERY_CHARACTER.filter((k) => hasOwnChords(k.scale))) {
      const mode = characterId(km);
      const all = diatonicChords(km).map(romanNumeral);
      for (const progression of progressionsFor(km)) {
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
      diatonicChords({
        tonic: preferredTonic(0 as Chroma, mode),
        scale: 'major' as const,
        mode,
      }).map(romanNumeral);
    expect(numerals('ionian')).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
    expect(numerals('dorian')).toEqual(['i', 'ii', '♭III', 'IV', 'v', 'vi°', '♭VII']);
    expect(numerals('lydian')).toEqual(['I', 'II', 'iii', '♯iv°', 'V', 'vi', 'vii']);
    expect(numerals('locrian')).toEqual(['i°', '♭II', '♭iii', 'iv', '♭V', '♭VI', '♭vii']);
  });
});
