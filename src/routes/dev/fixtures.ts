import { pitchClass } from '@/domain/music';
import type { KeyMode } from '@/domain/music';
import type { Instrument, ScaleNotePosition } from '@/domain/instrument';
import {
  STANDARD_GUITAR,
  shapesUpTheNeck,
  scaleOnNeck,
  scaleShape,
  shapeSpan,
} from '@/domain/instrument';
import { overlayFromScalePositions } from '@/domain/neck';
import { EIGHTH, QUARTER, SIXTEENTH, phraseBuilder } from '@/domain/phrase';
import { STRAIGHT_EIGHTHS, STRAIGHT_SIXTEENTHS } from '@/domain/phrase';

export const D_DORIAN: KeyMode = { tonic: pitchClass('D'), scale: 'major', mode: 'dorian' };
export const TARGET_SIXTH = { number: 6 as const, alteration: 0 as const, label: '6' };

/**
 * The whole mode across twelve frets — what the fretboard explorer shows.
 * Takes the instrument, because rendering standard-tuning positions on a
 * seven-string diagram would look plausible and be wrong.
 */
export function fullNeckOverlay(instrument: Instrument = STANDARD_GUITAR) {
  return overlayFromScalePositions(scaleOnNeck(instrument, D_DORIAN, { low: 0, high: 12 }), {
    targetDegree: TARGET_SIXTH,
    labelMode: 'degree',
  });
}

/** One 3nps shape, as an exercise would show it, with its own span emphasised. */
export function shapeOverlay(positions: ScaleNotePosition[]) {
  const span = shapeSpan(positions);
  return overlayFromScalePositions(positions, {
    targetDegree: TARGET_SIXTH,
    ...(span
      ? {
          emphasisFrets: Array.from(
            { length: span.high - span.low + 1 },
            (_, i) => span.low + i,
          ),
        }
      : {}),
  });
}

/** An ascending run through the shape, with the target degree marked. */
export function scaleRunPhrase() {
  const positions = scaleShape(STANDARD_GUITAR, { keyMode: D_DORIAN, minFret: 7 });
  const ascending = positions.slice(0, 16);

  return phraseBuilder()
    .labelBar('Bar 1')
    .withRhythm(
      ascending.map((p) => ({ string: p.string, fret: p.fret })),
      STRAIGHT_EIGHTHS,
      (_pos, i) => {
        const note = ascending[i]!;
        return {
          role: note.isRoot ? 'root' : note.degree.number === 6 ? 'target' : 'none',
          annotation: note.degree.label,
        };
      },
    )
    .labelBarAt(1, 'Bar 2 · land on B')
    .build();
}

/** Articulations and pick strokes, so the tab renderer can be eyeballed. */
export function articulationPhrase() {
  return phraseBuilder()
    .rhythm(EIGHTH)
    .note({ string: 2, fret: 7 }, { pickStroke: 'down', role: 'root' })
    .note({ string: 2, fret: 9 }, { articulation: 'hammer-on' })
    .note({ string: 2, fret: 10 }, { articulation: 'hammer-on' })
    .note({ string: 2, fret: 9 }, { articulation: 'pull-off' })
    .note({ string: 1, fret: 10 }, { pickStroke: 'up' })
    .note({ string: 1, fret: 12 }, { articulation: 'slide-up' })
    .note({ string: 1, fret: 10 }, { articulation: 'slide-down' })
    .note({ string: 0, fret: 10 }, { articulation: 'vibrato', role: 'target' })
    .labelBar('Articulations')
    .build();
}

/**
 * The same pattern picked, then slurred, alternating bar by bar — so the
 * velocity difference can be heard back to back rather than inferred from one
 * pass. Repetition is what makes it audible.
 */
export function legatoComparisonPhrase() {
  const pattern = [7, 9, 10, 9, 7, 9, 10, 9];
  const string = 3; // the G string, comfortably in the middle of the neck
  const builder = phraseBuilder({ repeat: 2 }).rhythm(EIGHTH);

  builder.labelBar('Picked');
  pattern.forEach((fret, i) => {
    builder.note({ string, fret }, { pickStroke: i % 2 === 0 ? 'down' : 'up', velocity: 0.85 });
  });

  builder.labelBar('Legato — only the first note is picked');
  pattern.forEach((fret, i) => {
    if (i === 0) {
      builder.note({ string, fret }, { pickStroke: 'down', velocity: 0.85 });
      return;
    }
    const previous = pattern[i - 1]!;
    builder.note(
      { string, fret },
      { articulation: fret > previous ? 'hammer-on' : 'pull-off', velocity: 0.85 },
    );
  });

  return builder.build();
}

/** A sixteenth-note run — the resolution the tab grid has to handle. */
export function sixteenthRunPhrase() {
  const positions = scaleShape(STANDARD_GUITAR, { keyMode: D_DORIAN, minFret: 5 }).slice(0, 16);
  return phraseBuilder()
    .withRhythm(
      positions.map((p) => ({ string: p.string, fret: p.fret })),
      STRAIGHT_SIXTEENTHS,
    )
    .build();
}

/**
 * All seven shapes ascending the neck, back to back — a preview of what the
 * modes-through-key exercise will generate, and the phrase length the tab has
 * to stay readable at.
 */
export function sevenShapesPhrase() {
  const builder = phraseBuilder().rhythm(EIGHTH);

  for (const shape of shapesUpTheNeck(STANDARD_GUITAR, D_DORIAN, { minFret: 1 })) {
    builder.labelBar(`Fret ${shape.startFret}`);
    builder.withRhythm(
      shape.positions.map((p) => ({ string: p.string, fret: p.fret })),
      STRAIGHT_EIGHTHS,
      (_pos, i) => {
        const note = shape.positions[i]!;
        return {
          role: note.isRoot ? 'root' : note.degree.number === 6 ? 'target' : 'none',
        };
      },
    );
    builder.fillBar();
  }

  return builder.build();
}

/** Chords, to prove simultaneous notes stack in one column. */
export function chordPhrase() {
  return phraseBuilder()
    .rhythm(QUARTER)
    .chord(
      [
        { string: 1, fret: 5 },
        { string: 2, fret: 7 },
        { string: 3, fret: 7 },
        { string: 4, fret: 6 },
      ],
      { role: 'root' },
    )
    .rest(QUARTER)
    .chord([
      { string: 1, fret: 7 },
      { string: 2, fret: 9 },
      { string: 3, fret: 9 },
      { string: 4, fret: 8 },
    ])
    .rest(QUARTER)
    .labelBar('Chords')
    .build();
}

export const ALL_SHAPES = () => shapesUpTheNeck(STANDARD_GUITAR, D_DORIAN, { minFret: 1 });

export const SIXTEENTH_TICKS = SIXTEENTH;
