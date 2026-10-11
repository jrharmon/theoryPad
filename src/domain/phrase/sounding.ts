import type { Instrument } from '@/domain/instrument';
import { midiAt } from '@/domain/instrument';
import type { NoteName } from '@/domain/music';
import { midi, noteNameFromMidi } from '@/domain/music';
import type { Phrase, TabNote } from './types';

/** A note as it is played: where it starts and how long it rings, in ticks. */
export interface SoundingNote {
  note: TabNote;
  /** Ticks from the start of the phrase. A grace before the first beat can be negative. */
  startTick: number;
  durationTicks: number;
}

/**
 * The notes as they are played rather than as they are written.
 *
 * - A tied note is not picked again: the note it continues rings through it.
 * - A grace note before the beat ends on the beat; one on the beat starts
 *   there, and its main note on that string waits for it to finish.
 *
 * In the order they sound.
 */
export function soundingNotes(phrase: Phrase): SoundingNote[] {
  const byString = new Map<number, TabNote[]>();
  for (const note of phrase.notes) {
    if (note.grace) continue;
    byString.set(note.string, [...(byString.get(note.string) ?? []), note]);
  }

  /** Where a note stops ringing: the end of the last note tied on to it. */
  const ringsUntil = (note: TabNote): number => {
    const line = byString.get(note.string) ?? [];
    let end = note.startTick + note.durationTicks;
    for (let i = line.indexOf(note) + 1; i < line.length && line[i]!.tied; i += 1) {
      end = line[i]!.startTick + line[i]!.durationTicks;
    }
    return end;
  };

  /** How long an on-beat grace holds back the main note on its string and beat. */
  const heldBack = new Map<string, number>();
  for (const note of phrase.notes) {
    if (note.grace !== 'on-beat') continue;
    const key = `${note.string}:${note.startTick}`;
    heldBack.set(key, Math.max(heldBack.get(key) ?? 0, note.durationTicks));
  }

  const played = phrase.notes.flatMap((note): SoundingNote[] => {
    if (note.tied) return [];
    if (note.grace === 'before-beat') {
      return [
        {
          note,
          startTick: note.startTick - note.durationTicks,
          durationTicks: note.durationTicks,
        },
      ];
    }
    if (note.grace === 'on-beat') {
      return [{ note, startTick: note.startTick, durationTicks: note.durationTicks }];
    }
    const delay = heldBack.get(`${note.string}:${note.startTick}`) ?? 0;
    const startTick = note.startTick + delay;
    return [{ note, startTick, durationTicks: Math.max(1, ringsUntil(note) - startTick) }];
  });
  return played.sort((a, b) => a.startTick - b.startTick || a.note.string - b.note.string);
}

/**
 * How far above the open string a natural harmonic at this fret sounds, in
 * semitones: 12 an octave, 7 a twelfth, 5 two octaves. Only the nodes that
 * ring clearly enough to be written are here.
 */
const HARMONIC_SEMITONES: Record<number, number> = {
  12: 12,
  7: 19,
  19: 19,
  5: 24,
  24: 24,
  4: 28,
  9: 28,
  16: 28,
  3: 31,
};

/**
 * The pitch a note sounds at. A natural harmonic sounds above the open
 * string; the others sound above the fretted note, by where they are touched
 * (an octave, unless the note says otherwise). A fret that isn't a harmonic
 * node sounds as fretted.
 */
export function soundingPitch(instrument: Instrument, note: TabNote): NoteName {
  const fretted = midiAt(instrument, note);
  const harmonic = note.harmonic;
  if (!harmonic) return noteNameFromMidi(fretted);
  if (harmonic.kind === 'natural') {
    const above = HARMONIC_SEMITONES[note.fret];
    const open = midiAt(instrument, { string: note.string, fret: 0 });
    return noteNameFromMidi(above === undefined ? fretted : midi(open + above));
  }
  return noteNameFromMidi(midi(fretted + (HARMONIC_SEMITONES[harmonic.fret ?? 12] ?? 0)));
}
