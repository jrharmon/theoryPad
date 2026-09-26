import { describe, expect, it } from 'vitest';
import type { DegreeNumber, KeyMode, ModeId, ScaleId, ShapeId } from '@/domain/music';
import { MODE_NAMES, SHAPE_IDS, chroma, pitchClass, scaleNotes } from '@/domain/music';
import {
  BASS_4_STRING,
  DROP_D_GUITAR,
  STANDARD_GUITAR,
  TEST_INSTRUMENTS,
} from '../instruments';
import { lowestFret, midiAt, stringCount } from '../fretboard';
import { boxShape, scaleShape, shapeSpan, shapesUpTheNeck } from '../shapes';

const G_MAJOR = { tonic: pitchClass('G'), scale: 'major' as const, mode: 'ionian' as const };
const D_DORIAN = { tonic: pitchClass('D'), scale: 'major' as const, mode: 'dorian' as const };
const A_LYDIAN = { tonic: pitchClass('A'), scale: 'major' as const, mode: 'lydian' as const };

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

  /**
   * Everything a shape must be, over every instrument, mode, starting degree
   * and hand position: three notes a string, consecutive degrees of the key,
   * ascending in pitch, within the hand, and on the neck we asked for.
   */
  it('is a playable, ascending run of the key wherever it is asked for', () => {
    for (const instrument of TEST_INSTRUMENTS) {
      for (const mode of MODE_NAMES) {
        const keyMode = { tonic: pitchClass('A'), scale: 'major' as const, mode };
        const notes = scaleNotes(keyMode);
        const inKey = new Set(notes.map((n) => chroma(n)));

        // From the nut up, including the open position: a shape the hand
        // cannot hold that low starts higher rather than spanning the neck.
        for (const minFret of [0, 1, 3, 5, 9]) {
          for (let degree = 1; degree <= 7; degree += 1) {
            const where = `${instrument.name} ${mode} degree ${degree} min ${minFret}`;
            const shape = scaleShape(instrument, {
              keyMode,
              minFret,
              startDegree: degree as DegreeNumber,
            });

            // Three a string, unless the neck runs out first, and then it
            // stops cleanly rather than inventing frets.
            const full = 3 * stringCount(instrument);
            expect(shape.length, where).toBe(minFret > 5 ? Math.min(shape.length, full) : full);
            expect(shape[0]!.degree.number, where).toBe(degree);

            const from = notes.findIndex((n) => chroma(n) === chroma(shape[0]!.pitchClass));
            shape.forEach((position, i) => {
              expect(inKey.has(chroma(position.pitchClass)), `${where} note ${i}`).toBe(true);
              // Consecutive degrees, no gaps and no repeats.
              expect(position.pitchClass, `${where} note ${i}`).toBe(
                notes[(from + i) % notes.length],
              );
              // minFret anchors the hand rather than flooring every note: a
              // later string may reach lower rather than jump an octave up.
              expect(position.fret, `${where} note ${i}`).toBeGreaterThanOrEqual(
                position.string === 0 ? minFret : lowestFret(instrument),
              );
              expect(position.fret, `${where} note ${i}`).toBeLessThanOrEqual(
                instrument.fretCount,
              );
              if (i > 0) {
                expect(midiAt(instrument, position), `${where} note ${i}`).toBeGreaterThan(
                  midiAt(instrument, shape[i - 1]!),
                );
              }
            });

            for (const frets of fretsByString(shape).values()) {
              for (let i = 1; i < frets.length; i += 1) {
                expect(frets[i]!, where).toBeGreaterThan(frets[i - 1]!);
              }
            }

            // Three notes per string needs a stretch, but not more than six frets.
            const span = shapeSpan(shape)!;
            expect(span, where).not.toBeNull();
            expect(span.high - span.low, where).toBeLessThanOrEqual(6);
          }
        }
      }
    }
  });

  it('starts higher rather than stretching the hand across the neck', () => {
    // In drop D the low string runs 1-2-4 and the next note of the scale sits
    // below the open A string, leaving fret 11 as the only way on: a sixteen-
    // fret shape. The hand goes up the neck instead, to the shape it would
    // have found a fret or two higher.
    const lydian = { keyMode: A_LYDIAN, startDegree: 4 as DegreeNumber };
    const atTheNut = scaleShape(DROP_D_GUITAR, { ...lydian, minFret: 1 });

    expect(shapeSpan(atTheNut)).toEqual({ low: 11, high: 16 });
    expect(atTheNut).toEqual(scaleShape(DROP_D_GUITAR, { ...lydian, minFret: 3 }));
    // Starting higher is a move of the hand, not of the run: same notes.
    expect(atTheNut.map((p) => p.note)).toEqual(
      scaleShape(STANDARD_GUITAR, { ...lydian, minFret: 1 }).map((p) => p.note),
    );
  });

  it('puts the asked-for number of notes on each string', () => {
    const four = scaleShape(STANDARD_GUITAR, {
      keyMode: G_MAJOR,
      minFret: 3,
      notesPerString: 4,
    });
    expect(four).toHaveLength(24);
    for (const frets of fretsByString(four).values()) expect(frets).toHaveLength(4);

    for (const instrument of TEST_INSTRUMENTS) {
      const counts = Array.from({ length: stringCount(instrument) }, (_, k) => (k % 2 ? 3 : 4));
      const shape = scaleShape(instrument, {
        keyMode: G_MAJOR,
        minFret: 3,
        notesPerString: counts,
      });
      expect(shape, instrument.name).toHaveLength(counts.reduce((a, b) => a + b, 0));
      const byString = fretsByString(shape);
      counts.forEach((count, string) =>
        expect(byString.get(string), `${instrument.name} string ${string}`).toHaveLength(count),
      );
    }

    // A count per string is the same thing as one count, when they all agree.
    expect(
      scaleShape(STANDARD_GUITAR, { keyMode: G_MAJOR, notesPerString: [3, 3, 3, 3, 3, 3] }),
    ).toEqual(scaleShape(STANDARD_GUITAR, { keyMode: G_MAJOR, notesPerString: 3 }));
  });

  it('uses the strings it is given, on the tuning it is given', () => {
    const subset = scaleShape(STANDARD_GUITAR, {
      keyMode: G_MAJOR,
      minFret: 3,
      strings: [3, 4, 5],
    });
    expect(new Set(subset.map((p) => p.string))).toEqual(new Set([3, 4, 5]));
    expect(subset).toHaveLength(9);

    const low = (instrument: typeof STANDARD_GUITAR) =>
      scaleShape(instrument, { keyMode: D_DORIAN, minFret: 3 })
        .filter((p) => p.string === 0)
        .map((p) => p.fret);
    // Lowering string 0 by two semitones moves its frets up by two.
    expect(low(DROP_D_GUITAR)).toEqual(low(STANDARD_GUITAR).map((fret) => fret + 2));
  });

  it('stops cleanly rather than running off the end of the neck', () => {
    const shape = scaleShape(BASS_4_STRING, { keyMode: D_DORIAN, minFret: 19 });
    for (const p of shape) expect(p.fret).toBeLessThanOrEqual(BASS_4_STRING.fretCount);
  });
});

