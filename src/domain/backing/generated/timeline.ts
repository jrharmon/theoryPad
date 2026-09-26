import type { KeyMode } from '../../music';
import { diatonicChords, harmonyOf } from '../../music';
import type { Phrase } from '../../phrase';
import { ticksPerBar } from '../../phrase';
import type { ChordSpan, GeneratedBackingSettings, Progression } from './types';

/**
 * The chords of one pass, from its bar 1. The progression loops for as long
 * as the pass lasts and is cut where it ends. A phrase with `repeat > 1`
 * restarts it at every copy, so the tab (one copy, with a repeat marker) and
 * what you hear agree.
 *
 * The same chord twice in a row is one span, so the lane marks changes rather
 * than bars; a span never crosses from one copy into the next.
 */
export function chordTimeline(
  progression: Progression,
  keyMode: KeyMode,
  chords: GeneratedBackingSettings['chords'],
  phrase: Pick<Phrase, 'totalTicks' | 'timeSignature' | 'repeat'>,
): ChordSpan[] {
  if (progression.length === 0) return [];
  const diatonic = diatonicChords(harmonyOf(keyMode));
  const bar = ticksPerBar(phrase.timeSignature);
  const copyTicks = phrase.totalTicks;
  const spans: ChordSpan[] = [];

  for (let copy = 0; copy < (phrase.repeat ?? 1); copy += 1) {
    const copyStart = copy * copyTicks;
    let tick = 0;
    for (let i = 0; tick < copyTicks; i += 1) {
      const step = progression[i % progression.length]!;
      const durationTicks = Math.min(Math.max(1, step.bars) * bar, copyTicks - tick);
      const last = spans.at(-1);
      if (last && tick > 0 && last.degree === step.degree) {
        last.durationTicks += durationTicks;
      } else {
        const chord = diatonic[step.degree - 1]!;
        spans.push({
          startTick: copyStart + tick,
          durationTicks,
          degree: step.degree,
          symbol: chords === 'triads' ? chord.triadSymbol : chord.seventhSymbol,
        });
      }
      tick += durationTicks;
    }
  }
  return spans;
}
