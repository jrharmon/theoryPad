/**
 * Something that plays under the exercise instead of the synth notes: a
 * YouTube track, or the drone. The practice store holds one and does not ask
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
  start(countInTicks: number): Promise<void>;
  pause(): void;
  resume(): Promise<void>;
  stop(): void;
  setRate(speed: number): void;
  dispose(): void;
}
