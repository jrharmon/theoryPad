import { describe, expect, it } from 'vitest';
import { EIGHTH, QUARTER, SIX_EIGHT, THREE_FOUR, ticksPerBar } from '@/domain/phrase';
import { FakeClock } from '@/domain/time';
import { Metronome, type BeatEvent, type ClickSink, type MetronomeOptions } from '../Metronome';

function make(options: MetronomeOptions = {}) {
  const clock = new FakeClock();
  const clicks: { kind: string; time: number }[] = [];
  const beats: BeatEvent[] = [];
  const sink: ClickSink = { click: (time, kind) => clicks.push({ kind, time }) };
  const metronome = new Metronome(clock, sink, options);
  const off = metronome.onBeat((beat) => beats.push(beat));
  return { clock, metronome, clicks, beats, off, kinds: () => clicks.map((c) => c.kind) };
}

describe('Metronome', () => {
  it('clicks every beat in 4/4, accenting the downbeat, and reports where it is', () => {
    const { clock, metronome, clicks, beats, kinds, off } = make();
    metronome.start();

    clock.start();
    clock.advanceTicks(QUARTER * 5);

    expect(kinds()).toEqual(['accent', 'beat', 'beat', 'beat', 'accent', 'beat']);
    expect(beats.map((b) => [b.bar, b.beat])).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 0],
      [1, 1],
    ]);
    expect(beats.map((b) => b.isDownbeat)).toEqual([true, false, false, false, true, false]);

    // A listener that unsubscribes hears no more, while the click goes on.
    off();
    const heard = beats.length;
    clock.advanceTicks(QUARTER * 4);
    expect(beats).toHaveLength(heard);
    expect(clicks.length).toBeGreaterThan(6);
  });

  it('counts in first, then starts musical bar 0 — and has no count-in unless asked', () => {
    expect(new Metronome(new FakeClock(), null).countInTicks).toBe(0);

    const { clock, metronome, beats } = make({ countInTicks: QUARTER * 4 });
    metronome.start();
    clock.start();
    clock.advanceTicks(QUARTER * 5);

    expect(metronome.countInTicks).toBe(QUARTER * 4);
    expect(beats.slice(0, 4).every((b) => b.isCountIn)).toBe(true);
    expect(beats[4]).toMatchObject({ isCountIn: false, bar: 0, beat: 0 });
  });

  it('goes silent when muted, but still counts in and still keeps the beat', () => {
    const { clock, metronome, clicks, beats } = make({ countInTicks: QUARTER * 4 });
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

  it('makes no sound at all when silenced — under a track, the recording counts in', () => {
    const { clock, metronome, clicks, beats } = make({
      countInTicks: QUARTER * 4,
      subdivision: 2,
    });
    metronome.setSilenced(true);
    metronome.start();

    clock.start();
    clock.advanceTicks(QUARTER * 7);
    expect(clicks).toHaveLength(0);
    expect(beats).toHaveLength(8);
  });

  it('clicks a count-in in the middle of the clock even when muted', () => {
    // Between a routine's items: the count-in is the only warning of what is next.
    const { clock, metronome, clicks } = make();
    metronome.setMuted(true);
    metronome.start();
    clock.start();
    clock.advanceTicks(QUARTER * 7);
    expect(clicks).toHaveLength(0);

    metronome.countInBetween(QUARTER * 8, QUARTER * 12);
    clock.advanceTicks(QUARTER * 8);
    expect(clicks).toHaveLength(4);
  });

  it('clicks what the time signature, accent and subdivision ask for', () => {
    const threeFour = make({ timeSignature: THREE_FOUR });
    threeFour.metronome.start();
    threeFour.clock.start();
    threeFour.clock.advanceTicks(QUARTER * 5);
    expect(threeFour.kinds()).toEqual(['accent', 'beat', 'beat', 'accent', 'beat', 'beat']);

    const flat = make({ accentFirstBeat: false });
    flat.metronome.start();
    flat.clock.start();
    flat.clock.advanceTicks(QUARTER * 3);
    expect(flat.kinds().every((kind) => kind === 'beat')).toBe(true);

    // Three beats plus two offbeats, and no doubled click on the beat itself.
    const offbeats = make({ subdivision: 2 });
    offbeats.metronome.start();
    offbeats.clock.start();
    offbeats.clock.advanceTicks(QUARTER * 2);
    expect(offbeats.kinds().filter((k) => k === 'subdivision')).toHaveLength(2);
    expect(offbeats.kinds().filter((k) => k !== 'subdivision')).toHaveLength(3);

    // In 6/8 the eighth is the beat.
    const sixEight = make({ timeSignature: SIX_EIGHT });
    sixEight.metronome.start();
    sixEight.clock.start();
    sixEight.clock.advanceTicks(ticksPerBar(SIX_EIGHT));
    expect(sixEight.beats).toHaveLength(7);
    expect(sixEight.beats[1]!.tick).toBe(EIGHTH);
  });

  it('freezes with the clock, stops cleanly, and restarts when reconfigured', () => {
    const { clock, metronome, clicks } = make({ subdivision: 2 });
    metronome.start();
    clock.start();
    clock.advanceTicks(QUARTER * 2);

    const paused = clicks.length;
    clock.pause();
    clock.advanceTicks(QUARTER * 8);
    expect(clicks).toHaveLength(paused);
    clock.start();
    clock.advanceTicks(QUARTER);
    expect(clicks.length).toBeGreaterThan(paused);

    // Reconfigured mid-run, it keeps running on the new setting.
    metronome.configure({ timeSignature: THREE_FOUR });
    const configured = clicks.length;
    clock.advanceTicks(QUARTER * 3);
    expect(clicks.length).toBeGreaterThan(configured);
    expect(metronome.isRunning).toBe(true);

    const stopped = clicks.length;
    metronome.stop();
    clock.advanceTicks(QUARTER * 8);
    expect(clicks).toHaveLength(stopped);
    expect(clock.scheduledCount).toBe(0);
    expect(metronome.isRunning).toBe(false);
  });
});
