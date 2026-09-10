import { describe, expect, it, vi } from 'vitest';
import { PPQ, QUARTER } from '@/domain/phrase';
import { FakeClock } from '../FakeClock';

describe('FakeClock', () => {
  it('starts stopped at tick zero', () => {
    const clock = new FakeClock();
    expect(clock.state).toBe('stopped');
    expect(clock.ticks).toBe(0);
  });

  it('does not advance while stopped or paused', () => {
    const clock = new FakeClock();
    clock.advanceTicks(QUARTER);
    expect(clock.ticks).toBe(0);

    clock.start();
    clock.advanceTicks(QUARTER);
    expect(clock.ticks).toBe(QUARTER);

    clock.pause();
    clock.advanceTicks(QUARTER);
    expect(clock.ticks).toBe(QUARTER);

    clock.start();
    clock.advanceTicks(QUARTER);
    expect(clock.ticks).toBe(QUARTER * 2);
  });

  it('fires a one-shot exactly once, at its tick', () => {
    const clock = new FakeClock();
    const fired: number[] = [];
    clock.schedule((_time, tick) => fired.push(tick), QUARTER * 2);

    clock.start();
    clock.advanceTicks(QUARTER);
    expect(fired).toEqual([]);

    clock.advanceTicks(QUARTER * 3);
    expect(fired).toEqual([QUARTER * 2]);

    clock.advanceTicks(QUARTER * 8);
    expect(fired).toEqual([QUARTER * 2]);
  });

  it('repeats on its interval, at exact ticks', () => {
    const clock = new FakeClock();
    const beats: number[] = [];
    clock.scheduleRepeat((_time, tick) => beats.push(tick), QUARTER);

    clock.start();
    clock.advanceTicks(QUARTER * 4);

    expect(beats).toEqual([0, QUARTER, QUARTER * 2, QUARTER * 3, QUARTER * 4]);
  });

  it('never drifts, however long it runs', () => {
    const clock = new FakeClock();
    const beats: number[] = [];
    clock.scheduleRepeat((_time, tick) => beats.push(tick), QUARTER);
    clock.start();

    // A thousand beats, advanced in awkward chunks.
    for (let i = 0; i < 100; i += 1) clock.advanceTicks(QUARTER * 10);

    expect(beats).toHaveLength(1001);
    beats.forEach((tick, i) => expect(tick).toBe(i * QUARTER));
  });

  it('fires callbacks in tick order when several are due', () => {
    const clock = new FakeClock();
    const order: string[] = [];
    clock.schedule(() => order.push('third'), QUARTER * 3);
    clock.schedule(() => order.push('first'), QUARTER);
    clock.schedule(() => order.push('second'), QUARTER * 2);

    clock.start();
    clock.advanceTicks(QUARTER * 4);
    expect(order).toEqual(['first', 'second', 'third']);
  });

  it('gives callbacks an audio time in seconds, not a wall clock', () => {
    const clock = new FakeClock(60);
    const times: number[] = [];
    clock.scheduleRepeat((time) => times.push(time), QUARTER);
    clock.start();
    clock.advanceTicks(QUARTER * 2);
    // At 60 bpm a quarter note is one second.
    expect(times).toEqual([0, 1, 2]);
  });

  it('cancels a scheduled callback', () => {
    const clock = new FakeClock();
    const fn = vi.fn();
    const handle = clock.scheduleRepeat(fn, QUARTER);

    clock.start();
    clock.advanceTicks(QUARTER);
    expect(fn).toHaveBeenCalledTimes(2);

    clock.clear(handle);
    clock.advanceTicks(QUARTER * 4);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(clock.scheduledCount).toBe(0);
  });

  it('clears everything at once', () => {
    const clock = new FakeClock();
    clock.scheduleRepeat(vi.fn(), QUARTER);
    clock.scheduleRepeat(vi.fn(), QUARTER * 2);
    expect(clock.scheduledCount).toBe(2);
    clock.clearAll();
    expect(clock.scheduledCount).toBe(0);
  });

  it('stops at the tick where a callback pauses it', () => {
    const clock = new FakeClock();
    const beats: number[] = [];
    clock.scheduleRepeat((_t, tick) => {
      beats.push(tick);
      if (tick === QUARTER * 2) clock.pause();
    }, QUARTER);

    clock.start();
    clock.advanceTicks(QUARTER * 8);

    // The pause takes effect immediately; nothing past it fires.
    expect(beats).toEqual([0, QUARTER, QUARTER * 2]);
    expect(clock.ticks).toBe(QUARTER * 2);
    expect(clock.state).toBe('paused');
  });

  it('resumes from where it paused', () => {
    const clock = new FakeClock();
    const beats: number[] = [];
    clock.scheduleRepeat((_t, tick) => beats.push(tick), QUARTER);

    clock.start();
    clock.advanceTicks(QUARTER * 2);
    clock.pause();
    clock.advanceTicks(QUARTER * 10);
    clock.start();
    clock.advanceTicks(QUARTER);

    expect(beats).toEqual([0, QUARTER, QUARTER * 2, QUARTER * 3]);
  });

  it('resets to zero on stop', () => {
    const clock = new FakeClock();
    clock.start();
    clock.advanceTicks(QUARTER * 4);
    clock.stop();
    expect(clock.ticks).toBe(0);
    expect(clock.state).toBe('stopped');
  });

  it('seeks without firing anything', () => {
    const clock = new FakeClock();
    const fn = vi.fn();
    clock.scheduleRepeat(fn, QUARTER);
    clock.seek(QUARTER * 4);
    expect(fn).not.toHaveBeenCalled();
    expect(clock.ticks).toBe(QUARTER * 4);
  });

  it('reports elapsed seconds from the tempo', () => {
    const clock = new FakeClock(120);
    clock.start();
    clock.advanceTicks(PPQ * 4);
    expect(clock.seconds).toBe(2);
  });

  it('advances by beats and seconds', () => {
    const clock = new FakeClock(60);
    clock.start();
    clock.advanceBeats(4);
    expect(clock.ticks).toBe(QUARTER * 4);
    clock.advanceSeconds(2);
    expect(clock.ticks).toBe(QUARTER * 6);
  });

  it('rejects a non-positive tempo or interval', () => {
    const clock = new FakeClock();
    expect(() => clock.setBpm(0)).toThrow();
    expect(() => clock.scheduleRepeat(vi.fn(), 0)).toThrow();
    expect(() => {
      clock.start();
      clock.advanceTicks(-1);
    }).toThrow();
  });

  it('runs a long routine instantly', () => {
    // The point of the whole abstraction: 31 minutes of practice in no time.
    const clock = new FakeClock(120);
    let bars = 0;
    clock.scheduleRepeat(() => (bars += 1), QUARTER * 4);
    clock.start();
    clock.advanceSeconds(31 * 60);
    expect(bars).toBeGreaterThan(900);
  });
});

