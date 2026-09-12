import { useEffect } from 'react';
import { usePractice } from '@/store/practice';
import { useSettings } from '@/store/settings';
import { nudgeTabZoom } from './tabZoom';

/**
 * The app has to be operable with a guitar in your hands, so the running view
 * is fully keyboard-driven. Registered in one place so they are torn down
 * together and cannot leak between screens.
 */
export function useRunnerHotkeys({
  onLeave,
  enabled = true,
}: {
  /** Escape leaves the exercise. */
  onLeave: () => void;
  /** Off while a dialog is open, so its keys stay its own. */
  enabled?: boolean;
}): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Never steal keys from a field the player is typing in.
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      // Browser and OS shortcuts — Cmd+[ is back — are not ours.
      if (event.metaKey || event.ctrlKey || event.altKey) return;

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
          if (state === 'brief') void practice.play();
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
        case 'm':
        case 'M':
          void practice.setMetronome(!useSettings.getState().settings.audio.metronomeEnabled);
          break;
        case 'l':
        case 'L':
          void practice.setLoop(!useSettings.getState().settings.audio.loop);
          break;
        // Tab size. `=` and `-` sit together and need no Shift; `+` and `_`
        // are the same keys with it held.
        case '=':
        case '+':
          nudgeTabZoom(1);
          break;
        case '-':
        case '_':
          nudgeTabZoom(-1);
          break;
        case 'Escape':
          onLeave();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onLeave, enabled]);
}
