import type { NewVideo, Video, VideoScope } from '@/data';
import { videoProblems } from '@/data';
import type { ModeName } from '@/domain/music';
import { chroma, pitchClass, preferredTonic } from '@/domain/music';
import { formatVideoTime, parseVideoTime, parseYouTubeLink } from '@/domain/backing';

/**
 * The track form's fields, as typed. Kept as text so a half-typed time or bpm
 * is not thrown away or coerced while someone is still typing it.
 */
export interface TrackDraft {
  link: string;
  title: string;
  /** Empty for an exercise's own video that fits any key. */
  tonic: string;
  mode: ModeName | '';
  start: string;
  bpm: string;
  beats: string;
  end: string;
  progression: string;
  tags: string;
  playAlong: boolean;
  scope: VideoScope;
}

export function emptyDraft(scope: VideoScope, fill: Partial<TrackDraft> = {}): TrackDraft {
  return {
    link: '',
    title: '',
    tonic: '',
    mode: '',
    start: '0:00',
    bpm: '',
    beats: '4',
    end: '',
    progression: '',
    tags: '',
    playAlong: scope.kind === 'shared',
    scope,
    ...fill,
  };
}

export function draftFromVideo(video: Video): TrackDraft {
  return {
    link: `https://youtu.be/${video.videoId}`,
    title: video.title,
    tonic: video.keyMode?.tonic ?? '',
    mode: (video.keyMode?.mode as ModeName | undefined) ?? '',
    start: formatVideoTime(video.startSec),
    bpm: video.bpm === undefined ? '' : String(video.bpm),
    beats: String(video.beatsPerBar),
    end: video.endSec === undefined ? '' : formatVideoTime(video.endSec),
    progression: video.progression ?? '',
    tags: video.tags.join(', '),
    playAlong: video.playAlong,
    scope: video.scope,
  };
}

/** Spell the tonic the way the chosen mode reads it: A♯ Dorian is B♭ Dorian. */
export function respell(tonic: string, mode: ModeName | ''): string {
  if (!tonic || !mode) return tonic;
  return preferredTonic(chroma(pitchClass(tonic)), mode);
}

/** The video a draft describes, and everything stopping it being saved. */
export function draftToVideo(draft: TrackDraft): {
  video: NewVideo | null;
  problems: string[];
} {
  const problems: string[] = [];
  const link = parseYouTubeLink(draft.link);
  if (!link) problems.push('Paste a YouTube link.');

  const startSec = parseVideoTime(draft.start);
  if (startSec === null) problems.push('Bar 1 needs a time, like 3:36 or 216.5.');
  const endSec = draft.end.trim() ? parseVideoTime(draft.end) : undefined;
  if (endSec === null) problems.push('The loop point needs a time, like 7:12.');
  const bpm = draft.bpm.trim() ? Number(draft.bpm) : undefined;
  if (bpm !== undefined && !(bpm > 0)) problems.push('The bpm has to be a number.');
  const beats = Number(draft.beats);
  if ((draft.tonic === '') !== (draft.mode === ''))
    problems.push('Choose both a key and a mode, or neither.');

  if (!link || startSec === null || endSec === null || problems.length > 0) {
    return { video: null, problems };
  }

  const shared = draft.scope.kind === 'shared';
  const video: NewVideo = {
    videoId: link.videoId,
    title: draft.title.trim(),
    scope: draft.scope,
    playAlong: shared || draft.playAlong,
    startSec,
    beatsPerBar: Number.isInteger(beats) ? beats : 0,
    tags: [
      ...new Set(
        draft.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ],
  };
  if (endSec !== undefined) video.endSec = endSec;
  if (bpm !== undefined) video.bpm = bpm;
  if (draft.tonic && draft.mode) {
    video.keyMode = {
      tonic: pitchClass(respell(draft.tonic, draft.mode)),
      scale: 'major',
      mode: draft.mode,
    };
  }
  if (draft.progression.trim()) video.progression = draft.progression.trim();
  return { video, problems: videoProblems(video) };
}
