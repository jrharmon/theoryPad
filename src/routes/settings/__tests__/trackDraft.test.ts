import { describe, expect, it } from 'vitest';
import { FIRST_RUN_VIDEOS } from '@/data/seed/videos';
import { draftFromVideo, draftToVideo, emptyDraft, respell } from '../trackDraft';

const shared = { kind: 'shared' } as const;
const own = { kind: 'exercise', exerciseId: 'ex-1' } as const;

describe('the track form’s draft', () => {
  it('round-trips a stored track', () => {
    const [first] = FIRST_RUN_VIDEOS;
    const { id: _id, createdAt: _c, updatedAt: _u, ...stored } = first!;
    expect(draftToVideo(draftFromVideo(first!))).toEqual({ video: stored, problems: [] });
  });

  it('reads pasted links, times as YouTube writes them, and tags', () => {
    const { video, problems } = draftToVideo({
      ...emptyDraft(shared),
      link: 'https://www.youtube.com/watch?v=WkIijba-HcU&t=10s',
      title: ' Funk in D ',
      tonic: 'D',
      mode: 'dorian',
      start: '1:02.5',
      end: '4:00',
      bpm: '96.5',
      tags: 'funk, clean,, funk',
    });
    expect(problems).toEqual([]);
    expect(video).toMatchObject({
      videoId: 'WkIijba-HcU',
      title: 'Funk in D',
      startSec: 62.5,
      endSec: 240,
      bpm: 96.5,
      tags: ['funk', 'clean'],
      playAlong: true,
    });
  });

  it('says what is missing rather than saving half a track', () => {
    expect(draftToVideo({ ...emptyDraft(shared), link: 'nope', start: 'soon' }).problems).toEqual([
      'Paste a YouTube link.',
      'Bar 1 needs a time, like 3:36 or 216.5.',
    ]);
    const noKey = draftToVideo({ ...emptyDraft(shared), link: 'WkIijba-HcU', title: 'x', bpm: '90' });
    expect(noKey.problems).toEqual(['A shared track needs a key and mode.']);
  });

  it('lets an exercise’s own reference video go without key or tempo', () => {
    const { video, problems } = draftToVideo({
      ...emptyDraft(own),
      link: 'https://youtu.be/WkIijba-HcU',
      title: 'How the shift works',
    });
    expect(problems).toEqual([]);
    expect(video).toMatchObject({ scope: own, playAlong: false });
    expect(video).not.toHaveProperty('keyMode');
  });

  it('spells the tonic the way the mode reads it', () => {
    expect(respell('A#', 'dorian')).toBe('Bb');
    expect(respell('Gb', 'lydian')).toBe('Gb');
    expect(respell('', 'dorian')).toBe('');
  });
});
