import { expect, test, type Page } from '@playwright/test';
import { readStore, storedReps, writeRow } from './helpers';

/** The exercise these tests drive, by its display name. The library seeds others too. */
const EXERCISE = 'Modes up the neck';

/** That exercise's row in the library. */
const row = (page: Page) => page.locator('li', { hasText: EXERCISE });

/**
 * The vertical slice, end to end: pick an exercise, configure it, practise it,
 * and confirm the rep was logged with what it rolled.
 */

/** Reps as they were actually written to IndexedDB. */

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
  const [first] = await readStore<{ id: string }>(page, 'exercises');
  await writeRow(page, 'exercises', { ...first, id: 'duplicate-row', createdAt: Date.now() });

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
  await page.getByRole('link', { name: EXERCISE }).click();
  await page.getByRole('combobox', { name: 'Key policy' }).click();
  await page.getByRole('option', { name: 'Fixed' }).click();
  await expect(page.getByRole('combobox', { name: 'Key value' })).toBeVisible();

  await page.getByRole('link', { name: 'Exercises' }).click();
  await expect(row(page).getByText('Key: C')).toBeVisible();
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

  // Playing and leaving is enough: the pass is logged, and its values held.
  await page.getByRole('link', { name: 'Practice this' }).click();
  await page.getByTestId('play').click();
  // Play waits for the audio engine; leave once something is actually playing.
  await expect(page.getByTestId('pause')).toBeVisible();
  await page.keyboard.press('Escape');

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
  await expect(row(page).getByRole('link', { name: 'Practice', exact: true })).toBeVisible();

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
  await row(page).getByRole('link', { name: 'Practice', exact: true }).click();

  // No interstitial: the variation is rolled and the material generated on
  // arrival, and the transport is already there.
  await expect(page.getByText('This time you are playing')).toBeVisible();
  await expect(page.getByTestId('tab-staff')).toBeVisible();
  await expect(page.getByTestId('play')).toBeVisible();
});

test('the transport stays put while the tab scrolls', async ({ page }) => {
  await row(page).getByRole('link', { name: 'Practice', exact: true }).click();
  await expect(page.getByTestId('play')).toBeInViewport();

  // A generated exercise runs to twenty-one bars; the controls must not go
  // with them.
  await page.mouse.wheel(0, 4000);
  await expect(page.getByTestId('play')).toBeInViewport();
});

test('a practice run rolls, briefs, plays and logs the rep', async ({ page }) => {
  await row(page).getByRole('link', { name: 'Practice', exact: true }).click();

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

  // There is no End button to remember: leaving the screen logs the pass.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Your library' })).toBeVisible();

  const reps = await storedReps(page);
  expect(reps).toHaveLength(1);
  expect(reps[0]).toMatchObject({ status: 'abandoned', freeTime: false });
  expect(reps[0]!.axes.key).toBeTruthy();
});

test('the transport toggles are remembered', async ({ page }) => {
  await row(page).getByRole('link', { name: 'Practice', exact: true }).click();
  const loop = page.getByRole('button', { name: 'Loop', exact: true });
  const metronome = page.getByRole('button', { name: 'Metronome', exact: true });
  await expect(loop).toHaveAttribute('aria-pressed', 'false');
  await expect(metronome).toHaveAttribute('aria-pressed', 'true');

  await loop.click();
  // M toggles the metronome without taking a hand off the guitar.
  await page.keyboard.press('m');
  await expect(loop).toHaveAttribute('aria-pressed', 'true');
  await expect(metronome).toHaveAttribute('aria-pressed', 'false');

  await page.reload();
  await expect(page.getByRole('button', { name: 'Loop', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Metronome', exact: true })).toHaveAttribute('aria-pressed', 'false');
});

test('settings can be changed without leaving the exercise', async ({ page }) => {
  await row(page).getByRole('link', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Settings' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Key policy' }).click();
  await page.getByRole('option', { name: 'Fixed' }).click();
  await dialog.getByRole('combobox', { name: 'Key value' }).click();
  await page.getByRole('option', { name: 'G', exact: true }).click();
  await dialog.getByRole('button', { name: 'Done' }).click();

  await expect(page.getByTestId('axis-key')).toContainText(/G [A-Z]/);
  // Saved to the exercise, not just this run.
  await page.keyboard.press('Escape');
  await expect(row(page).getByText('Key: G')).toBeVisible();
});

test('moving the tempo while practising never changes the target', async ({ page }) => {
  await row(page).getByRole('link', { name: 'Practice', exact: true }).click();
  await page.getByTestId('play').click();

  const tempo = page.getByTestId('tempo');
  await expect(tempo).toHaveText('70');

  await page.getByRole('button', { name: 'Faster' }).click();
  await page.getByRole('button', { name: 'Faster' }).click();
  await expect(tempo).toHaveText('74');
  // The configured tempo is shown alongside, unchanged.
  await expect(page.getByText('target 70')).toBeVisible();

  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: EXERCISE }).click();
  await expect(page.getByLabel('Target tempo')).toHaveValue('70');
});

test('space pauses and resumes, with a guitar in your hands', async ({ page }) => {
  await row(page).getByRole('link', { name: 'Practice', exact: true }).click();
  await expect(page.getByTestId('play')).toBeVisible();

  // Enter starts it.
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('pause')).toHaveAttribute('aria-label', 'Pause');

  await page.keyboard.press(' ');
  await expect(page.getByTestId('pause')).toHaveAttribute('aria-label', 'Resume');

  await page.keyboard.press(' ');
  await expect(page.getByTestId('pause')).toHaveAttribute('aria-label', 'Pause');

  // Bracket keys move the tempo.
  await page.keyboard.press(']');
  await expect(page.getByTestId('tempo')).toHaveText('71');
});

