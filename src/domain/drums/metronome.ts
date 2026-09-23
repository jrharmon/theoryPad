import { FOUR_FOUR } from '../phrase';
import type { TimeSignature } from '../phrase';
import { patternById, patternsFor } from './patterns';
import type { DrumPattern, DrumSound } from './types';

/**
 * What the metronome plays: nothing but the count-in, a click, or a drum beat
 * by its pattern id. A beat's id is open-ended so adding one to beats.ts is
 * all it takes; an id that no longer exists plays Simple.
 */
export type MetronomeVoiceId = 'off' | 'click' | `drums-${string}`;

const PREFIX = 'drums-';

/**
 * The beat a voice plays in this signature, or null for the click. A beat
 * written for another signature falls back to Simple rather than to silence:
 * an exercise set to Upbeat that rolls into 3/4 keeps drumming.
 */
export function drumPatternFor(
  id: MetronomeVoiceId,
  timeSignature: TimeSignature,
): DrumPattern | null {
  if (!id.startsWith(PREFIX)) return null;
  const wanted = patternById(id.slice(PREFIX.length));
  const fits = patternsFor(timeSignature);
  return fits.find((p) => p === wanted) ?? patternById('simple')!;
}

/** Every sound a pattern plays, in any of its bars. */
export function patternSounds(pattern: DrumPattern): DrumSound[] {
  const ts = pattern.timeSignature ?? FOUR_FOUR;
  const bars = Array.from({ length: pattern.bars }, (_, bar) => pattern.bar(ts, bar));
  const sounds = bars.flatMap((hits) => hits.map((hit) => hit.sound));
  return [...new Set(sounds)];
}

/**
 * The samples a voice can play, so only those are downloaded. Off loads
 * nothing: its count-in is the synth click. The click counts in on the stick.
 * A beat counts in on the open hat, and may fall back to Simple.
 */
export function metronomeSounds(id: MetronomeVoiceId): DrumSound[] {
  if (id === 'off') return [];
  if (id === 'click') return ['stick'];
  const pattern = patternById(id.slice(PREFIX.length));
  const sounds = [
    ...(pattern ? patternSounds(pattern) : []),
    ...patternSounds(patternById('simple')!),
    'hat-open' as const,
  ];
  return [...new Set(sounds)];
}
