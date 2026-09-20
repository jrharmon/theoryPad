import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { answerSet, open } from './helpers';

test('a finished set shows on the home strip and in the report', async ({ page }) => {
  await open(page, 'Circle of fifths');
  await expect(page.getByTestId('play')).toHaveText('Start');
  await page.keyboard.press('Enter');
  await answerSet(page);
  await expect(page.getByTestId('theory-score')).toBeVisible();

  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByTestId('streak')).toHaveText('1 day');
  await expect(page.getByTestId('heatmap').locator('[data-intensity="1"]')).toHaveCount(1);

  await page.getByRole('link', { name: 'Report' }).click();
  const row = page.getByTestId('report-row').filter({ hasText: 'Circle of fifths' });
  await expect(row).toContainText(/\d+\/10 · \d+%/);
  await expect(page.getByTestId('stat-sessions')).toHaveText('1');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV' }).click(),
  ]);
  const csv = await readFile(await download.path(), 'utf8');
  const [header, line] = csv.trim().split('\r\n');
  expect(header).toMatch(/^date,started,exercise,routine,status,tempo/);
  expect(line).toContain('Circle of fifths,,completed');
});

test('the explorer shows a key and mode, and the grid picks another', async ({ page }) => {
  await page.goto('/#/fretboard');
  await expect(page.getByTestId('explorer-title')).toHaveText('C Ionian');
  await expect(page.getByTestId('frets-never')).toHaveText('all of them, so far');

  await page.getByRole('button', { name: /^D Dorian/ }).click();
  await expect(page.getByTestId('explorer-title')).toHaveText('D Dorian');
  await expect(page.getByTestId('key-mode-full')).toContainText('Dm7');

  // One 3nps shape: three notes on every string.
  await page
    .getByRole('button', { name: /^Shape starting/ })
    .first()
    .click();
  await expect(page.getByTestId('fretboard').locator('[data-testid^="note-"]')).toHaveCount(18);
});

test('the key and mode reference opens mid-exercise, and Escape closes only it', async ({
  page,
}) => {
  await open(page, 'Modes up the neck');
  await page.getByTestId('play').click();
  await expect(page.getByTestId('pause')).toBeVisible();

  await page.keyboard.press('k');
  await expect(page.getByTestId('key-mode-compact')).toBeVisible();
  // Looking something up never stops the music.
  await expect(page.getByTestId('pause')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('key-mode-compact')).toBeHidden();
  await expect(page).toHaveURL(/practice\/exercise/);

  await page.getByTestId('key-mode-trigger').click();
  await page.getByRole('button', { name: 'Full view' }).click();
  await expect(page.getByTestId('key-mode-full')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('key-mode-full')).toBeHidden();
  await expect(page).toHaveURL(/practice\/exercise/);

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#\/exercises/);
});
