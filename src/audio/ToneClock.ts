import * as Tone from 'tone';
import type { Clock, ClockState, LoopRange, ScheduledCallback } from './Clock';

/**
 * Clock backed by Tone.Transport.
 *
 * Tone's transport schedules on the Web Audio clock, which is sample accurate.
 * setInterval and setTimeout drift by tens of milliseconds and are audibly
 * wrong for a metronome — that drift is the main reason we take the dependency
 * at all.
 *
 * `tone` is imported here, in the other files in src/audio, and nowhere else in
 * the app. ESLint enforces it.
 */
export class ToneClock implements Clock {
  private readonly transport = Tone.getTransport();
  private readonly handles = new Set<number>();

  constructor(bpm = 120) {
    this.transport.PPQ = 480;
    this.transport.bpm.value = bpm;
  }

  get ticks(): number {
    return this.transport.ticks;
  }

  get seconds(): number {
    return this.transport.seconds;
  }

  get state(): ClockState {
    return this.transport.state;
  }

  get bpm(): number {
    return this.transport.bpm.value;
  }

  setBpm(bpm: number): void {
    if (bpm <= 0) throw new Error(`Tempo must be positive, got ${bpm}`);
    this.transport.bpm.value = bpm;
  }

  schedule(callback: ScheduledCallback, atTick: number): number {
    const id = this.transport.schedule((time) => {
      callback(time, atTick);
    }, `${atTick}i`);
    this.handles.add(id);
    return id;
  }

  scheduleRepeat(callback: ScheduledCallback, intervalTicks: number, fromTick = 0): number {
    if (intervalTicks <= 0) throw new Error(`Interval must be positive, got ${intervalTicks}`);
    const id = this.transport.scheduleRepeat(
      (time) => {
        callback(time, this.transport.ticks);
      },
      `${intervalTicks}i`,
      `${fromTick}i`,
    );
    this.handles.add(id);
    return id;
  }

  clear(handle: number): void {
    this.transport.clear(handle);
    this.handles.delete(handle);
  }

  clearAll(): void {
    for (const handle of this.handles) this.transport.clear(handle);
    this.handles.clear();
  }

  start(): void {
    this.transport.start();
  }

  pause(): void {
    this.transport.pause();
  }

  stop(): void {
    this.transport.stop();
    this.transport.ticks = 0;
  }

  seek(tick: number): void {
    this.transport.ticks = tick;
  }

  setLoop(startTick: number, endTick: number): void {
    if (endTick <= startTick) {
      throw new Error(`Loop end must be after its start, got ${startTick}..${endTick}`);
    }
    this.transport.loopStart = `${startTick}i`;
    this.transport.loopEnd = `${endTick}i`;
    this.transport.loop = true;
  }

  clearLoop(): void {
    this.transport.loop = false;
  }

  get loop(): LoopRange | null {
    if (!this.transport.loop) return null;
    return {
      start: this.transport.toTicks(this.transport.loopStart),
      end: this.transport.toTicks(this.transport.loopEnd),
    };
  }
}
