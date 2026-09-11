import { expect, test, type Page } from '@playwright/test';

/** The one exercise the registry seeds, by its display name. */
const EXERCISE = 'Modes up the neck';

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
  await expect(page.getByRole('link', { name: EXERCISE })).toBeVisible();
});

test('clears up identical unplayed copies of one exercise', async ({ page }) => {
  // An earlier seeding race left some databases holding two identical rows.
  // Two instances of a definition are a fine thing to want, but two with the
  // same configuration and no history cannot be told apart, because there is
  // nothing to tell apart.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('theorypad');
        open.onerror = () => reject(new Error('cannot open db'));
        open.onsuccess = () => {
          const store = open.result
            .transaction('exercises', 'readwrite')
            .objectStore('exercises');
          const all = store.getAll();
          all.onsuccess = () => {
            const first = (all.result as { id: string }[])[0]!;
            const copy = { ...first, id: 'duplicate-row', createdAt: Date.now() };
            const put = store.put(copy);
            put.onsuccess = () => resolve();
            put.onerror = () => reject(new Error('cannot write'));
          };
        };
      }),
  );

  await page.reload();
  await expect(page.getByRole('link', { name: EXERCISE })).toHaveCount(1);
});

test('seeds the library exactly once, however many screens ask for it', async ({ page }) => {
  // Several screens load on mount and StrictMode runs each effect twice, which
  // used to race and seed the library twice over.
  await expect(page.getByRole('link', { name: EXERCISE })).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('link', { name: EXERCISE })).toHaveCount(1);
});

test('the library row shows how an exercise is configured', async ({ page }) => {
  // Names come from definitions, so configuration is what tells two instances
  // of one definition apart.
  await expect(page.getByText('2 reps', { exact: false })).toBeVisible();

  await page.getByRole('link', { name: EXERCISE }).click();
  await page.getByRole('combobox', { name: 'Key policy' }).click();
  await page.getByRole('option', { name: 'Fixed' }).click();
  await expect(page.getByRole('combobox', { name: 'Key value' })).toBeVisible();

  await page.getByRole('link', { name: 'Exercises' }).click();
  await expect(page.getByText('2 reps · Key: C')).toBeVisible();
});

test('deleting removes an exercise from the library', async ({ page }) => {
  await page.getByRole('link', { name: EXERCISE }).click();
  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByRole('heading', { name: 'Your library' })).toBeVisible();
  await expect(page.getByRole('link', { name: EXERCISE })).toHaveCount(0);
});

test('hold says what it is holding', async ({ page }) => {
  // "Keeps last session's value" said nothing about which value, and a hold
  // that can never be released is a trap — re-roll breaks it.
  await page.getByRole('link', { name: EXERCISE }).click();
  await page.getByRole('combobox', { name: 'Direction policy' }).click();
  await page.getByRole('option', { name: 'Hold' }).click();
  await expect(page.getByTestId('held-direction')).toContainText('Nothing held yet');

  await page.getByRole('link', { name: 'Practice this' }).click();
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: 'End' }).click();

  await page.getByRole('link', { name: EXERCISE }).click();
  await expect(page.getByTestId('held-direction')).toContainText('Holding');
});

test('reset puts an exercise back to its definition\u2019s defaults', async ({ page }) => {
  // A configured exercise keeps what it was given, so a changed default does
  // not move one you have already tuned. This is how you take it deliberately.
  await page.getByRole('link', { name: EXERCISE }).click();
  await page.getByLabel('Target tempo').fill('120');
  await expect(page.getByLabel('Target tempo')).toHaveValue('120');

  await page.getByRole('button', { name: 'Reset to defaults' }).click();
  await expect(page.getByLabel('Target tempo')).toHaveValue('70');
});

test('the library lists exercises and filters by tag', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'Practice', exact: true })).toBeVisible();

  // Tags, not one family: this exercise is scales and modes and whole-neck.
  for (const tag of ['scales', 'modes', 'whole-neck']) {
    await expect(page.getByRole('button', { name: tag, exact: true })).toBeVisible();
  }

  await page.getByRole('button', { name: 'modes', exact: true }).click();
  await expect(page.getByRole('link', { name: EXERCISE })).toBeVisible();

  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.getByRole('link', { name: EXERCISE })).toBeVisible();
});

