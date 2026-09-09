import { describe, expect, it } from 'vitest';
import {
  BASS_4_STRING,
  SEVEN_STRING_GUITAR,
  STANDARD_GUITAR,
  TEST_INSTRUMENTS,
} from '../instruments';
import { stringCount } from '../fretboard';
import {
  allStrings,
  defaultStringSets,
  skippedSets,
  stringLabel,
  stringSetsOfSize,
} from '../stringSets';

describe('stringLabel', () => {
  it('uses guitarist numbering, where 1 is the highest string', () => {
    expect(stringLabel(STANDARD_GUITAR, 0)).toBe('6'); // low E
    expect(stringLabel(STANDARD_GUITAR, 5)).toBe('1'); // high e
  });

  it('scales with the instrument rather than assuming six', () => {
    expect(stringLabel(SEVEN_STRING_GUITAR, 0)).toBe('7');
    expect(stringLabel(SEVEN_STRING_GUITAR, 6)).toBe('1');
    expect(stringLabel(BASS_4_STRING, 0)).toBe('4');
  });
});

describe('stringSetsOfSize', () => {
  it('names sets high-string-first, the way players say them', () => {
    const sets = stringSetsOfSize(STANDARD_GUITAR, 3);
    expect(sets.map((s) => s.name)).toEqual(['4-5-6', '3-4-5', '2-3-4', '1-2-3']);
    expect(sets[0]!.strings).toEqual([0, 1, 2]);
    expect(sets[3]!.strings).toEqual([3, 4, 5]);
  });

  it('produces one more set on a seven-string', () => {
    expect(stringSetsOfSize(SEVEN_STRING_GUITAR, 3)).toHaveLength(5);
    expect(stringSetsOfSize(STANDARD_GUITAR, 3)).toHaveLength(4);
    expect(stringSetsOfSize(BASS_4_STRING, 3)).toHaveLength(2);
  });

  it('never references a string the instrument does not have', () => {
    for (const inst of TEST_INSTRUMENTS) {
      for (const size of [2, 3, 4]) {
        for (const set of stringSetsOfSize(inst, size)) {
          expect(set.strings).toHaveLength(size);
          for (const s of set.strings) {
            expect(s, `${inst.name} ${set.name}`).toBeLessThan(stringCount(inst));
            expect(s).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it('returns nothing when the set is wider than the instrument', () => {
    expect(stringSetsOfSize(BASS_4_STRING, 5)).toEqual([]);
  });
});

describe('allStrings', () => {
  it('covers the whole instrument', () => {
    for (const inst of TEST_INSTRUMENTS) {
      expect(allStrings(inst).strings).toHaveLength(stringCount(inst));
    }
  });
});

describe('skippedSets', () => {
  it('leaves a gap between strings', () => {
    const sets = skippedSets(STANDARD_GUITAR, 1);
    expect(sets.length).toBeGreaterThan(0);
    for (const set of sets) {
      for (let i = 1; i < set.strings.length; i += 1) {
        expect(set.strings[i]! - set.strings[i - 1]!).toBe(2);
      }
    }
  });

  it('stays within the instrument', () => {
    for (const inst of TEST_INSTRUMENTS) {
      for (const set of skippedSets(inst, 1)) {
        for (const s of set.strings) {
          expect(s, `${inst.name} ${set.name}`).toBeLessThan(stringCount(inst));
        }
      }
    }
  });
});

describe('defaultStringSets', () => {
  it('gives a usable pool for every instrument', () => {
    for (const inst of TEST_INSTRUMENTS) {
      const sets = defaultStringSets(inst);
      expect(sets.length, inst.name).toBeGreaterThan(0);
      expect(new Set(sets.map((s) => s.id)).size).toBe(sets.length);
    }
  });
});
