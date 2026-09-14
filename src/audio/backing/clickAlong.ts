import type { TrackTiming } from '@/domain/backing';
import { alignTrack } from '@/domain/backing';
import { PPQ } from '@/domain/phrase';
import type { AudioEngine } from '../AudioEngine';
import { TrackFollower } from './TrackFollower';
import { YT_STATE, type YouTubePlayer } from './YouTubePlayer';

/**
 * Play a video with the metronome following it, from a bar before bar 1 — the
 * check that bar 1 and the bpm are right. If they are, the accent lands on the
 * track's downbeat and stays there. Returns how to stop it.
 */
export async function clickAlong(
  engine: AudioEngine,
  player: YouTubePlayer,
  track: TrackTiming,
): Promise<() => void> {
  await engine.init();
  const { clock, metronome } = engine;
  const bar = track.beatsPerBar * PPQ;
  metronome.stop();
  clock.stop();
  clock.seek(0);
  clock.setBpm(track.bpm);
  engine.configureMetronome({ timeSignature: { beats: track.beatsPerBar, unit: 4 }, countInBars: 0 });
  metronome.setMuted(false);
  metronome.setSilenced(false);

  const duration = player.duration;
  const alignment = alignTrack(track, bar, duration > 0 ? duration : undefined);
  player.setRate(1);
  await player.playFrom(alignment.playFromSec);
  metronome.start();
  clock.start();
  const follower = new TrackFollower(
    clock,
    {
      get currentTime() {
        return player.currentTime;
      },
      get buffering() {
        return player.state === YT_STATE.buffering;
      },
      seekTo: (seconds) => player.seekTo(seconds),
    },
    track,
    alignment,
    track.bpm,
  );
  follower.start();

  return () => {
    follower.stop();
    metronome.stop();
    clock.stop();
    player.pause();
  };
}
