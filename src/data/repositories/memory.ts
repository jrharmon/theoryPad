import type { PracticeDay } from '@/domain/progress';
import { applyRepToDay, dayKey, emptyDay, rollupDays } from '@/domain/progress';
import type { Exercise, ExerciseStats, Rep, Routine, Session, Settings } from '../entities';
import { newId } from '../ids';
import { applyRep, emptyStats, rebuildStats } from '../stats';
import { defaultSettings } from './dexie';
import type { NewExercise, NewRep, NewRoutine, NewSession, Repositories } from './types';

/**
 * An in-memory implementation of the same interfaces.
 *
 * Domain and store tests use this rather than IndexedDB, which is slow and
 * awkward in jsdom. Only the Dexie repositories' own tests touch a real
 * database — which is exactly why the repository layer exists.
 */
export function createMemoryRepositories(now = () => Date.now()): Repositories {
  const exercises = new Map<string, Exercise>();
  const routines = new Map<string, Routine>();
  const sessions = new Map<string, Session>();
  const reps = new Map<string, Rep>();
  const stats = new Map<string, ExerciseStats>();
  const days = new Map<string, PracticeDay>();
  let settings: Settings | null = null;

  const stamp = () => now();
  const live = <T extends { deletedAt?: number }>(rows: T[]) =>
    rows.filter((row) => row.deletedAt === undefined);

  return {
    exercises: {
      add(exercise: NewExercise) {
        const at = stamp();
        const row: Exercise = { ...exercise, id: newId(), createdAt: at, updatedAt: at };
        exercises.set(row.id, row);
        return Promise.resolve(row);
      },
      byId(id) {
        const row = exercises.get(id);
        return Promise.resolve(row?.deletedAt === undefined ? row : undefined);
      },
      all: () => Promise.resolve(live([...exercises.values()])),
      byDefinition: (definitionId) =>
        Promise.resolve(live([...exercises.values()]).filter((e) => e.definitionId === definitionId)),
      update(id, changes) {
        const existing = exercises.get(id);
        if (!existing) return Promise.reject(new Error(`No exercise ${id}`));
        const row: Exercise = { ...existing, ...changes, updatedAt: stamp() };
        exercises.set(id, row);
        return Promise.resolve(row);
      },
      softDelete(id) {
        const existing = exercises.get(id);
        if (existing) exercises.set(id, { ...existing, deletedAt: stamp(), updatedAt: stamp() });
        return Promise.resolve();
      },
    },

    routines: {
      add(routine: NewRoutine) {
        const at = stamp();
        const row: Routine = { ...routine, id: newId(), createdAt: at, updatedAt: at };
        routines.set(row.id, row);
        return Promise.resolve(row);
      },
      byId(id) {
        const row = routines.get(id);
        return Promise.resolve(row?.deletedAt === undefined ? row : undefined);
      },
      all: () => Promise.resolve(live([...routines.values()])),
      update(id, changes) {
        const existing = routines.get(id);
        if (!existing) return Promise.reject(new Error(`No routine ${id}`));
        const row: Routine = { ...existing, ...changes, updatedAt: stamp() };
        routines.set(id, row);
        return Promise.resolve(row);
      },
      softDelete(id) {
        const existing = routines.get(id);
        if (existing) routines.set(id, { ...existing, deletedAt: stamp(), updatedAt: stamp() });
        return Promise.resolve();
      },
    },

    sessions: {
      add(session: NewSession) {
        const at = stamp();
        const row: Session = { ...session, id: newId(), createdAt: at, updatedAt: at };
        sessions.set(row.id, row);
        return Promise.resolve(row);
      },
      byId: (id) => Promise.resolve(sessions.get(id)),
      end(id, endedAt) {
        const existing = sessions.get(id);
        if (!existing) return Promise.reject(new Error(`No session ${id}`));
        const row: Session = { ...existing, endedAt, updatedAt: stamp() };
        sessions.set(id, row);
        return Promise.resolve(row);
      },
      inRange: (fromMs, toMs) =>
        Promise.resolve(
          [...sessions.values()].filter((s) => s.startedAt >= fromMs && s.startedAt <= toMs),
        ),
      recent: (limit = 20) =>
        Promise.resolve(
          [...sessions.values()].sort((a, b) => b.startedAt - a.startedAt).slice(0, limit),
        ),
    },

    reps: {
      add(rep: NewRep) {
        const at = stamp();
        const row: Rep = { ...rep, id: newId(), createdAt: at, updatedAt: at };
        reps.set(row.id, row);
        const current = stats.get(row.exerciseId) ?? emptyStats(row.exerciseId, row.definitionId);
        stats.set(row.exerciseId, applyRep(current, row));
        const date = dayKey(row.startedAt);
        days.set(date, applyRepToDay(days.get(date) ?? emptyDay(date), row));
        return Promise.resolve(row);
      },
      byId: (id) => Promise.resolve(reps.get(id)),
      bySession: (sessionId) =>
        Promise.resolve([...reps.values()].filter((r) => r.sessionId === sessionId)),
      byExercise: (exerciseId, limit) => {
        const found = [...reps.values()]
          .filter((r) => r.exerciseId === exerciseId)
          .sort((a, b) => b.startedAt - a.startedAt);
        return Promise.resolve(limit === undefined ? found : found.slice(0, limit));
      },
      inRange: (fromMs, toMs) =>
        Promise.resolve(
          [...reps.values()].filter((r) => r.startedAt >= fromMs && r.startedAt <= toMs),
        ),
      count: () => Promise.resolve(reps.size),
    },

    stats: {
      byExercise: (exerciseId) => Promise.resolve(stats.get(exerciseId)),
      all: () => Promise.resolve([...stats.values()]),
      rebuild() {
        stats.clear();
        for (const entry of rebuildStats([...reps.values()])) stats.set(entry.exerciseId, entry);
        days.clear();
        for (const day of rollupDays([...reps.values()])) days.set(day.date, day);
        return Promise.resolve();
      },
    },

    days: {
      all: () =>
        Promise.resolve([...days.values()].sort((a, b) => (a.date < b.date ? -1 : 1))),
      inRange: (from, to) =>
        Promise.resolve(
          [...days.values()]
            .filter((d) => d.date >= from && d.date <= to)
            .sort((a, b) => (a.date < b.date ? -1 : 1)),
        ),
    },

    settings: {
      get() {
        settings ??= defaultSettings(stamp());
        return Promise.resolve(settings);
      },
      save(next) {
        settings = { ...next, key: 'settings', updatedAt: stamp() };
        return Promise.resolve(settings);
      },
    },
  };
}
