import { create } from 'zustand';
import type { Instrument } from '@/domain/instrument';
import { STANDARD_GUITAR } from '@/domain/instrument';
import type { Settings } from '@/data';
import { createRepositories, db, defaultSettings } from '@/data';

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  save: (changes: Partial<Omit<Settings, 'key' | 'updatedAt'>>) => Promise<void>;
  instrument: () => Instrument;
}

/**
 * Settings are read once at start-up and kept in memory. They are small,
 * change rarely, and every screen needs the instrument.
 */
export const useSettings = create<SettingsState>((set, get) => ({
  settings: defaultSettings(0),
  loaded: false,

  async load() {
    if (get().loaded) return;
    const repos = createRepositories(db());
    set({ settings: await repos.settings.get(), loaded: true });
  },

  async save(changes) {
    const repos = createRepositories(db());
    const next = await repos.settings.save({ ...get().settings, ...changes });
    set({ settings: next });
  },

  instrument() {
    return get().settings.instrument ?? STANDARD_GUITAR;
  },
}));
