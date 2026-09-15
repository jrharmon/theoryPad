import { z } from 'zod';
import type { StringSet } from '@/domain/instrument';
import { allStrings, stringLabel } from '@/domain/instrument';
import { QUARTER, phraseBuilder } from '@/domain/phrase';
import type { ExerciseDefinition, PlayedInstance } from '../types';
import {
  axisValue,
  keyModeLabel,
  makeBrief,
  oneNotePerString as sweep,
  orderedHighlights,
  phraseEstimate,
  roleFor,
} from '../shared';

const params = z.object({
  stopCondition: z.enum(['return-to-root', 'fixed-cycles']).default('return-to-root'),
  /** Sweeps across the strings and back, when stopping after a fixed number. */
  cycles: z.number().int().min(1).max(12).default(4),
  step: z.enum(['next-scale-degree', 'skip-one']).default('next-scale-degree'),
});

export type OneNotePerStringParams = z.infer<typeof params>;

export const oneNotePerString: ExerciseDefinition<OneNotePerStringParams> = {
  id: 'one-note-per-string',
  name: 'One note per string',
  tags: ['scales', 'modes', 'fretboard-knowledge', 'whole-neck'],
  kind: 'played',
  summary: 'Walk the scale one note per string, finding each note wherever it is.',
  description: [
    'A key is rolled. Play the next note of the scale on the next string,',
    'sweeping across the strings and back until you land on the root where',
    'you started. The tab shows note names, not frets: the point is finding',
    'each note on the fly, anywhere on its string. You will always be limited',
    'by how fast you find the note, never by how fast your hand gets there.',
  ].join(' '),

  axes: ['mode', 'key', 'stringSet'],
  params,
  defaults: {
    targetTempo: 35,
    reps: 2,
    params: { stopCondition: 'return-to-root', cycles: 4, step: 'next-scale-degree' },
    // String set: every string, the axis's own default. A set is still a choice.
  },
  timing: 'either',

  generate({ keyMode, instrument, variation, params: config }): PlayedInstance {
    const set = axisValue<StringSet>(variation, 'stringSet', allStrings(instrument));
    const notes = sweep({
      instrument,
      keyMode,
      strings: set.strings,
      step: config.step === 'skip-one' ? 2 : 1,
      stop:
        config.stopCondition === 'fixed-cycles'
          ? { kind: 'cycles', count: config.cycles }
          : { kind: 'return-to-root' },
    });

    const builder = phraseBuilder().rhythm(QUARTER);
    // The note name stands in for the fret, which would give the answer away.
    for (const n of notes) builder.note(n, { role: roleFor(n), display: n.pitchClass });

    return {
      kind: 'played',
      phrase: builder.build(),
      // Nothing on the neck, for the same reason.
      neck: { notes: [] },
      brief: makeBrief(
        `One note per string in ${keyModeLabel(keyMode)}, on ${set.id === 'all' ? 'all strings' : `strings ${set.name}`}.`,
        `Find each note anywhere on its string, ${config.step === 'skip-one' ? 'skipping a note each time' : 'walking the scale'}` +
          (config.stopCondition === 'fixed-cycles'
            ? `, ${config.cycles} times across and back.`
            : `, until you are back on ${keyMode.tonic} on string ${stringLabel(instrument, set.strings[0]!)}.`),
        orderedHighlights(variation, ['key', 'stringSet']),
      ),
    };
  },

  estimateRepSeconds: phraseEstimate(35),
};
