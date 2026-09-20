/**
 * Telling a pre-roll advert apart from a browser that will not start a video.
 *
 * Measured on the deployed site (2026-09-20, `WkIijba-HcU`, youtube-nocookie):
 * through 31.4 s of unskippable pre-roll the IFrame player reports state
 * `unstarted` and fires no state events at all, and `getDuration()` stays on
 * the track's own length throughout — so neither is any use. The one thing
 * that moves is `getCurrentTime()`, which leaves the seek target, runs the
 * advert's own clock up from zero, and snaps back to the target when the track
 * finally starts.
 *
 * So: something is playing when the reported time moves, and only the track
 * ever reports `playing`. A browser holding the video back moves nothing at
 * all — which is the whole distinction, and the reason a fixed deadline could
 * never draw it.
 */

/** One reading of the video, taken by whoever is polling it. */
export interface PlaybackSample {
  atMs: number;
  /** The player's state, by number. Only ever compared, never interpreted. */
  state: number;
  currentTime: number;
}

export type StartVerdict =
  /** Too early to say, or nothing has changed. */
  | 'waiting'
  /** Something is playing, but it is not the track: an advert. */
  | 'advert'
  /** Nothing has moved at all: the browser wants a click on the video. */
  | 'stalled';

/** The time may sit on the seek target this long before anything is read into it. */
const GRACE_MS = 1_500;
/** Nothing moving for this long after the grace: the browser is holding it back. */
const STALL_MS = 2_500;
/** Below this, a difference in reported time is jitter rather than progress. */
const PROGRESS_EPS_SEC = 0.05;
/** An advert's clock runs up from zero, so it reads well short of the seek target. */
const AD_TIME_TOLERANCE_SEC = 3;

/**
 * Is this reported time the track's, rather than an advert's?
 *
 * Only ever says no when the time is clearly *behind* where the video was sent
 * — an advert counting up from zero under a seek target further in. It cannot
 * draw the line at all when the track starts at zero, because then the
 * advert's clock and the track's read the same; there it says yes, which is
 * what the player did before this existed. Wrong in that direction only
 * delays; the other way round would hang the exercise.
 */
export function isTrackTime(currentTime: number, requestedSec: number): boolean {
  return currentTime >= requestedSec - AD_TIME_TOLERANCE_SEC;
}

/**
 * Watches a video that has been told to play and has not said `playing` yet.
 *
 * Fed a reading at a time, it answers what that silence means. Once the time
 * has moved even once, it never reports `stalled` again: autoplay is an
 * all-or-nothing gate at the start, so something that has begun playing was
 * plainly not blocked — which keeps the gap between two back-to-back adverts
 * from reading as one.
 */
export class StartWatch {
  private readonly startedAtMs: number;
  private lastState: number | null = null;
  private lastTime = 0;
  private lastProgressAtMs: number;
  private timeHasMoved = false;

  constructor(startedAtMs: number) {
    this.startedAtMs = startedAtMs;
    // The stall window runs from the end of the grace, not from the play.
    this.lastProgressAtMs = startedAtMs + GRACE_MS;
  }

  observe(sample: PlaybackSample): StartVerdict {
    if (this.lastState === null) {
      this.lastState = sample.state;
      this.lastTime = sample.currentTime;
      return 'waiting';
    }
    // A state change means the player is doing something, so it holds off the
    // stall — but only the time moving means something is actually playing.
    const timeMoved = Math.abs(sample.currentTime - this.lastTime) > PROGRESS_EPS_SEC;
    if (timeMoved) this.timeHasMoved = true;
    if (timeMoved || sample.state !== this.lastState) this.lastProgressAtMs = sample.atMs;
    this.lastState = sample.state;
    this.lastTime = sample.currentTime;

    if (sample.atMs - this.startedAtMs < GRACE_MS) return 'waiting';
    if (this.timeHasMoved) return 'advert';
    if (sample.atMs - this.lastProgressAtMs >= STALL_MS) return 'stalled';
    return 'waiting';
  }
}
