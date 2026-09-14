import { MODE_NAMES, chroma, sameChroma } from '@/domain/music';
import type { KeyMode, ModeName } from '@/domain/music';
import type { BackingChoice, BackingCriteria, Uuid, Video } from './entities';
import type { NewVideo } from './repositories/types';

/**
 * Which videos go where. Pure, over the whole table: there are tens of videos,
 * not thousands, so matching in memory is simpler than indexing and as fast.
 */

/** Exact on both halves. D Dorian over an A-minor vamp just sounds like A minor. */
export function sameKeyMode(a: KeyMode, b: KeyMode): boolean {
  return a.mode === b.mode && sameChroma(a.tonic, b.tonic);
}

/** Every criterion the track must meet; no criteria admits everything. */
export function meetsCriteria(video: Video, criteria: BackingCriteria | undefined): boolean {
  if (!criteria) return true;
  const tags = new Set(video.tags.map((tag) => tag.toLowerCase()));
  if (!criteria.tags.every((tag) => tags.has(tag.toLowerCase()))) return false;
  if (criteria.bpm && video.bpm !== undefined) {
    if (video.bpm < criteria.bpm.min || video.bpm > criteria.bpm.max) return false;
  }
  return true;
}

const byTitle = (a: Video, b: Video) => a.title.localeCompare(b.title);

export interface BackingQuery {
  keyMode: KeyMode;
  /** The exercise being practiced. Absent for a routine, which offers shared tracks only. */
  exerciseId?: Uuid;
  criteria?: BackingCriteria;
}

/**
 * The tracks the backing menu offers: the exercise's own play-along videos
 * first — criteria are for narrowing the shared ones, not the ones you
 * attached on purpose — then shared tracks in the key and mode.
 */
export function backingTracks(videos: readonly Video[], query: BackingQuery): Video[] {
  const own =
    query.exerciseId === undefined
      ? []
      : videos.filter(
          (v) =>
            v.scope.kind === 'exercise' &&
            v.scope.exerciseId === query.exerciseId &&
            v.playAlong &&
            v.bpm !== undefined &&
            (v.keyMode === undefined || sameKeyMode(v.keyMode, query.keyMode)),
        );
  const shared = videos.filter(
    (v) =>
      v.scope.kind === 'shared' &&
      v.bpm !== undefined &&
      v.keyMode !== undefined &&
      sameKeyMode(v.keyMode, query.keyMode) &&
      meetsCriteria(v, query.criteria),
  );
  return [...own.sort(byTitle), ...shared.sort(byTitle)];
}

/** An exercise's reference videos: its own, with play-along off. */
export function referenceVideos(videos: readonly Video[], exerciseId: Uuid): Video[] {
  return videos
    .filter((v) => v.scope.kind === 'exercise' && v.scope.exerciseId === exerciseId && !v.playAlong)
    .sort(byTitle);
}

/** Every video attached to one exercise, play-along or not. */
export function exerciseVideos(videos: readonly Video[], exerciseId: Uuid): Video[] {
  return videos
    .filter((v) => v.scope.kind === 'exercise' && v.scope.exerciseId === exerciseId)
    .sort(byTitle);
}

export function sharedTracks(videos: readonly Video[]): Video[] {
  return videos.filter((v) => v.scope.kind === 'shared').sort(byTitle);
}

/**
 * How many shared tracks fill each cell of the 12×7 grid: per mode, twelve
 * counts by chroma — spelling-blind, so A♯ and B♭ Dorian are one cell.
 */
export function coverage(videos: readonly Video[]): Record<ModeName, number[]> {
  const grid = Object.fromEntries(MODE_NAMES.map((m) => [m, Array<number>(12).fill(0)])) as Record<
    ModeName,
    number[]
  >;
  for (const video of sharedTracks(videos)) {
    if (!video.keyMode) continue;
    const row = grid[video.keyMode.mode];
    const cell = chroma(video.keyMode.tonic);
    row[cell] = (row[cell] ?? 0) + 1;
  }
  return grid;
}

/** Every tag in use, for suggestions — spelled as first seen, sorted. */
export function tagsInUse(videos: readonly Video[]): string[] {
  const seen = new Map<string, string>();
  for (const tag of videos.flatMap((v) => v.tags)) {
    const trimmed = tag.trim();
    if (trimmed && !seen.has(trimmed.toLowerCase())) seen.set(trimmed.toLowerCase(), trimmed);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export type ResolvedBacking =
  | { kind: 'none'; dropped: boolean }
  | { kind: 'drone' }
  | { kind: 'video'; video: Video };

/**
 * What a remembered choice means now. A track that no longer fits — a re-roll
 * moved the key, or it was deleted — falls back to none, and says it did.
 */
export function resolveBacking(
  choice: BackingChoice | undefined,
  videos: readonly Video[],
  query: BackingQuery,
): ResolvedBacking {
  if (!choice) return { kind: 'none', dropped: false };
  if (choice.kind === 'drone') return { kind: 'drone' };
  const video = backingTracks(videos, query).find((v) => v.id === choice.id);
  return video ? { kind: 'video', video } : { kind: 'none', dropped: true };
}

/** What stops a video being saved, in words for the form. Empty means it can be. */
export function videoProblems(video: NewVideo): string[] {
  const problems: string[] = [];
  if (!/^[\w-]{11}$/.test(video.videoId)) problems.push('That is not a YouTube video id.');
  if (!video.title.trim()) problems.push('Give it a title.');
  const shared = video.scope.kind === 'shared';
  if (shared && !video.keyMode) problems.push('A shared track needs a key and mode.');
  if ((shared || video.playAlong) && !(video.bpm !== undefined && video.bpm > 0)) {
    problems.push('Playing along needs the track’s bpm.');
  }
  if (shared && !video.playAlong) problems.push('A shared video is always a backing track.');
  if (!(video.startSec >= 0)) problems.push('Bar 1 can’t be before the start of the video.');
  if (video.endSec !== undefined && !(video.endSec > video.startSec)) {
    problems.push('The end has to come after bar 1.');
  }
  if (!(video.beatsPerBar >= 1)) problems.push('A bar needs at least one beat.');
  return problems;
}
