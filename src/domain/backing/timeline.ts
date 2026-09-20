import { PPQ } from '../phrase';

/**
 * Lining the clock up with a recording.
 *
 * The clock follows the video, not the other way round: the video can only be
 * nudged in 5% steps, the clock by any amount. Everything here is in the
 * video's own seconds, which is what makes it independent of the speed — a bar
 * of a 100 bpm track is 2.4 video seconds at any playback rate.
 */

export interface TrackTiming {
  /** Where bar 1 begins, in video seconds. */
  startSec: number;
  bpm: number;
  beatsPerBar: number;
  /** Where to loop back from. Absent until the video's length is known. */
  endSec?: number;
}

export interface TrackAlignment {
  /** The clock tick at which the track's bar 1 sounds. */
  bar1Tick: number;
  /** Where to start the video, so the count-in plays over the end of the intro. */
  playFromSec: number;
  /** Whole bars from bar 1 to the last bar line at or before the end. Null: no loop. */
  loopBars: number | null;
}

const secondsPerTick = (bpm: number) => 60 / (bpm * PPQ);

/**
 * Where the clock and the video meet. The count-in is the bar before bar 1 in
 * the recording — the tail of the intro — so the tab starts on bar 1. With too
 * little intro for that, the track's own first bar is the count-in.
 */
export function alignTrack(
  track: TrackTiming,
  countInTicks: number,
  durationSec?: number,
): TrackAlignment {
  const leadSec = countInTicks * secondsPerTick(track.bpm);
  const room = track.startSec >= leadSec - 1e-9;
  const endSec = track.endSec ?? durationSec;
  const barSec = (track.beatsPerBar * 60) / track.bpm;
  const loopBars =
    endSec === undefined ? null : Math.floor((endSec - track.startSec) / barSec + 1e-9);
  return {
    bar1Tick: room ? countInTicks : 0,
    playFromSec: room ? track.startSec - leadSec : track.startSec,
    loopBars: loopBars !== null && loopBars >= 1 ? loopBars : null,
  };
}

/** The video second at which a loop jumps back to bar 1: a bar line, never mid-bar. */
export function loopEndSec(track: TrackTiming, alignment: TrackAlignment): number | null {
  if (alignment.loopBars === null) return null;
  return track.startSec + (alignment.loopBars * track.beatsPerBar * 60) / track.bpm;
}

/**
 * The clock tick the video is at. `loops` counts jumps back to bar 1 so far,
 * which keeps the tick climbing through a loop instead of jumping back with it.
 */
export function tickAtVideoTime(
  track: TrackTiming,
  alignment: TrackAlignment,
  videoSec: number,
  loops = 0,
): number {
  const loopTicks = (alignment.loopBars ?? 0) * track.beatsPerBar * PPQ;
  return (
    alignment.bar1Tick +
    loops * loopTicks +
    (videoSec - track.startSec) / secondsPerTick(track.bpm)
  );
}

/** Past this, the clock is nudged toward the video; within it, left alone. */
export const FOLLOW_DEADBAND_SEC = 0.008;
/** How far the clock may run fast or slow to catch up. Nothing audible rides on it. */
export const FOLLOW_MAX_NUDGE = 0.15;
/** Fraction of the gap closed per second: a half-second time constant, so YouTube's
 * start delay is gone well inside a count-in bar. */
const FOLLOW_GAIN = 2;

/**
 * How much faster (above 1) or slower the clock should run to close its gap to
 * the video. The clock never jumps: a jump could step over a pass's end.
 */
export function followFactor(clockTick: number, videoTick: number, clockBpm: number): number {
  const gapSec = (videoTick - clockTick) * secondsPerTick(clockBpm);
  if (Math.abs(gapSec) < FOLLOW_DEADBAND_SEC) return 1;
  return 1 + Math.min(FOLLOW_MAX_NUDGE, Math.max(-FOLLOW_MAX_NUDGE, gapSec * FOLLOW_GAIN));
}
