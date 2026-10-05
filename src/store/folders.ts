import { create } from 'zustand';
import { repos, type Folder } from '@/data';
import { deletionOf, planMove } from '@/domain/library';
import { useExercises } from './exercises';

interface FoldersState {
  folders: Folder[];
  loaded: boolean;
  load: () => Promise<void>;
  /** Names are checked by the caller, which shows the problem inline. */
  create: (name: string, parentId: string | null) => Promise<Folder>;
  rename: (id: string, name: string) => Promise<void>;
  /** The folder and everything in it, subfolders and their exercises — all soft. */
  remove: (id: string) => Promise<void>;
  /**
   * Exercises and folders into a folder (null: the top level), a clash there
   * renamed " - 2". False, and nothing moved, if a folder would go into itself.
   */
  move: (
    selection: { folderIds: readonly string[]; exerciseIds: readonly string[] },
    to: string | null,
  ) => Promise<boolean>;
}

export const useFolders = create<FoldersState>((set, get) => ({
  folders: [],
  loaded: false,

  async load() {
    set({ folders: await repos().folders.all(), loaded: true });
  },

  async create(name, parentId) {
    const folder = await repos().folders.add({ name: name.trim(), parentId });
    set({ folders: [...get().folders, folder] });
    return folder;
  },

  async rename(id, name) {
    const updated = await repos().folders.update(id, { name: name.trim() });
    set({ folders: get().folders.map((f) => (f.id === id ? updated : f)) });
  },

  async remove(id) {
    const { folderIds, exerciseIds } = deletionOf(
      get().folders,
      useExercises.getState().exercises,
      id,
    );
    await useExercises.getState().removeMany(exerciseIds);
    for (const folderId of folderIds) await repos().folders.softDelete(folderId);
    set({ folders: get().folders.filter((f) => !folderIds.includes(f.id)) });
  },

  async move(selection, to) {
    const plan = planMove(get().folders, useExercises.getState().exercises, selection, to);
    if (!plan) return false;
    const moved = new Map<string, Folder>();
    for (const { id, name, parentId } of plan.folders) {
      moved.set(id, await repos().folders.update(id, { name, parentId }));
    }
    set({ folders: get().folders.map((f) => moved.get(f.id) ?? f) });
    for (const { id, name, folderId } of plan.exercises) {
      await useExercises.getState().update(id, { name, folderId });
    }
    return true;
  },
}));
