import { z } from 'zod';
import { playsInBoxes } from '@/domain/music';
import { shapeCount } from '@/domain/instrument';
import { EIGHTH, QUARTER, phraseBuilder, rhythmById } from '@/domain/phrase';
import type { RhythmPattern } from '@/domain/phrase';
import type { AxisId, Direction } from '@/domain/variation';
import type { PlayedDefinition, GenerationContext, PlayedInstance } from '../types';
import {
  arpeggioRun,
  axisDisplay,
  keyModeLabel,
  makeBrief,
  noteOptionsFor,
  orderedHighlights,
  overlayFromPositions,
  shapeChord,
  shapeRuns,
} from '../shared';

const params = z.object({
  variant: z.enum(['plain', 'arpeggio-then-scale', 'pause-on-root']).default('plain'),
  /** How many shapes one rep covers, at most the scale's own: seven, or five boxes. */
  shapesPerRep: z.number().int().min(1).max(7).default(7),
  /** Lowest fret the first shape may start at. */
  minFret: z.number().int().min(0).max(12).default(1),
});

export type ModesThroughKeyParams = z.infer<typeof params>;

const AXES = ['scale', 'mode', 'key', 'direction', 'rhythmPattern'] as const;

/** "All five boxes", "All seven shapes". */
const COUNT_WORDS: Record<number, string> = { 5: 'five', 6: 'six', 7: 'seven' };

export const modesThroughKey: PlayedDefinition<ModesThroughKeyParams> = {
  id: 'modes-through-key',
  name: 'Modes up the neck',
  tags: ['scales', 'modes', 'whole-neck', 'positional'],
  kind: 'played',
  summary:
    'Every shape of one key — seven three-note-per-string shapes, or five pentatonic boxes — climbing the neck.',
  description: [
    'A key is rolled. Play its shapes in order up the neck, each starting on',
    'whichever scale note falls next on the lowest string — seven three-note-',
    'per-string shapes, or the five boxes of a pentatonic — so you cover the',
    'whole neck instead of the one box you are comfortable in.',
  ].join(' '),

  axes: [...AXES],
  params,

  defaults: {
    targetTempo: 70,
    reps: 2,
  },

  timing: 'either',

  generate(context: GenerationContext<ModesThroughKeyParams>): PlayedInstance {
    const { keyMode, instrument, params: config, variation } = context;
    const { variant } = config;
    const boxes = playsInBoxes(keyMode.scale);

    const direction = (variation.axes.direction?.value ?? 'ascending') as Direction;
    const rhythm = (variation.axes.rhythmPattern?.value ??
      rhythmById('straight-eighths')) as RhythmPattern;

    const runs = shapeRuns({
      instrument,
      keyMode,
      // The arpeggio variant has its own shape — chord up, scale down.
      direction: variant === 'arpeggio-then-scale' ? 'ascending' : direction,
      minFret: config.minFret,
      count: Math.min(config.shapesPerRep, shapeCount(keyMode)),
    });

    const builder = phraseBuilder().rhythm(EIGHTH);

    for (const run of runs) {
      const positions =
        variant === 'arpeggio-then-scale'
          ? [
              ...arpeggioRun(run.positions, shapeChord(keyMode, run.startDegree).degrees),
              ...[...run.positions].reverse(),
            ]
          : run.positions;
      const options = (i: number) => noteOptionsFor(positions[i]!);

      // A box is known by the step it starts on — "shape 2" — and a 3nps shape
      // by its degree, which is its mode.
      builder.labelBar(
        `Fret ${run.startFret} · ${boxes ? 'shape' : 'degree'} ${run.startDegree}`,
      );
      if (variant === 'pause-on-root') {
        // Not meant to be musical: a beat on every root, eighths otherwise.
        positions.forEach((p, i) => builder.note(p, options(i), p.isRoot ? QUARTER : EIGHTH));
      } else {
        builder.withRhythm(positions, rhythm, (_p, i) => options(i));
      }
      // Each shape starts on a bar line, so the player can hear where one ends.
      builder.fillBar();
    }

    const phrase = builder.build();
    const noun = boxes ? 'boxes' : 'shapes';
    const shapes =
      runs.length === shapeCount(keyMode)
        ? `All ${COUNT_WORDS[runs.length] ?? runs.length} ${noun}`
        : runs.length === 1
          ? `One ${boxes ? 'box' : 'shape'}`
          : `${runs.length} ${noun}`;
    const chord = shapeChord(keyMode, 1).symbol;
    const [headline, instruction, highlights] = {
      plain: [
        `${shapes} in ${keyModeLabel(keyMode)}, ${axisDisplay(variation, 'direction', 'ascending').toLowerCase()}.`,
        `Work up the neck, one ${boxes ? 'box' : 'shape'} at a time.`,
        ['key', 'direction', 'rhythmPattern'],
      ],
      'arpeggio-then-scale': [
        `${shapes} in ${keyModeLabel(keyMode)}, each chord then scale.`,
        chord
          ? `For each box, arpeggiate ${keyMode.tonic}${chord} up, then run the scale down.`
          : 'For each shape, arpeggiate its 7th chord up, then run the scale down.',
        ['key', 'rhythmPattern'],
      ],
      'pause-on-root': [
        `${shapes} in ${keyModeLabel(keyMode)}, holding every root.`,
        'Work up the neck, giving each root a full beat.',
        ['key', 'direction'],
      ],
    }[variant] as [string, string, AxisId[]];

    return {
      kind: 'played',
      phrase,
      neck: overlayFromPositions(
        runs.flatMap((run) => run.positions),
        { emphasisFrets: runs.map((run) => run.startFret) },
      ),
      brief: makeBrief(headline, instruction, orderedHighlights(variation, highlights)),
    };
  },
};
