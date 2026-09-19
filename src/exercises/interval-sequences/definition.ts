import type { DegreeNumber } from '@/domain/music';
import { noteAtDegree } from '@/domain/music';
import type { NeckPosition } from '@/domain/instrument';
import { STRAIGHT_EIGHTHS, phraseBuilder } from '@/domain/phrase';
import type { RhythmPattern } from '@/domain/phrase';
import type { Direction, IntervalPairing, IntervalPattern } from '@/domain/variation';
import { INTERVAL_PATTERNS } from '@/domain/variation';
import type { PlayedDefinition, PlayedInstance } from '../types';
import {
  axisDisplay,
  axisValue,
  intervalRun,
  keyModeLabel,
  makeBrief,
  noteOptionsFor,
  optionalAxis,
  ordinal,
  orderedHighlights,
  overlayFromPositions,
  phraseEstimate,
  shapeFrom,
} from '../shared';

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
    'mode', 'key', 'neckPosition', 'intervalPattern', 'intervalPairing',
    'direction', 'rhythmPattern', 'targetScaleDegree',
  ],
  defaults: { targetTempo: 80, reps: 2 },
  timing: 'either',

  generate({ keyMode, instrument, variation }): PlayedInstance {
    const position = axisValue<NeckPosition>(variation, 'neckPosition', { fret: 5, span: 4 });
    const pattern = axisValue<IntervalPattern>(variation, 'intervalPattern', INTERVAL_PATTERNS[0]!);
    const pairing = axisValue<IntervalPairing>(variation, 'intervalPairing', 'same-direction');
    const direction = axisValue<Direction>(variation, 'direction', 'up-down');
    const rhythm = axisValue<RhythmPattern>(variation, 'rhythmPattern', STRAIGHT_EIGHTHS);
    const target = optionalAxis<DegreeNumber>(variation, 'targetScaleDegree');

    const shape = shapeFrom({ instrument, keyMode, fret: position.fret });
    if (!shape) throw new Error(`No shape of ${keyModeLabel(keyMode)} fits at fret ${position.fret}`);
    const positions = intervalRun({ positions: shape.positions, pattern, pairing, direction });

    const phrase = phraseBuilder()
      .labelBar(`${pattern.name} · fret ${shape.startFret}`)
      .withRhythm(positions, rhythm, (_p, i) => noteOptionsFor(positions[i]!, target))
      .build();

    return {
      kind: 'played',
      phrase,
      neck: overlayFromPositions(shape.positions, {
        ...(target !== undefined ? { targetDegree: target } : {}),
        emphasisFrets: [shape.startFret],
      }),
      brief: makeBrief(
        `${pattern.name} in ${keyModeLabel(keyMode)}, ${axisDisplay(variation, 'neckPosition').toLowerCase()}.`,
        `${pairing === 'alternating' ? 'Alternating' : 'Every figure the same way'}, ` +
          `${axisDisplay(variation, 'direction', 'up then down').toLowerCase()}` +
          (target === undefined
            ? '.'
            : `, leaning on the ${ordinal(target)} (${noteAtDegree(keyMode, target)}) wherever it falls.`),
        orderedHighlights(variation, ['key', 'intervalPattern', 'intervalPairing', 'neckPosition', 'direction', 'targetScaleDegree']),
      ),
    };
  },

  estimateRepSeconds: phraseEstimate(80),
};
