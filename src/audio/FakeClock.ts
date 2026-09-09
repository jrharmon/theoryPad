import type { Clock, ClockState, ScheduledCallback } from './Clock';
import { ticksToSecondsAt } from './Clock';

interface Entry {
  handle: number;
  callback: ScheduledCallback;
  nextTick: number;
  intervalTicks: number | null;
}

/**
 * A Clock that advances only when told to, firing scheduled callbacks
 * synchronously and in tick order.
 *
 * This is the whole testing strategy for anything time-based: the metronome,
 * the runner state machine, rep counting and the countdown are all driven
 * through `Clock`, so they can be tested exhaustively with no audio, no timers
 * and no waiting.
 */
export class FakeClock implements Clock {
  private currentTick = 0;
  private currentBpm: number;
  private clockState: ClockState = 'stopped';
  private entries: Entry[] = [];
  private nextHandle = 1;

  constructor(bpm = 120) {
    this.currentBpm = bpm;
  }

  get ticks(): number {
    return this.currentTick;
  }

  get seconds(): number {
    return ticksToSecondsAt(this.currentTick, this.currentBpm);
  }

  get state(): ClockState {
    return this.clockState;
  }

  get bpm(): number {
    return this.currentBpm;
  }

  setBpm(bpm: number): void {
    if (bpm <= 0) throw new Error(`Tempo must be positive, got ${bpm}`);
    this.currentBpm = bpm;
  }

  schedule(callback: ScheduledCallback, atTick: number): number {
    const handle = this.nextHandle++;
    this.entries.push({ handle, callback, nextTick: atTick, intervalTicks: null });
    return handle;
  }

  scheduleRepeat(callback: ScheduledCallback, intervalTicks: number, fromTick = 0): number {
    if (intervalTicks <= 0) throw new Error(`Interval must be positive, got ${intervalTicks}`);
    const handle = this.nextHandle++;
    this.entries.push({ handle, callback, nextTick: fromTick, intervalTicks });
    return handle;
  }

  clear(handle: number): void {
    this.entries = this.entries.filter((e) => e.handle !== handle);
  }

  clearAll(): void {
    this.entries = [];
  }

  start(): void {
    this.clockState = 'started';
  }

  pause(): void {
    this.clockState = 'paused';
  }

  stop(): void {
    this.clockState = 'stopped';
    this.currentTick = 0;
  }

  seek(tick: number): void {
    this.currentTick = tick;
  }

  /**
   * Move time forward, firing everything due along the way in tick order.
   * Does nothing unless the clock is started, so a paused clock really is
   * frozen — which is the behaviour the runner depends on.
   */
  advanceTicks(ticks: number): void {
    if (ticks < 0) throw new Error('Cannot advance backwards');
    if (this.clockState !== 'started') return;

    const target = this.currentTick + ticks;

    for (;;) {
      const due = this.entries
        .filter((e) => e.nextTick <= target)
        .sort((a, b) => a.nextTick - b.nextTick || a.handle - b.handle);
      const next = due[0];
      if (!next) break;

      this.currentTick = next.nextTick;
      const audioTime = ticksToSecondsAt(this.currentTick, this.currentBpm);

      if (next.intervalTicks === null) {
        this.entries = this.entries.filter((e) => e.handle !== next.handle);
      } else {
        next.nextTick += next.intervalTicks;
      }

      next.callback(audioTime, this.currentTick);

      // A callback may have paused the clock — stop where it did.
      if (this.clockState !== 'started') return;
    }

    this.currentTick = target;
  }

  /** Convenience for tests that think in beats. */
  advanceBeats(beats: number): void {
    this.advanceTicks(beats * TICKS_PER_BEAT);
  }

  advanceSeconds(seconds: number): void {
    this.advanceTicks(Math.round((seconds * this.currentBpm * TICKS_PER_BEAT) / 60));
  }

  /** How many callbacks are currently registered — for leak assertions. */
  get scheduledCount(): number {
    return this.entries.length;
  }
}

const TICKS_PER_BEAT = 480;
