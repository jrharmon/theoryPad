import { z } from 'zod';
import { noteAtDegree } from '@/domain/music';
import { allStrings, scaleOnNeck } from '@/domain/instrument';
import { FOUR_FOUR, phraseBuilder, ticksPerBar } from '@/domain/phrase';
import type { PlayedDefinition, PlayedInstance } from '../types';
import {
  axisDisplay,
  axisValue,
  keyModeLabel,
  makeBrief,
  optionalAxis,
  ordinal,
  orderedHighlights,
  overlayFromPositions,
} from '../shared';

const params = z.object({
  phraseLengthBars: z.number().int().min(1).max(8).default(4),
  phraseCount: z.number().int().min(1).max(16).default(8),
  constrainToPosition: z
    .boolean()
    .default(false)
    .describe('Keep to the rolled position. Off, the position is only a place to start.'),
  showTargetOnNeck: z.boolean().default(true),
});

export type FreeImprovTargetParams = z.infer<typeof params>;

/** Where the neck diagram stops when nothing narrows it: past this, few improvise. */
const HIGHEST_FRET = 15;

/** The label on each phrase's first bar — also how the screen counts phrases. */
export const PHRASE_LABEL = 'Phrase';

export const freeImprovTarget: PlayedDefinition<FreeImprovTargetParams> = {
  id: 'free-improv-target',
  name: 'Improvise to a target',
  tags: ['improv', 'modes', 'whole-neck', 'timing'],
  kind: 'played',
  summary: 'Improvise freely in the key, ending every phrase on one scale degree.',
  description: [
    'A key, a mode and a target degree are rolled. Play anything you like over',
    'the backing — a track, the drone, or just the click — but end every phrase',
    'on the target, usually the note that gives the mode its colour. The neck',
    'shows the whole mode with the target marked; the screen counts the bars and',
    'phrases, so all you have to listen for is where the phrase ends.',
  ].join(' '),

  axes: ['mode', 'key', 'targetScaleDegree', 'neckPosition', 'stringSet'],
  params,
  defaults: {
    targetTempo: 90,
    reps: 1,
  },
  // The clock counts the phrases, so it runs — the click can be muted.
  timing: 'either',
  // TEMPORARY (doc 13, task 3): chord changes to hear before the generated
  // backing has settings. Task 4 decides what this exercise really defaults to.
  backing: { generated: { source: { kind: 'goTo' }, style: 'strum', chords: 'sevenths' } },

  generate({ keyMode, instrument, variation, params: config }): PlayedInstance {
    const target = optionalAxis(variation, 'targetScaleDegree') ?? 1;
    const position = optionalAxis(variation, 'neckPosition');
    const set = axisValue(variation, 'stringSet', allStrings(instrument));
    const note = noteAtDegree(keyMode, target);

    const range =
      config.constrainToPosition && position
        ? { low: position.fret, high: position.fret + position.span }
        : { low: 0, high: Math.min(HIGHEST_FRET, instrument.fretCount) };
    const positions = scaleOnNeck(instrument, keyMode, range).filter((p) =>
      set.strings.includes(p.string),
    );

    // Nothing written: bars to count, and a label where each phrase begins.
    const bar = ticksPerBar(FOUR_FOUR);
    const builder = phraseBuilder({ timeSignature: FOUR_FOUR });
    for (let i = 0; i < config.phraseCount; i += 1) {
      builder.labelBar(`${PHRASE_LABEL} ${i + 1} · land on ${note}`);
      builder.rest(bar * config.phraseLengthBars);
    }

    // "Open position", "5th position" — the axis's own words.
    const named = axisDisplay(variation, 'neckPosition', '').toLowerCase();
    const where = position
      ? `${config.constrainToPosition ? 'in' : 'starting around'} ${named}`
      : 'anywhere on the neck';
    const bars = `${config.phraseLengthBars} ${config.phraseLengthBars === 1 ? 'bar' : 'bars'}`;
    const howMany = `${config.phraseCount} phrases of ${bars}`;
    return {
      kind: 'played',
      phrase: builder.build(),
      neck: overlayFromPositions(positions, {
        ...(config.showTargetOnNeck ? { targetDegree: target } : {}),
        ...(position ? { emphasisFrets: [position.fret] } : {}),
      }),
      brief: makeBrief(
        `Improvise in ${keyModeLabel(keyMode)}, ending every phrase on ${note}.`,
        `${howMany}, ${where}. ` +
          `Play what you like, but land the last note of each on ${note} — the ${ordinal(target)}.`,
        orderedHighlights(variation, ['key', 'targetScaleDegree', 'neckPosition']),
      ),
    };
  },
};
