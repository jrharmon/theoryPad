import { describe, expect, it } from 'vitest';
import { DEFAULT_MIX, completeMix, videoVolume } from '../mix';
import { mixPreview } from '../preview';

describe('videoVolume', () => {
  it('adds Master to the video fader, as gain, and caps it at what YouTube can play', () => {
    expect(videoVolume(DEFAULT_MIX)).toBe(100);
    expect(videoVolume({ ...DEFAULT_MIX, video: -6 })).toBe(50);
    expect(videoVolume({ ...DEFAULT_MIX, master: -6, video: -6 })).toBe(25);
    // Master raised cannot push the video past full.
    expect(videoVolume({ ...DEFAULT_MIX, master: 6 })).toBe(100);
    expect(videoVolume({ ...DEFAULT_MIX, master: 6, video: -12 })).toBe(50);
  });

  it('is silent when either fader is off', () => {
    expect(videoVolume({ ...DEFAULT_MIX, video: null })).toBe(0);
    expect(videoVolume({ ...DEFAULT_MIX, master: null })).toBe(0);
  });
});

describe('completeMix', () => {
  it('fills in missing channels, keeps Off, and drops what is not a level', () => {
    expect(
      completeMix({ master: -4, metronome: null, notes: 'loud' as unknown as number }),
    ).toEqual({ ...DEFAULT_MIX, master: -4, metronome: null });
    expect(completeMix(undefined)).toEqual(DEFAULT_MIX);
  });
});

describe('mixPreview', () => {
  it('is four bars of eighths with bass and piano under every bar', () => {
    const { melody, backing, totalTicks } = mixPreview();
    expect(totalTicks).toBe(4 * 4 * 480);
    expect(melody).toHaveLength(32);
    expect(melody.at(-1)!.tick + melody.at(-1)!.durationTicks).toBe(totalTicks);
    for (let bar = 0; bar < 4; bar += 1) {
      const inBar = (e: { tick: number }) => Math.floor(e.tick / 1920) === bar;
      expect(backing.bass.some(inBar)).toBe(true);
      expect(backing.piano.some(inBar)).toBe(true);
    }
  });
});
