import { describe, expect, it } from 'vitest';
import { PPQ } from '../../phrase';
import {
  alignTrack,
  effectiveTempo,
  followFactor,
  formatVideoTime,
  loopEndSec,
  parseVideoTime,
  parseYouTubeLink,
  snapSpeed,
  speedFor,
  speedPercent,
  stepSpeed,
  tapTempo,
  tickAtVideoTime,
} from '..';

describe('speed', () => {
  it('lands on the step nearest the tempo', () => {
    expect(speedFor(76, 100)).toBe(0.75);
    expect(effectiveTempo(100, speedFor(76, 100))).toBe(75);
    expect(speedFor(85, 100)).toBe(0.85);
    expect(speedFor(120, 96)).toBe(1.25);
  });

  it('stays in 5% steps from 25% to 200%, without float drift', () => {
    expect(snapSpeed(0.62)).toBe(0.6);
    expect(snapSpeed(0.1)).toBe(0.25);
    expect(snapSpeed(3)).toBe(2);
    expect(stepSpeed(0.7, 1)).toBe(0.75);
    expect(stepSpeed(0.25, -1)).toBe(0.25);
    let speed = 1;
    for (let i = 0; i < 7; i += 1) speed = stepSpeed(speed, -1);
    expect(speed).toBe(0.65);
    expect(speedPercent(0.65)).toBe('65%');
  });
});

describe('lining the clock up with a track', () => {
  const track = { startSec: 216, bpm: 100, beatsPerBar: 4 };
  const bar = 4 * PPQ;

  it('starts the video a bar early, so the count-in plays over the intro', () => {
    const alignment = alignTrack(track, bar);
    expect(alignment.bar1Tick).toBe(bar);
    expect(alignment.playFromSec).toBeCloseTo(213.6); // 2.4 s is a bar at 100 bpm
    expect(tickAtVideoTime(track, alignment, 213.6)).toBeCloseTo(0);
    expect(tickAtVideoTime(track, alignment, 216)).toBeCloseTo(bar);
    expect(tickAtVideoTime(track, alignment, 218.4)).toBeCloseTo(2 * bar);
  });

  it('uses the track’s first bar as the count-in when there is no intro to spare', () => {
    const alignment = alignTrack({ ...track, startSec: 1 }, bar);
    expect(alignment.bar1Tick).toBe(0);
    expect(alignment.playFromSec).toBe(1);
    expect(tickAtVideoTime({ ...track, startSec: 1 }, alignment, 3.4)).toBeCloseTo(bar);
  });

  it('starts two bars early for a two-bar count-in, whatever the speed', () => {
    // Nothing here takes the speed: in the video's own seconds a bar is a bar.
    expect(alignTrack(track, 2 * bar).playFromSec).toBeCloseTo(211.2);
  });

  it('loops on whole bars, and keeps counting up through a loop', () => {
    const alignment = alignTrack({ ...track, endSec: 250 }, bar);
    expect(alignment.loopBars).toBe(14); // 34 s is 14.17 bars
    const end = loopEndSec({ ...track, endSec: 250 }, alignment)!;
    expect(end).toBeCloseTo(249.6);
    const beforeJump = tickAtVideoTime(track, alignment, end, 0);
    const afterJump = tickAtVideoTime(track, alignment, 216, 1);
    expect(afterJump).toBeCloseTo(beforeJump);
  });

  it('takes the video’s length as the end when none is set', () => {
    expect(alignTrack(track, bar, 240).loopBars).toBe(10);
    expect(alignTrack(track, bar).loopBars).toBeNull();
  });
});

describe('following the video', () => {
  it('leaves a clock that is on time alone', () => {
    expect(followFactor(1000, 1002, 100)).toBe(1);
  });

  it('runs a late clock faster and an early one slower, within bounds', () => {
    const halfBeat = PPQ / 2; // 0.3 s at 100 bpm
    expect(followFactor(0, halfBeat, 100)).toBeCloseTo(1.15);
    expect(followFactor(halfBeat, 0, 100)).toBeCloseTo(0.85);
    expect(followFactor(0, PPQ / 20, 100)).toBeCloseTo(1.03);
  });
});

describe('reading a YouTube link', () => {
  it('reads every shape of link, with its start', () => {
    expect(parseYouTubeLink('https://www.youtube.com/watch?v=WkIijba-HcU&t=216s')).toEqual({
      videoId: 'WkIijba-HcU',
      startSec: 216,
    });
    expect(parseYouTubeLink('https://youtu.be/WkIijba-HcU?t=3m36s')).toEqual({
      videoId: 'WkIijba-HcU',
      startSec: 216,
    });
    expect(parseYouTubeLink('youtube.com/embed/WkIijba-HcU?start=40')).toEqual({
      videoId: 'WkIijba-HcU',
      startSec: 40,
    });
    expect(parseYouTubeLink('https://m.youtube.com/watch?feature=share&v=WkIijba-HcU')).toEqual({
      videoId: 'WkIijba-HcU',
    });
    expect(parseYouTubeLink('https://www.youtube.com/shorts/WkIijba-HcU')).toEqual({
      videoId: 'WkIijba-HcU',
    });
    expect(parseYouTubeLink(' WkIijba-HcU ')).toEqual({ videoId: 'WkIijba-HcU' });
  });

  it('refuses what is not a video', () => {
    expect(parseYouTubeLink('https://vimeo.com/12345')).toBeNull();
    expect(parseYouTubeLink('https://www.youtube.com/@someone')).toBeNull();
    expect(parseYouTubeLink('hello')).toBeNull();
  });
});

describe('video times', () => {
  it('writes them as YouTube does, with a tenth when there is one', () => {
    expect(formatVideoTime(216)).toBe('3:36');
    expect(formatVideoTime(216.54)).toBe('3:36.5');
    expect(formatVideoTime(3723)).toBe('1:02:03');
    expect(formatVideoTime(5)).toBe('0:05');
  });

  it('reads them back, or plain seconds', () => {
    expect(parseVideoTime('3:36.5')).toBe(216.5);
    expect(parseVideoTime('1:02:03')).toBe(3723);
    expect(parseVideoTime('216.5')).toBe(216.5);
    expect(parseVideoTime('3:75')).toBeNull();
    expect(parseVideoTime('soon')).toBeNull();
  });
});

describe('tapping along', () => {
  it('needs a few taps', () => {
    expect(tapTempo([1, 1.6, 2.2])).toBeNull();
  });

  it('finds the tempo and bar 1 of steady taps', () => {
    expect(tapTempo([216, 216.6, 217.2, 217.8, 218.4])).toEqual({ bpm: 100, bar1Sec: 216 });
  });

  it('fits through a sloppy tap rather than trusting the first one', () => {
    const result = tapTempo([216.04, 216.6, 217.2, 217.8, 218.4, 219.0]);
    // The first gap alone would say 107 bpm and bar 1 at 216.04.
    expect(Math.abs(result!.bpm - 100)).toBeLessThan(1.5);
    expect(Math.abs(result!.bar1Sec - 216)).toBeLessThan(0.03);
  });

  it('gives up on a missed or doubled tap', () => {
    expect(tapTempo([0, 0.6, 1.2, 2.4, 3.0])).toBeNull();
  });
});
