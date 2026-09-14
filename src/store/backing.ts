import type { BackingChoice, BackingQuery, ResolvedBacking, Video } from '@/data';
import { backingTracks, resolveBacking } from '@/data';
import type { KeyMode } from '@/domain/music';
import type { BackingSource, YouTubePlayer } from '@/audio/backing';

/** What plays instead of the synth notes, and everything the screen shows about it. */
export interface BackingState {
  /** What was chosen, as remembered on the exercise or routine. */
  choice: BackingChoice;
  /** What that means in the current key: the drone, a track, or none. */
  resolved: ResolvedBacking;
  /** Tracks the menu offers in the current key. */
  options: Video[];
  source: BackingSource | null;
  /** The YouTube player, for the screen to mount. Null unless a track is chosen. */
  player: YouTubePlayer | null;
  /** A track's speed, 0.25–2. */
  speed: number;
  /** The tempo before a track took it over, to go back to without one. */
  tempoBefore: number | null;
  /** YouTube could not be reached, or could not play the video. */
  error: string | null;
  /** Waiting for YouTube to start before the clock goes. */
  starting: boolean;
  /** Sounding (or paused mid-pass) — as opposed to loaded and waiting. */
  started: boolean;
}

export const NO_BACKING: BackingState = {
  choice: { kind: 'none' },
  resolved: { kind: 'none', dropped: false },
  options: [],
  source: null,
  player: null,
  speed: 1,
  tempoBefore: null,
  error: null,
  starting: false,
  started: false,
};

export interface BackingContext {
  choice: BackingChoice;
  query: BackingQuery;
}

/** The same thing, so a refresh need not rebuild what is already playing. */
export function sameResolution(a: ResolvedBacking, b: ResolvedBacking): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'video' && b.kind === 'video') {
    const x = a.video;
    const y = b.video;
    return x.id === y.id && x.updatedAt === y.updatedAt;
  }
  return true;
}

/** What the menu offers and what the choice resolves to, for a key. */
export function resolveFor(videos: readonly Video[], choice: BackingChoice, query: BackingQuery) {
  return {
    options: backingTracks(videos, query),
    resolved: resolveBacking(choice, videos, query),
  };
}

export type { KeyMode };
