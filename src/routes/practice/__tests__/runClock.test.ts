import { describe, expect, it } from 'vitest';
import { FOUR_FOUR, PPQ, makeBars, type Phrase } from '@/domain/phrase';
import type { RunnerSnapshot } from '@/exercises/runner';
import { formatClock, runClock } from '../runClock';

/** Four bars of 4/4: sixteen quarter notes, which is eight seconds at 120 bpm. */
const phrase: Phrase = {
  ppq: PPQ,
  timeSignature: FOUR_FOUR,
  bars: makeBars(4, FOUR_FOUR),
  notes: [],
  totalTicks: PPQ * 16,
};

const snapshot = (changes: Partial<RunnerSnapshot> = {}) =>
  ({
    currentTempo: 120,
    passes: 1,
    runTicks: 0,
    phraseTick: 0,
    loop: false,
    ...changes,
  }) as RunnerSnapshot;

describe('runClock', () => {
  it('times the run at the tempo being played, one pass per rep', () => {
    expect(runClock(snapshot({ runTicks: PPQ * 4 }), phrase)).toEqual({
      elapsedSeconds: 2,
      totalSeconds: 8,
    });

    // A routine item plays its material once per rep, so its length is that
    // many times as long.
    expect(runClock(snapshot({ passes: 3, runTicks: PPQ * 20 }), phrase)).toEqual({
      elapsedSeconds: 10,
      totalSeconds: 24,
    });

    // Both halves are ticks, so a tempo change rescales them together.
    expect(runClock(snapshot({ currentTempo: 60, runTicks: PPQ * 4 }), phrase)).toEqual({
      elapsedSeconds: 4,
      totalSeconds: 16,
    });

    // A phrase that repeats within one pass counts every time through.
    expect(runClock(snapshot(), { ...phrase, repeat: 2 })?.totalSeconds).toBe(16);
  });

  it('times the loop itself while looping, so it starts again each time round', () => {
    // Going round has no end to count toward. The passes are ignored and the
    // clock follows the pass rather than the run: 6 seconds into this time
    // through, not 30 seconds into something that never finishes.
    expect(
      runClock(
        snapshot({ loop: true, passes: 3, runTicks: PPQ * 60, phraseTick: PPQ * 12 }),
        phrase,
      ),
    ).toEqual({ elapsedSeconds: 6, totalSeconds: 8 });
  });

  it('has nothing to time without a pulse or a phrase', () => {
    // A theory set and free time have no tempo; an improvisation has no phrase.
    expect(runClock(snapshot({ currentTempo: null }), phrase)).toBeNull();
    expect(runClock(snapshot(), null)).toBeNull();
    expect(runClock(snapshot(), { ...phrase, totalTicks: 0 })).toBeNull();
  });

  it('reads as a clock, with seconds always shown', () => {
    expect([0, 7.6, 64, 750].map(formatClock)).toEqual(['0:00', '0:07', '1:04', '12:30']);
  });
});
