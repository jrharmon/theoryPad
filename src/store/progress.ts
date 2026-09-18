import { create } from 'zustand';
import type { KeyMode } from '@/domain/music';
import type { DayKey, PracticeDay } from '@/domain/progress';
import { dayKey, lastKeyMode } from '@/domain/progress';
import { repos } from '@/data';

interface ProgressState {
  /** Every day with practice logged, oldest first. */
  days: PracticeDay[];
  /** Today as of the last load, so a screen's render stays pure. */
  today: DayKey;
  /** The key and mode of the last pass that had both, in the last 30 days. */
  lastKeyMode: KeyMode | null;
  loaded: boolean;
  /** Read afresh each time: passes are logged as they end, anywhere in the app. */
  load: () => Promise<void>;
}

export const useProgress = create<ProgressState>((set) => ({
  days: [],
  today: dayKey(Date.now()),
  lastKeyMode: null,
  loaded: false,
  async load() {
    const now = Date.now();
    const [days, recent] = await Promise.all([
      repos().days.all(),
      repos().reps.inRange(now - 30 * 24 * 60 * 60 * 1000, now),
    ]);
    set({ days, today: dayKey(now), lastKeyMode: lastKeyMode(recent), loaded: true });
  },
}));
