import { useEffect, useRef, useState } from 'react';
import { referenceVideos } from '@/data';
import { usePractice } from '@/store/practice';
import { useVideos } from '@/store/videos';

/**
 * Ticks into the phrase, for as long as there is a playhead to draw. Polled
 * rather than pushed: the runner's clock is the source of truth, and reading it
 * on rAF keeps the screen in step without the clock driving React.
 *
 * `active` covers the count-in and the pause as well as playing, so a restart
 * puts the playhead back to the top while it counts you in instead of leaving
 * it where the last pass fell apart, and so a seek shows up while paused. A
 * paused clock does not move, so polling it simply holds the playhead still.
 */
export function usePhraseTick(active: boolean): number {
  const [tick, setTick] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const read = () => setTick(usePractice.getState().runner?.snapshot.phraseTick ?? 0);
    // Straight away as well as on the next frame: a restart must not show the
    // old position for even one frame.
    read();
    const step = () => {
      read();
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [active]);

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
