import type { Clock } from '@/domain/time';
import type { TrackTiming } from '@/domain/backing';
import type { TrackAlignment } from '@/domain/backing';
import { SPEED_MAX, SPEED_MIN, SPEED_STEP, alignTrack, effectiveTempo } from '@/domain/backing';
import { TrackFollower } from './TrackFollower';
import { YT_STATE, YouTubePlayer, type PlayOptions } from './YouTubePlayer';
import type { BackingSource } from './types';

export interface VideoTrack extends TrackTiming {
  videoId: string;
}

/**
 * A YouTube backing track, kept in time with the clock.
 *
 * The caller starts the video first, then the clock: `start` settles once
 * sound is coming out, with the video a count-in ahead of bar 1, and from then
 * on the follower keeps the clock with it — through pauses, speed changes and
 * loops.
 */
export class VideoBacking implements BackingSource {
  readonly kind = 'video';
  readonly rates = { min: SPEED_MIN, max: SPEED_MAX, step: SPEED_STEP };
  readonly player: YouTubePlayer;

  private follower: TrackFollower | null = null;
  private speed = 1;
  private readonly track: VideoTrack;
  private readonly clock: Clock;

  constructor(track: VideoTrack, clock: Clock) {
    this.track = track;
    this.clock = clock;
    this.player = new YouTubePlayer(track.videoId, { startSec: track.startSec });
  }

  get effectiveBpm(): number {
    return effectiveTempo(this.track.bpm, this.speed);
  }

  load(): Promise<void> {
    return this.player.ready;
  }

  /** Loaded, the play goes out before this returns — inside the click, where browsers want it. */
  start(countInTicks: number, options: PlayOptions = {}): Promise<void> {
    this.follower?.stop();
    if (!this.player.isReady)
      return this.player.ready.then(() => this.start(countInTicks, options));
    const duration = this.player.duration;
    const alignment = alignTrack(this.track, countInTicks, duration > 0 ? duration : undefined);
    this.player.setRate(this.speed);
    return this.player
      .playFrom(alignment.playFromSec, options)
      .then(() => this.follow(alignment));
  }

  private follow(alignment: TrackAlignment): void {
    const player = this.player;
    this.follower = new TrackFollower(
      this.clock,
      {
        get currentTime() {
          return player.currentTime;
        },
        get buffering() {
          return player.state === YT_STATE.buffering;
        },
        seekTo: (seconds) => player.seekTo(seconds),
      },
      this.track,
      alignment,
      this.effectiveBpm,
    );
    this.follower.start();
  }

  /** The clock was moved under the track; hold it where it was put. */
  reanchor(): void {
    this.follower?.reanchor();
  }

  pause(): void {
    this.follower?.stop();
    this.player.pause();
  }

  async resume(options: PlayOptions = {}): Promise<void> {
    await this.player.resume(options);
    this.follower?.start();
  }

  stop(): void {
    this.follower?.stop();
    this.follower = null;
    this.player.pause();
  }

  setRate(speed: number): void {
    this.speed = speed;
    this.player.setRate(speed);
    this.follower?.setTempo(this.effectiveBpm);
  }

  dispose(): void {
    this.stop();
    this.player.destroy();
  }
}
