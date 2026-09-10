import { expect, test, type Page } from '@playwright/test';

/**
 * The vertical slice, end to end: pick an exercise, configure it, practise it,
 * and confirm the rep was logged with what it rolled.
 */

/** Reps as they were actually written to IndexedDB. */
async function storedReps(page: Page) {
  return page.evaluate<{ tempo: number | null; freeTime: boolean; axes: Record<string, string>; status: string }[]>(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('theorypad');
        open.onerror = () => reject(new Error('cannot open db'));
        open.onsuccess = () => {
          const database = open.result;
          const request = database.transaction('reps').objectStore('reps').getAll();
          request.onsuccess = () => resolve(request.result as never);
          request.onerror = () => reject(new Error('cannot read reps'));
        };
      }),
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/#/exercises');
  // First run seeds the library from the registry.
  await expect(page.getByRole('link', { name: 'Seven modes through a key' })).toBeVisible();
});

test('the library lists exercises and filters by tag', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Practise' })).toBeVisible();

  // Tags, not one family: this exercise is scales and modes and whole-neck.
  for (const tag of ['scales', 'modes', 'whole-neck']) {
    await expect(page.getByRole('button', { name: tag, exact: true })).toBeVisible();
  }

  await page.getByRole('button', { name: 'modes', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Seven modes through a key' })).toBeVisible();

  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Seven modes through a key' })).toBeVisible();
});

test('the detail page configures tempo and what varies', async ({ page }) => {
  await page.getByRole('link', { name: 'Seven modes through a key' }).click();

  const target = page.getByLabel('Target tempo');
  await expect(target).toHaveValue('76');
  await target.fill('84');
  await target.blur();

  // Pin the key so the next roll is predictable.
  await page.getByLabel('Key policy').selectOption('fixed');
  await page.getByLabel('Key value').selectOption('D');

  // Settings survive a reload, which is the point of persisting them.
  await page.reload();
  await expect(page.getByLabel('Target tempo')).toHaveValue('84');
  await expect(page.getByLabel('Key policy')).toHaveValue('fixed');
});

test('a practice run rolls, briefs, plays and logs the rep', async ({ page }) => {
  await page.getByRole('button', { name: 'Practise' }).click();

  // Free time so a twenty-one bar exercise does not take a minute to finish.
  await page.getByLabel(/Free time/).check();
  await page.getByRole('button', { name: 'Start', exact: true }).click();

  // The brief reveals the whole rolled variation, and waits.
  await expect(page.getByText('This time you are playing')).toBeVisible();
  const headline = await page.getByRole('heading', { level: 2 }).textContent();
  expect(headline).toMatch(/shapes in .+/);

  // The axis strip names the same key the headline does.
  const keyCell = page.getByTestId('axis-key');
  await expect(keyCell).toBeVisible();
  const keyText = (await keyCell.textContent()) ?? '';
  const key = keyText.replace('Key & mode', '').trim();
  expect(headline).toContain(key);

  await page.getByTestId('begin').click();
  await expect(page.getByTestId('done-rep')).toBeVisible();

  await page.getByTestId('done-rep').click();
  await expect(page.getByRole('heading', { name: 'That’s the set.' })).toBeVisible();

  const reps = await storedReps(page);
  expect(reps).toHaveLength(1);
  expect(reps[0]).toMatchObject({ status: 'completed', freeTime: true, tempo: null });
  expect(reps[0]!.axes.key).toBeTruthy();
});

test('moving the tempo while practising never changes the target', async ({ page }) => {
  await page.getByRole('button', { name: 'Practise' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByTestId('begin').click();

  const tempo = page.getByTestId('axis-tempo');
  await expect(tempo).toContainText('76');

  await page.getByRole('button', { name: 'Faster' }).click();
  await page.getByRole('button', { name: 'Faster' }).click();
  await expect(tempo).toContainText('80');
  // The configured tempo is shown alongside, unchanged.
  await expect(tempo).toContainText('target 76');

  await page.getByRole('button', { name: 'End' }).click();
  await page.getByRole('link', { name: 'Exercises' }).click();
  await page.getByRole('link', { name: 'Seven modes through a key' }).click();
  await expect(page.getByLabel('Target tempo')).toHaveValue('76');
});

test('space pauses and resumes, with a guitar in your hands', async ({ page }) => {
  await page.getByRole('button', { name: 'Practise' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  // Starting is async — it boots the audio engine and opens a session.
  await expect(page.getByTestId('begin')).toBeVisible();

  // Enter leaves the brief.
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Pause' }).first()).toBeVisible();

  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: 'Resume' }).first()).toBeVisible();

  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: 'Pause' }).first()).toBeVisible();

  // Bracket keys move the tempo.
  await page.keyboard.press(']');
  await expect(page.getByTestId('axis-tempo')).toContainText('77');
});

test('re-rolling gives a fresh variation from the brief', async ({ page }) => {
  await page.getByRole('button', { name: 'Practise' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByTestId('begin').click();

  await page.getByRole('button', { name: 'Re-roll' }).click();
  await expect(page.getByText('This time you are playing')).toBeVisible();
  await expect(page.getByTestId('begin')).toBeVisible();

  // Nothing was logged: a re-roll is not a rep.
  expect(await storedReps(page)).toHaveLength(0);
});
