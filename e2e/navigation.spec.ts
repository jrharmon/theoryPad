import { expect, test } from '@playwright/test';

/**
 * M0's only E2E: the shell boots, hash routing works, and every nav
 * destination renders. Real flows arrive with the runner in M2.
 */
test('the app boots and every nav destination renders', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/#\/home$/);
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

  for (const label of ['Exercises', 'Fretboard', 'Report', 'Settings']) {
    await page.getByRole('link', { name: label, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
});

test('an unknown route renders the not-found screen', async ({ page }) => {
  await page.goto('/#/nope');
  await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
});
