import { useEffect, useRef, useState } from 'react';
import { referenceVideos } from '@/data';
import { usePractice } from '@/store/practice';
import { useVideos } from '@/store/videos';

/** Where the clock is, as the screen reads it each frame. */
export interface RunnerTicks {
  /** Ticks into the phrase: the playhead, and the bar and beat. */
  phraseTick: number;
  /** Ticks played since Play was pressed, across every pass of the run. */
  runTicks: number;
}

const STILL: RunnerTicks = { phraseTick: 0, runTicks: 0 };

/**
 * Where the clock is, for as long as something is moving. Polled rather than
 * pushed: the runner's clock is the source of truth, and reading it on rAF
 * keeps the screen in step without the clock driving React.
 *
 * The runner only emits when something happens to it, so anything that has to
 * count — the playhead, the bar and beat, the progress bar, the transport's
 * clock — reads it from here instead of from the store's snapshot.
 *
 * `active` covers the count-in and the pause as well as playing, so a restart
 * puts the playhead back to the top while it counts you in instead of leaving
 * it where the last pass fell apart, and so a seek shows up while paused. A
 * paused clock does not move, so polling it simply holds everything still.
 */
export function useRunnerTicks(active: boolean): RunnerTicks {
  const [ticks, setTicks] = useState<RunnerTicks>(STILL);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const read = () => {
      const snapshot = usePractice.getState().runner?.snapshot;
      const next = {
        phraseTick: snapshot?.phraseTick ?? 0,
        runTicks: snapshot?.runTicks ?? 0,
      };
      // Same numbers, same object: a paused clock must not re-render every
      // frame for the whole screen that reads this.
      setTicks((previous) =>
        previous.phraseTick === next.phraseTick && previous.runTicks === next.runTicks
          ? previous
          : next,
      );
    };
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
      // Back to a standing start when the run ends: Stop must put the
      // transport's clock back to zero, not leave it where it stopped.
      setTicks(STILL);
    };
  }, [active]);

  return ticks;
}

/** Just the playhead's tick, for the tab. */
export function usePhraseTick(active: boolean): number {
  return useRunnerTicks(active).phraseTick;
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
