import { expect, test } from '@playwright/test';
import { answerSet, open, storedReps } from './helpers';

test('a circle-of-fifths set is answered from the keyboard and scored', async ({ page }) => {
  await open(page, 'Circle of fifths');
  await expect(page.getByTestId('play')).toHaveText('Start');
  await page.keyboard.press('Enter');
  await answerSet(page);

  await expect(page.getByTestId('theory-score')).toHaveText(/\d+ of 10/);
  await expect(page.getByTestId('play')).toHaveText('Again');
  const [rep] = await storedReps(page);
  expect(rep!.status).toBe('completed');
  expect(rep!.score!.total).toBe(10);
  expect(rep!.answers).toHaveLength(10);
});

test('a wrong answer stays, with the correction, until you move on', async ({ page }) => {
  await open(page, 'Circle of fifths');
  await page.getByTestId('play').click();
  await page.getByTestId('theory-question').waitFor();

  // Pick every option in turn until one is wrong; there is always a wrong one.
  const options = page.locator('[data-state="open"]');
  const count = await options.count();
  for (let i = 1; i <= count; i += 1) {
    await page.keyboard.press(String(i));
    if (await page.getByTestId('theory-continue').isVisible()) break;
    await expect(page.getByTestId('theory-right')).toBeHidden();
  }
  await expect(page.getByTestId('theory-feedback')).toBeVisible();
  await expect(page.getByTestId('circle-correct')).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(page.getByTestId('theory-feedback')).toBeVisible();
});

test('a table is submitted whole, and only once every row is filled', async ({ page }) => {
  // Just the notes question, so the set is one table.
  await page.goto('/#/exercises');
  await page.getByRole('link', { name: 'Key signature drill', exact: true }).click();
  const types = page.getByRole('group', { name: 'Question types' });
  for (const t of ['Name chords', 'Spell chord', 'Chord families']) {
    await types.getByRole('button', { name: t }).click();
  }
  await expect(types.getByRole('button', { name: 'Name notes' })).toBeDisabled();
  await page.getByRole('link', { name: 'Practice this' }).click();
  await page.getByTestId('play').click();

  await expect(page.getByTestId('submit-table')).toBeDisabled();
  const rows = await page.getByTestId('table-row').count();
  for (let r = 0; r < rows - 1; r += 1) await page.keyboard.press('2');
  await expect(page.getByTestId('submit-table')).toBeDisabled();
  await page.keyboard.press('2');
  await expect(page.getByTestId('submit-table')).toBeEnabled();
  await page.getByTestId('submit-table').click();

  // One question, one answer — right or wrong as a whole.
  await expect(
    page.getByTestId('theory-continue').or(page.getByTestId('theory-ready')),
  ).toBeVisible();
  if (await page.getByTestId('theory-continue').isVisible()) await page.keyboard.press('Enter');
  await expect(page.getByTestId('theory-score')).toHaveText(/[01] of 1/);
});

test('a routine moves on from a theory set to the next exercise', async ({ page }) => {
  await page.goto('/#/exercises');
  await page.getByRole('link', { name: 'Modes up the neck', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'New routine' }).click();
  for (const name of ['Circle of fifths', 'Modes up the neck']) {
    await page.getByRole('button', { name: 'Add exercise' }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: new RegExp(name) })
      .click();
    await expect(page.getByRole('dialog')).toBeHidden();
  }
  await page.getByRole('link', { name: 'Start' }).click();
  await page.getByTestId('start-routine').click();

  await answerSet(page);
  await expect(page.getByTestId('routine-chrome')).toContainText('02 / 02');
  await expect(page.getByTestId('tab-staff')).toBeVisible();
  // Straight on, counted in: no Play to press.
  await expect(page.getByTestId('pause')).toBeVisible();
});

test('a chord family is picked whole: every chord of its family, and no other', async ({
  page,
}) => {
  // Just the family question, so the set is one multi-pick.
  await page.goto('/#/exercises');
  await page.getByRole('link', { name: 'Key signature drill', exact: true }).click();
  const types = page.getByRole('group', { name: 'Question types' });
  for (const t of ['Name notes', 'Name chords', 'Spell chord']) {
    await types.getByRole('button', { name: t }).click();
  }
  await page.getByRole('link', { name: 'Practice this' }).click();
  await page.getByTestId('play').click();

  // A family is more than one chord, and nothing is marked until you submit.
  await expect(
    page.getByRole('heading', { name: /Which chords are the .+ family/ }),
  ).toBeVisible();
  const options = page.getByRole('group', { name: 'Answers' }).getByRole('button');
  await expect(options).toHaveCount(7);
  await expect(page.getByTestId('submit-multi')).toBeDisabled();
  await page.keyboard.press('1');
  await expect(options.first()).toHaveAttribute('aria-pressed', 'true');
  // Ticking every chord is wrong however many of them belong.
  for (const n of ['2', '3', '4', '5', '6', '7']) await page.keyboard.press(n);
  await page.keyboard.press('Enter');

  // Wrong, so the correction waits — and names the family it was asking for.
  await expect(page.getByTestId('theory-feedback')).toContainText(/family .+ is the/);
  await expect(page.getByTestId('theory-question')).toContainText('Question 1 of');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('theory-question')).toContainText('Question 2 of');
});
