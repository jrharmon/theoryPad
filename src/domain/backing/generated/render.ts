import type { KeyMode, Midi } from '../../music';
import { diatonicChords, midi, semitonesBetween } from '../../music';
import type { CompPattern, CompTone } from './compTab';
import type { ChordSpan, GeneratedBackingSettings } from './types';
import { bassRoot, voiceChord } from './voicing';

/** One note the backing plays, in ticks from the pass's bar 1. */
export interface NoteEvent {
  tick: number;
  durationTicks: number;
  midi: Midi;
  /** 0–1. */
  velocity: number;
}

export interface RenderedPass {
  bass: NoteEvent[];
  piano: NoteEvent[];
}

/**
 * Everything the bass and piano play in one pass: the pattern looped from
 * bar 1 over the chord timeline, and restarted at every copy of a repeated
 * phrase (`copyTicks`, the phrase's `totalTicks`), so every copy sounds the
 * same. A note still ringing when the chord changes moves to the new chord;
 * nothing rings past the pass's end. Each copy's first chord is voiced afresh
 * and each chord after it is voice-led from the one before.
 */
export function renderPass(
  timeline: readonly ChordSpan[],
  pattern: CompPattern,
  keyMode: KeyMode,
  chords: GeneratedBackingSettings['chords'],
  copyTicks?: number,
): RenderedPass {
  const last = timeline.at(-1);
  if (!last) return { bass: [], piano: [] };
  const passEnd = last.startTick + last.durationTicks;
  const copy = copyTicks ?? passEnd;
  const diatonic = diatonicChords(keyMode);

  // What each span sounds: its piano voicing and its bass tones.
  let previous: Midi[] | null = null;
  const sounds = timeline.map((span) => {
    const chord = diatonic[span.degree - 1]!;
    const tones = chords === 'triads' ? chord.notes.triad : chord.notes.seventh;
    if (span.startTick % copy === 0) previous = null;
    const piano = voiceChord(tones, previous);
    previous = piano;
    const root = bassRoot(chord.root);
    const above = tones.map((t) => semitonesBetween(chord.root, t));
    const bass = (tone: CompTone) =>
      midi(
        root +
          (tone === 'octave' || (tone === 7 && above[3] === undefined)
            ? 12
            : above[(tone - 1) / 2]!),
      );
    return { span, piano, bass };
  });

  const bass: NoteEvent[] = [];
  const piano: NoteEvent[] = [];
  // Lay a hit at [start, end), split wherever the chord changes under it.
  const place = (
    start: number,
    end: number,
    each: (s: (typeof sounds)[number], tick: number, ticks: number) => void,
  ) => {
    for (const sound of sounds) {
      const from = Math.max(start, sound.span.startTick);
      const to = Math.min(end, sound.span.startTick + sound.span.durationTicks);
      if (from < to) each(sound, from, to - from);
    }
  };

  for (let copyStart = 0; copyStart < passEnd; copyStart += copy) {
    const copyEnd = Math.min(copyStart + copy, passEnd);
    for (let loop = copyStart; loop < copyEnd; loop += pattern.lengthTicks) {
      for (const hit of pattern.piano) {
        const start = loop + hit.tick;
        if (start >= copyEnd) continue;
        place(
          start,
          Math.min(start + hit.durationTicks, copyEnd),
          (sound, tick, durationTicks) => {
            for (const m of sound.piano)
              piano.push({ tick, durationTicks, midi: m, velocity: hit.velocity });
          },
        );
      }
      for (const hit of pattern.bass) {
        const start = loop + hit.tick;
        if (start >= copyEnd) continue;
        place(
          start,
          Math.min(start + hit.durationTicks, copyEnd),
          (sound, tick, durationTicks) => {
            bass.push({
              tick,
              durationTicks,
              midi: sound.bass(hit.tone),
              velocity: hit.velocity,
            });
          },
        );
      }
    }
  }

  const byTick = (a: NoteEvent, b: NoteEvent) => a.tick - b.tick || a.midi - b.midi;
  return { bass: bass.sort(byTick), piano: piano.sort(byTick) };
}
