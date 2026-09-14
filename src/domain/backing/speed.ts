/**
 * A track's speed, and the tempo that comes out of it.
 *
 * YouTube accepts any rate from 0.25 to 2 in steps of 0.05, pitch preserved —
 * tested against the real player, 2026-09-13. Its own list of rates shows only
 * the quarter steps; don't take that as the whole set.
 */

export const SPEED_MIN = 0.25;
export const SPEED_MAX = 2;
export const SPEED_STEP = 0.05;
/** Below this the audio gets audibly mushy: offered, but flagged. */
export const SPEED_MUSHY_BELOW = 0.5;

/** The nearest speed the player can actually do. Twentieths, so no float drift. */
export function snapSpeed(speed: number): number {
  const twentieths = Math.round(speed / SPEED_STEP);
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, twentieths / (1 / SPEED_STEP)));
}

/** The speed that plays a track closest to a tempo: 76 over a 100 bpm track is 0.75. */
export function speedFor(tempo: number, trackBpm: number): number {
  return snapSpeed(tempo / trackBpm);
}

/** What comes out of the speakers. Not rounded: the clock runs at exactly this. */
export function effectiveTempo(trackBpm: number, speed: number): number {
  return trackBpm * speed;
}

/** One press of `[` or `]`: a step slower or faster, within what the player can do. */
export function stepSpeed(speed: number, steps: number): number {
  return snapSpeed(speed + steps * SPEED_STEP);
}

/** "75%" — the multiplier is what YouTube wants, the percentage is what people read. */
export function speedPercent(speed: number): string {
  return `${Math.round(speed * 100)}%`;
}
