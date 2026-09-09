import type { Instrument } from '@/domain/instrument';
import { noteAt } from '@/domain/instrument';
import type { Phrase, TabNote } from '@/domain/phrase';
import { ticksToSeconds } from '@/domain/phrase';
import type { Clock } from './Clock';
import type { InstrumentVoice } from './voices';

/** Articulations that change how a note sounds, rather than only how it looks. */
function soundingVelocity(note: TabNote): number {
  const base = note.velocity ?? 0.8;
  switch (note.articulation) {
    // Slurred notes are not picked, so they speak more quietly. Without this,
    // legato playback sounds identical to alternate picking.
    case 'hammer-on':
    case 'pull-off':
      return base * 0.7;
    case 'ghost':
      return base * 0.45;
    case 'palm-mute':
      return base * 0.8;
    default:
      return base;
  }
}

function soundingDuration(note: TabNote, seconds: number): number {
  switch (note.articulation) {
    case 'staccato':
      return seconds * 0.5;
    case 'palm-mute':
      return Math.min(seconds, seconds * 0.6);
    case 'let-ring':
      return seconds * 2;
    default:
      return seconds;
  }
}

/**
 * Schedules a phrase's notes against the clock.
 *
 * Playback is optional during practice — the point is that the player plays.
 * This is for "hear it" and for ear training.
 */
export class PhrasePlayer {
  private readonly clock: Clock;
  private readonly voice: InstrumentVoice;
  private handles: number[] = [];

  constructor(clock: Clock, voice: InstrumentVoice) {
    this.clock = clock;
    this.voice = voice;
  }

  /** Schedule the phrase from `atTick`. Does not start the clock. */
  load(phrase: Phrase, instrument: Instrument, atTick = 0): void {
    this.clear();
    const repeats = phrase.repeat ?? 1;

    for (let pass = 0; pass < repeats; pass += 1) {
      const offset = atTick + pass * phrase.totalTicks;
      for (const note of phrase.notes) {
        const start = offset + note.startTick;
        this.handles.push(
          this.clock.schedule((audioTime) => {
            const seconds = ticksToSeconds(note.durationTicks, this.clock.bpm);
            this.voice.play(
              noteAt(instrument, note),
              soundingDuration(note, seconds),
              audioTime,
              soundingVelocity(note),
            );
          }, start),
        );
      }
    }
  }

  clear(): void {
    for (const handle of this.handles) this.clock.clear(handle);
    this.handles = [];
    this.voice.releaseAll();
  }

  get scheduledNoteCount(): number {
    return this.handles.length;
  }
}