describe('looping', () => {
  it('has no loop by default', () => {
    expect(new FakeClock().loop).toBeNull();
  });

  it('rewinds to the loop start rather than running on', () => {
    const clock = new FakeClock();
    clock.setLoop(0, QUARTER * 4);
    clock.start();

    clock.advanceTicks(QUARTER * 6);
    // Six beats into a four-beat loop is two beats past its start.
    expect(clock.ticks).toBe(QUARTER * 2);
  });

  it('fires one-shots again on every pass', () => {
    // In Tone the transport position rewinds, so positional events become due
    // again — a one-shot is not consumed by firing. FakeClock must match.
    const clock = new FakeClock();
    const fired: number[] = [];
    clock.schedule(() => fired.push(fired.length), QUARTER * 2);
    clock.setLoop(0, QUARTER * 4);

    clock.start();
    clock.advanceTicks(QUARTER * 12);
    expect(fired).toHaveLength(3);
  });

  it('keeps a repeat aligned across the loop point', () => {
    const clock = new FakeClock();
    const beats: number[] = [];
    clock.scheduleRepeat((_t, tick) => beats.push(tick), QUARTER);
    clock.setLoop(0, QUARTER * 4);

    clock.start();
    clock.advanceTicks(QUARTER * 8);

    // Two passes of a four-beat loop, with no doubled or missing beat.
    expect(beats).toEqual([
      0, QUARTER, QUARTER * 2, QUARTER * 3,
      0, QUARTER, QUARTER * 2, QUARTER * 3,
      0,
    ]);
  });

  it('loops a span that does not start at zero', () => {
    const clock = new FakeClock();
    const fired: number[] = [];
    clock.schedule((_t, tick) => fired.push(tick), QUARTER * 5);
    // A one-shot outside the loop never comes back round.
    clock.schedule((_t, tick) => fired.push(tick), QUARTER);
    clock.setLoop(QUARTER * 4, QUARTER * 8);

    clock.start();
    clock.advanceTicks(QUARTER * 20);

    expect(fired.filter((t) => t === QUARTER)).toHaveLength(1);
    expect(fired.filter((t) => t === QUARTER * 5).length).toBeGreaterThan(2);
  });

  it('stops looping when the loop is cleared', () => {
    const clock = new FakeClock();
    clock.setLoop(0, QUARTER * 4);
    clock.start();
    clock.advanceTicks(QUARTER * 6);
    expect(clock.ticks).toBe(QUARTER * 2);

    clock.clearLoop();
    expect(clock.loop).toBeNull();
    clock.advanceTicks(QUARTER * 6);
    expect(clock.ticks).toBe(QUARTER * 8);
  });

  it('still freezes when paused mid-loop', () => {
    const clock = new FakeClock();
    const beats: number[] = [];
    clock.scheduleRepeat((_t, tick) => {
      beats.push(tick);
      if (beats.length === 6) clock.pause();
    }, QUARTER);
    clock.setLoop(0, QUARTER * 4);

    clock.start();
    clock.advanceTicks(QUARTER * 100);
    expect(beats).toHaveLength(6);
    expect(clock.state).toBe('paused');
  });

  it('rejects a loop that does not move forward', () => {
    const clock = new FakeClock();
    expect(() => clock.setLoop(QUARTER, QUARTER)).toThrow();
    expect(() => clock.setLoop(QUARTER * 2, QUARTER)).toThrow();
  });

  it('loops a phrase for a long time without drifting', () => {
    const clock = new FakeClock(120);
    const downbeats: number[] = [];
    clock.scheduleRepeat((_t, tick) => {
      if (tick === 0) downbeats.push(clock.seconds);
    }, QUARTER);
    clock.setLoop(0, QUARTER * 4);

    clock.start();
    clock.advanceTicks(QUARTER * 400);

    // Every pass starts at the loop's start tick, so seconds are identical —
    // a hundred passes with no accumulated drift, plus the downbeat at the
    // tick we landed on.
    expect(new Set(downbeats).size).toBe(1);
    expect(downbeats.length).toBe(101);
  });
});
