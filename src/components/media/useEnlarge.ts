import { useEffect, useState } from 'react';

/**
 * Enlarging a video: its panel is restyled in place, over a scrim, because
 * moving an iframe in the page reloads it. Escape shrinks it again — and stops
 * there, so it never also leaves the exercise.
 */
export function useEnlarge() {
  const [enlarged, setEnlarged] = useState(false);

  useEffect(() => {
    if (!enlarged) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setEnlarged(false);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [enlarged]);

  return [enlarged, setEnlarged] as const;
}

/** The panel's classes while enlarged: centered, as big as the screen allows at 16:9. */
export const ENLARGED =
  'fixed top-1/2 left-1/2 z-40 w-[min(92vw,calc(78vh*16/9))] -translate-x-1/2 -translate-y-1/2';