test('the detail page configures tempo and what varies', async ({ page }) => {
  await page.getByRole('link', { name: EXERCISE }).click();

  const target = page.getByLabel('Target tempo');
  await expect(target).toHaveValue('70');
  await target.fill('84');
  await target.blur();

  // Pin the key so the next roll is predictable. These are Radix comboboxes,
  // not native selects.
  await page.getByRole('combobox', { name: 'Key policy' }).click();
  await page.getByRole('option', { name: 'Fixed' }).click();
  await page.getByRole('combobox', { name: 'Key value' }).click();
  await page.getByRole('option', { name: 'D', exact: true }).click();

  // The store only updates after the write resolves, so the control showing D
  // is proof it committed — and reloading before that would race it.
  await expect(page.getByRole('combobox', { name: 'Key value' })).toHaveText('D');

  // Settings survive a reload, which is the point of persisting them.
  await page.reload();
  await expect(page.getByLabel('Target tempo')).toHaveValue('84');
  await expect(page.getByRole('combobox', { name: 'Key policy' })).toHaveText('Fixed');
  await expect(page.getByRole('combobox', { name: 'Key value' })).toHaveText('D');

  // And the practice screen honours them.
  await page.getByRole('link', { name: 'Practice this' }).click();
  await expect(page.getByTestId('axis-key')).toContainText('D');
  await expect(page.getByTestId('tempo')).toHaveText('84');
});

test('opening an exercise goes straight into it', async ({ page }) => {
  await page.getByRole('link', { name: 'Practice', exact: true }).click();

  // No interstitial: the variation is rolled and the material generated on
  // arrival, and the transport is already there.
  await expect(page.getByText('This time you are playing')).toBeVisible();
  await expect(page.getByTestId('tab-staff')).toBeVisible();
  await expect(page.getByTestId('play')).toBeVisible();
});

test('the transport stays put while the tab scrolls', async ({ page }) => {
  await page.getByRole('link', { name: 'Practice', exact: true }).click();
  await expect(page.getByTestId('play')).toBeInViewport();

  // A generated exercise runs to twenty-one bars; the controls must not go
  // with them.
  await page.mouse.wheel(0, 4000);
  await expect(page.getByTestId('play')).toBeInViewport();
});

test('a practice run rolls, briefs, plays and logs the rep', async ({ page }) => {
  await page.getByRole('link', { name: 'Practice', exact: true }).click();

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

  await page.getByTestId('play').click();
  await expect(page.getByTestId('pause')).toBeVisible();

  // Skipping ends the rep without waiting out twenty-one bars.
  await page.getByRole('button', { name: 'Skip' }).click();

  const reps = await storedReps(page);
  expect(reps).toHaveLength(1);
  expect(reps[0]).toMatchObject({ status: 'skipped', freeTime: false });
  expect(reps[0]!.axes.key).toBeTruthy();
});

test('finishes after the configured reps', async ({ page }) => {
  await page.getByRole('link', { name: 'Practice', exact: true }).click();
  await expect(page.getByTestId('play')).toBeVisible();

  // Two reps by default.
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByText('This time you are playing')).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();

  await expect(page.getByRole('heading', { name: 'That’s the set.' })).toBeVisible();
  expect(await storedReps(page)).toHaveLength(2);
});

test('moving the tempo while practising never changes the target', async ({ page }) => {
  await page.getByRole('link', { name: 'Practice', exact: true }).click();
  await page.getByTestId('play').click();

  const tempo = page.getByTestId('tempo');
  await expect(tempo).toHaveText('70');

  await page.getByRole('button', { name: 'Faster' }).click();
  await page.getByRole('button', { name: 'Faster' }).click();
  await expect(tempo).toHaveText('74');
  // The configured tempo is shown alongside, unchanged.
  await expect(page.getByText('target 70')).toBeVisible();

  await page.getByRole('button', { name: 'End' }).click();
  await page.getByRole('link', { name: 'Exercises' }).click();
  await page.getByRole('link', { name: EXERCISE }).click();
  await expect(page.getByLabel('Target tempo')).toHaveValue('70');
});

test('space pauses and resumes, with a guitar in your hands', async ({ page }) => {
  await page.getByRole('link', { name: 'Practice', exact: true }).click();
  await expect(page.getByTestId('play')).toBeVisible();

  // Enter starts it.
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('pause')).toHaveText('Pause');

  await page.keyboard.press(' ');
  await expect(page.getByTestId('pause')).toHaveText('Resume');

  await page.keyboard.press(' ');
  await expect(page.getByTestId('pause')).toHaveText('Pause');

  // Bracket keys move the tempo.
  await page.keyboard.press(']');
  await expect(page.getByTestId('tempo')).toHaveText('71');
});

test('re-rolling gives a fresh variation from the brief', async ({ page }) => {
  await page.getByRole('link', { name: 'Practice', exact: true }).click();
  await page.getByTestId('play').click();

  await page.getByRole('button', { name: 'Re-roll' }).click();
  await expect(page.getByText('This time you are playing')).toBeVisible();
  await expect(page.getByTestId('play')).toBeVisible();

  // Nothing was logged: a re-roll is not a rep.
  expect(await storedReps(page)).toHaveLength(0);
});
