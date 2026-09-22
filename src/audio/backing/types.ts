import type { PlayOptions } from './YouTubePlayer';

/**
 * Something that plays under the exercise: a YouTube track, which replaces the
 * synth notes, or the drone, which plays beneath them. The practice store holds one and does not ask
 * which kind for anything but display. A generated source, if it is ever
 * built, is a third implementation and touches nothing above this line.
 */
export interface BackingSource {
  readonly kind: 'video' | 'drone';
  /** Speeds it can play at; null when it has no tempo (the drone). */
  readonly rates: { min: number; max: number; step: number } | null;
  /** The tempo coming out of the speakers; null for the drone. */
  readonly effectiveBpm: number | null;
  load(): Promise<void>;
  /**
   * Start sounding, settling once it is. A track starts a count-in ahead of
   * its bar 1. Start the clock after this, not before.
   */
  start(countInTicks: number, options?: PlayOptions): Promise<void>;
  pause(): void;
  resume(options?: PlayOptions): Promise<void>;
  /**
   * The clock was moved out from under this — the player clicked a note in the
   * tab. Keep sounding where you are, and take the clock's new position as the
   * one to stay in step with. Only a source with a timeline of its own has
   * anything to do here.
   */
  reanchor?(): void;
  /**
   * The player's own controls were used, rather than the app's: true when it
   * was set playing, false when paused. Only a source the player can touch
   * directly has anything to report.
   */
  onTransport?(listener: (playing: boolean) => void): () => void;
  stop(): void;
  setRate(speed: number): void;
  dispose(): void;
}
