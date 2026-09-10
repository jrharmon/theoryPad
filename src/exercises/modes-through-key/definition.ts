import { z } from 'zod';
import type { DegreeNumber } from '@/domain/music';
import { noteAtDegree } from '@/domain/music';
import { EIGHTH, phraseBuilder, phraseSeconds, rhythmById } from '@/domain/phrase';
import type { RhythmPattern } from '@/domain/phrase';
import type { Direction } from '@/domain/variation';
import type { ExerciseDefinition, GenerationContext, PlayedInstance } from '../types';
import {
  axisDisplay,
  keyModeLabel,
  makeBrief,
  noteOptionsFor,
  ordinal,
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

const AXES = ['mode', 'key', 'direction', 'rhythmPattern', 'targetScaleDegree'] as const;

export const modesThroughKey: ExerciseDefinition<ModesThroughKeyParams> = {
  id: 'modes-through-key',
  name: 'Seven modes through a key',
  tags: ['scales', 'modes', 'whole-neck', 'positional'],
  kind: 'played',
  summary: 'Play every shape of a rolled key, ascending the neck.',
  description: [
    'A key is rolled. Play its shapes in order up the neck, each starting on',
    'whichever degree falls next — so the whole neck gets covered rather than',
    'one comfortable box. Land each shape on the rolled target degree.',
  ].join(' '),

  axes: [...AXES],
  params,

  defaults: {
    targetTempo: 76,
    reps: 2,
    params: { variant: 'plain', shapesPerRep: 7, minFret: 1 },
  },

  timing: 'either',
  rerollPolicy: 'per-rep',

  generate(context: GenerationContext<ModesThroughKeyParams>): PlayedInstance {
    const { keyMode, instrument, params: config, variation } = context;

    if (config.variant !== 'plain') {
      // Declared in the catalogue, built in milestone 3. Failing loudly beats
      // silently playing something other than what the brief promises.
      throw new Error(`modes-through-key variant "${config.variant}" is not implemented yet`);
    }

    const direction = (variation.axes.direction?.value ?? 'ascending') as Direction;
    const rhythm = (variation.axes.rhythmPattern?.value ??
      rhythmById('straight-eighths')) as RhythmPattern;
    const targetDegree = variation.axes.targetScaleDegree?.value as DegreeNumber | undefined;

    const runs = shapeRuns({
      instrument,
      keyMode,
      direction,
      minFret: config.minFret,
      count: config.shapesPerRep,
    });

    const builder = phraseBuilder().rhythm(EIGHTH);
    const allPositions = runs.flatMap((run) => run.positions);

    for (const run of runs) {
      builder.labelBar(`Fret ${run.startFret} · degree ${run.startDegree}`);
      builder.withRhythm(
        run.positions.map((p) => ({ string: p.string, fret: p.fret })),
        rhythm,
        (_position, index) => noteOptionsFor(run.positions[index]!, targetDegree),
      );
      // Each shape starts on a bar line, so the player can hear where one ends.
      builder.fillBar();
    }

    const phrase = builder.build();

    return {
      kind: 'played',
      phrase,
      neck: overlayFromPositions(allPositions, {
        ...(targetDegree !== undefined ? { targetDegree } : {}),
        emphasisFrets: runs.map((run) => run.startFret),
      }),
      brief: makeBrief(
        `${runs.length === 7 ? 'All seven shapes' : `${runs.length} shapes`} in ` +
          `${keyModeLabel(keyMode)}, ${axisDisplay(variation, 'direction', 'ascending').toLowerCase()}.`,
        targetDegree === undefined
          ? 'Work up the neck, one shape at a time.'
          : `Work up the neck, one shape at a time, landing each on the ` +
            `${ordinal(targetDegree)} (${noteAtDegree(keyMode, targetDegree)}).`,
        orderedHighlights(variation, ['key', 'direction', 'targetScaleDegree', 'rhythmPattern']),
      ),
    };
  },

  estimateRepSeconds(instance, tempo) {
    if (instance.kind !== 'played') return 0;
    return phraseSeconds(instance.phrase, tempo ?? 76);
  },
};
