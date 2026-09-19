import { z } from 'zod';
import { circleQuestions } from '@/domain/theory';
import type { TheoryDefinition, TheoryInstance } from '../types';
import { makeBrief } from '../shared';

const params = z.object({
  questionTypes: z
    .array(
      z.enum([
        'signature-to-key',
        'key-to-signature',
        'relative-minor',
        'relative-major',
        'neighbour-key',
        'mode-signature',
      ]),
    )
    .min(1)
    .default([
      'signature-to-key',
      'key-to-signature',
      'relative-minor',
      'relative-major',
      'neighbour-key',
      'mode-signature',
    ]),
  questionCount: z.number().int().min(5).max(20).default(10),
  /** "How many flats in Eb Dorian?" */
  includeModes: z.boolean().default(true),
});

export type CircleOfFifthsParams = z.infer<typeof params>;

export const circleOfFifths: TheoryDefinition<CircleOfFifthsParams> = {
  id: 'circle-of-fifths',
  name: 'Circle of fifths',
  tags: ['theory', 'key-signatures', 'no-guitar'],
  kind: 'theory',
  summary: 'Quick questions about key signatures, relative keys and the circle.',
  description: [
    'Rapid questions across all twelve keys — not the session’s, because',
    'covering the whole circle is the point. Signatures, relative majors and',
    'minors, neighbouring keys, and the signatures of modes. A wrong answer',
    'shows where you were on the circle against where the answer is.',
  ].join(' '),

  // Nothing rolled: it roams every key on its own.
  axes: [],
  params,
  defaults: {
    targetTempo: null,
    reps: 1,
    params: {
      questionTypes: [
        'signature-to-key',
        'key-to-signature',
        'relative-minor',
        'relative-major',
        'neighbour-key',
        'mode-signature',
      ],
      questionCount: 10,
      includeModes: true,
    },
  },

  generate({ rng, params: config, subjectWeights = {} }): TheoryInstance {
    const keyWeights = Object.fromEntries(
      Object.entries(subjectWeights).flatMap(([subject, weight]) =>
        subject.startsWith('key:') ? [[subject.slice(4), weight]] : [],
      ),
    );
    const questions = circleQuestions({
      rng,
      keyWeights,
      types: config.questionTypes,
      count: config.questionCount,
      includeModes: config.includeModes,
    });
    return {
      kind: 'theory',
      questions,
      brief: makeBrief(
        `${questions.length} questions around the circle of fifths.`,
        'Every key, not just this session’s. Number keys answer.',
      ),
    };
  },

  estimateRepSeconds: (set) => set.questions.length * 8,
};
