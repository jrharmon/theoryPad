import { z } from 'zod';
import type { KeyMode } from '@/domain/music';
import { harmonyOf, keyModeName } from '@/domain/music';
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

/**
 * Said once, in the brief, so the questions can name the key they are about:
 * a pentatonic's chord questions are its parent mode's (decision 20).
 */
function chordsNote(keyMode: KeyMode, types: DiatonicDrillParams['questionTypes']): string {
  const harmony = harmonyOf(keyMode);
  if (harmony === keyMode || types.every((t) => t === 'name-notes')) return '';
  return (
    `${keyModeName(keyMode)} has no chords of its own, so the chord questions are ` +
    `about ${keyModeName(harmony)}, the mode it comes from. `
  );
}

export const diatonicDrill: TheoryDefinition<DiatonicDrillParams> = {
  id: 'diatonic-drill',
  name: 'Key signature drill',
  tags: ['theory', 'chords', 'key-signatures', 'no-guitar'],
  kind: 'theory',
  summary: 'The notes and chords of a key: spelling, quality and chord families.',
  description: [
    'A key is rolled — in a routine, the routine’s key, so the theory is about',
    'what you just played. Name its notes, the quality of each chord, spell',
    'chords, and pick out the tonic, subdominant and dominant families. No',
    'guitar. The wrong answers are near misses on purpose: the other spelling',
    'of a note, one note off in a chord.',
  ].join(' '),

  // A pentatonic names its own notes and asks about its parent mode's chords.
  axes: ['scale', 'mode', 'key'],
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
        `${questions.length} ${questions.length === 1 ? 'question' : 'questions'} on ${keyModeLabel(keyMode)}.`,
        chordsNote(keyMode, config.questionTypes) +
          'Notes, chords and spelling, no guitar. Number keys answer.',
        orderedHighlights(variation, ['key']),
      ),
    };
  },

  estimateRepSeconds: (set) => set.questions.length * 12,
};
