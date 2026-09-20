import { z } from 'zod';
import { diatonicQuestions } from '@/domain/theory';
import type { TheoryDefinition, TheoryInstance } from '../types';
import { keyModeLabel, makeBrief, orderedHighlights } from '../shared';

const params = z.object({
  questionTypes: z
    .array(z.enum(['name-notes', 'name-chords', 'spell-chord', 'chord-function']))
    .min(1)
    .default(['name-notes', 'name-chords', 'spell-chord', 'chord-function']),
  chordDepth: z.enum(['triads', 'sevenths', 'both']).default('both'),
  questionCount: z.number().int().min(4).max(16).default(8),
});

export type DiatonicDrillParams = z.infer<typeof params>;

export const diatonicDrill: TheoryDefinition<DiatonicDrillParams> = {
  id: 'diatonic-drill',
  name: 'Key signature drill',
  tags: ['theory', 'chords', 'key-signatures', 'no-guitar'],
  kind: 'theory',
  summary: 'The notes and chords of a key: spelling, quality and function.',
  description: [
    'A key is rolled — in a routine, the routine’s key, so the theory is about',
    'what you just played. Name its notes, the quality of each chord, spell',
    'chords, and say which chord does which job. No guitar. The wrong answers',
    'are near misses on purpose: the other spelling of a note, one note off in',
    'a chord.',
  ].join(' '),

  axes: ['mode', 'key'],
  params,
  defaults: {
    targetTempo: null,
    reps: 1,
  },

  generate({ keyMode, rng, variation, params: config }): TheoryInstance {
    const questions = diatonicQuestions({
      keyMode,
      rng,
      types: config.questionTypes,
      depth: config.chordDepth,
      count: config.questionCount,
    });
    return {
      kind: 'theory',
      questions,
      brief: makeBrief(
        `${questions.length} questions on ${keyModeLabel(keyMode)}.`,
        'Notes, chords and spelling, no guitar. Number keys answer.',
        orderedHighlights(variation, ['key']),
      ),
    };
  },

  estimateRepSeconds: (set) => set.questions.length * 12,
};
