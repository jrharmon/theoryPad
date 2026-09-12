import { create } from 'zustand';
import type { PracticeDay, DayKey } from '@/domain/progress';
import { dayEnd, dayKey, dayStart } from '@/domain/progress';
import type { Rep } from '@/data';
import { createRepositories, db } from '@/data';

interface ReportState {
  /** Today as of the last load, so a screen's render stays pure. */
  today: DayKey;
  from: DayKey | null;
  to: DayKey | null;
  reps: Rep[];
  days: PracticeDay[];
  loading: boolean;
  /** The reps and days in a range, by local day, inclusive. */
  load: (from: DayKey, to: DayKey) => Promise<void>;
  /** Refresh `today`, for choosing a default range. */
  touch: () => void;
}

export const useReport = create<ReportState>((set) => ({
  today: dayKey(Date.now()),
  from: null,
  to: null,
  reps: [],
  days: [],
  loading: false,

  async load(from, to) {
    set({ loading: true, from, to });
    const repos = createRepositories(db());
    const [reps, days] = await Promise.all([
      repos.reps.inRange(dayStart(from), dayEnd(to)),
      repos.days.inRange(from, to),
    ]);
    set({ reps, days, loading: false, today: dayKey(Date.now()) });
  },

  touch() {
    set({ today: dayKey(Date.now()) });
  },
}));
