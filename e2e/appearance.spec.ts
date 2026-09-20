import { expect, test, type Page } from '@playwright/test';
import { savedSettings } from './helpers';

const html = (page: Page) => page.locator('html');
const choice = (page: Page, name: 'System' | 'Light' | 'Dark') =>
  page.getByRole('group', { name: 'Appearance' }).getByRole('button', { name, exact: true });

/** The theme <html> carried when the document finished parsing — before settings can load. */
async function themeAtLoad(page: Page) {
  return page.evaluate(() => (window as unknown as { themeAtLoad?: string }).themeAtLoad);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      (window as unknown as { themeAtLoad?: string }).themeAtLoad = document.documentElement.dataset.theme;
    });
  });
});

test.describe('on a light system', () => {
  test.use({ colorScheme: 'light' });

  test('a fresh start is light', async ({ page }) => {
    await page.goto('/#/home');
    await expect(html(page)).toHaveAttribute('data-theme', 'light');
  });

  test('choosing Dark turns dark at once, and stays dark from the first paint after a reload', async ({ page }) => {
    await page.goto('/#/settings');
    await expect(choice(page, 'System')).toHaveAttribute('aria-pressed', 'true');

    await choice(page, 'Dark').click();
    await expect(html(page)).toHaveAttribute('data-theme', 'dark');
    await expect(choice(page, 'Dark')).toHaveAttribute('aria-pressed', 'true');

    await savedSettings(page, (s) => s.ui.appearance === 'dark');
    await page.reload();
    expect(await themeAtLoad(page)).toBe('dark');
    await expect(choice(page, 'Dark')).toHaveAttribute('aria-pressed', 'true');
    await expect(html(page)).toHaveAttribute('data-theme', 'dark');
  });

  test('with System chosen, the theme follows the computer as it changes', async ({ page }) => {
    await page.goto('/#/settings');
    await expect(choice(page, 'System')).toHaveAttribute('aria-pressed', 'true');
    await expect(html(page)).toHaveAttribute('data-theme', 'light');

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(html(page)).toHaveAttribute('data-theme', 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(html(page)).toHaveAttribute('data-theme', 'light');
  });
});

test.describe('on a dark system', () => {
  test.use({ colorScheme: 'dark' });

  test('a fresh start is dark', async ({ page }) => {
    await page.goto('/#/home');
    await expect(html(page)).toHaveAttribute('data-theme', 'dark');
    expect(await themeAtLoad(page)).toBe('dark');
  });

  test('choosing Light turns light, and stays light after a reload', async ({ page }) => {
    await page.goto('/#/settings');
    await choice(page, 'Light').click();
    await expect(html(page)).toHaveAttribute('data-theme', 'light');

    await savedSettings(page, (s) => s.ui.appearance === 'light');
    await page.reload();
    expect(await themeAtLoad(page)).toBe('light');
    await expect(choice(page, 'Light')).toHaveAttribute('aria-pressed', 'true');
    await expect(html(page)).toHaveAttribute('data-theme', 'light');
  });
});
