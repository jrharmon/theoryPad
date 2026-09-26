import type { KeyMode } from '../music';
import { midi, pitchClass } from '../music';
import { FOUR_FOUR, PPQ, ticksPerBar } from '../phrase';
import type { NoteEvent, RenderedPass } from '../backing';
import {
  DEFAULT_GENERATED_BACKING,
  chordTimeline,
  compById,
  heldBars,
  renderPass,
} from '../backing';

export interface MixPreview {
  bpm: number;
  /** One time through; it loops. */
  totalTicks: number;
  /** A line in eighths for the notes channel, in ticks from bar 1. */
  melody: NoteEvent[];
  /** The generated backing under it. */
  backing: RenderedPass;
}

const KEY: KeyMode = { tonic: pitchClass('A'), scale: 'major', mode: 'aeolian' };
const PROGRESSION = heldBars([1, 4, 1, 5]);

/** Up and back down each bar's chord, an eighth a note — Am7, Dm7, Am7, Em7. */
const LINE = [
  [57, 60, 64, 67, 69, 67, 64, 60],
  [62, 65, 69, 72, 74, 72, 69, 65],
  [64, 67, 69, 72, 76, 72, 69, 67],
  [64, 67, 71, 74, 76, 74, 71, 67],
];

/**
 * Four bars of everything the mixer levels bar the video — a line, and the
 * generated backing's bass and piano under it — for Settings to loop while the
 * faders move. The metronome is the player's own; the caller adds it.
 */
export function mixPreview(): MixPreview {
  const eighth = PPQ / 2;
  const totalTicks = LINE.length * ticksPerBar(FOUR_FOUR);
  const melody = LINE.flat().map((m, i) => ({
    tick: i * eighth,
    durationTicks: eighth,
    midi: midi(m),
    // A lift on each beat, so it reads as a line rather than a stream.
    velocity: i % 2 === 0 ? 0.85 : 0.7,
  }));
  const settings = DEFAULT_GENERATED_BACKING;
  const timeline = chordTimeline(PROGRESSION, KEY, settings.chords, {
    totalTicks,
    timeSignature: FOUR_FOUR,
  });
  const backing = renderPass(timeline, compById(settings.style), KEY, settings.chords);
  return { bpm: 96, totalTicks, melody, backing };
}
