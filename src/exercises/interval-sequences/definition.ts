import { STRAIGHT_EIGHTHS, phraseBuilder } from '@/domain/phrase';
import type { AxisId } from '@/domain/variation';
import { INTERVAL_PATTERNS } from '@/domain/variation';
import type { PlayedDefinition, PlayedInstance } from '../types';
import {
  axisDisplay,
  axisValue,
  intervalRun,
  keyModeLabel,
  makeBrief,
  noteOptionsFor,
  orderedHighlights,
  overlayFromPositions,
  shapeFrom,
} from '../shared';

/** The axes worth naming in the strip, in the order the brief reads them. */
const HIGHLIGHTS: AxisId[] = [
  'key',
  'intervalPattern',
  'intervalPairing',
  'neckPosition',
  'direction',
];

export const intervalSequences: PlayedDefinition = {
  id: 'interval-sequences',
  name: 'Interval sequences',
  tags: ['scales', 'intervals', 'positional'],
  kind: 'played',
  summary: 'Run the scale in 3rds, 4ths, 5ths, 6ths or 7ths through one shape.',
  description: [
    'A key, a position and an interval are rolled. Play the scale through the',
    'three-note-per-string shape at that position as a sequence — 1-3, 2-4,',
    '3-5 for 3rds — or alternating, 1-3, 4-2, 3-5, so every other pair turns',
    'round. Hearing the scale in intervals is what gets you off running it',
    'straight up and down.',
  ].join(' '),

  axes: [
    'scale',
    'mode',
    'key',
    'neckPosition',
    'intervalPattern',
    'intervalPairing',
    'direction',
    'rhythmPattern',
  ],
  defaults: { targetTempo: 80, reps: 2 },
  timing: 'either',

  generate({ keyMode, instrument, variation }): PlayedInstance {
    const position = axisValue(variation, 'neckPosition', { fret: 5, span: 4 });
    const pattern = axisValue(variation, 'intervalPattern', INTERVAL_PATTERNS[0]!);
    const pairing = axisValue(variation, 'intervalPairing', 'same-direction');
    const direction = axisValue(variation, 'direction', 'up-down');
    const rhythm = axisValue(variation, 'rhythmPattern', STRAIGHT_EIGHTHS);

    const shape = shapeFrom({ instrument, keyMode, fret: position.fret });
    if (!shape)
      throw new Error(`No shape of ${keyModeLabel(keyMode)} fits at fret ${position.fret}`);
    const positions = intervalRun({ positions: shape.positions, pattern, pairing, direction });

    const phrase = phraseBuilder()
      .labelBar(`${pattern.name} · fret ${shape.startFret}`)
      .withRhythm(positions, rhythm, (_p, i) => noteOptionsFor(positions[i]!))
      .build();

    const where = axisDisplay(variation, 'neckPosition').toLowerCase();
    const headline = `${pattern.name} in ${keyModeLabel(keyMode)}, ${where}.`;
    const eachFigure = pairing === 'alternating' ? 'Alternating' : 'Every figure the same way';
    const how = axisDisplay(variation, 'direction', 'up then down').toLowerCase();
    const instruction = `${eachFigure}, ${how}.`;

    return {
      kind: 'played',
      phrase,
      neck: overlayFromPositions(shape.positions, { emphasisFrets: [shape.startFret] }),
      brief: makeBrief(headline, instruction, orderedHighlights(variation, HIGHLIGHTS)),
    };
  },
};
