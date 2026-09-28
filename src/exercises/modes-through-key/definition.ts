import { z } from 'zod';
import { playsInBoxes } from '@/domain/music';
import { shapeCount } from '@/domain/instrument';
import { EIGHTH, QUARTER, STRAIGHT_EIGHTHS, phraseBuilder, rhythmById } from '@/domain/phrase';
import type { RhythmPattern } from '@/domain/phrase';
import type { AxisId, Direction } from '@/domain/variation';
import type { PlayedDefinition, GenerationContext, PlayedInstance } from '../types';
import {
  applyDirection,
  arpeggioRun,
  axisDisplay,
  axisValue,
  keyModeLabel,
  makeBrief,
  noteOptionsFor,
  orderedHighlights,
  overlayFromPositions,
  shapeChord,
  shapeRuns,
  startOnString,
  turnaroundParam,
  turnInstruction,
  turnRepeats,
  turns,
} from '../shared';

const params = z.object({
  variant: z.enum(['plain', 'arpeggio-then-scale', 'pause-on-root']).default('plain'),
  /** How many shapes one rep covers, at most the scale's own: seven, or five boxes. */
  shapesPerRep: z.number().int().min(1).max(7).default(7),
  /** Lowest fret the first shape may start at. */
  minFret: z.number().int().min(0).max(12).default(1),
  turnaround: turnaroundParam,
});

export type ModesThroughKeyParams = z.infer<typeof params>;

const AXES = ['scale', 'mode', 'key', 'direction', 'startString', 'rhythmPattern'] as const;

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
    const start = axisValue(variation, 'startString', { string: null, name: 'Outer string' });
    // Chord up, scale down comes back to where it began, like a run that turns.
    const loops = variant === 'arpeggio-then-scale' || turns(direction);
    const rhythm = (variation.axes.rhythmPattern?.value ??
      rhythmById('straight-eighths')) as RhythmPattern;

    const runs = shapeRuns({
      instrument,
      keyMode,
      direction: 'ascending',
      minFret: config.minFret,
      count: Math.min(config.shapesPerRep, shapeCount(keyMode)),
    });
    // Holding the roots is mostly eighths, so Auto turns it as eighths.
    const turnRhythm = variant === 'pause-on-root' ? STRAIGHT_EIGHTHS : rhythm;
    // Asked of each shape: a blues box can be a note longer than the next.
    const repeatsTurn = runs.map((run) =>
      turnRepeats(config.turnaround, run.positions.length, turnRhythm),
    );

    const builder = phraseBuilder().rhythm(EIGHTH);

    runs.forEach((run, r) => {
      // The arpeggio variant has its own shape — chord up, scale down.
      const positions =
        variant === 'arpeggio-then-scale'
          ? startOnString(
              [
                ...arpeggioRun(run.positions, shapeChord(keyMode, run.startDegree).degrees),
                ...[...run.positions].reverse(),
              ],
              start.string,
              loops,
            )
          : startOnString(
              applyDirection(run.positions, direction, repeatsTurn[r]),
              start.string,
              loops,
              repeatsTurn[r],
            );
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
    });

    const phrase = builder.build();
    const noun = boxes ? 'boxes' : 'shapes';
    const shapes =
      runs.length === shapeCount(keyMode)
        ? `All ${COUNT_WORDS[runs.length] ?? runs.length} ${noun}`
        : runs.length === 1
          ? `One ${boxes ? 'box' : 'shape'}`
          : `${runs.length} ${noun}`;
    const chord = shapeChord(keyMode, 1).symbol;
    // Said only when it moves the start: the outer string is where a run starts anyway.
    const from = start.string === null ? '' : ` from ${start.name.toLowerCase()}`;
    const startAxis: AxisId[] = start.string === null ? [] : ['startString'];
    const turn = turns(direction) ? ` ${turnInstruction(repeatsTurn)}` : '';
    const [headline, instruction, highlights] = {
      plain: [
        `${shapes} in ${keyModeLabel(keyMode)}, ${axisDisplay(variation, 'direction', 'ascending').toLowerCase()}${from}.`,
        `Work up the neck, one ${boxes ? 'box' : 'shape'} at a time.${turn}`,
        ['key', 'direction', ...startAxis, 'rhythmPattern'],
      ],
      'arpeggio-then-scale': [
        `${shapes} in ${keyModeLabel(keyMode)}, each chord then scale${from ? `,${from}` : ''}.`,
        chord
          ? `For each box, arpeggiate ${keyMode.tonic}${chord} up, then run the scale down.`
          : 'For each shape, arpeggiate its 7th chord up, then run the scale down.',
        ['key', ...startAxis, 'rhythmPattern'],
      ],
      'pause-on-root': [
        `${shapes} in ${keyModeLabel(keyMode)}${from}, holding every root.`,
        `Work up the neck, giving each root a full beat.${turn}`,
        ['key', 'direction', ...startAxis],
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
