import { describe, expect, it, vi } from 'vitest';
import { PPQ, QUARTER } from '@/domain/phrase';
import { FakeClock } from '../FakeClock';

/**
 * The test double every runner and audio test runs on, so what it promises
 * has to hold: exact ticks, in order, only while it is running.
 *
 * It is not drift-tested here — every runner test asserts exact ticks over
 * whole exercises, which is the same promise under real use.
 */
describe('FakeClock', () => {
  it('runs only while started, and comes back to zero when stopped', () => {
    const clock = new FakeClock(60);
    expect(clock.state).toBe('stopped');
    expect(clock.ticks).toBe(0);

    clock.advanceTicks(QUARTER);
    expect(clock.ticks).toBe(0);

    clock.start();
    clock.advanceBeats(4);
    clock.advanceSeconds(2);
    expect(clock.ticks).toBe(QUARTER * 6);
    // At 60 bpm a quarter note is a second.
    expect(clock.seconds).toBe(6);

    clock.pause();
    clock.advanceTicks(PPQ * 4);
    expect(clock.ticks).toBe(QUARTER * 6);

    clock.stop();
    expect([clock.ticks, clock.state]).toEqual([0, 'stopped']);
  });

  it('fires what is due at its exact tick, in tick order, with an audio time', () => {
    const clock = new FakeClock(60);
    const fired: [string, number, number][] = [];
    const at = (name: string, tick: number) =>
      clock.schedule((time, ticks) => fired.push([name, ticks, time]), tick);
    at('third', QUARTER * 3);
    at('first', QUARTER);
    at('second', QUARTER * 2);

    clock.start();
    clock.advanceTicks(QUARTER * 4);
    expect(fired).toEqual([
      ['first', QUARTER, 1],
      ['second', QUARTER * 2, 2],
      ['third', QUARTER * 3, 3],
    ]);

    // A one-shot is spent once it has fired.
    clock.advanceTicks(QUARTER * 8);
    expect(fired).toHaveLength(3);
  });

  it('repeats on its interval, from its first tick', () => {
    const clock = new FakeClock();
    const beats: number[] = [];
    clock.scheduleRepeat((_time, tick) => beats.push(tick), QUARTER);

    clock.start();
    clock.advanceTicks(QUARTER * 4);
    expect(beats).toEqual([0, QUARTER, QUARTER * 2, QUARTER * 3, QUARTER * 4]);
  });

  it('pauses where a callback pauses it, and resumes from there', () => {
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
    expect([clock.ticks, clock.state]).toEqual([QUARTER * 2, 'paused']);

    clock.start();
    clock.advanceTicks(QUARTER);
    expect(beats).toEqual([0, QUARTER, QUARTER * 2, QUARTER * 3]);
  });

  it('seeks without firing anything', () => {
    const clock = new FakeClock();
    const fn = vi.fn();
    clock.scheduleRepeat(fn, QUARTER);
    clock.seek(QUARTER * 4);
    expect(fn).not.toHaveBeenCalled();
    expect(clock.ticks).toBe(QUARTER * 4);
  });

  it('clears one callback, or all of them', () => {
    const clock = new FakeClock();
    const fn = vi.fn();
    const handle = clock.scheduleRepeat(fn, QUARTER);
    clock.scheduleRepeat(vi.fn(), QUARTER * 2);

    clock.start();
    clock.advanceTicks(QUARTER);
    expect(fn).toHaveBeenCalledTimes(2);

    clock.clear(handle);
    clock.advanceTicks(QUARTER * 4);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(clock.scheduledCount).toBe(1);

    clock.clearAll();
    expect(clock.scheduledCount).toBe(0);
  });

  it('refuses a tempo, interval, step or loop that makes no sense', () => {
    const clock = new FakeClock();
    expect(() => clock.setBpm(0)).toThrow();
    expect(() => clock.scheduleRepeat(vi.fn(), 0)).toThrow();
    expect(() => clock.setLoop(QUARTER, QUARTER)).toThrow();
    expect(() => clock.setLoop(QUARTER * 2, QUARTER)).toThrow();
    expect(() => {
      clock.start();
      clock.advanceTicks(-1);
    }).toThrow();
  });
});

describe('looping', () => {
  it('rewinds at the loop end, firing again and staying aligned', () => {
    const clock = new FakeClock();
    expect(clock.loop).toBeNull();
    const beats: number[] = [];
    let shots = 0;
    clock.scheduleRepeat((_t, tick) => beats.push(tick), QUARTER);
    // In Tone the transport position rewinds, so a one-shot inside the loop
    // becomes due again rather than being spent.
    clock.schedule(() => (shots += 1), QUARTER * 2);
    clock.setLoop(0, QUARTER * 4);

    clock.start();
    clock.advanceTicks(QUARTER * 6);

    // Six beats into a four-beat loop is two beats past its start, with no
    // doubled or missing beat across the loop point.
    expect(clock.ticks).toBe(QUARTER * 2);
    expect(beats).toEqual([0, QUARTER, QUARTER * 2, QUARTER * 3, 0, QUARTER, QUARTER * 2]);
    expect(shots).toBe(2);
  });

  it('loops a span that does not start at zero, until the loop is cleared', () => {
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

    clock.clearLoop();
    expect(clock.loop).toBeNull();
    const at = clock.ticks;
    clock.advanceTicks(QUARTER * 6);
    expect(clock.ticks).toBe(at + QUARTER * 6);
  });
});