test('re-rolling stops, and waits with a fresh variation', async ({ page }) => {
  await row(page).getByRole('link', { name: 'Practice', exact: true }).click();
  await page.getByTestId('play').click();

  await page.getByRole('button', { name: 'Re-roll' }).click();
  await expect(page.getByText('This time you are playing')).toBeVisible();
  await expect(page.getByTestId('play')).toBeVisible();

  // The pass it cut short is logged as abandoned, like leaving would.
  expect((await storedReps(page)).map((r) => r.status)).toEqual(['abandoned']);
});

test('stop goes back to the top, and restart plays it again from the count-in', async ({ page }) => {
  await row(page).getByRole('link', { name: 'Practice', exact: true }).click();
  const headline = await page.getByRole('heading', { level: 2 }).textContent();
  await page.getByTestId('play').click();
  // Past the count-in, so there is a pass to cut short.
  await expect(page.getByTestId('position')).toBeVisible({ timeout: 10_000 });

  await page.getByTestId('stop').click();
  await expect(page.getByTestId('play')).toBeVisible();
  // The same material, not a re-roll.
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(headline!);
  expect((await storedReps(page)).map((r) => r.status)).toEqual(['abandoned']);

  await page.getByTestId('play').click();
  await expect(page.getByTestId('position')).toBeVisible({ timeout: 10_000 });
  // Enter, mid-pass: from the top again, counted in.
  await page.keyboard.press('Enter');
  await expect(page.getByText('Counting in…')).toBeVisible();
  await expect(page.getByTestId('restart')).toBeVisible();
  // Backspace stops; inside the count-in, nothing was played to log.
  await page.keyboard.press('Backspace');
  await expect(page.getByTestId('play')).toBeVisible();
  expect((await storedReps(page)).map((r) => r.status)).toEqual(['abandoned', 'abandoned']);
});

test('the circle of fifths marks the key being played', async ({ page }) => {
  await page.getByRole('link', { name: EXERCISE }).click();
  await page.getByRole('combobox', { name: 'Key policy' }).click();
  await page.getByRole('option', { name: 'Fixed' }).click();
  await page.getByRole('combobox', { name: 'Mode policy' }).click();
  await page.getByRole('option', { name: 'Fixed' }).click();
  // Fixed to the first of each: C, and Ionian.
  await page.getByRole('link', { name: 'Practice this' }).click();

  const circle = page.getByTestId('circle-of-fifths');
  await expect(circle).toBeVisible();
  await expect(circle.getByTestId('circle-tonic')).toHaveText('C');
  // C major's seven chords: the tonic and six more.
  await expect(circle.getByTestId('circle-in-key')).toHaveCount(6);
});

test('Hide Info puts the whole right column away, and brings it back', async ({ page }) => {
  await row(page).getByRole('link', { name: 'Practice', exact: true }).click();
  await expect(page.getByTestId('circle-of-fifths')).toBeVisible();

  const toggle = page.getByTestId('info-column-toggle');
  await expect(toggle).toHaveText('Hide Info');
  await toggle.click();
  await expect(page.getByTestId('circle-of-fifths')).toHaveCount(0);
  await expect(page.getByText('Shape on the neck')).toHaveCount(0);

  // It says how to get it back, and does.
  await expect(toggle).toHaveText('Show Info');
  await toggle.click();
  await expect(page.getByTestId('circle-of-fifths')).toBeVisible();
});

test('a roll can leave values out, and the run honours it', async ({ page }) => {
  await page.getByRole('link', { name: EXERCISE }).click();
  const keys = page.getByRole('group', { name: 'Key rolls from' });

  // Leave out every key but A; the next roll has nothing else to pick.
  for (const key of ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'Bb', 'B']) {
    await keys.getByRole('button', { name: key, exact: true }).click();
  }
  await expect(keys.getByRole('button', { name: 'A', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(keys.getByRole('button', { name: 'C', exact: true })).toHaveAttribute('aria-pressed', 'false');

  await page.getByRole('link', { name: 'Practice this' }).click();
  // "A Dorian", not "Ab Dorian".
  await expect(page.getByTestId('axis-key')).toContainText(/A [A-Z]/);
});

test('a variant chosen on the config page is what gets played', async ({ page }) => {
  await page.getByRole('link', { name: EXERCISE }).click();
  await page.getByRole('combobox', { name: 'Variant' }).click();
  await page.getByRole('option', { name: 'Pause on root' }).click();
  await expect(page.getByRole('combobox', { name: 'Variant' })).toHaveText('Pause on root');

  await page.getByRole('link', { name: 'Practice this' }).click();
  await expect(page.getByText('holding every root')).toBeVisible();
});

test('the tab size changes from its buttons and from - and =', async ({ page }) => {
  await row(page).getByRole('link', { name: 'Practice', exact: true }).click();
  const bigger = page.getByRole('button', { name: 'Bigger' });
  const smaller = page.getByRole('button', { name: 'Smaller' });
  await expect(page.getByText('Tab size')).toBeVisible();

  // Two steps up from the default is as big as it goes.
  await page.keyboard.press('=');
  await page.keyboard.press('=');
  await expect(bigger).toBeDisabled();

  await page.keyboard.press('-');
  await expect(bigger).toBeEnabled();
  await smaller.click();
  await smaller.click();
  await smaller.click();
  await expect(smaller).toBeDisabled();
});