describe('shapesUpTheNeck', () => {
  it('climbs the neck from the nut, one shape per degree', () => {
    // In D dorian the first D on the low E string is fret 10. Starting from
    // degree 1 and chaining would leave frets 1-9 unused and run the last
    // shapes off the neck.
    const shapes = shapesUpTheNeck(STANDARD_GUITAR, D_DORIAN, { minFret: 1 });
    expect(shapes.map((s) => s.startFret)).toEqual([1, 3, 5, 7, 8, 10, 12]);
    // Those frets are F G A B C D E — so the degrees run ♭3 4 5 6 ♭7 1 2.
    expect(shapes.map((s) => s.startDegree)).toEqual([3, 4, 5, 6, 7, 1, 2]);

    const lows = shapes.map((s) => shapeSpan(s.positions)!.low);
    for (let i = 1; i < lows.length; i += 1)
      expect(lows[i]!).toBeGreaterThanOrEqual(lows[i - 1]!);
  });

  it('covers every mode of the key exactly once', () => {
    for (const mode of MODE_NAMES) {
      const shapes = shapesUpTheNeck(STANDARD_GUITAR, {
        tonic: pitchClass('A'),
        scale: 'major' as const,
        mode,
      });
      expect(new Set(shapes.map((s) => s.startDegree)).size, mode).toBe(7);
    }
  });

  it('keeps every shape whole, on the neck, and above minFret', () => {
    for (const instrument of TEST_INSTRUMENTS) {
      for (const shape of shapesUpTheNeck(instrument, D_DORIAN, { minFret: 7 })) {
        expect(shape.positions.length, instrument.name).toBe(3 * stringCount(instrument));
        expect(shape.startFret, instrument.name).toBeGreaterThanOrEqual(7);
        for (const p of shape.positions)
          expect(p.fret).toBeLessThanOrEqual(instrument.fretCount);
      }
    }
  });

  it('returns fewer shapes than asked when the neck runs out', () => {
    expect(shapesUpTheNeck(STANDARD_GUITAR, D_DORIAN, { minFret: 18 }).length).toBeLessThan(7);
  });
});

