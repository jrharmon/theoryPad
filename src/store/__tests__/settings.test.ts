import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { repos } from '@/data';
import { useSettings } from '../settings';

describe('useSettings', () => {
  it('reads the row again on reload, so another tab’s changes show up', async () => {
    await useSettings.getState().load();

    // Another tab, over the same database, changes a setting.
    const stored = await repos().settings.get();
    await repos().settings.save({ ...stored, ui: { ...stored.ui, tabZoom: 2 } });

    // Settings are read once at start-up and kept, so load leaves what this
    // tab already knows — which is why the settings screen was showing the
    // older values until it was refreshed.
    await useSettings.getState().load();
    expect(useSettings.getState().settings.ui.tabZoom).toBe(0);

    await useSettings.getState().reload();
    expect(useSettings.getState().settings.ui.tabZoom).toBe(2);
  });
});
