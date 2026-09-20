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
  it('numbers strings from the lowest pitch up, however many there are', () => {
    for (const inst of TEST_INSTRUMENTS) {
      const openMidi = inst.tuning.map((t) => midiOf(t));
      expect(openMidi[0], `${inst.name} string 0`).toBe(Math.min(...openMidi));
      for (let i = 1; i < openMidi.length; i += 1) {
        expect(openMidi[i]!, `${inst.name} string ${i}`).toBeGreaterThan(openMidi[i - 1]!);
      }
      expect(stringCount(inst), inst.name).toBe(inst.tuning.length);
    }
    expect([STANDARD_GUITAR, SEVEN_STRING_GUITAR, BASS_4_STRING].map(stringCount)).toEqual([6, 7, 4]);

    // Past the end of the tuning is an error, not a silent wrong note.
    expect(() => midiAt(STANDARD_GUITAR, { string: 6, fret: 0 })).toThrow();
    expect(midiAt(SEVEN_STRING_GUITAR, { string: 6, fret: 0 })).toBe(midiOf(noteName('E4')));
  });
});

describe('noteAt', () => {
  it('starts at the open string and rises a semitone a fret, to the octave at 12', () => {
    for (const inst of TEST_INSTRUMENTS) {
      for (let s = 0; s < stringCount(inst); s += 1) {
        const open = midiAt(inst, { string: s, fret: 0 });
        expect(open, `${inst.name} string ${s}`).toBe(midiOf(inst.tuning[s]!));
        for (let f = 1; f <= inst.fretCount; f += 1) {
          expect(
            midiAt(inst, { string: s, fret: f }) - midiAt(inst, { string: s, fret: f - 1 }),
            `${inst.name} string ${s} fret ${f}`,
          ).toBe(1);
        }
        expect(midiAt(inst, { string: s, fret: 12 }) - open).toBe(12);
      }
    }
  });

  it('names the notes of standard tuning', () => {
    const expected: [number, number, string][] = [
      [0, 5, 'A2'], // 5th fret low E
      [1, 7, 'E3'], // 7th fret A string
      [2, 2, 'E3'],
      [3, 9, 'E4'],
      [4, 1, 'C4'],
      [5, 12, 'E5'], // 12th fret high E, an octave up
    ];
    for (const [string, fret, name] of expected) {
      expect(noteAt(STANDARD_GUITAR, { string, fret }), `${string}/${fret}`).toBe(name);
    }
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
});

describe('isValidPosition', () => {
  it('bounds by string count, fret count and any capo', () => {
    expect(isValidPosition(STANDARD_GUITAR, { string: 0, fret: 0 })).toBe(true);
    expect(isValidPosition(STANDARD_GUITAR, { string: 5, fret: 22 })).toBe(true);
    expect(isValidPosition(STANDARD_GUITAR, { string: -1, fret: 0 })).toBe(false);
    expect(isValidPosition(STANDARD_GUITAR, { string: 6, fret: 0 })).toBe(false);
    expect(isValidPosition(STANDARD_GUITAR, { string: 0, fret: 23 })).toBe(false);
    expect(isValidPosition(STANDARD_GUITAR, { string: 0, fret: 1.5 })).toBe(false);

    const capoed = { ...STANDARD_GUITAR, capo: 3 };
    expect(isValidPosition(capoed, { string: 0, fret: 2 })).toBe(false);
    expect(isValidPosition(capoed, { string: 0, fret: 3 })).toBe(true);
  });
});

describe('positionsOf', () => {
  it('finds every instance of a pitch, in neck order, by sound not spelling', () => {
    const found = positionsOf(STANDARD_GUITAR, pitchClass('E'), { low: 0, high: 12 });
    for (const pos of found) {
      expect(chroma(pitchClassAt(STANDARD_GUITAR, pos))).toBe(chroma(pitchClass('E')));
    }
    // Open low E, open high E, and 12th fret on both.
    expect(found).toContainEqual({ string: 0, fret: 0 });
    expect(found).toContainEqual({ string: 5, fret: 0 });
    expect(found).toContainEqual({ string: 0, fret: 12 });

    // Low string first, then low fret.
    for (let i = 1; i < found.length; i += 1) {
      const previous = found[i - 1]!;
      const here = found[i]!;
      expect(
        here.string > previous.string ||
          (here.string === previous.string && here.fret > previous.fret),
      ).toBe(true);
    }

    expect(positionsOf(STANDARD_GUITAR, pitchClass('F#'), { low: 0, high: 5 })).toEqual(
      positionsOf(STANDARD_GUITAR, pitchClass('Gb'), { low: 0, high: 5 }),
    );

    // Any pitch class turns up on every string within an octave.
    for (const inst of TEST_INSTRUMENTS) {
      const all = positionsOf(inst, pitchClass('A'), { low: 0, high: 11 });
      expect(new Set(all.map((p) => p.string)).size, inst.name).toBe(stringCount(inst));
    }
  });
});

describe('scaleOnNeck', () => {
  const km = { tonic: pitchClass('D'), mode: 'dorian' as const };

  it('lays the key over the asked-for frets, on every string, roots marked', () => {
    const allowed = new Set(['D', 'E', 'F', 'G', 'A', 'B', 'C']);
    for (const inst of TEST_INSTRUMENTS) {
      const positions = scaleOnNeck(inst, km, { low: 5, high: 9 });
      expect(new Set(positions.map((p) => p.string)).size, inst.name).toBe(stringCount(inst));
      for (const p of positions) {
        expect(allowed.has(p.pitchClass), `${p.pitchClass} at ${p.string}/${p.fret}`).toBe(true);
        expect(p.isRoot).toBe(p.pitchClass === 'D');
        expect(p.fret).toBeGreaterThanOrEqual(5);
        expect(p.fret).toBeLessThanOrEqual(9);
      }
      expect(positions.some((p) => p.isRoot), inst.name).toBe(true);
    }
  });

  it('labels degrees by the mode', () => {
    const positions = scaleOnNeck(STANDARD_GUITAR, km, { low: 5, high: 8 });
    expect(positions.find((p) => p.pitchClass === 'B')?.degree.label).toBe('6'); // dorian's signature
    expect(positions.find((p) => p.pitchClass === 'F')?.degree.label).toBe('♭3');
  });
});

describe('spelling', () => {
  const eb = { tonic: pitchClass('Eb'), mode: 'ionian' as const };

  it('spells in the key rather than always in sharps, and leaves outsiders alone', () => {
    expect(spellInKey(eb, pitchClass('G#'))).toBe('Ab');
    expect(spellInKey({ tonic: pitchClass('C'), mode: 'ionian' }, pitchClass('F#'))).toBe('F#');

    const spellings = new Set(scaleOnNeck(STANDARD_GUITAR, eb, { low: 0, high: 5 }).map((p) => p.pitchClass));
    expect(spellings.has(pitchClass('Ab'))).toBe(true);
    expect(spellings.has(pitchClass('G#'))).toBe(false);
  });
});

describe('neck positions', () => {
  it('spans from its own fret, and always includes the open strings', () => {
    expect(positionRange({ fret: 7, span: 4 })).toEqual({ low: 7, high: 10 });
    const p = { fret: 7, span: 4 };
    expect(isWithinPosition({ string: 0, fret: 0 }, p)).toBe(true);
    expect(isWithinPosition({ string: 0, fret: 8 }, p)).toBe(true);
    expect(isWithinPosition({ string: 0, fret: 11 }, p)).toBe(false);
  });
});

describe('fretForPitchOnString', () => {
  it('finds the lowest fret at or above a minimum, or none within reach', () => {
    // A on the low E string is fret 5, then 17.
    expect(fretForPitchOnString(STANDARD_GUITAR, 0, pitchClass('A'))).toBe(5);
    expect(fretForPitchOnString(STANDARD_GUITAR, 0, pitchClass('A'), 6)).toBe(17);
    expect(fretForPitchOnString(STANDARD_GUITAR, 0, pitchClass('A'), 18)).toBeNull();
  });
});
