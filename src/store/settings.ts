import { create } from 'zustand';
import type { Instrument } from '@/domain/instrument';
import { STANDARD_GUITAR } from '@/domain/instrument';
import type { Settings } from '@/data';
import { repos, defaultSettings } from '@/data';

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
    set({ settings: await repos().settings.get(), loaded: true });
  },

  async save(changes) {
    // In memory first, then to disk. Waiting for the write before updating
    // meant two quick toggles each merged into the same stale settings, and
    // the second write undid the first.
    const merged = { ...get().settings, ...changes };
    set({ settings: merged });
    await repos().settings.save(merged);
  },

  instrument() {
    return get().settings.instrument ?? STANDARD_GUITAR;
  },
}));
