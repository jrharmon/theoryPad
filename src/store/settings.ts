import { create } from 'zustand';
import type { Instrument } from '@/domain/instrument';
import { STANDARD_GUITAR } from '@/domain/instrument';
import type { Settings } from '@/data';
import { repos, defaultSettings } from '@/data';
import { serialWrites } from './util';

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  /** Read the stored row again, whatever is in memory. */
  reload: () => Promise<void>;
  save: (changes: Partial<Omit<Settings, 'key' | 'updatedAt'>>) => Promise<void>;
  instrument: () => Instrument;
}

/**
 * Writes to the one settings row run in order.
 *
 * Two quick toggles — Loop then the metronome — each wrote the whole row, and
 * if the first write landed second it put the older row back: the toggle was
 * on screen and gone after a reload. Each write sends the current merged
 * settings, so the last one to run writes the newest state.
 */
const queued = serialWrites();

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

  /**
   * Read the row again even though it is already in memory. Another tab can
   * have changed it since: the settings screen was showing what this tab last
   * knew, and only a refresh brought the other tab's changes in.
   *
   * Through the same queue as the writes, so a read can never overtake a save
   * that has not landed yet and put the older row back.
   */
  async reload() {
    const settings = await queued('settings', () => repos().settings.get());
    set({ settings, loaded: true });
  },

  async save(changes) {
    // In memory first, then to disk. Waiting for the write before updating
    // meant two quick toggles each merged into the same stale settings, and
    // the second write undid the first.
    set({ settings: { ...get().settings, ...changes } });
    await queued('settings', () => repos().settings.save(get().settings));
  },

  instrument() {
    return get().settings.instrument ?? STANDARD_GUITAR;
  },
}));
