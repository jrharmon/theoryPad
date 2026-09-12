import type { Exercise, ExerciseStats, Rep, Routine, Session, Settings, Uuid } from '../entities';

export type NewExercise = Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'>;
export type NewRoutine = Omit<Routine, 'id' | 'createdAt' | 'updatedAt'>;
export type NewSession = Omit<Session, 'id' | 'createdAt' | 'updatedAt'>;
export type NewRep = Omit<Rep, 'id' | 'createdAt' | 'updatedAt'>;

export interface ExerciseRepository {
  add(exercise: NewExercise): Promise<Exercise>;
  byId(id: Uuid): Promise<Exercise | undefined>;
  all(): Promise<Exercise[]>;
  byDefinition(definitionId: string): Promise<Exercise[]>;
  update(id: Uuid, changes: Partial<NewExercise>): Promise<Exercise>;
  softDelete(id: Uuid): Promise<void>;
}

export interface RoutineRepository {
  add(routine: NewRoutine): Promise<Routine>;
  byId(id: Uuid): Promise<Routine | undefined>;
  all(): Promise<Routine[]>;
  update(id: Uuid, changes: Partial<NewRoutine>): Promise<Routine>;
  softDelete(id: Uuid): Promise<void>;
}

export interface SessionRepository {
  add(session: NewSession): Promise<Session>;
  byId(id: Uuid): Promise<Session | undefined>;
  end(id: Uuid, endedAt: number): Promise<Session>;
  inRange(fromMs: number, toMs: number): Promise<Session[]>;
  recent(limit?: number): Promise<Session[]>;
}

export interface RepRepository {
  /** Writes the rep and updates its exercise's stats in one transaction. */
  add(rep: NewRep): Promise<Rep>;
  byId(id: Uuid): Promise<Rep | undefined>;
  bySession(sessionId: Uuid): Promise<Rep[]>;
  byExercise(exerciseId: Uuid, limit?: number): Promise<Rep[]>;
  inRange(fromMs: number, toMs: number): Promise<Rep[]>;
  count(): Promise<number>;
}

export interface StatsRepository {
  byExercise(exerciseId: Uuid): Promise<ExerciseStats | undefined>;
  all(): Promise<ExerciseStats[]>;
  /** Recompute every aggregate from the rep log. */
  rebuild(): Promise<void>;
}

export interface SettingsRepository {
  get(): Promise<Settings>;
  save(settings: Omit<Settings, 'key' | 'updatedAt'>): Promise<Settings>;
}

export interface Repositories {
  exercises: ExerciseRepository;
  routines: RoutineRepository;
  sessions: SessionRepository;
  reps: RepRepository;
  stats: StatsRepository;
  settings: SettingsRepository;
}
