import { z } from 'zod';
import type { NeckPosition } from '@/domain/instrument';
import { STRAIGHT_EIGHTHS, phraseBuilder } from '@/domain/phrase';
import type { RhythmPattern } from '@/domain/phrase';
import type { Direction } from '@/domain/variation';
import type { ExerciseDefinition, PlayedInstance } from '../types';
import {
  axisDisplay,
  axisValue,
  horizontalRun,
  keyModeLabel,
  makeBrief,
  noteOptionsFor,
  orderedHighlights,
  overlayFromPhrase,
  phraseEstimate,
} from '../shared';

const params = z.object({
  shiftOn: z.enum(['every-other-string', 'every-string']).default('every-other-string'),
});

export type PositionShiftingParams = z.infer<typeof params>;

export const positionShifting: ExerciseDefinition<PositionShiftingParams> = {
  id: 'position-shifting',
  name: 'Position shifting',
  tags: ['scales', 'horizontal', 'whole-neck'],
  kind: 'played',
  summary: 'Climb the neck through the shapes, sliding into the next one as you go.',
  description: [
    'Play the scale across the neck rather than inside one box. Going up, a',
    'string with four notes instead of three is a shift: slide into the',
    'fourth and you are in the next three-note-per-string shape. Coming down,',
    'the shifts fall on different strings, so the route back is not the',
    'route up.',
  ].join(' '),

  axes: ['mode', 'key', 'neckPosition', 'direction', 'rhythmPattern'],
  params,
  defaults: {
    targetTempo: 72,
    reps: 2,
    params: { shiftOn: 'every-other-string' },
    axisPolicies: {
      // Only up-and-back shows both routes; a one-way run is still available.
      direction: { mode: 'roll', from: ['up-down', 'down-up'] },
      // The run climbs ten frets or more, so start it in the lower half.
      neckPosition: { mode: 'roll', from: ['0', '3', '5', '7'] },
    },
  },
  timing: 'either',
  rerollPolicy: 'per-rep',

  generate({ keyMode, instrument, variation, params: config }): PlayedInstance {
    const position = axisValue<NeckPosition>(variation, 'neckPosition', { fret: 3, span: 4 });
    const direction = axisValue<Direction>(variation, 'direction', 'up-down');
    const rhythm = axisValue<RhythmPattern>(variation, 'rhythmPattern', STRAIGHT_EIGHTHS);

    const run = horizontalRun({ instrument, keyMode, minFret: position.fret, shiftOn: config.shiftOn });
    if (!run) throw new Error(`No run of ${keyModeLabel(keyMode)} fits from fret ${position.fret}`);
    const notes = {
      ascending: run.up,
      descending: run.down,
      'up-down': [...run.up, ...run.down.slice(1)],
      'down-up': [...run.down, ...run.up.slice(1)],
    }[direction];

    const phrase = phraseBuilder()
      .labelBar(`From fret ${run.startFret}`)
      .withRhythm(notes, rhythm, (_p, i) => ({
        ...noteOptionsFor(notes[i]!),
        ...(notes[i]!.shift ? { articulation: notes[i]!.shift === 'up' ? 'slide-up' : 'slide-down' } : {}),
      }))
      .build();

    return {
      kind: 'played',
      phrase,
      neck: overlayFromPhrase(phrase, keyMode, instrument, { emphasisFrets: [run.startFret] }),
      brief: makeBrief(
        `${keyModeLabel(keyMode)} across the neck from ${axisDisplay(variation, 'neckPosition').toLowerCase()}, ` +
          `shifting on ${config.shiftOn === 'every-string' ? 'every string' : 'every other string'}.`,
        `Slide into each marked note to change shape.` +
          (direction === 'up-down' || direction === 'down-up'
            ? ' The way back shifts on different strings.'
            : ''),
        orderedHighlights(variation, ['key', 'neckPosition', 'direction', 'rhythmPattern']),
      ),
    };
  },

  estimateRepSeconds: phraseEstimate(72),
};
