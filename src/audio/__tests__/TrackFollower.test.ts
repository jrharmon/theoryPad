import { describe, expect, it } from 'vitest';
import { FakeClock } from '@/domain/time';
import { PPQ } from '@/domain/phrase';
import { alignTrack, tickAtVideoTime } from '@/domain/backing';
import type { TrackTiming } from '@/domain/backing';
import { TrackFollower } from '../backing/TrackFollower';

const BAR = 4 * PPQ;
const STEP = 0.04;

/** A video whose time runs at `rate` of real time unless it is buffering. */
class FakeVideo {
  currentTime: number;
  buffering = false;
  seeks: number[] = [];
  rate: number;
  constructor(start: number, rate = 1) {
    this.currentTime = start;
    this.rate = rate;
  }
  seekTo(seconds: number) {
    this.seeks.push(seconds);
    this.currentTime = seconds;
  }
  advance(seconds: number) {
    if (!this.buffering) this.currentTime += seconds * this.rate;
  }
}

function setup(options: { lead?: number; rate?: number; endSec?: number } = {}) {
  const track: TrackTiming = { startSec: 216, bpm: 100, beatsPerBar: 4 };
  if (options.endSec !== undefined) track.endSec = options.endSec;
  const alignment = alignTrack(track, BAR);
  const rate = options.rate ?? 1;
  // YouTube is already a little way in by the time it reports playing.
  const video = new FakeVideo(alignment.playFromSec + (options.lead ?? 0), rate);
  const clock = new FakeClock(100 * rate);
  const follower = new TrackFollower(clock, video, track, alignment, 100 * rate);
  clock.start();
  // Carry the fraction of a tick each step, as a real transport would; rounding
  // every step would swallow the follower's small nudges.
  let carry = 0;
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += STEP) {
      video.advance(STEP);
      if (clock.state === 'started') {
        const exact = (STEP * clock.bpm * PPQ) / 60 + carry;
        const whole = Math.floor(exact);
        carry = exact - whole;
        clock.advanceTicks(whole);
      }
      follower.update();
    }
  };
  const gapSec = (loops = 0) =>
    ((tickAtVideoTime(track, alignment, video.currentTime, loops) - clock.ticks) / PPQ) *
    (60 / clock.bpm);
  return { track, alignment, video, clock, follower, run, gapSec };
}

describe('following a video', () => {
  it('catches up on YouTube’s start delay within the count-in bar', () => {
    const { run, gapSec } = setup({ lead: 0.25 });
    expect(gapSec()).toBeCloseTo(0.25, 2);
    run(2.4); // the count-in bar at 100 bpm
    expect(Math.abs(gapSec())).toBeLessThan(0.02);
  });

  it('holds on through a slowed track, at the slowed tempo', () => {
    const { run, gapSec, clock } = setup({ lead: 0.2, rate: 0.75 });
    run(10);
    expect(Math.abs(gapSec())).toBeLessThan(0.01);
    expect(clock.bpm).toBeCloseTo(75, 0);
  });

  it('follows a speed change without drifting', () => {
    const { run, gapSec, video, follower } = setup();
    run(3);
    video.rate = 0.8;
    follower.setTempo(80);
    run(5);
    expect(Math.abs(gapSec())).toBeLessThan(0.01);
  });

  it('loops on a bar line and keeps the clock counting up through it', () => {
    const { run, video, clock, alignment, gapSec } = setup({ endSec: 240 });
    expect(alignment.loopBars).toBe(10); // 24 s from bar 1
    const before = clock.ticks;
    run(2.4 + 24 + 2);
    expect(video.seeks).toEqual([216]);
    expect(clock.ticks).toBeGreaterThan(before + 11 * BAR);
    expect(Math.abs(gapSec(1))).toBeLessThan(0.05);
  });

  it('holds the clock while the video buffers, and lets it go after', () => {
    const { run, video, clock, gapSec } = setup();
    run(2);
    video.buffering = true;
    run(0.2);
    expect(clock.state).toBe('paused');
    const held = clock.ticks;
    run(1);
    expect(clock.ticks).toBe(held);
    video.buffering = false;
    run(1);
    expect(clock.state).toBe('started');
    expect(Math.abs(gapSec())).toBeLessThan(0.05);
  });

  it('leaves a clock the app has paused alone', () => {
    const { follower, clock } = setup();
    clock.pause();
    follower.update();
    expect(clock.state).toBe('paused');
  });
});
