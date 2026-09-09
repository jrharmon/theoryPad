import { describe, expect, it } from 'vitest';
import type { DegreeNumber } from '@/domain/music';
import { MODE_NAMES, chroma, pitchClass, scaleNotes } from '@/domain/music';
import {
  BASS_4_STRING,
  DROP_D_GUITAR,
  SEVEN_STRING_GUITAR,
  STANDARD_GUITAR,
  TEST_INSTRUMENTS,
} from '../instruments';
import { midiAt, stringCount } from '../fretboard';
import { allThreeNotePerStringShapes, scaleShape, shapeSpan } from '../shapes';

const G_MAJOR = { tonic: pitchClass('G'), mode: 'ionian' as const };
const D_DORIAN = { tonic: pitchClass('D'), mode: 'dorian' as const };

function fretsByString(shape: { string: number; fret: number }[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const p of shape) map.set(p.string, [...(map.get(p.string) ?? []), p.fret]);
  return map;
}

describe('scaleShape', () => {
  it('produces the canonical G major three-note-per-string fingering', () => {
    const shape = scaleShape(STANDARD_GUITAR, { keyMode: G_MAJOR, minFret: 3 });
    const byString = fretsByString(shape);
    // The B string shift is not special-cased anywhere; it falls out of
    // "take the next scale note nearest the hand".
    expect([...byString.values()]).toEqual([
      [3, 5, 7], // G A B
      [3, 5, 7], // C D E
      [4, 5, 7], // F# G A
      [4, 5, 7], // B C D
      [5, 7, 8], // E F# G
      [5, 7, 8], // A B C
    ]);
  });

  it('places three notes on every string by default', () => {
    for (const inst of TEST_INSTRUMENTS) {
      const shape = scaleShape(inst, { keyMode: D_DORIAN, minFret: 3 });
      expect(shape, inst.name).toHaveLength(3 * stringCount(inst));
    }
  });

  it('honours notesPerString', () => {
    const shape = scaleShape(STANDARD_GUITAR, { keyMode: G_MAJOR, minFret: 3, notesPerString: 4 });
    expect(shape).toHaveLength(24);
    for (const frets of fretsByString(shape).values()) expect(frets).toHaveLength(4);
  });

  it('starts on the requested degree', () => {
    for (let d = 1; d <= 7; d += 1) {
      const shape = scaleShape(STANDARD_GUITAR, {
        keyMode: D_DORIAN,
        startDegree: d as DegreeNumber,
        minFret: 1,
      });
      expect(shape[0]!.degree.number, `degree ${d}`).toBe(d);
    }
  });

  it('walks consecutive scale degrees with no gaps or repeats', () => {
    for (const inst of TEST_INSTRUMENTS) {
      const notes = scaleNotes(D_DORIAN);
      const shape = scaleShape(inst, { keyMode: D_DORIAN, minFret: 3 });
      shape.forEach((p, i) => {
        expect(p.pitchClass, `${inst.name} note ${i}`).toBe(notes[i % notes.length]);
      });
    }
  });

  it('ascends in pitch throughout, including across string changes', () => {
    for (const inst of TEST_INSTRUMENTS) {
      for (const mode of MODE_NAMES) {
        const shape = scaleShape(inst, {
          keyMode: { tonic: pitchClass('A'), mode },
          minFret: 2,
        });
        for (let i = 1; i < shape.length; i += 1) {
          expect(
            midiAt(inst, shape[i]!),
            `${inst.name} ${mode} at index ${i}`,
          ).toBeGreaterThan(midiAt(inst, shape[i - 1]!));
        }
      }
    }
  });

  it('ascends within each string', () => {
    for (const inst of TEST_INSTRUMENTS) {
      for (const frets of fretsByString(scaleShape(inst, { keyMode: G_MAJOR, minFret: 3 })).values()) {
        for (let i = 1; i < frets.length; i += 1) {
          expect(frets[i]!).toBeGreaterThan(frets[i - 1]!);
        }
      }
    }
  });

  it('stays within a playable hand span', () => {
    for (const inst of TEST_INSTRUMENTS) {
      for (const mode of MODE_NAMES) {
        for (let d = 1; d <= 7; d += 1) {
          const shape = scaleShape(inst, {
            keyMode: { tonic: pitchClass('C'), mode },
            startDegree: d as DegreeNumber,
            minFret: 3,
          });
          const span = shapeSpan(shape);
          expect(span, `${inst.name} ${mode} degree ${d}`).not.toBeNull();
          // Three notes per string needs a stretch, but not more than six frets.
          expect(span!.high - span!.low, `${inst.name} ${mode} degree ${d}`).toBeLessThanOrEqual(6);
        }
      }
    }
  });

  it('never uses a note outside the key', () => {
    for (const inst of TEST_INSTRUMENTS) {
      const allowed = new Set(scaleNotes(D_DORIAN).map((n) => chroma(n)));
      for (const p of scaleShape(inst, { keyMode: D_DORIAN, minFret: 3 })) {
        expect(allowed.has(chroma(p.pitchClass))).toBe(true);
      }
    }
  });

  it('reflects an altered tuning', () => {
    const standard = scaleShape(STANDARD_GUITAR, { keyMode: D_DORIAN, minFret: 3 });
    const dropD = scaleShape(DROP_D_GUITAR, { keyMode: D_DORIAN, minFret: 3 });
    const standardLow = standard.filter((p) => p.string === 0).map((p) => p.fret);
    const dropDLow = dropD.filter((p) => p.string === 0).map((p) => p.fret);
    // Lowering string 0 by two semitones moves its frets up by two.
    expect(dropDLow).toEqual(standardLow.map((f) => f + 2));
  });

  it('covers a seven-string without a special case', () => {
    const shape = scaleShape(SEVEN_STRING_GUITAR, { keyMode: D_DORIAN, minFret: 3 });
    expect(new Set(shape.map((p) => p.string)).size).toBe(7);
    expect(shape).toHaveLength(21);
  });

  it('respects a restricted string set', () => {
    const shape = scaleShape(STANDARD_GUITAR, {
      keyMode: G_MAJOR,
      minFret: 3,
      strings: [3, 4, 5],
    });
    expect(new Set(shape.map((p) => p.string))).toEqual(new Set([3, 4, 5]));
    expect(shape).toHaveLength(9);
  });

  it('never returns a fret below minFret', () => {
    for (const inst of TEST_INSTRUMENTS) {
      for (const minFret of [1, 5, 9]) {
        for (const p of scaleShape(inst, { keyMode: D_DORIAN, minFret })) {
          expect(p.fret, `${inst.name} min ${minFret}`).toBeGreaterThanOrEqual(minFret);
        }
      }
    }
  });

  it('stops cleanly rather than running off the end of the neck', () => {
    const shape = scaleShape(BASS_4_STRING, { keyMode: D_DORIAN, minFret: 19 });
    for (const p of shape) expect(p.fret).toBeLessThanOrEqual(BASS_4_STRING.fretCount);
  });
});

describe('allThreeNotePerStringShapes', () => {
  it('gives seven shapes, one starting on each degree', () => {
    const shapes = allThreeNotePerStringShapes(STANDARD_GUITAR, D_DORIAN, 1);
    expect(shapes).toHaveLength(7);
    shapes.forEach((shape, i) => {
      expect(shape[0]!.degree.number).toBe(i + 1);
    });
  });

  it('gives shapes that climb the neck in order', () => {
    const shapes = allThreeNotePerStringShapes(STANDARD_GUITAR, G_MAJOR, 1);
    const lows = shapes.map((s) => shapeSpan(s)!.low);
    for (let i = 1; i < lows.length; i += 1) {
      expect(lows[i]!, `shape ${i + 1}`).toBeGreaterThan(lows[i - 1]!);
    }
  });
});
