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
import { scaleShape, shapeSpan, shapesUpTheNeck } from '../shapes';

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

describe('shapesUpTheNeck', () => {
  it('gives seven shapes ascending the neck', () => {
    const shapes = shapesUpTheNeck(STANDARD_GUITAR, D_DORIAN, { minFret: 1 });
    expect(shapes).toHaveLength(7);
    for (let i = 1; i < shapes.length; i += 1) {
      expect(shapes[i]!.startFret).toBeGreaterThan(shapes[i - 1]!.startFret);
    }
  });

  it('starts from the nut rather than from degree 1', () => {
    // In D dorian the first D on the low E string is fret 10. Starting from
    // degree 1 and chaining would leave frets 1-9 unused and run the last
    // shapes off the neck.
    const shapes = shapesUpTheNeck(STANDARD_GUITAR, D_DORIAN, { minFret: 1 });
    expect(shapes.map((s) => s.startFret)).toEqual([1, 3, 5, 7, 8, 10, 12]);
    // Those frets are F G A B C D E — so the degrees run ♭3 4 5 6 ♭7 1 2.
    expect(shapes.map((s) => s.startDegree)).toEqual([3, 4, 5, 6, 7, 1, 2]);
  });

  it('covers every mode of the key exactly once', () => {
    for (const mode of MODE_NAMES) {
      const shapes = shapesUpTheNeck(STANDARD_GUITAR, { tonic: pitchClass('A'), mode });
      expect(new Set(shapes.map((s) => s.startDegree)).size, mode).toBe(7);
    }
  });

  it('keeps every shape on the neck', () => {
    for (const inst of TEST_INSTRUMENTS) {
      for (const shape of shapesUpTheNeck(inst, D_DORIAN, { minFret: 1 })) {
        expect(shape.positions.length, inst.name).toBe(3 * stringCount(inst));
        for (const p of shape.positions) {
          expect(p.fret).toBeLessThanOrEqual(inst.fretCount);
        }
      }
    }
  });

  it('honours minFret', () => {
    const shapes = shapesUpTheNeck(STANDARD_GUITAR, G_MAJOR, { minFret: 7 });
    expect(shapes[0]!.startFret).toBeGreaterThanOrEqual(7);
  });

  it('returns fewer shapes than asked when the neck runs out', () => {
    const shapes = shapesUpTheNeck(STANDARD_GUITAR, D_DORIAN, { minFret: 18 });
    expect(shapes.length).toBeLessThan(7);
  });

  it('gives shapes whose spans ascend too', () => {
    const shapes = shapesUpTheNeck(STANDARD_GUITAR, G_MAJOR, { minFret: 1 });
    const lows = shapes.map((s) => shapeSpan(s.positions)!.low);
    for (let i = 1; i < lows.length; i += 1) {
      expect(lows[i]!, `shape ${i + 1}`).toBeGreaterThanOrEqual(lows[i - 1]!);
    }
  });
});

describe('scaleShape with a count per string', () => {
  it.each(TEST_INSTRUMENTS.map((i) => [i.id, i] as const))(
    'places exactly the asked-for notes on each string, ascending in pitch (%s)',
    (_id, instrument) => {
      const counts = Array.from({ length: stringCount(instrument) }, (_, k) => (k % 2 ? 3 : 4));
      const shape = scaleShape(instrument, { keyMode: G_MAJOR, minFret: 3, notesPerString: counts });

      expect(shape).toHaveLength(counts.reduce((a, b) => a + b, 0));
      const byString = fretsByString(shape);
      counts.forEach((count, string) => expect(byString.get(string), `string ${string}`).toHaveLength(count));

      const midis = shape.map((p) => midiAt(instrument, p));
      for (let i = 1; i < midis.length; i += 1) expect(midis[i]!).toBeGreaterThan(midis[i - 1]!);
    },
  );

  it('matches a single count when every entry is the same', () => {
    const counts = Array.from({ length: 6 }, () => 3);
    expect(scaleShape(STANDARD_GUITAR, { keyMode: G_MAJOR, notesPerString: counts })).toEqual(
      scaleShape(STANDARD_GUITAR, { keyMode: G_MAJOR, notesPerString: 3 }),
    );
  });
});
