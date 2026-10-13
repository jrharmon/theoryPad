import { expect, test } from '@playwright/test';

const fixture = (name: string) => `test/fixtures/guitar-pro/${name}.gp`;

/**
 * Written exercises (doc 16): made from a Guitar Pro file on the new-exercise
 * page, practiced like any other, and given new notes from another file.
 */
test('a written exercise is made from a file, practiced, and replaced from another', async ({
  page,
}) => {
  await page.goto('/#/exercises/new');
  await page.getByRole('link', { name: /^Written exercise/ }).click();

  // Nothing to save until a file is read.
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
  await page.getByLabel('Guitar Pro file').setInputFiles(fixture('fixture6_structure'));
  await expect(page.getByTestId('written-facts')).toContainText('Written at 120');
  await expect(page.getByTestId('written-dropped')).toContainText(
    'tempo change to 100 at bar 5 ignored',
  );
  // Named from the section the bars start on; bars 1–4 only.
  await expect(page.getByLabel('Exercise name')).toHaveValue('A Intro');
  await page.getByRole('combobox', { name: 'To bar' }).click();
  await page.getByRole('option', { name: '4', exact: true }).click();
  await expect(page.getByTestId('written-facts')).toContainText('4 bars');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('link', { name: 'Practice this' })).toBeVisible();
  await expect(page.getByLabel('Exercise name')).toHaveValue('A Intro');
  await expect(page.getByTestId('written-source')).toContainText(
    'fixture6_structure.gp · Electric Guitar (Overdrive) · bars 1–4 · Standard',
  );

  // Practiced like any exercise, at the tempo it was written at.
  await page.getByRole('link', { name: 'Practice this' }).click();
  await expect(page.getByText('Tab · as written')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Bars 1–4 of Structure, in C Ionian.' }),
  ).toBeVisible();
  await expect(page.getByTestId(/^bar-label-/)).toHaveCount(4);

  // New notes from another file; the name stays.
  await page.goBack();
  await page.getByRole('link', { name: 'Replace from file' }).click();
  await page.getByLabel('Guitar Pro file').setInputFiles(fixture('fixture5_grace_picking'));
  await expect(page.getByTestId('written-facts')).toContainText('2 bars');
  await page.getByRole('button', { name: 'Replace' }).click();
  await expect(page.getByLabel('Exercise name')).toHaveValue('A Intro');
  await expect(page.getByTestId('written-source')).toContainText('fixture5_grace_picking.gp');

  await page.getByRole('link', { name: 'Practice this' }).click();
  await expect(page.getByTestId(/^bar-label-/)).toHaveCount(2);
  // Its picking is marked.
  await expect(page.getByTestId(/^pick-stroke-/).first()).toBeVisible();
});
