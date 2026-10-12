import { z } from 'zod';
import type { Phrase } from '@/domain/phrase';
import { emptyPhrase } from '@/domain/phrase';
import type { PlayedDefinition, PlayedInstance } from '../types';
import { keyModeLabel, makeBrief, orderedHighlights, overlayFromPhrase } from '../shared';

/** A phrase as stored in params: enough to tell it from anything else, trusted beyond that. */
const storedPhrase = z.custom<Phrase>(
  (value) =>
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as Phrase).notes) &&
    Array.isArray((value as Phrase).bars) &&
    typeof (value as Phrase).totalTicks === 'number',
);

/** Where the notes came from, for the exercise page: "Rhythm.gp · Lead · bars 5–12". */
const source = z.object({
  file: z.string(),
  title: z.string(),
  track: z.string(),
  /** 1-based, as Guitar Pro numbers them. */
  firstBar: z.number(),
  lastBar: z.number(),
});

const params = z.object({
  // Neither is a setting: neither becomes a form field. Both are locked at
  // import, so a routine item always reads the exercise's own.
  phrase: storedPhrase.default(() => emptyPhrase(1)),
  source: source.optional(),
});

export type PhraseParams = z.infer<typeof params>;
export type PhraseSource = z.infer<typeof source>;

/** The params keys a written exercise keeps on itself, never copied into a routine. */
export const WRITTEN_PARAMS = ['phrase', 'source'] as const;

/**
 * A written exercise: a set phrase, the same every time, read from a Guitar
 * Pro file (doc 16). "Phrase" is only the code's name; the player sees a
 * written exercise. The id is `phrase`, and stays so.
 */
export const writtenExercise: PlayedDefinition<PhraseParams> = {
  id: 'phrase',
  name: 'Written exercise',
  // What any set phrase trains: playing it as written, in time. Tags are the player's to change.
  tags: ['timing'],
  kind: 'played',
  summary: 'A riff, lick or étude read from a Guitar Pro file, played as written.',
  description: [
    'The notes come from a .gp or .gpx file: one track, the whole file or a stretch of bars,',
    'with its own tuning and capo. Repeats are written out. Its key comes from the file and can',
    'be changed; its tempo starts at the one it was written at.',
  ].join(' '),

  axes: ['scale', 'mode', 'key'],
  params,
  defaults: { targetTempo: 100, reps: 2 },
  timing: 'metronome',
  // Made only on its own new-exercise page, from a file: no starter.
  starter: false,

  generate({ keyMode, instrument, variation, params: { phrase, source } }): PlayedInstance {
    const written = phrase.writtenTempo
      ? `Written at ${phrase.writtenTempo}`
      : 'Played as written';
    const capo = instrument.capo > 0 ? `, capo ${instrument.capo}` : '';
    const where = source
      ? source.firstBar === source.lastBar
        ? `Bar ${source.firstBar} of ${source.title}`
        : `Bars ${source.firstBar}–${source.lastBar} of ${source.title}`
      : 'A written phrase';
    return {
      kind: 'played',
      phrase,
      neck: overlayFromPhrase(phrase, keyMode, instrument),
      brief: makeBrief(
        `${where}, in ${keyModeLabel(keyMode)}.`,
        `${written}${capo}.`,
        // The key card names the mode too.
        orderedHighlights(variation, ['key']),
      ),
    };
  },
};
