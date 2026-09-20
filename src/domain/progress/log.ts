import { repSeconds } from './rollup';
import type { LoggedRep } from './types';

/** One exercise's line in the report. Target tempo is the caller's to join in. */
export interface ExerciseLogRow {
  exerciseId: string;
  definitionId: string;
  /** Finished passes and sets. */
  played: number;
  /** Every pass, finished or not. */
  seconds: number;
  /** Lowest and highest tempo actually played, finished metered passes only. */
  tempos: { low: number; high: number } | null;
  /** Theory: every question in the range. */
  score: { correct: number; total: number } | null;
  lastPlayedAt: number;
}

/** A line per exercise, most time first. Routine passes count toward their source exercise. */
export function exerciseLog(reps: readonly LoggedRep[]): ExerciseLogRow[] {
  const rows = new Map<string, ExerciseLogRow>();
  for (const rep of reps) {
    const row: ExerciseLogRow = rows.get(rep.exerciseId) ?? {
      exerciseId: rep.exerciseId,
      definitionId: rep.definitionId,
      played: 0,
      seconds: 0,
      tempos: null,
      score: null,
      lastPlayedAt: rep.startedAt,
    };
    row.seconds += repSeconds(rep);
    row.lastPlayedAt = Math.max(row.lastPlayedAt, rep.startedAt);
    if (rep.score) {
      row.score = {
        correct: (row.score?.correct ?? 0) + rep.score.correct,
        total: (row.score?.total ?? 0) + rep.score.total,
      };
    }
    if (rep.status === 'completed') {
      row.played += 1;
      if (!rep.freeTime && rep.tempo !== null) {
        row.tempos = {
          low: Math.min(row.tempos?.low ?? rep.tempo, rep.tempo),
          high: Math.max(row.tempos?.high ?? rep.tempo, rep.tempo),
        };
      }
    }
    rows.set(rep.exerciseId, row);
  }
  return [...rows.values()].sort((a, b) => b.seconds - a.seconds);
}

export interface ReportSummary {
  /** Sessions with anything logged — opening an exercise alone doesn't count. */
  sessions: number;
  seconds: number;
  /** Distinct rolls finished at least once. */
  variations: number;
  exercises: number;
}

export function reportSummary(reps: readonly LoggedRep[]): ReportSummary {
  const sessions = new Set<string>();
  const variations = new Set<string>();
  const exercises = new Set<string>();
  let seconds = 0;
  for (const rep of reps) {
    sessions.add(rep.sessionId);
    exercises.add(rep.exerciseId);
    seconds += repSeconds(rep);
    if (rep.status === 'completed') variations.add(`${rep.exerciseId}:${rep.seed}`);
  }
  return {
    sessions: sessions.size,
    seconds,
    variations: variations.size,
    exercises: exercises.size,
  };
}

/** Tempos of an exercise's finished metered passes, oldest first. */
export function tempoHistory(
  reps: readonly LoggedRep[],
  exerciseId: string,
): { at: number; tempo: number }[] {
  return reps
    .filter((r) => r.exerciseId === exerciseId && r.status === 'completed' && !r.freeTime)
    .flatMap((r) => (r.tempo === null ? [] : [{ at: r.startedAt, tempo: r.tempo }]))
    .sort((a, b) => a.at - b.at);
}

/** Practice time the way the report writes it: "2h 41m", "34m", "<1m". */
export function formatPracticeTime(seconds: number): string {
  if (seconds <= 0) return '0m';
  if (seconds < 60) return '<1m';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}
