import { useEffect } from 'react';
import { usePractice } from '@/store/practice';

/**
 * The app has to be operable with a guitar in your hands, so the running view
 * is fully keyboard-driven. Registered in one place so they are torn down
 * together and cannot leak between screens.
 */
export function useRunnerHotkeys(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Never steal keys from a field the player is typing in.
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      const practice = usePractice.getState();
      const state = practice.snapshot?.state;
      if (!state || state === 'done') return;

      switch (event.key) {
        case ' ':
          event.preventDefault();
          if (state === 'paused') practice.resume();
          else if (state === 'playing' || state === 'count-in') practice.pause();
          break;
        case 'Enter':
          event.preventDefault();
          if (state === 'brief' || state === 'rep-complete') void practice.play();
          else if (practice.snapshot?.freeTime) practice.completeRep();
          break;
        case '[':
          practice.nudgeTempo(event.shiftKey ? -5 : -1);
          break;
        case ']':
          practice.nudgeTempo(event.shiftKey ? 5 : 1);
          break;
        case 'r':
        case 'R':
          practice.reroll();
          break;
        case 'Escape':
          void practice.end();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
