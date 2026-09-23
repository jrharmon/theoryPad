import { create } from 'zustand';
import { repos, newId, type Exercise, type Routine, type RoutineItem } from '@/data';
import type { AxisId, AxisPolicy } from '@/domain/variation';
import { initialItemReps } from '@/exercises/params';
import { findExerciseDefinition } from '@/exercises/registry';
import { serialWrites } from './util';

/**
 * An item copied from an exercise: its settings as they are now, and nothing
 * shared with it afterwards. That is what lets the same exercise sit in a
 * routine twice, set up two different ways.
 */
export function itemFromExercise(exercise: Exercise): RoutineItem {
  return {
    id: newId(),
    exerciseId: exercise.id,
    definitionId: exercise.definitionId,
    reps: initialItemReps(findExerciseDefinition(exercise.definitionId), exercise),
    params: structuredClone(exercise.params),
    tempo: { ...exercise.tempo },
    countInBars: exercise.countInBars ?? 1,
    ...(exercise.metronome ? { metronome: exercise.metronome } : {}),
    // Key and mode belong to the routine, so the item does not carry them.
    axisPolicies: Object.fromEntries(
      Object.entries(exercise.axisPolicies).filter(
        ([axis]) => axis !== 'key' && axis !== 'mode',
      ),
    ),
    heldAxisValues: {},
  };
}

/** Move an item up (-1) or down (+1), stopping at the ends. */
export function moveItem(items: RoutineItem[], itemId: string, delta: -1 | 1): RoutineItem[] {
  const from = items.findIndex((i) => i.id === itemId);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= items.length) return items;
  const next = [...items];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

/** Favorites first, then most recently played, then newest. */
export function sortRoutines(routines: Routine[]): Routine[] {
  return [...routines].sort(
    (a, b) =>
      Number(b.favorite ?? false) - Number(a.favorite ?? false) ||
      (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0) ||
      b.createdAt - a.createdAt,
  );
}

interface RoutinesState {
  routines: Routine[];
  loaded: boolean;
  load: () => Promise<void>;
  create: (name?: string) => Promise<Routine>;
  rename: (id: string, name: string) => Promise<void>;
  setFavorite: (id: string, favorite: boolean) => Promise<void>;
  setSessionPolicy: (id: string, axis: AxisId, policy: AxisPolicy) => Promise<void>;
  addItem: (id: string, exercise: Exercise) => Promise<void>;
  updateItem: (id: string, itemId: string, changes: Partial<RoutineItem>) => Promise<void>;
  moveItem: (id: string, itemId: string, delta: -1 | 1) => Promise<void>;
  removeItem: (id: string, itemId: string) => Promise<void>;
  /** Any other change to the routine row, against the stored copy. */
  update: (id: string, changes: Partial<Routine>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/**
 * Writes to one routine run in order, each against the stored row rather than
 * a caller's copy — the same reason as the exercises store: two quick edits
 * would otherwise each write their own stale view and the second would win.
 */
const queued = serialWrites();

export const useRoutines = create<RoutinesState>((set, get) => {
  /** Read the stored routine, change it, write it, and refresh the list. */
  const mutate = (id: string, change: (routine: Routine) => Partial<Routine>) =>
    queued(id, async () => {
      const current = await repos().routines.byId(id);
      if (!current) return;
      const updated = await repos().routines.update(id, change(current));
      set({ routines: get().routines.map((r) => (r.id === id ? updated : r)) });
    });

  return {
    routines: [],
    loaded: false,

    async load() {
      set({ routines: await repos().routines.all(), loaded: true });
    },

    async create(name = 'New routine') {
      const routine = await repos().routines.add({ name, items: [], sessionAxisPolicies: {} });
      set({ routines: [...get().routines, routine] });
      return routine;
    },

    rename: (id, name) => mutate(id, () => ({ name })),
    setFavorite: (id, favorite) => mutate(id, () => ({ favorite })),
    setSessionPolicy: (id, axis, policy) =>
      mutate(id, (r) => ({
        sessionAxisPolicies: { ...r.sessionAxisPolicies, [axis]: policy },
      })),
    addItem: (id, exercise) =>
      mutate(id, (r) => ({ items: [...r.items, itemFromExercise(exercise)] })),
    updateItem: (id, itemId, changes) =>
      mutate(id, (r) => ({
        items: r.items.map((item) => (item.id === itemId ? { ...item, ...changes } : item)),
      })),
    moveItem: (id, itemId, delta) =>
      mutate(id, (r) => ({ items: moveItem(r.items, itemId, delta) })),
    removeItem: (id, itemId) =>
      mutate(id, (r) => ({ items: r.items.filter((item) => item.id !== itemId) })),
    update: (id, changes) => mutate(id, () => changes),

    async remove(id) {
      await repos().routines.softDelete(id);
      set({ routines: get().routines.filter((r) => r.id !== id) });
    },
  };
});
