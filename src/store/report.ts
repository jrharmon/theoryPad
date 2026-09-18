import { create } from 'zustand';
import type { PracticeDay, DayKey } from '@/domain/progress';
import { dayEnd, dayKey, dayStart } from '@/domain/progress';
import type { Rep, Session } from '@/data';
import { repos } from '@/data';

interface ReportState {
  /** Today as of the last load, so a screen's render stays pure. */
  today: DayKey;
  from: DayKey | null;
  to: DayKey | null;
  reps: Rep[];
  days: PracticeDay[];
  /** The sessions those reps belong to, for the routine each was part of. */
  sessions: Session[];
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
  sessions: [],
  loading: false,

  async load(from, to) {
    set({ loading: true, from, to });
    const [reps, days, sessions] = await Promise.all([
      repos().reps.inRange(dayStart(from), dayEnd(to)),
      repos().days.inRange(from, to),
      // A session can start the evening before its first rep in range.
      repos().sessions.inRange(dayStart(from) - 24 * 60 * 60 * 1000, dayEnd(to)),
    ]);
    set({ reps, days, sessions, loading: false, today: dayKey(Date.now()) });
  },

  touch() {
    set({ today: dayKey(Date.now()) });
  },
}));
