import type { NoteName } from '@/domain/music';

/**
 * Anything that can sound a note.
 *
 * v1 ships SynthVoice. A SampledVoice wrapping Tone.Sampler drops in later
 * with no change to any consumer — that is the whole point of the interface,
 * and what makes "better audio later" a contained change rather than a rewrite.
 */
export interface InstrumentVoice {
  readonly id: string;
  load(): Promise<void>;
  readonly ready: boolean;
  /**
   * `atTime` is in the audio context's timebase, as handed to a Clock callback.
   * Scheduling against it rather than playing immediately is what keeps timing
   * tight.
   */
  play(note: NoteName, durationSeconds: number, atTime: number, velocity?: number): void;
  releaseAll(): void;
  setVolume(decibels: number): void;
  dispose(): void;
}
