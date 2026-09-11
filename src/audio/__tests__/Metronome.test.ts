import { describe, expect, it, vi } from 'vitest';
import { EIGHTH, QUARTER, SIX_EIGHT, THREE_FOUR, ticksPerBar } from '@/domain/phrase';
import { FakeClock } from '@/domain/time';
import { Metronome, type BeatEvent, type ClickSink } from '../Metronome';

function sink() {
  const clicks: { kind: string; time: number }[] = [];
  const s: ClickSink = { click: (time, kind) => clicks.push({ kind, time }) };
  return { s, clicks };
}

describe('Metronome', () => {
  it('goes silent when muted, but still counts in and still reports beats', () => {
    const clock = new FakeClock();
    const { s, clicks } = sink();
    const metronome = new Metronome(clock, s, { countInBars: 1 });
    const beats: BeatEvent[] = [];
    metronome.onBeat((b) => beats.push(b));
    metronome.setMuted(true);
    metronome.start();

    clock.start();
    clock.advanceTicks(QUARTER * 7);
    // Four count-in clicks, then nothing — though the beat carries on.
    expect(clicks).toHaveLength(4);
    expect(beats).toHaveLength(8);

    metronome.setMuted(false);
    clock.advanceTicks(QUARTER);
    expect(clicks).toHaveLength(5);
  });

  it('clicks once per beat', () => {
    const clock = new FakeClock();
    const { s, clicks } = sink();
    new Metronome(clock, s).start();

    clock.start();
    clock.advanceTicks(QUARTER * 4);
    expect(clicks).toHaveLength(5);
  });

  it('accents the downbeat', () => {
    const clock = new FakeClock();
    const { s, clicks } = sink();
    new Metronome(clock, s).start();

    clock.start();
    clock.advanceTicks(QUARTER * 7);
    expect(clicks.map((c) => c.kind)).toEqual([
      'accent', 'beat', 'beat', 'beat',
      'accent', 'beat', 'beat', 'beat',
    ]);
  });

  it('can be told not to accent', () => {
    const clock = new FakeClock();
    const { s, clicks } = sink();
    new Metronome(clock, s, { accentFirstBeat: false }).start();
    clock.start();
    clock.advanceTicks(QUARTER * 3);
    expect(clicks.every((c) => c.kind === 'beat')).toBe(true);
  });

  it('follows the time signature', () => {
    const clock = new FakeClock();
    const { s, clicks } = sink();
    new Metronome(clock, s, { timeSignature: THREE_FOUR }).start();

    clock.start();
    clock.advanceTicks(QUARTER * 5);
    expect(clicks.map((c) => c.kind)).toEqual(['accent', 'beat', 'beat', 'accent', 'beat', 'beat']);
  });

  it('uses the eighth as the beat in 6/8', () => {
    const clock = new FakeClock();
    const beats: BeatEvent[] = [];
    const metronome = new Metronome(clock, null, { timeSignature: SIX_EIGHT });
    metronome.onBeat((e) => beats.push(e));
    metronome.start();

    clock.start();
    clock.advanceTicks(ticksPerBar(SIX_EIGHT));
    expect(beats).toHaveLength(7);
    expect(beats[1]!.tick).toBe(EIGHTH);
  });

  it('reports bar and beat', () => {
    const clock = new FakeClock();
    const beats: BeatEvent[] = [];
    const metronome = new Metronome(clock, null);
    metronome.onBeat((e) => beats.push(e));
    metronome.start();

    clock.start();
    clock.advanceTicks(QUARTER * 5);

    expect(beats.map((b) => [b.bar, b.beat])).toEqual([
      [0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1],
    ]);
    expect(beats[0]!.isDownbeat).toBe(true);
    expect(beats[1]!.isDownbeat).toBe(false);
  });

  it('marks count-in beats and starts musical bar 0 after them', () => {
    const clock = new FakeClock();
    const beats: BeatEvent[] = [];
    const metronome = new Metronome(clock, null, { countInBars: 1 });
    metronome.onBeat((e) => beats.push(e));
    metronome.start();

    clock.start();
    clock.advanceTicks(QUARTER * 5);

    // Four count-in beats, then the phrase begins at bar 0.
    expect(beats.slice(0, 4).every((b) => b.isCountIn)).toBe(true);
    expect(beats[4]!.isCountIn).toBe(false);
    expect(beats[4]!.bar).toBe(0);
    expect(beats[4]!.beat).toBe(0);
    expect(metronome.countInTicks).toBe(QUARTER * 4);
  });

  it('has no count-in by default', () => {
    const clock = new FakeClock();
    const metronome = new Metronome(clock, null);
    expect(metronome.countInTicks).toBe(0);
  });

  it('adds subdivision clicks between beats', () => {
    const clock = new FakeClock();
    const { s, clicks } = sink();
    new Metronome(clock, s, { subdivision: 2 }).start();

    clock.start();
    clock.advanceTicks(QUARTER * 2);

    // Three beats plus two offbeats, and no doubled click on the beat itself.
    expect(clicks.filter((c) => c.kind === 'subdivision')).toHaveLength(2);
    expect(clicks.filter((c) => c.kind !== 'subdivision')).toHaveLength(3);
  });

  it('stops cleanly and leaves nothing scheduled', () => {
    const clock = new FakeClock();
    const { s, clicks } = sink();
    const metronome = new Metronome(clock, s, { subdivision: 2 });
    metronome.start();

    clock.start();
    clock.advanceTicks(QUARTER * 2);
    const before = clicks.length;

    metronome.stop();
    clock.advanceTicks(QUARTER * 8);

    expect(clicks).toHaveLength(before);
    expect(clock.scheduledCount).toBe(0);
    expect(metronome.isRunning).toBe(false);
  });

  it('freezes with the clock when paused', () => {
    const clock = new FakeClock();
    const { s, clicks } = sink();
    new Metronome(clock, s).start();

    clock.start();
    clock.advanceTicks(QUARTER * 2);
    const before = clicks.length;

    clock.pause();
    clock.advanceTicks(QUARTER * 8);
    expect(clicks).toHaveLength(before);

    clock.start();
    clock.advanceTicks(QUARTER);
    expect(clicks.length).toBe(before + 1);
  });

  it('is steady at any tempo', () => {
    for (const bpm of [40, 60, 120, 208]) {
      const clock = new FakeClock(bpm);
      const times: number[] = [];
      const metronome = new Metronome(clock, { click: (t) => times.push(t) });
      metronome.start();

      clock.start();
      clock.advanceTicks(QUARTER * 16);

      const gaps = times.slice(1).map((t, i) => t - times[i]!);
      const expected = 60 / bpm;
      for (const gap of gaps) expect(gap, `${bpm} bpm`).toBeCloseTo(expected, 9);
    }
  });

  it('unsubscribes a listener', () => {
    const clock = new FakeClock();
    const listener = vi.fn();
    const metronome = new Metronome(clock, null);
    const off = metronome.onBeat(listener);
    metronome.start();

    clock.start();
    clock.advanceTicks(QUARTER);
    expect(listener).toHaveBeenCalledTimes(2);

    off();
    clock.advanceTicks(QUARTER * 4);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('restarts when reconfigured while running', () => {
    const clock = new FakeClock();
    const { s, clicks } = sink();
    const metronome = new Metronome(clock, s);
    metronome.start();

    clock.start();
    clock.advanceTicks(QUARTER * 2);
    metronome.configure({ timeSignature: THREE_FOUR });
    clicks.length = 0;

    clock.advanceTicks(QUARTER * 3);
    expect(clicks.length).toBeGreaterThan(0);
    expect(metronome.isRunning).toBe(true);
  });
});
