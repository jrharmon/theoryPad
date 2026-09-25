import { z } from 'zod';
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
  shapeRuns,
} from '../shared';

const params = z.object({
  variant: z.enum(['plain', 'arpeggio-then-scale', 'pause-on-root']).default('plain'),
  /** How many of the seven shapes one rep covers. */
  shapesPerRep: z.number().int().min(1).max(7).default(7),
  /** Lowest fret the first shape may start at. */
  minFret: z.number().int().min(0).max(12).default(1),
});

export type ModesThroughKeyParams = z.infer<typeof params>;

const AXES = ['mode', 'key', 'direction', 'rhythmPattern'] as const;

export const modesThroughKey: PlayedDefinition<ModesThroughKeyParams> = {
  id: 'modes-through-key',
  name: 'Modes up the neck',
  tags: ['scales', 'modes', 'whole-neck', 'positional'],
  kind: 'played',
  summary:
    'All seven three-note-per-string shapes of one key, climbing from the nut to the 12th fret.',
  description: [
    'A key is rolled. Play its seven shapes in order up the neck, each starting',
    'on whichever scale degree falls next on the lowest string — so you cover',
    'the whole neck instead of the one box you are comfortable in.',
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

    const direction = (variation.axes.direction?.value ?? 'ascending') as Direction;
    const rhythm = (variation.axes.rhythmPattern?.value ??
      rhythmById('straight-eighths')) as RhythmPattern;

    const runs = shapeRuns({
      instrument,
      keyMode,
      // The arpeggio variant has its own shape — chord up, scale down.
      direction: variant === 'arpeggio-then-scale' ? 'ascending' : direction,
      minFret: config.minFret,
      count: config.shapesPerRep,
    });

    const builder = phraseBuilder().rhythm(EIGHTH);

    for (const run of runs) {
      const positions =
        variant === 'arpeggio-then-scale'
          ? [...arpeggioRun(run.positions, run.startDegree), ...[...run.positions].reverse()]
          : run.positions;
      const options = (i: number) => noteOptionsFor(positions[i]!);

      builder.labelBar(`Fret ${run.startFret} · degree ${run.startDegree}`);
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
    const shapes = runs.length === 7 ? 'All seven shapes' : `${runs.length} shapes`;
    const [headline, instruction, highlights] = {
      plain: [
        `${shapes} in ${keyModeLabel(keyMode)}, ${axisDisplay(variation, 'direction', 'ascending').toLowerCase()}.`,
        'Work up the neck, one shape at a time.',
        ['key', 'direction', 'rhythmPattern'],
      ],
      'arpeggio-then-scale': [
        `${shapes} in ${keyModeLabel(keyMode)}, each chord then scale.`,
        'For each shape, arpeggiate its 7th chord up, then run the scale down.',
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
