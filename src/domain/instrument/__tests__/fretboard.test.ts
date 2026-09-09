import { describe, expect, it } from 'vitest';
import { midiOf, noteName, pitchClass, chroma } from '@/domain/music';
import {
  DROP_D_GUITAR,
  SEVEN_STRING_GUITAR,
  STANDARD_GUITAR,
  TEST_INSTRUMENTS,
  BASS_4_STRING,
} from '../instruments';
import {
  fretForPitchOnString,
  isValidPosition,
  isWithinPosition,
  midiAt,
  noteAt,
  pitchClassAt,
  positionRange,
  positionsOf,
  scaleOnNeck,
  spellInKey,
  stringCount,
} from '../fretboard';

describe('string indexing', () => {
  it('makes string 0 the lowest-pitched string on every instrument', () => {
    for (const inst of TEST_INSTRUMENTS) {
      const openMidi = inst.tuning.map((t) => midiOf(t));
      const lowest = Math.min(...openMidi);
      expect(openMidi[0], `${inst.name} string 0`).toBe(lowest);
    }
  });

  it('orders tuning ascending by pitch on every instrument', () => {
    for (const inst of TEST_INSTRUMENTS) {
      const openMidi = inst.tuning.map((t) => midiOf(t));
      for (let i = 1; i < openMidi.length; i += 1) {
        expect(openMidi[i]!, `${inst.name} string ${i}`).toBeGreaterThan(openMidi[i - 1]!);
      }
    }
  });

  it('does not assume six strings', () => {
    expect(stringCount(STANDARD_GUITAR)).toBe(6);
    expect(stringCount(SEVEN_STRING_GUITAR)).toBe(7);
    expect(stringCount(BASS_4_STRING)).toBe(4);
  });

  it('rejects a string index past the end of the tuning', () => {
    expect(() => midiAt(STANDARD_GUITAR, { string: 6, fret: 0 })).toThrow();
    // The same index is valid on a 7-string.
    expect(midiAt(SEVEN_STRING_GUITAR, { string: 6, fret: 0 })).toBe(midiOf(noteName('E4')));
  });
});

describe('noteAt', () => {
  it('gives the open strings back at fret 0', () => {
    for (const inst of TEST_INSTRUMENTS) {
      for (let s = 0; s < stringCount(inst); s += 1) {
        expect(midiAt(inst, { string: s, fret: 0 })).toBe(midiOf(inst.tuning[s]!));
      }
    }
  });

  it.each([
    [0, 5, 'A2'], // 5th fret low E
    [1, 7, 'E3'], // 7th fret A string
    [2, 2, 'E3'],
    [3, 9, 'E4'],
    [4, 1, 'C4'],
    [5, 12, 'E5'], // 12th fret high E, an octave up
  ])('standard tuning: string %i fret %i is %s', (string, fret, expected) => {
    expect(noteAt(STANDARD_GUITAR, { string, fret })).toBe(expected);
  });

  it('reflects an altered tuning', () => {
    // Drop D lowers only string 0.
    expect(noteAt(STANDARD_GUITAR, { string: 0, fret: 0 })).toBe('E2');
    expect(noteAt(DROP_D_GUITAR, { string: 0, fret: 0 })).toBe('D2');
    expect(noteAt(DROP_D_GUITAR, { string: 0, fret: 2 })).toBe('E2');
    // The rest of the neck is untouched.
    for (let s = 1; s < 6; s += 1) {
      expect(noteAt(DROP_D_GUITAR, { string: s, fret: 5 })).toBe(
        noteAt(STANDARD_GUITAR, { string: s, fret: 5 }),
      );
    }
  });

  it('rises by one semitone per fret, on every string of every instrument', () => {
    for (const inst of TEST_INSTRUMENTS) {
      for (let s = 0; s < stringCount(inst); s += 1) {
        for (let f = 1; f <= inst.fretCount; f += 1) {
          const here = midiAt(inst, { string: s, fret: f });
          const before = midiAt(inst, { string: s, fret: f - 1 });
          expect(here - before).toBe(1);
        }
      }
    }
  });

  it('puts the 12th fret an octave above the open string', () => {
    for (const inst of TEST_INSTRUMENTS) {
      for (let s = 0; s < stringCount(inst); s += 1) {
        expect(midiAt(inst, { string: s, fret: 12 }) - midiAt(inst, { string: s, fret: 0 })).toBe(12);
      }
    }
  });
});

describe('isValidPosition', () => {
  it('bounds by string count and fret count', () => {
    expect(isValidPosition(STANDARD_GUITAR, { string: 0, fret: 0 })).toBe(true);
    expect(isValidPosition(STANDARD_GUITAR, { string: 5, fret: 22 })).toBe(true);
    expect(isValidPosition(STANDARD_GUITAR, { string: -1, fret: 0 })).toBe(false);
    expect(isValidPosition(STANDARD_GUITAR, { string: 6, fret: 0 })).toBe(false);
    expect(isValidPosition(STANDARD_GUITAR, { string: 0, fret: 23 })).toBe(false);
    expect(isValidPosition(STANDARD_GUITAR, { string: 0, fret: 1.5 })).toBe(false);
  });

  it('respects a capo', () => {
    const capoed = { ...STANDARD_GUITAR, capo: 3 };
    expect(isValidPosition(capoed, { string: 0, fret: 2 })).toBe(false);
    expect(isValidPosition(capoed, { string: 0, fret: 3 })).toBe(true);
  });
});

