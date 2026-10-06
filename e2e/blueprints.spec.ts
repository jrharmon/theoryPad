import { expect, test } from '@playwright/test';

/**
 * Blueprints: an exercise made from one, kept in a folder, with a setting
 * locked into it — hidden from the practice dialog — and found again in the
 * side panel's Favorites.
 */
test('an exercise from a blueprint, in a folder, with its rhythm locked', async ({ page }) => {
  await page.goto('/#/exercises');
  await expect(
    page.getByRole('link', { name: 'Modes up the neck', exact: true }),
  ).toBeVisible();

  // A folder, and a new exercise made inside it.
  await page.getByRole('button', { name: 'New folder' }).click();
  await page.getByLabel('Name').fill('Rhythms');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('link', { name: 'Rhythms', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Rhythms' })).toBeVisible();
  await page.getByRole('link', { name: 'New exercise' }).click();
  await page.getByRole('button', { name: /^Modes up the neck/ }).click();

  // The editor opens with the blueprint's name selected, ready to type over.
  const name = page.getByLabel('Exercise name');
  await expect(name).toHaveValue('Modes up the neck');
  await expect(name).toBeFocused();
  await page.keyboard.type('Triplet modes');
  await page.keyboard.press('Enter');
  await expect(page.getByText('from Modes up the neck')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Folder' })).toHaveText('Rhythms');

  // Rhythm fixed at triplets, and locked into the exercise.
  await page.getByRole('combobox', { name: 'Rhythm policy' }).click();
  await page.getByRole('option', { name: 'Fixed' }).click();
  await page.getByRole('combobox', { name: 'Rhythm value' }).click();
  await page.getByRole('option', { name: 'Eighth triplets' }).click();
  await page.getByRole('button', { name: 'Lock Rhythm' }).click();
  await expect(page.getByRole('button', { name: 'Unlock Rhythm' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Favorite Triplet modes' }).click();

  // The practice dialog leaves the locked rhythm out, and keeps the rest.
  await page.getByRole('link', { name: 'Practice this' }).click();
  await expect(page.getByTestId('axis-rhythmPattern')).toContainText('Eighth triplets');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('combobox', { name: 'Direction policy' })).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Rhythm policy' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Done' }).click();

  // In the side panel: under Favorites and under its folder, both marked current.
  const list = page.getByTestId('practice-list');
  await expect(list.getByText('Favorites', { exact: true })).toBeVisible();
  await expect(list.getByTitle('Rhythms', { exact: true })).toBeVisible();
  const current = list.getByRole('link', { name: /Triplet modes/ });
  await expect(current).toHaveCount(2);
  await expect(current.first()).toHaveAttribute('aria-current', 'page');
  await expect(current.first()).toContainText('Eighth triplets');
});
