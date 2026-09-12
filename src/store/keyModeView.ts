import { create } from 'zustand';

interface KeyModeViewState {
  /** The compact reference beside a running exercise. */
  popover: boolean;
  /** The full drawer. */
  sheet: boolean;
  /** A trigger is on screen, so `K` has something to open. */
  available: boolean;
  setAvailable: (available: boolean) => void;
  setPopover: (open: boolean) => void;
  setSheet: (open: boolean) => void;
  togglePopover: () => void;
}

/**
 * Whether the practice screen's key/mode reference is open. Shared so `K` can
 * toggle it and the transport's keys stand aside while it is up — Escape
 * closes the reference, it must not also leave the exercise.
 */
export const useKeyModeView = create<KeyModeViewState>((set) => ({
  popover: false,
  sheet: false,
  available: false,
  // Leaving the screen closes the reference, so it is not waiting on return.
  setAvailable: (available) => set(available ? { available } : { available, popover: false, sheet: false }),
  setPopover: (popover) => set({ popover }),
  setSheet: (sheet) => set(sheet ? { sheet, popover: false } : { sheet }),
  togglePopover: () => set((s) => (s.available ? { popover: !s.popover } : {})),
}));
