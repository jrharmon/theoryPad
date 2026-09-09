import { PPQ } from '@/domain/phrase';

/**
 * The single source of musical time.
 *
 * Everything that moves — the metronome, the playhead, rep counting, the
 * inter-exercise countdown — reads from one Clock, so pausing is one call and
 * nothing drifts apart.
 *
 * The interface exists so tests can inject FakeClock and advance time
 * synchronously. That is what lets a 31-minute routine be tested in a few
 * milliseconds, and it is why the runner never touches Tone directly.
 */
export interface Clock {
  readonly ticks: number;
  readonly seconds: number;
  readonly state: ClockState;
  readonly bpm: number;

  setBpm(bpm: number): void;
  /** Run `callback` once at an absolute tick. Returns a handle to cancel with. */
  schedule(callback: ScheduledCallback, atTick: number): number;
  /** Run `callback` every `intervalTicks`, starting at `fromTick`. */
  scheduleRepeat(callback: ScheduledCallback, intervalTicks: number, fromTick?: number): number;
  clear(handle: number): void;
  clearAll(): void;
  start(): void;
  pause(): void;
  stop(): void;
  seek(tick: number): void;
}

export type ClockState = 'stopped' | 'started' | 'paused';

/**
 * `audioTime` is the moment the event should sound, in the audio context's own
 * timebase — not `Date.now()`. Voices must schedule against it rather than
 * playing immediately, or timing jitters.
 */
export type ScheduledCallback = (audioTime: number, tick: number) => void;

export const TICKS_PER_QUARTER = PPQ;

export function ticksToSecondsAt(ticks: number, bpm: number): number {
  return (ticks / PPQ) * (60 / bpm);
}
