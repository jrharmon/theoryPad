import { afterEach, describe, expect, it } from 'vitest';
import {
  APPEARANCE_KEY,
  applyAppearance,
  resolveTheme,
  type Appearance,
} from '@/app/appearance';

describe('resolveTheme', () => {
  const cases: [Appearance, boolean, 'light' | 'dark'][] = [
    ['system', false, 'light'],
    ['system', true, 'dark'],
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
  ];

  it.each(cases)('%s with a %s-dark system shows %s', (appearance, systemDark, theme) => {
    expect(resolveTheme(appearance, systemDark)).toBe(theme);
  });
});

describe('applyAppearance', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
    localStorage.clear();
  });

  it('stamps the theme on <html> and mirrors the choice for the boot script', () => {
    applyAppearance('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(APPEARANCE_KEY)).toBe('dark');
  });

  it('follows the system when there is no media query to ask, as light', () => {
    applyAppearance('system');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(APPEARANCE_KEY)).toBe('system');
  });
});
