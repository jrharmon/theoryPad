import { describe, expect, it } from 'vitest';
import {
  EIGHTH,
  FOUR_FOUR,
  QUARTER,
  SIX_EIGHT,
  THREE_FOUR,
  ticksPerBar,
} from '@/domain/phrase';
import { FakeClock } from '@/domain/time';
import { Metronome, type BeatEvent, type MetronomeOptions } from '../Metronome';
import { patternById, patternSounds, type DrumSound } from '@/domain/drums';
import { ClickVoice, DrumVoice, type ClickSink, type DrumSink } from '../metronomeVoices';

type Options = MetronomeOptions & { accentFirstBeat?: boolean; subdivision?: 1 | 2 | 4 };

function make({ accentFirstBeat, subdivision, ...options }: Options = {}) {
  const clock = new FakeClock();
  const clicks: { kind: string; time: number }[] = [];
  const beats: BeatEvent[] = [];
  const sink: ClickSink = { click: (time, kind) => clicks.push({ kind, time }) };
  const voice = new ClickVoice(sink, null, {
    ...(accentFirstBeat !== undefined ? { accentFirstBeat } : {}),
    ...(subdivision ? { subdivision } : {}),
  });
  const metronome = new Metronome(clock, voice, options);
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

/** A kit that records what it plays, holding only the sounds it is given. */
function fakeKit(loaded: DrumSound[]) {
  const has = new Set(loaded);
  const played: { sound: DrumSound; tick: number; velocity: number }[] = [];
  let clock: FakeClock | null = null;
  const kit: DrumSink = {
    has: (sound) => has.has(sound),
    play: (sound, _time, velocity) => played.push({ sound, tick: clock!.ticks, velocity }),
  };
  return { kit, played, has, attach: (c: FakeClock) => (clock = c) };
}

function drums(id: string, loaded?: DrumSound[]) {
  const pattern = patternById(id)!;
  const needs = [...patternSounds(pattern), 'hat-open' as const];
  const { kit, played, has, attach } = fakeKit(loaded ?? needs);
  const clicks: string[] = [];
  const click = new ClickVoice({ click: (_t, kind) => clicks.push(kind) }, kit);
  return {
    voice: new DrumVoice(pattern, kit, click, needs),
    kit,
    played,
    has,
    attach,
    clicks,
    click,
  };
}

describe('Metronome voices', () => {
  it('play a beat’s hits at its ticks, counting in on the open hat rather than the pattern', () => {
    const clock = new FakeClock();
    const { voice, played, attach } = drums('simple');
    attach(clock);
    const metronome = new Metronome(clock, voice, { countInTicks: QUARTER * 4 });
    metronome.start();
    clock.start();
    clock.advanceTicks(QUARTER * 8 - 1);

    const countIn = played.filter((p) => p.tick < QUARTER * 4);
    expect(countIn.map((p) => p.sound)).toEqual([
      'hat-open',
      'hat-open',
      'hat-open',
      'hat-open',
    ]);
    expect(countIn[0]!.velocity).toBeGreaterThan(countIn[1]!.velocity);

    const bar = played
      .filter((p) => p.tick >= QUARTER * 4)
      .map((p) => ({ sound: p.sound, tick: p.tick - QUARTER * 4, velocity: p.velocity }));
    expect(bar).toEqual(patternById('simple')!.bar(FOUR_FOUR, 0));
  });

  it('count the click in on the stick when it is loaded, and play the click until a beat’s drums are in', () => {
    const clock = new FakeClock();
    const { voice, played, has, attach, clicks } = drums('upbeat', ['stick']);
    attach(clock);
    const metronome = new Metronome(clock, voice, { countInTicks: QUARTER * 4 });
    metronome.start();
    clock.start();
    clock.advanceTicks(QUARTER * 6 - 1);

    // Upbeat's drums are not in: the click, counted in on the stick.
    expect(played.map((p) => p.sound)).toEqual(['stick', 'stick', 'stick', 'stick']);
    expect(clicks).toEqual(['accent', 'beat']);

    // Once they are, from the next step.
    for (const sound of ['kick', 'snare', 'hat-closed', 'hat-open'] as const) has.add(sound);
    clock.advanceTicks(QUARTER * 2);
    expect(played.slice(4).map((p) => p.sound)).toContain('snare');
    expect(clicks).toHaveLength(2);
  });

  it('take a routine item’s bars from its own bar 1 when swapped in mid-run', () => {
    const clock = new FakeClock();
    const first = drums('simple');
    first.attach(clock);
    const metronome = new Metronome(clock, first.click);
    metronome.start();
    clock.start();
    clock.advanceTicks(QUARTER * 3);

    // The next item counts in for half a bar from tick 4q: its bar 1 is at 6q,
    // halfway through the metronome's own second bar.
    const next = drums('heavy');
    next.attach(clock);
    metronome.setVoice(next.voice);
    metronome.countInBetween(QUARTER * 4, QUARTER * 6);
    clock.advanceTicks(QUARTER * 5 - 1);

    const at = (tick: number) => next.played.filter((p) => p.tick === tick).map((p) => p.sound);
    expect(at(QUARTER * 4)).toEqual(['hat-open']);
    expect(at(QUARTER * 6).sort()).toEqual(['crash', 'kick']);
    expect(at(QUARTER * 7)).toContain('snare');
  });
});
