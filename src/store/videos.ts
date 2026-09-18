import { create } from 'zustand';
import { repos, type NewVideo, type Video } from '@/data';

interface VideosState {
  /** Every live video: shared tracks, and every exercise's own. */
  videos: Video[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (video: NewVideo) => Promise<Video>;
  update: (id: string, changes: Partial<NewVideo>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/** Backing tracks and reference videos. Few enough to hold all of them. */
export const useVideos = create<VideosState>((set, get) => ({
  videos: [],
  loaded: false,

  async load() {
    set({ videos: await repos().videos.all(), loaded: true });
  },

  async add(video) {
    const added = await repos().videos.add(video);
    set({ videos: [...get().videos, added] });
    return added;
  },

  async update(id, changes) {
    const updated = await repos().videos.update(id, changes);
    set({ videos: get().videos.map((v) => (v.id === id ? updated : v)) });
  },

  async remove(id) {
    await repos().videos.softDelete(id);
    set({ videos: get().videos.filter((v) => v.id !== id) });
  },
}));
