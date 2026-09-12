import { ZOOM_MAX, ZOOM_MIN } from '@/components/music/tabLayout';
import { useSettings } from '@/store/settings';

/** The stored tab size, kept within the steps there are. */
export function clampZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

/**
 * Make the tab a step bigger (positive) or smaller. Shared by the buttons and
 * the `-` / `=` keys, so both stop at the same ends and save the same way.
 */
export function nudgeTabZoom(delta: number): void {
  const { settings, save } = useSettings.getState();
  const current = clampZoom(settings.ui.tabZoom);
  const next = clampZoom(current + delta);
  if (next !== current) void save({ ui: { ...settings.ui, tabZoom: next } });
}
