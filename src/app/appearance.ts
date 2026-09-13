import { useEffect } from 'react';
import { useSettings } from '@/store/settings';

/** The Appearance setting. 'system' follows the computer, and changes when it does. */
export type Appearance = 'system' | 'light' | 'dark';
/** What is on screen: always one or the other, stamped on <html data-theme>. */
export type Theme = 'light' | 'dark';

/**
 * The setting, mirrored in localStorage so index.html's boot script can stamp
 * the theme before first paint — settings live in IndexedDB, which is too slow
 * for that. Namespaced: every repo on the Pages origin shares one localStorage.
 */
export const APPEARANCE_KEY = 'theorypad:appearance';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function systemQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null;
}

/** Which theme to show. */
export function resolveTheme(appearance: Appearance, systemDark: boolean): Theme {
  if (appearance === 'system') return systemDark ? 'dark' : 'light';
  return appearance;
}

/** Stamp the resolved theme on <html> and write the mirror the boot script reads. */
export function applyAppearance(appearance: Appearance): void {
  try {
    document.documentElement.dataset.theme = resolveTheme(appearance, systemQuery()?.matches ?? false);
  } catch {
    // No document: nothing to stamp.
  }
  try {
    localStorage.setItem(APPEARANCE_KEY, appearance);
  } catch {
    // Storage blocked: the boot script falls back to following the system.
  }
}

/**
 * Keeps <html data-theme> in step with the Appearance setting, and — while it
 * is 'system' — with the computer's light or dark mode as it changes. Called
 * once, in AppShell. Waits for settings to load, so the boot script's stamp
 * stands until the stored choice is known rather than flicking to the default.
 */
export function useAppearance(): void {
  const load = useSettings((s) => s.load);
  const loaded = useSettings((s) => s.loaded);
  // The setting arrives with R5's Settings row; until then the app follows the system.
  const appearance: Appearance = 'system';

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loaded) return;
    applyAppearance(appearance);
    if (appearance !== 'system') return;
    const query = systemQuery();
    if (!query) return;
    const follow = () => applyAppearance('system');
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  }, [appearance, loaded]);
}
