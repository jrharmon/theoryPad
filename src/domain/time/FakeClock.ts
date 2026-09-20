import type { Clock, ClockState, LoopRange, ScheduledCallback } from './Clock';
import { ticksToSecondsAt } from './Clock';

interface Entry {
  handle: number;
  callback: ScheduledCallback;
  /** Where the entry was originally scheduled. */
  fromTick: number;
  /** Null for a one-shot. */
  intervalTicks: number | null;
  nextTick: number;
  /** One-shots stay registered after firing so a loop pass can re-arm them. */
  done: boolean;
}

const TICKS_PER_BEAT = 480;

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
  private loopRange: LoopRange | null = null;

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

  get loop(): LoopRange | null {
    return this.loopRange;
  }

  setBpm(bpm: number): void {
    if (bpm <= 0) throw new Error(`Tempo must be positive, got ${bpm}`);
    this.currentBpm = bpm;
  }

  setLoop(startTick: number, endTick: number): void {
    if (endTick <= startTick) {
      throw new Error(`Loop end must be after its start, got ${startTick}..${endTick}`);
    }
    this.loopRange = { start: startTick, end: endTick };
  }

  clearLoop(): void {
    this.loopRange = null;
  }

  schedule(callback: ScheduledCallback, atTick: number): number {
    const handle = this.nextHandle++;
    this.entries.push({
      handle,
      callback,
      fromTick: atTick,
      intervalTicks: null,
      nextTick: atTick,
      done: false,
    });
    return handle;
  }

  scheduleRepeat(callback: ScheduledCallback, intervalTicks: number, fromTick = 0): number {
    if (intervalTicks <= 0) throw new Error(`Interval must be positive, got ${intervalTicks}`);
    const handle = this.nextHandle++;
    this.entries.push({
      handle,
      callback,
      fromTick,
      intervalTicks,
      nextTick: fromTick,
      done: false,
    });
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

  /**
   * Jump the transport. Scheduling is positional, as Tone's is: what lies
   * ahead of the new position is due again, and what lies behind it is not.
   * Without that, seeking back over a phrase would never replay its notes
   * here while it does in the browser.
   */
  seek(tick: number): void {
    this.currentTick = tick;
    for (const entry of this.entries) {
      if (entry.intervalTicks === null) {
        entry.done = entry.fromTick < tick;
        entry.nextTick = entry.fromTick;
        continue;
      }
      const steps = Math.ceil((tick - entry.fromTick) / entry.intervalTicks);
      entry.nextTick = entry.fromTick + Math.max(0, steps) * entry.intervalTicks;
    }
  }

  /**
   * Move time forward, firing everything due along the way in tick order.
   * Does nothing unless started, so a paused clock really is frozen — which is
   * the behaviour the runner depends on.
   */
  advanceTicks(ticks: number): void {
    if (ticks < 0) throw new Error('Cannot advance backwards');
    if (this.clockState !== 'started') return;

    let remaining = ticks;

    while (remaining > 0) {
      const boundary = this.loopRange?.end ?? Number.POSITIVE_INFINITY;
      const step = Math.min(remaining, boundary - this.currentTick);

      if (step > 0) {
        // The loop end and the loop start are the same musical position, so
        // the boundary is exclusive — otherwise the downbeat fires twice.
        const atBoundary =
          this.loopRange !== null && this.currentTick + step >= this.loopRange.end;
        this.runTo(this.currentTick + step, atBoundary);
        if (this.clockState !== 'started') return;
        remaining -= step;
      }

      if (this.loopRange && this.currentTick >= this.loopRange.end) {
        // The transport rewinds; events inside the loop become due again.
        this.currentTick = this.loopRange.start;
        this.rearmForLoop();
      } else if (step <= 0) {
        break;
      }
    }

    // Fire anything due exactly at the landing tick, so advancing N beats
    // always sounds the beat at N — including when N lands on a loop point and
    // the rewind has just re-armed it. Anything already fired has moved past
    // this tick, so this cannot double up.
    this.runTo(this.currentTick);
  }

  private runTo(target: number, exclusiveEnd = false): void {
    for (;;) {
      const due = this.entries
        .filter((e) => !e.done && (exclusiveEnd ? e.nextTick < target : e.nextTick <= target))
        .sort((a, b) => a.nextTick - b.nextTick || a.handle - b.handle);
      const next = due[0];
      if (!next) break;

      this.currentTick = next.nextTick;
      const audioTime = ticksToSecondsAt(this.currentTick, this.currentBpm);

      if (next.intervalTicks === null) next.done = true;
      else next.nextTick += next.intervalTicks;

      next.callback(audioTime, this.currentTick);

      // A callback may have paused the clock — stop where it did.
      if (this.clockState !== 'started') return;
    }
    this.currentTick = target;
  }

  private rearmForLoop(): void {
    const loop = this.loopRange;
    if (!loop) return;

    for (const entry of this.entries) {
      if (entry.intervalTicks === null) {
        if (entry.fromTick >= loop.start && entry.fromTick < loop.end) {
          entry.done = false;
          entry.nextTick = entry.fromTick;
        }
        continue;
      }
      // Realign a repeat to the first occurrence at or after the loop start.
      const steps = Math.ceil((loop.start - entry.fromTick) / entry.intervalTicks);
      entry.nextTick = entry.fromTick + Math.max(0, steps) * entry.intervalTicks;
    }
  }

  /** Convenience for tests that think in beats. */
  advanceBeats(beats: number): void {
    this.advanceTicks(beats * TICKS_PER_BEAT);
  }

  advanceSeconds(seconds: number): void {
    this.advanceTicks(Math.round((seconds * this.currentBpm * TICKS_PER_BEAT) / 60));
  }

  /** How many callbacks are registered — for leak assertions. */
  get scheduledCount(): number {
    return this.entries.length;
  }
}
