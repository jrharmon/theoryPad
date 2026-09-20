import { expect, test, type Page } from '@playwright/test';
import { storedReps } from './helpers';

/** Reps as they were written to IndexedDB. */

async function newRoutine(page: Page, name: string, exercises: string[]) {
  await page.goto('/#/exercises');
  await expect(
    page.getByRole('link', { name: 'Modes up the neck', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'New routine' }).click();
  const field = page.getByLabel('Routine name');
  await field.fill(name);
  await field.press('Enter');
  for (const exercise of exercises) {
    await page.getByRole('button', { name: 'Add exercise' }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: new RegExp(exercise) })
      .click();
    await expect(page.getByRole('dialog')).toBeHidden();
  }
  await expect(page.getByTestId('routine-item')).toHaveCount(exercises.length);
}

test('a routine is built from the library, the same exercise twice', async ({ page }) => {
  await newRoutine(page, 'Morning', [
    'Interval sequences',
    'Modes up the neck',
    'Interval sequences',
  ]);

  await page.getByRole('button', { name: 'More passes' }).first().click();
  await expect(page.getByTestId('item-passes').first()).toHaveText('3 passes');
  // The first item cannot move up; the second can.
  await page.getByRole('button', { name: 'Move up' }).nth(1).click();
  await expect(page.getByTestId('routine-item').first()).toContainText('Modes up the neck');

  // Home lists it, and a star pins it.
  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByTestId('routine-row')).toContainText('Morning');
  await page.getByRole('button', { name: 'Favorite Morning' }).click();
  await expect(page.getByRole('button', { name: 'Favorite Morning' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('an item’s settings are its own copy', async ({ page }) => {
  await newRoutine(page, 'Copy', ['Modes up the neck']);
  await page.getByRole('button', { name: 'Edit' }).click();
  const tempo = page.getByRole('dialog').getByLabel('Target tempo');
  await tempo.fill('99');
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('routine-item')).toContainText('99 bpm');

  // The library's exercise is untouched.
  await page.getByRole('link', { name: 'Exercises' }).click();
  await page.getByRole('link', { name: 'Modes up the neck', exact: true }).click();
  await expect(page.getByLabel('Target tempo')).toHaveValue('70');
});

test('a routine shows its overview, then runs and logs against its exercises', async ({
  page,
}) => {
  await newRoutine(page, 'Run', ['Interval sequences', 'Modes up the neck']);
  await page.getByRole('link', { name: 'Start' }).click();

  // Everything rolled, in one key, before committing.
  await expect(page.getByTestId('overview-item')).toHaveCount(2);
  await page.getByRole('button', { name: 'Re-roll all' }).click();
  await expect(page.getByTestId('overview-item')).toHaveCount(2);

  await page.keyboard.press('Enter');
  await expect(page.getByTestId('routine-chrome')).toContainText('01 / 02');
  await expect(page.getByTestId('routine-chrome')).toContainText('Next: Modes up the neck');

  // S skips, without a hand off the guitar.
  await page.keyboard.press('s');
  await expect(page.getByTestId('routine-chrome')).toContainText('02 / 02');
  await page.getByRole('button', { name: 'Skip' }).click();

  await expect(page.getByText('Finished')).toBeVisible();
  const reps = await storedReps(page);
  expect(reps).toHaveLength(2);
  expect(reps.every((r) => r.status === 'skipped' && r.routineItemId)).toBe(true);
  // Against the library exercises they were copied from.
  const exerciseIds = new Set(reps.map((r) => r.exerciseId));
  expect(exerciseIds.size).toBe(2);
});

test('a routine item can be stopped and played again, staying where it is', async ({
  page,
}) => {
  await newRoutine(page, 'Stop', ['Modes up the neck', 'Interval sequences']);
  await page.getByRole('link', { name: 'Start' }).click();
  await expect(page.getByTestId('overview-item')).toHaveCount(2);
  await page.getByTestId('start-routine').click();
  await expect(page.getByTestId('routine-chrome')).toContainText('01 / 02');
  await expect(page.getByTestId('position')).toBeVisible({ timeout: 10_000 });

  await page.getByTestId('stop').click();
  // Still the first item, waiting rather than moved on.
  await expect(page.getByTestId('routine-chrome')).toContainText('01 / 02');
  await expect(page.getByTestId('play')).toBeVisible();
  expect((await storedReps(page)).map((r) => r.status)).toEqual(['abandoned']);

  await page.getByTestId('play').click();
  await expect(page.getByTestId('pause')).toBeVisible();
  await expect(page.getByTestId('routine-chrome')).toContainText('01 / 02');
});