describe('positionsOf', () => {
  it('finds every E on a standard neck within 12 frets', () => {
    const found = positionsOf(STANDARD_GUITAR, pitchClass('E'), { low: 0, high: 12 });
    for (const pos of found) {
      expect(chroma(pitchClassAt(STANDARD_GUITAR, pos))).toBe(chroma(pitchClass('E')));
    }
    // Open low E, open high E, and 12th fret on both.
    expect(found).toContainEqual({ string: 0, fret: 0 });
    expect(found).toContainEqual({ string: 5, fret: 0 });
    expect(found).toContainEqual({ string: 0, fret: 12 });
  });

  it('returns positions in low-string, low-fret order', () => {
    const found = positionsOf(STANDARD_GUITAR, pitchClass('C'), { low: 0, high: 12 });
    for (let i = 1; i < found.length; i += 1) {
      const prev = found[i - 1]!;
      const cur = found[i]!;
      expect(cur.string > prev.string || (cur.string === prev.string && cur.fret > prev.fret)).toBe(
        true,
      );
    }
  });

  it('matches by pitch, not spelling', () => {
    const sharp = positionsOf(STANDARD_GUITAR, pitchClass('F#'), { low: 0, high: 5 });
    const flat = positionsOf(STANDARD_GUITAR, pitchClass('Gb'), { low: 0, high: 5 });
    expect(sharp).toEqual(flat);
  });

  it('finds a pitch on every string of every instrument within 12 frets', () => {
    for (const inst of TEST_INSTRUMENTS) {
      const found = positionsOf(inst, pitchClass('A'), { low: 0, high: 11 });
      const strings = new Set(found.map((p) => p.string));
      expect(strings.size, `${inst.name}`).toBe(stringCount(inst));
    }
  });
});

describe('scaleOnNeck', () => {
  const km = { tonic: pitchClass('D'), mode: 'dorian' as const };

  it('returns only notes in the key', () => {
    const positions = scaleOnNeck(STANDARD_GUITAR, km, { low: 0, high: 12 });
    const allowed = new Set(['D', 'E', 'F', 'G', 'A', 'B', 'C']);
    for (const p of positions) {
      expect(allowed.has(p.pitchClass), `${p.pitchClass} at ${p.string}/${p.fret}`).toBe(true);
    }
  });

  it('marks the roots', () => {
    const positions = scaleOnNeck(STANDARD_GUITAR, km, { low: 0, high: 12 });
    for (const p of positions) {
      expect(p.isRoot).toBe(p.pitchClass === 'D');
    }
    expect(positions.some((p) => p.isRoot)).toBe(true);
  });

  it('labels degrees consistently with the key', () => {
    const positions = scaleOnNeck(STANDARD_GUITAR, km, { low: 5, high: 8 });
    const b = positions.find((p) => p.pitchClass === 'B');
    expect(b?.degree.label).toBe('6'); // dorian's signature note
    const f = positions.find((p) => p.pitchClass === 'F');
    expect(f?.degree.label).toBe('♭3');
  });

  it('spells in the key rather than always in sharps', () => {
    const eb = { tonic: pitchClass('Eb'), mode: 'ionian' as const };
    const positions = scaleOnNeck(STANDARD_GUITAR, eb, { low: 0, high: 5 });
    const spellings = new Set(positions.map((p) => p.pitchClass));
    expect(spellings.has(pitchClass('Ab'))).toBe(true);
    expect(spellings.has(pitchClass('G#'))).toBe(false);
  });

  it('covers every string on every instrument', () => {
    for (const inst of TEST_INSTRUMENTS) {
      const positions = scaleOnNeck(inst, km, { low: 0, high: 11 });
      const strings = new Set(positions.map((p) => p.string));
      expect(strings.size, inst.name).toBe(stringCount(inst));
    }
  });

  it('respects the requested fret range', () => {
    const positions = scaleOnNeck(STANDARD_GUITAR, km, { low: 5, high: 9 });
    for (const p of positions) {
      expect(p.fret).toBeGreaterThanOrEqual(5);
      expect(p.fret).toBeLessThanOrEqual(9);
    }
  });
});

describe('spellInKey', () => {
  it('respells a sharp to the key’s flat', () => {
    const eb = { tonic: pitchClass('Eb'), mode: 'ionian' as const };
    expect(spellInKey(eb, pitchClass('G#'))).toBe('Ab');
  });

  it('leaves notes outside the key alone', () => {
    const c = { tonic: pitchClass('C'), mode: 'ionian' as const };
    expect(spellInKey(c, pitchClass('F#'))).toBe('F#');
  });
});

describe('neck positions', () => {
  it('spans from its own fret', () => {
    expect(positionRange({ fret: 7, span: 4 })).toEqual({ low: 7, high: 10 });
  });

  it('includes open strings regardless of the window', () => {
    const p = { fret: 7, span: 4 };
    expect(isWithinPosition({ string: 0, fret: 0 }, p)).toBe(true);
    expect(isWithinPosition({ string: 0, fret: 8 }, p)).toBe(true);
    expect(isWithinPosition({ string: 0, fret: 11 }, p)).toBe(false);
  });
});

describe('fretForPitchOnString', () => {
  it('finds the lowest fret at or above a minimum', () => {
    // A on the low E string is fret 5, then 17.
    expect(fretForPitchOnString(STANDARD_GUITAR, 0, pitchClass('A'))).toBe(5);
    expect(fretForPitchOnString(STANDARD_GUITAR, 0, pitchClass('A'), 6)).toBe(17);
  });

  it('returns null when the string cannot reach it', () => {
    expect(fretForPitchOnString(STANDARD_GUITAR, 0, pitchClass('A'), 18)).toBeNull();
  });
});
