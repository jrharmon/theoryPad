import type { Clock } from '@/domain/time';
import type { TrackAlignment, TrackTiming } from '@/domain/backing';
import { followFactor, loopEndSec, tickAtVideoTime } from '@/domain/backing';

/** What the follower needs from a video: where it is, and a way to jump. */
export interface VideoTimeline {
  readonly currentTime: number;
  /** True while the video is stalled waiting for data. */
  readonly buffering: boolean;
  seekTo(seconds: number): void;
}

/** Often enough that a correction is never more than a frame or two late. */
const INTERVAL_MS = 40;
/** A backwards jump bigger than this is the loop landing, not jitter. */
const JUMP_SEC = 1;

/**
 * Keeps the clock with a playing video.
 *
 * The video is the truth: it can only be sped up or slowed in 5% steps, the
 * clock by any amount. Several times a second this reads where the video is,
 * works out the tick that corresponds to, and runs the clock a little fast or
 * slow to close the gap. The clock never jumps, because a jump could step over
 * the end of a pass. It also loops the video on a bar line, and holds the
 * clock while the video buffers.
 *
 * The clock can also be moved deliberately — the player clicks a note in the
 * tab while a track plays. The video cannot follow it there, so `reanchor`
 * records how far apart the two now are and the follower keeps them that far
 * apart, still correcting the drift that is its job.
 */
export class TrackFollower {
  private loops = 0;
  private lastTime: number | null = null;
  private loopRequested = false;
  private heldForBuffering = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly clock: Clock;
  private readonly video: VideoTimeline;
  private readonly track: TrackTiming;
  private readonly alignment: TrackAlignment;
  /** The tempo the clock runs at when on time: the track's bpm times its speed. */
  private tempo: number;
  /** Ticks the clock is deliberately behind the video, from a seek. */
  private offset = 0;

  constructor(
    clock: Clock,
    video: VideoTimeline,
    track: TrackTiming,
    alignment: TrackAlignment,
    tempo: number,
  ) {
    this.clock = clock;
    this.video = video;
    this.track = track;
    this.alignment = alignment;
    this.tempo = tempo;
  }

  /** A new speed: the clock's resting tempo moves with it. */
  setTempo(tempo: number): void {
    this.tempo = tempo;
  }

  /**
   * Take where the clock is now as where it belongs. The track plays on from
   * where it is; the exercise carries on from where it was put.
   */
  reanchor(): void {
    this.offset = this.videoTick() - this.clock.ticks;
  }

  start(): void {
    this.timer ??= setInterval(() => this.update(), INTERVAL_MS);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.lastTime = null;
  }

  /** One correction. Public so tests can step it. */
  update(): void {
    if (this.video.buffering) {
      if (this.clock.state === 'started') {
        this.clock.pause();
        this.heldForBuffering = true;
      }
      return;
    }
    if (this.heldForBuffering) {
      this.heldForBuffering = false;
      this.clock.start();
    }
    if (this.clock.state !== 'started') return;

    const time = this.video.currentTime;
    if (this.lastTime !== null && time < this.lastTime - JUMP_SEC) {
      this.loops += 1;
      this.loopRequested = false;
    }
    this.lastTime = time;

    const end = loopEndSec(this.track, this.alignment);
    if (end !== null && time >= end && !this.loopRequested) {
      this.loopRequested = true;
      this.video.seekTo(this.track.startSec);
    }

    this.clock.setBpm(
      this.tempo *
        followFactor(this.clock.ticks, this.videoTick() - this.offset, this.clock.bpm),
    );
  }

  /** Where the video is, as a tick on the clock's timeline. */
  private videoTick(): number {
    return tickAtVideoTime(this.track, this.alignment, this.video.currentTime, this.loops);
  }
}
