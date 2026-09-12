import { create } from 'zustand';
import type { DayKey, PracticeDay } from '@/domain/progress';
import { dayKey } from '@/domain/progress';
import { createRepositories, db } from '@/data';

interface ProgressState {
  /** Every day with practice logged, oldest first. */
  days: PracticeDay[];
  /** Today as of the last load, so a screen's render stays pure. */
  today: DayKey;
  loaded: boolean;
  /** Read afresh each time: passes are logged as they end, anywhere in the app. */
  load: () => Promise<void>;
}

export const useProgress = create<ProgressState>((set) => ({
  days: [],
  today: dayKey(Date.now()),
  loaded: false,
  async load() {
    const days = await createRepositories(db()).days.all();
    set({ days, today: dayKey(Date.now()), loaded: true });
  },
}));
