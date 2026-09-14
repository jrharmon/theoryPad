import { describe, expect, it } from 'vitest';
import { pitchClass } from '@/domain/music';
import type { ModeName } from '@/domain/music';
import type { Video } from '../entities';
import type { NewVideo } from '../repositories/types';
import {
  backingTracks,
  coverage,
  coverageKey,
  referenceVideos,
  resolveBacking,
  tagsInUse,
  videoProblems,
} from '../videos';

/** Fixtures can say `keyMode: undefined` to mean "without one". */
type Loose<T> = { [K in keyof T]?: T[K] | undefined };
function defined<T>(value: Loose<T>): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

let counter = 0;
function video(overrides: Loose<Video> = {}): Video {
  counter += 1;
  return defined<Video>({
    id: `v${counter}`,
    videoId: 'abcdefghijk',
    title: `Track ${counter}`,
    scope: { kind: 'shared' },
    playAlong: true,
    startSec: 0,
    keyMode: { tonic: pitchClass('A'), mode: 'aeolian' },
    bpm: 100,
    beatsPerBar: 4,
    tags: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  });
}

const km = (tonic: string, mode: ModeName) => ({ tonic: pitchClass(tonic), mode });
const own = (exerciseId: string) => ({ kind: 'exercise' as const, exerciseId });

describe('the backing menu', () => {
  it('offers shared tracks matching key and mode exactly', () => {
    const aMinor = video({ title: 'A minor' });
    const dDorian = video({ keyMode: km('D', 'dorian') });
    const aDorian = video({ keyMode: km('A', 'dorian') });
    expect(backingTracks([aMinor, dDorian, aDorian], { keyMode: km('A', 'aeolian') })).toEqual([aMinor]);
  });

  it('matches the tonic by sound, not spelling', () => {
    const bFlat = video({ keyMode: km('Bb', 'dorian') });
    expect(backingTracks([bFlat], { keyMode: km('A#', 'dorian') })).toEqual([bFlat]);
  });

  it('puts the exercise’s own play-along tracks first, and only for that exercise', () => {
    const shared = video({ title: 'A shared' });
    const mine = video({ title: 'Z mine', scope: own('ex-1') });
    const theirs = video({ scope: own('ex-2') });
    const query = { keyMode: km('A', 'aeolian'), exerciseId: 'ex-1' };
    expect(backingTracks([shared, mine, theirs], query)).toEqual([mine, shared]);
  });

  it('offers an exercise’s own track without a key in any key', () => {
    const anyKey = video({ scope: own('ex-1'), keyMode: undefined });
    expect(backingTracks([anyKey], { keyMode: km('F#', 'lydian'), exerciseId: 'ex-1' })).toEqual([anyKey]);
  });

  it('never offers reference videos, or an exercise’s tracks to a routine', () => {
    const lesson = video({ scope: own('ex-1'), playAlong: false });
    const mine = video({ scope: own('ex-1') });
    expect(backingTracks([lesson, mine], { keyMode: km('A', 'aeolian') })).toEqual([]);
    expect(backingTracks([lesson], { keyMode: km('A', 'aeolian'), exerciseId: 'ex-1' })).toEqual([]);
  });

  it('narrows shared tracks by saved criteria, and new ones that fit just appear', () => {
    const funk = video({ tags: ['Funk', 'clean'], bpm: 96 });
    const rock = video({ tags: ['rock'] });
    const slowFunk = video({ tags: ['funk'], bpm: 60 });
    const criteria = { tags: ['funk'], bpm: { min: 80, max: 120 } };
    const query = { keyMode: km('A', 'aeolian'), criteria };
    expect(backingTracks([funk, rock, slowFunk], query)).toEqual([funk]);

    const added = video({ tags: ['funk'], bpm: 110 });
    expect(backingTracks([funk, rock, slowFunk, added], query)).toHaveLength(2);
  });

  it('does not narrow the exercise’s own tracks by criteria', () => {
    const mine = video({ scope: own('ex-1'), tags: [] });
    const query = { keyMode: km('A', 'aeolian'), exerciseId: 'ex-1', criteria: { tags: ['funk'] } };
    expect(backingTracks([mine], query)).toEqual([mine]);
  });
});

describe('a remembered choice', () => {
  const query = { keyMode: km('A', 'aeolian') };

  it('is none when nothing was chosen, and the drone fits every key', () => {
    expect(resolveBacking(undefined, [], query)).toEqual({ kind: 'none', dropped: false });
    expect(resolveBacking({ kind: 'drone' }, [], { keyMode: km('C#', 'locrian') })).toEqual({
      kind: 'drone',
    });
  });

  it('finds its track while the key still fits, and drops it, saying so, when not', () => {
    const track = video();
    expect(resolveBacking({ kind: 'video', id: track.id }, [track], query)).toEqual({
      kind: 'video',
      video: track,
    });
    expect(resolveBacking({ kind: 'video', id: track.id }, [track], { keyMode: km('E', 'aeolian') })).toEqual(
      { kind: 'none', dropped: true },
    );
    expect(resolveBacking({ kind: 'video', id: 'deleted' }, [track], query)).toEqual({
      kind: 'none',
      dropped: true,
    });
  });
});

describe('reference videos, coverage and tags', () => {
  it('lists an exercise’s reference videos', () => {
    const lesson = video({ scope: own('ex-1'), playAlong: false, keyMode: undefined });
    const track = video({ scope: own('ex-1') });
    expect(referenceVideos([lesson, track, video()], 'ex-1')).toEqual([lesson]);
  });

  it('counts shared tracks per key and mode, spelling-blind', () => {
    const counts = coverage([
      video(),
      video(),
      video({ keyMode: km('Bb', 'dorian') }),
      video({ keyMode: km('A#', 'dorian') }),
      video({ scope: own('ex-1'), keyMode: km('C', 'ionian') }),
    ]);
    expect(counts.get(coverageKey(km('A', 'aeolian')))).toBe(2);
    expect(counts.get(coverageKey(km('Bb', 'dorian')))).toBe(2);
    expect(counts.has(coverageKey(km('C', 'ionian')))).toBe(false);
  });

  it('suggests each tag once, spelled as first seen', () => {
    expect(tagsInUse([video({ tags: ['Funk', 'clean'] }), video({ tags: ['funk', ' rock '] })])).toEqual([
      'clean',
      'Funk',
      'rock',
    ]);
  });
});

describe('what stops a video being saved', () => {
  const base = (() => {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = video();
    return rest;
  })();
  const problems = (changes: Loose<NewVideo>) => videoProblems(defined<NewVideo>({ ...base, ...changes }));

  it('accepts a complete shared track', () => {
    expect(problems({})).toEqual([]);
  });

  it('asks a shared track for its key, mode and bpm', () => {
    expect(problems({ keyMode: undefined, bpm: undefined })).toEqual([
      'A shared track needs a key and mode.',
      'Playing along needs the track’s bpm.',
    ]);
  });

  it('lets a reference video go without key, mode or bpm', () => {
    expect(
      problems({ scope: own('ex-1'), playAlong: false, keyMode: undefined, bpm: undefined }),
    ).toEqual([]);
  });

  it('catches a bad id and an end before bar 1', () => {
    expect(problems({ videoId: 'nope', startSec: 30, endSec: 20 })).toEqual([
      'That is not a YouTube video id.',
      'The end has to come after bar 1.',
    ]);
  });
});
