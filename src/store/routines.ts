import { create } from 'zustand';
import { repos, newId, type Exercise, type Routine, type RoutineItem } from '@/data';
import type { AxisId, AxisPolicy } from '@/domain/variation';
import type { Instrument } from '@/domain/instrument';
import { estimateItemSeconds, formatDuration } from '@/exercises/estimate';
import { initialItemReps } from '@/exercises/params';
import { findExerciseDefinition } from '@/exercises/registry';
import {
  addItem,
  insertSection,
  isSection,
  itemsOf,
  moveItem,
  playedItems,
  moveSection,
  removeSection,
  type RoutineSection,
} from '@/domain/routine';
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
    ...(exercise.playNotes !== undefined ? { playNotes: exercise.playNotes } : {}),
    ...(exercise.generatedBacking
      ? { generatedBacking: structuredClone(exercise.generatedBacking) }
      : {}),
    // Key, scale and mode are the routine's unless the item fixes its own,
    // which it does in its editor — not by copying the exercise's.
    axisPolicies: Object.fromEntries(
      Object.entries(exercise.axisPolicies).filter(
        ([axis]) => axis !== 'key' && axis !== 'mode',
      ),
    ),
    heldAxisValues: {},
  };
}

/** How many items a routine has, how many it plays, and about how long that takes. */
export function routineExtent(
  routine: Routine,
  instrument: Instrument,
): { total: number; played: number; seconds: number } {
  const played = playedItems(routine.items);
  return {
    total: itemsOf(routine.items).length,
    played: played.length,
    seconds: played.reduce((sum, item) => {
      const definition = findExerciseDefinition(item.definitionId);
      return definition ? sum + estimateItemSeconds(definition, item, instrument) : sum;
    }, 0),
  };
}

/** "7 exercises · about 12 min", or "4 of 7 exercises on · …" with some switched off. */
export function describeExtent({
  total,
  played,
  seconds,
}: ReturnType<typeof routineExtent>): string {
  const count =
    played === total
      ? `${total} exercise${total === 1 ? '' : 's'}`
      : `${played} of ${total} exercise${total === 1 ? '' : 's'} on`;
  return played === 0 ? count : `${count} · about ${formatDuration(seconds)}`;
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
  /**
   * The new item, at the end of a section or, with none named, of the routine —
   * returned so its editor can open straight away.
   */
  addItem: (id: string, exercise: Exercise, sectionId?: string | null) => Promise<RoutineItem>;
  updateItem: (id: string, itemId: string, changes: Partial<RoutineItem>) => Promise<void>;
  moveItem: (id: string, itemId: string, delta: -1 | 1) => Promise<void>;
  removeItem: (id: string, itemId: string) => Promise<void>;
  /** A new divider before an entry, or at the end; returned so its name can be typed over. */
  addSection: (id: string, beforeId: string | null) => Promise<RoutineSection>;
  updateSection: (
    id: string,
    sectionId: string,
    changes: Partial<Pick<RoutineSection, 'name' | 'enabled'>>,
  ) => Promise<void>;
  moveSection: (id: string, sectionId: string, delta: -1 | 1) => Promise<void>;
  /** The divider alone, its items staying put — or with its items. */
  removeSection: (id: string, sectionId: string, withItems: boolean) => Promise<void>;
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
    async addItem(id, exercise, sectionId = null) {
      const item = itemFromExercise(exercise);
      await mutate(id, (r) => ({ items: addItem(r.items, item, sectionId) }));
      return item;
    },
    updateItem: (id, itemId, changes) =>
      mutate(id, (r) => ({
        items: r.items.map((entry) =>
          !isSection(entry) && entry.id === itemId ? { ...entry, ...changes } : entry,
        ),
      })),
    moveItem: (id, itemId, delta) =>
      mutate(id, (r) => ({ items: moveItem(r.items, itemId, delta) })),
    removeItem: (id, itemId) =>
      mutate(id, (r) => ({ items: r.items.filter((item) => item.id !== itemId) })),
    async addSection(id, beforeId) {
      const section: RoutineSection = { kind: 'section', id: newId(), name: 'New section' };
      await mutate(id, (r) => ({ items: insertSection(r.items, section, beforeId) }));
      return section;
    },
    updateSection: (id, sectionId, changes) =>
      mutate(id, (r) => ({
        items: r.items.map((entry) =>
          isSection(entry) && entry.id === sectionId ? { ...entry, ...changes } : entry,
        ),
      })),
    moveSection: (id, sectionId, delta) =>
      mutate(id, (r) => ({ items: moveSection(r.items, sectionId, delta) })),
    removeSection: (id, sectionId, withItems) =>
      mutate(id, (r) => ({ items: removeSection(r.items, sectionId, withItems) })),
    update: (id, changes) => mutate(id, () => changes),

    async remove(id) {
      await repos().routines.softDelete(id);
      set({ routines: get().routines.filter((r) => r.id !== id) });
    },
  };
});
