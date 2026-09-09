import { describe, expect, it } from 'vitest';
import type { NoteName } from '@/domain/music';
import { STANDARD_GUITAR } from '@/domain/instrument';
import { EIGHTH, QUARTER, phraseBuilder } from '@/domain/phrase';
import { FakeClock } from '../FakeClock';
import { PhrasePlayer } from '../PhrasePlayer';
import type { InstrumentVoice } from '../voices';

interface Played {
  note: NoteName;
  duration: number;
  time: number;
  velocity: number;
}

function recordingVoice() {
  const played: Played[] = [];
  let released = 0;
  const voice: InstrumentVoice = {
    id: 'test',
    ready: true,
    load: () => Promise.resolve(),
    play: (note, duration, time, velocity = 0.8) =>
      played.push({ note, duration, time, velocity }),
    releaseAll: () => {
      released += 1;
    },
    setVolume: () => {},
    dispose: () => {},
  };
  return { voice, played, releases: () => released };
}

const p = (string: number, fret: number) => ({ string, fret });

describe('PhrasePlayer', () => {
  it('plays each note at its pitch and tick', () => {
    const clock = new FakeClock(60);
    const { voice, played } = recordingVoice();
    const phrase = phraseBuilder().rhythm(QUARTER).sequence([p(0, 3), p(0, 5), p(1, 0)]).build();

    new PhrasePlayer(clock, voice).load(phrase, STANDARD_GUITAR);
    clock.start();
    clock.advanceTicks(QUARTER * 4);

    expect(played.map((n) => n.note)).toEqual(['G2', 'A2', 'A2']);
    // At 60 bpm a quarter note is one second.
    expect(played.map((n) => n.time)).toEqual([0, 1, 2]);
  });

  it('reflects the tuning it is given', () => {
    const clock = new FakeClock(60);
    const { voice, played } = recordingVoice();
    const phrase = phraseBuilder().rhythm(QUARTER).sequence([p(0, 0)]).build();

    const dropD = { ...STANDARD_GUITAR, tuning: [...STANDARD_GUITAR.tuning] };
    dropD.tuning[0] = 'D2' as NoteName;

    new PhrasePlayer(clock, voice).load(phrase, dropD);
    clock.start();
    clock.advanceTicks(QUARTER);
    expect(played[0]!.note).toBe('D2');
  });

  it('scales durations with the tempo', () => {
    for (const [bpm, expected] of [[60, 1], [120, 0.5]] as const) {
      const clock = new FakeClock(bpm);
      const { voice, played } = recordingVoice();
      const phrase = phraseBuilder().rhythm(QUARTER).sequence([p(0, 3)]).build();

      new PhrasePlayer(clock, voice).load(phrase, STANDARD_GUITAR);
      clock.start();
      clock.advanceTicks(QUARTER);
      expect(played[0]!.duration).toBe(expected);
    }
  });

  it('plays slurred notes more quietly than picked ones', () => {
    const clock = new FakeClock(60);
    const { voice, played } = recordingVoice();
    const phrase = phraseBuilder()
      .rhythm(EIGHTH)
      .note(p(0, 3))
      .note(p(0, 5), { articulation: 'hammer-on' })
      .note(p(0, 7), { articulation: 'pull-off' })
      .build();

    new PhrasePlayer(clock, voice).load(phrase, STANDARD_GUITAR);
    clock.start();
    clock.advanceTicks(QUARTER * 2);

    // Without this, legato playback sounds identical to alternate picking.
    expect(played[0]!.velocity).toBeGreaterThan(played[1]!.velocity);
    expect(played[1]!.velocity).toBe(played[2]!.velocity);
  });

  it('shortens staccato and lengthens let-ring', () => {
    const clock = new FakeClock(60);
    const { voice, played } = recordingVoice();
    const phrase = phraseBuilder()
      .rhythm(QUARTER)
      .note(p(0, 3), { articulation: 'staccato' })
      .note(p(0, 5), { articulation: 'let-ring' })
      .build();

    new PhrasePlayer(clock, voice).load(phrase, STANDARD_GUITAR);
    clock.start();
    clock.advanceTicks(QUARTER * 2);

    expect(played[0]!.duration).toBe(0.5);
    expect(played[1]!.duration).toBe(2);
  });

  it('honours a note’s own velocity', () => {
    const clock = new FakeClock(60);
    const { voice, played } = recordingVoice();
    const phrase = phraseBuilder()
      .rhythm(QUARTER)
      .note(p(0, 3), { velocity: 1 })
      .note(p(0, 5), { velocity: 0.4 })
      .build();

    new PhrasePlayer(clock, voice).load(phrase, STANDARD_GUITAR);
    clock.start();
    clock.advanceTicks(QUARTER * 2);
    expect(played.map((n) => n.velocity)).toEqual([1, 0.4]);
  });

  it('plays a phrase once per repeat', () => {
    const clock = new FakeClock(60);
    const { voice, played } = recordingVoice();
    const phrase = phraseBuilder({ repeat: 3 })
      .rhythm(QUARTER)
      .sequence([p(0, 3), p(0, 5), p(0, 7), p(0, 8)])
      .build();

    new PhrasePlayer(clock, voice).load(phrase, STANDARD_GUITAR);
    clock.start();
    clock.advanceTicks(QUARTER * 16);

    expect(played).toHaveLength(12);
    expect(played[4]!.time).toBe(4); // second pass starts after one bar
  });

  it('starts from an offset tick', () => {
    const clock = new FakeClock(60);
    const { voice, played } = recordingVoice();
    const phrase = phraseBuilder().rhythm(QUARTER).sequence([p(0, 3)]).build();

    new PhrasePlayer(clock, voice).load(phrase, STANDARD_GUITAR, QUARTER * 4);
    clock.start();
    clock.advanceTicks(QUARTER * 2);
    expect(played).toHaveLength(0);

    clock.advanceTicks(QUARTER * 4);
    expect(played).toHaveLength(1);
    expect(played[0]!.time).toBe(4);
  });

  it('plays nothing for a phrase with no notes', () => {
    const clock = new FakeClock(60);
    const { voice, played } = recordingVoice();
    const player = new PhrasePlayer(clock, voice);
    player.load(phraseBuilder().rest(QUARTER * 4).build(), STANDARD_GUITAR);

    clock.start();
    clock.advanceTicks(QUARTER * 8);
    expect(played).toHaveLength(0);
    expect(player.scheduledNoteCount).toBe(0);
  });

  it('clears scheduled notes and releases the voice', () => {
    const clock = new FakeClock(60);
    const { voice, played, releases } = recordingVoice();
    const player = new PhrasePlayer(clock, voice);
    player.load(phraseBuilder().rhythm(QUARTER).sequence([p(0, 3), p(0, 5)]).build(), STANDARD_GUITAR);

    // load() releases too, so a previous phrase cannot ring on under a new one.
    const beforeClear = releases();
    player.clear();

    clock.start();
    clock.advanceTicks(QUARTER * 8);

    expect(played).toHaveLength(0);
    expect(clock.scheduledCount).toBe(0);
    expect(releases()).toBe(beforeClear + 1);
  });

  it('replaces the previous phrase on reload', () => {
    const clock = new FakeClock(60);
    const { voice, played } = recordingVoice();
    const player = new PhrasePlayer(clock, voice);

    player.load(phraseBuilder().rhythm(QUARTER).sequence([p(0, 3), p(0, 5)]).build(), STANDARD_GUITAR);
    player.load(phraseBuilder().rhythm(QUARTER).sequence([p(0, 7)]).build(), STANDARD_GUITAR);

    clock.start();
    clock.advanceTicks(QUARTER * 4);
    expect(played).toHaveLength(1);
    expect(played[0]!.note).toBe('B2');
  });

  it('sounds nothing while the clock is paused', () => {
    const clock = new FakeClock(60);
    const { voice, played } = recordingVoice();
    new PhrasePlayer(clock, voice).load(
      phraseBuilder().rhythm(QUARTER).sequence([p(0, 3), p(0, 5), p(0, 7), p(0, 8)]).build(),
      STANDARD_GUITAR,
    );

    clock.start();
    clock.advanceTicks(QUARTER);
    clock.pause();
    clock.advanceTicks(QUARTER * 8);
    expect(played).toHaveLength(2);
  });
});
