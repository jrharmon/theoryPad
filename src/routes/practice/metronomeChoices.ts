import type { MetronomeVoiceId } from '@/domain/drums';
import { drumPatternFor, drumPatterns, patternsFor } from '@/domain/drums';
import type { TimeSignature } from '@/domain/phrase';

export interface MetronomeChoice {
  id: MetronomeVoiceId;
  title: string;
  detail: string;
}

const OFF: MetronomeChoice = {
  id: 'off',
  title: 'Off',
  detail: 'Silent while you play. The count-in still sounds.',
};

const CLICK: MetronomeChoice = {
  id: 'click',
  title: 'Click',
  detail: 'A tick on every beat, the downbeat accented.',
};

/**
 * Off, Click, then the beats: those that fit this signature, or every one
 * when there is no phrase to fit — the Settings default covers them all.
 */
export function metronomeChoices(timeSignature: TimeSignature | null): MetronomeChoice[] {
  const patterns = timeSignature ? patternsFor(timeSignature) : drumPatterns();
  return [
    OFF,
    CLICK,
    ...patterns.map((p) => ({
      id: `drums-${p.id}` as MetronomeVoiceId,
      title: `Drums — ${p.name}`,
      detail: p.detail,
    })),
  ];
}

/** What a choice actually plays in this signature: a beat that doesn't fit plays Simple. */
export function metronomeHeard(
  id: MetronomeVoiceId,
  timeSignature: TimeSignature,
): MetronomeVoiceId {
  const pattern = drumPatternFor(id, timeSignature);
  return pattern ? (`drums-${pattern.id}` as MetronomeVoiceId) : id;
}

/** "Drums — Upbeat", for any id, whether or not it fits the phrase. */
export function metronomeTitle(id: MetronomeVoiceId): string {
  return metronomeChoices(null).find((c) => c.id === id)?.title ?? id;
}