describe('pentatonic and blues boxes', () => {
  const key = (tonic: string, scale: ScaleId, mode: ModeId = 'shape-1'): KeyMode => ({
    tonic: pitchClass(tonic),
    scale,
    mode,
  });
  const frets = (k: KeyMode, near: number) => [
    ...fretsByString(boxShape(STANDARD_GUITAR, k, near).positions).values(),
  ];

  it.each<[ShapeId, number, number[][]]>([
    // A minor pentatonic (A C D E G), low string first.
    [
      'shape-1',
      5,
      [
        [5, 8],
        [5, 7],
        [5, 7],
        [5, 7],
        [5, 8],
        [5, 8],
      ],
    ],
    [
      'shape-2',
      8,
      [
        [8, 10],
        [7, 10],
        [7, 10],
        [7, 9],
        [8, 10],
        [8, 10],
      ],
    ],
    [
      'shape-3',
      10,
      [
        [10, 12],
        [10, 12],
        [10, 12],
        [9, 12],
        [10, 13],
        [10, 12],
      ],
    ],
    [
      'shape-4',
      12,
      [
        [12, 15],
        [12, 15],
        [12, 14],
        [12, 14],
        [13, 15],
        [12, 15],
      ],
    ],
    [
      'shape-5',
      15,
      [
        [15, 17],
        [15, 17],
        [14, 17],
        [14, 17],
        [15, 17],
        [15, 17],
      ],
    ],
  ])('plays A minor pentatonic %s as the standard box at fret %i', (shape, start, expected) => {
    expect(frets(key('A', 'minor-pentatonic', shape), start)).toEqual(expected);
  });

  it('adds the blues ♭5 on the 4th’s string, one fret above it', () => {
    // Box 1: A string D Eb E, G string C D Eb.
    expect(frets(key('A', 'blues', 'shape-1'), 5)).toEqual([
      [5, 8],
      [5, 6, 7],
      [5, 7],
      [5, 7, 8],
      [5, 8],
      [5, 8],
    ]);
    // Box 2: low and high E C D Eb, G string D Eb E.
    expect(frets(key('A', 'blues', 'shape-2'), 8)).toEqual([
      [8, 10, 11],
      [7, 10],
      [7, 10],
      [7, 8, 9],
      [8, 10],
      [8, 10, 11],
    ]);
  });

  it('numbers major pentatonic from its own root', () => {
    // C major pentatonic is A minor pentatonic's notes from C: its shape n is A minor's n + 1.
    for (let n = 1; n <= 5; n += 1) {
      const major = key('C', 'major-pentatonic', `shape-${n}` as ShapeId);
      const minor = key('A', 'minor-pentatonic', `shape-${(n % 5) + 1}` as ShapeId);
      const near = boxShape(STANDARD_GUITAR, major, 7).startFret;
      expect(frets(major, near), `shape ${n}`).toEqual(frets(minor, near));
    }
  });

  it('places a box at the octave copy nearest the position', () => {
    const shape4 = key('A', 'minor-pentatonic', 'shape-4');
    expect(boxShape(STANDARD_GUITAR, shape4, 3).startFret).toBe(0);
    expect(boxShape(STANDARD_GUITAR, shape4, 9).startFret).toBe(12);
  });

  it('gives every shape of every pentatonic scale a whole, playable box on every instrument', () => {
    for (const instrument of TEST_INSTRUMENTS) {
      for (const scale of ['minor-pentatonic', 'major-pentatonic', 'blues'] as const) {
        for (const mode of SHAPE_IDS) {
          for (const tonic of ['E', 'G', 'Bb', 'C#']) {
            const k = key(tonic, scale, mode);
            const label = `${instrument.name} ${tonic} ${scale} ${mode}`;
            const { positions } = boxShape(instrument, k, 7);
            const perString = [...fretsByString(positions).values()].map((f) => f.length);
            expect(perString.length, label).toBe(stringCount(instrument));
            for (const count of perString) {
              expect(count === 2 || (scale === 'blues' && count === 3), label).toBe(true);
            }
            const pitches = positions.map((p) => midiAt(instrument, p));
            for (let i = 1; i < pitches.length; i += 1) {
              expect(pitches[i]!, label).toBeGreaterThan(pitches[i - 1]!);
            }
            // Within the hand's reach. Standard tuning's boxes span 4 frets at most;
            // drop D's low string can stretch a blues box to 6.
            const span = shapeSpan(positions)!;
            expect(span.high - span.low, label).toBeLessThanOrEqual(6);
          }
        }
      }
    }
  });

  it('climbs the neck through all five shapes', () => {
    const shapes = shapesUpTheNeck(STANDARD_GUITAR, key('A', 'minor-pentatonic'), {
      minFret: 1,
    });
    expect(shapes.map((s) => s.startFret)).toEqual([3, 5, 8, 10, 12]);
    expect(shapes.map((s) => s.shape)).toEqual([
      'shape-5',
      'shape-1',
      'shape-2',
      'shape-3',
      'shape-4',
    ]);
  });

  it('gives harmonic minor, Phrygian dominant and melodic minor all seven 3nps shapes', () => {
    for (const scale of ['harmonic-minor', 'phrygian-dominant', 'melodic-minor'] as const) {
      const k = key('A', scale, scale);
      const inScale = new Set(scaleNotes(k).map(chroma));
      const shapes = shapesUpTheNeck(STANDARD_GUITAR, k);
      expect(new Set(shapes.map((s) => s.startDegree)).size, scale).toBe(7);
      for (const shape of shapes) {
        expect(shape.positions, scale).toHaveLength(3 * stringCount(STANDARD_GUITAR));
        for (const p of shape.positions)
          expect(inScale.has(chroma(p.pitchClass)), scale).toBe(true);
      }
    }
  });
});
