import type { DayKey } from './types';

/**
 * Calendar days in local time. Built from `new Date(y, m, d)` rather than by
 * adding 86,400,000 ms, so a daylight-saving change never skips or repeats a
 * day.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(ms: number): DayKey {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parts(key: DayKey): [number, number, number] {
  const [y, m, d] = key.split('-').map(Number);
  return [y!, m! - 1, d!];
}

/** Local midnight at the start of the day. */
export function dayStart(key: DayKey): number {
  const [y, m, d] = parts(key);
  return new Date(y, m, d).getTime();
}

/** The last millisecond of the day. */
export function dayEnd(key: DayKey): number {
  return dayStart(addDays(key, 1)) - 1;
}

export function addDays(key: DayKey, days: number): DayKey {
  const [y, m, d] = parts(key);
  return dayKey(new Date(y, m, d + days).getTime());
}

/** Every day from `from` to `to`, inclusive. Empty if `to` is before `from`. */
export function daysBetween(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) out.push(day);
  return out;
}

/** 0 is Monday. Weeks start on Monday throughout. */
export function weekday(key: DayKey): number {
  const [y, m, d] = parts(key);
  return (new Date(y, m, d).getDay() + 6) % 7;
}

export function weekStart(key: DayKey): DayKey {
  return addDays(key, -weekday(key));
}

export function monthStart(key: DayKey): DayKey {
  return `${key.slice(0, 7)}-01`;
}

export type RangePreset = 'last-7' | 'last-30' | 'this-month';

/** A report range by name, ending today. */
export function presetRange(preset: RangePreset, today: DayKey): { from: DayKey; to: DayKey } {
  switch (preset) {
    case 'last-7':
      return { from: addDays(today, -6), to: today };
    case 'last-30':
      return { from: addDays(today, -29), to: today };
    case 'this-month':
      return { from: monthStart(today), to: today };
  }
}
