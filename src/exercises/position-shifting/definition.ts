import { z } from 'zod';
import { STRAIGHT_EIGHTHS, phraseBuilder } from '@/domain/phrase';
import type { PlayedDefinition, PlayedInstance } from '../types';
import {
  axisDisplay,
  axisValue,
  horizontalRun,
  keyModeLabel,
  makeBrief,
  noteOptionsFor,
  orderedHighlights,
  overlayFromPhrase,
  turnaroundParam,
  turnInstruction,
  turnRepeats,
} from '../shared';

const params = z.object({
  shiftOn: z.enum(['every-other-string', 'every-string']).default('every-other-string'),
  turnaround: turnaroundParam,
});

export type PositionShiftingParams = z.infer<typeof params>;

export const positionShifting: PlayedDefinition<PositionShiftingParams> = {
  id: 'position-shifting',
  name: 'Position shifting',
  tags: ['scales', 'horizontal', 'whole-neck'],
  kind: 'played',
  summary: 'Climb the neck through the shapes, sliding into the next one as you go.',
  description: [
    'Play the scale across the neck rather than inside one box. Going up, a',
    'string with a note more than its shape has is a shift — four instead of',
    "three, or three instead of a pentatonic box's two: slide into the extra",
    'note and you are in the next shape. Coming down, the shifts fall on',
    'different strings, so the route back is not the route up.',
  ].join(' '),

  axes: ['scale', 'mode', 'key', 'neckPosition', 'direction', 'rhythmPattern'],
  params,
  defaults: {
    targetTempo: 72,
    reps: 2,
    axisPolicies: {
      // Only up-and-back shows both routes; a one-way run is still available.
      direction: { mode: 'roll', from: ['up-down', 'down-up'] },
      // The run climbs ten frets or more, so start it in the lower half.
      neckPosition: { mode: 'roll', from: ['0', '3', '5', '7'] },
    },
  },
  timing: 'either',

  generate({ keyMode, instrument, variation, params: config }): PlayedInstance {
    const position = axisValue(variation, 'neckPosition', { fret: 3, span: 4 });
    const direction = axisValue(variation, 'direction', 'up-down');
    const rhythm = axisValue(variation, 'rhythmPattern', STRAIGHT_EIGHTHS);

    const run = horizontalRun({
      instrument,
      keyMode,
      minFret: position.fret,
      shiftOn: config.shiftOn,
    });
    if (!run)
      throw new Error(`No run of ${keyModeLabel(keyMode)} fits from fret ${position.fret}`);
    // The way up and the way down shift on different strings, so their lengths
    // can differ: the turn is decided by the way into it.
    const repeatTurn = turnRepeats(
      config.turnaround,
      (direction === 'down-up' ? run.down : run.up).length,
      rhythm,
    );
    const back = <T>(way: T[]) => (repeatTurn ? way : way.slice(1));
    const notes = {
      ascending: run.up,
      descending: run.down,
      'up-down': [...run.up, ...back(run.down)],
      'down-up': [...run.down, ...back(run.up)],
    }[direction];

    const phrase = phraseBuilder()
      .labelBar(`From fret ${run.startFret}`)
      .withRhythm(notes, rhythm, (_p, i) => ({
        ...noteOptionsFor(notes[i]!),
        ...(notes[i]!.shift
          ? { articulation: notes[i]!.shift === 'up' ? 'slide-up' : 'slide-down' }
          : {}),
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
            ? ` The way back shifts on different strings. ${turnInstruction([repeatTurn])}`
            : ''),
        orderedHighlights(variation, ['key', 'neckPosition', 'direction', 'rhythmPattern']),
      ),
    };
  },
};
