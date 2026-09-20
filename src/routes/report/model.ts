import type { Exercise, Rep } from '@/data';
import type { DayKey, PracticeDay, ReportSummary } from '@/domain/progress';
import {
  dayStart,
  exerciseLog,
  formatPracticeTime,
  reportSummary,
  timeByDay,
} from '@/domain/progress';
import { findExerciseDefinition } from '@/exercises/registry';

/** One line of the table, ready to show — the screen and the exported file share it. */
export interface ReportRow {
  exerciseId: string;
  name: string;
  theory: boolean;
  played: number;
  seconds: number;
  tempos: { low: number; high: number } | null;
  target: number | null;
  score: { correct: number; total: number } | null;
}

export interface Report {
  from: DayKey;
  to: DayKey;
  summary: ReportSummary;
  days: { date: DayKey; seconds: number }[];
  rows: ReportRow[];
}

export function buildReport(input: {
  from: DayKey;
  to: DayKey;
  reps: readonly Rep[];
  days: readonly PracticeDay[];
  exercises: readonly Exercise[];
}): Report {
  const { from, to, reps, days, exercises } = input;
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const rows = exerciseLog(reps).map((line): ReportRow => {
    const definition = findExerciseDefinition(line.definitionId);
    const exercise = byId.get(line.exerciseId);
    return {
      exerciseId: line.exerciseId,
      name: definition?.name ?? line.definitionId,
      theory: definition?.kind === 'theory',
      played: line.played,
      seconds: line.seconds,
      tempos: line.tempos,
      target: exercise?.tempo.targetTempo ?? null,
      score: line.score,
    };
  });
  return { from, to, summary: reportSummary(reps), days: timeByDay(days, from, to), rows };
}

export type SortColumn = 'name' | 'played' | 'tempos' | 'target' | 'time';

function sortValue(row: ReportRow, column: SortColumn): number | string {
  switch (column) {
    case 'name':
      return row.name.toLowerCase();
    case 'played':
      return row.played;
    case 'tempos':
      // Theory rows sort by score, below every tempo.
      return row.tempos
        ? row.tempos.high
        : row.score
          ? row.score.correct / row.score.total - 1
          : -2;
    case 'target':
      return row.target ?? -1;
    case 'time':
      return row.seconds;
  }
}

export function sortRows(
  rows: readonly ReportRow[],
  column: SortColumn,
  descending: boolean,
): ReportRow[] {
  return [...rows].sort((a, b) => {
    const x = sortValue(a, column);
    const y = sortValue(b, column);
    const order = x < y ? -1 : x > y ? 1 : a.name.localeCompare(b.name);
    return descending ? -order : order;
  });
}

// ---------------------------------------------------------------- display

export function formatTempos(row: ReportRow): string {
  if (row.score) {
    const percent = Math.round((100 * row.score.correct) / Math.max(1, row.score.total));
    return `${row.score.correct}/${row.score.total} · ${percent}%`;
  }
  if (!row.tempos) return '—';
  return row.tempos.low === row.tempos.high
    ? `${row.tempos.low}`
    : `${row.tempos.low}–${row.tempos.high}`;
}

export function formatRange(from: DayKey, to: DayKey): string {
  const day = (key: DayKey, year: boolean) =>
    new Date(dayStart(key)).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(year ? { year: 'numeric' } : {}),
    });
  if (from === to) return day(from, true);
  return `${day(from, from.slice(0, 4) !== to.slice(0, 4))} – ${day(to, true)}`;
}

export function summaryLine(summary: ReportSummary): string {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return [
    plural(summary.sessions, 'session'),
    formatPracticeTime(summary.seconds),
    plural(summary.variations, 'variation'),
    plural(summary.exercises, 'exercise'),
  ].join(' · ');
}
