import { useEffect, useRef, useState } from 'react';
import type { YouTubePlayer } from '@/audio/backing';

/**
 * A player for one video, made when the id is known and destroyed when it
 * changes or the component goes. YouTube's script loads on the first one.
 */
export function useYouTubePlayer(videoId: string | null, startSec?: number) {
  const [state, setState] = useState<{ player: YouTubePlayer | null; error: string | null }>({
    player: null,
    error: null,
  });
  // The start is only where the player first cues; changing it later must not
  // rebuild the player.
  const start = useRef(startSec);

  useEffect(() => {
    if (!videoId) return;
    let player: YouTubePlayer | null = null;
    let cancelled = false;
    void import('@/audio/backing').then(({ YouTubePlayer }) => {
      if (cancelled) return;
      player = new YouTubePlayer(videoId, { startSec: start.current ?? 0 });
      setState({ player, error: null });
      player.ready.catch((e: unknown) => {
        if (!cancelled) setState({ player: null, error: (e as Error).message });
      });
    });
    return () => {
      cancelled = true;
      player?.destroy();
      setState({ player: null, error: null });
    };
  }, [videoId]);

  return state;
}
