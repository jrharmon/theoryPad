import { useEffect, useRef, useState } from 'react';
import { referenceVideos } from '@/data';
import { usePractice } from '@/store/practice';
import { useVideos } from '@/store/videos';

/**
 * Ticks into the phrase while playing. Polled rather than pushed: the runner's
 * clock is the source of truth, and reading it on rAF keeps the screen in step
 * without the clock driving React. Held where it stopped when paused.
 */
export function usePhraseTick(playing: boolean): number {
  const [tick, setTick] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    const step = () => {
      setTick(usePractice.getState().runner?.snapshot.phraseTick ?? 0);
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [playing]);

  return tick;
}

/**
 * Whether a video needs the right-hand column: a backing track (YouTube's
 * player must stay visible) or this exercise's reference videos.
 */
export function useVideoColumn(): boolean {
  const hasTrack = usePractice(
    (s) => s.backing.resolved.kind === 'video' || s.backing.error !== null,
  );
  const exerciseId = usePractice((s) => s.exerciseId);
  const lessons = useVideos((s) =>
    exerciseId ? referenceVideos(s.videos, exerciseId).length : 0,
  );
  return hasTrack || lessons > 0;
}
