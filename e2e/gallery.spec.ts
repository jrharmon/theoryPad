import { expect, test } from '@playwright/test';

/**
 * The dev gallery is how the M1 primitives are reviewed. These tests keep it
 * from silently breaking, and cover the one thing unit tests cannot: that
 * pressing play actually starts the audio clock in a real browser, where the
 * AudioContext needs a user gesture.
 */
test.describe('dev gallery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/dev/gallery');
  });

  test('renders the derived theory for the fixture key', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'D Dorian' })).toBeVisible();
    await expect(page.getByText('D · E · F · G · A · B · C')).toBeVisible();
    // Dorian's major IV is what distinguishes it from aeolian.
    await expect(page.getByRole('cell', { name: 'G', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Gmaj7' })).toHaveCount(0);
    await expect(page.getByRole('cell', { name: 'G7' })).toBeVisible();
  });

  test('renders a fretboard and a tab staff', async ({ page }) => {
    expect(await page.getByTestId('fretboard').count()).toBeGreaterThan(0);
    expect(await page.getByTestId('tab-staff').count()).toBeGreaterThan(0);
  });

  test('switches between the shapes up the neck', async ({ page }) => {
    // Shapes tile ascending from the nut, so the first starts at fret 1.
    await expect(page.getByRole('button', { name: 'fret 1', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'fret 7', exact: true }).click();

    const section = page.locator('section').filter({ hasText: 'GENERATED 3NPS SHAPES' });
    // The rolled position's frets are emphasised in the fret-number row.
    await expect(section.getByTestId('fret-number-7')).toHaveClass(/text-accent-700/);
    await expect(section.getByTestId('fret-number-3')).not.toHaveClass(/text-accent-700/);
  });

  test('starts the clock and moves the playhead when play is pressed', async ({ page }) => {
    const section = page.locator('section').filter({ hasText: 'SCALE RUN' });
    await expect(section.getByTestId('playhead')).toHaveCount(0);

    // The click is the user gesture the AudioContext needs.
    await section.getByRole('button', { name: 'Play' }).click();

    const playhead = section.getByTestId('playhead');
    await expect(playhead).toBeVisible();

    const startColumn = await playhead.getAttribute('data-column');
    await expect
      .poll(async () => playhead.getAttribute('data-column'), { timeout: 5000 })
      .not.toBe(startColumn);

    await section.getByRole('button', { name: 'Stop' }).click();
    await expect(section.getByTestId('playhead')).toHaveCount(0);
  });

  test('every tab example is independently playable', async ({ page }) => {
    for (const heading of ['SCALE RUN', 'PICKED VS LEGATO', 'ARTICULATION MARKS', 'SIXTEENTH-NOTE RUN', 'CHORDS']) {
      const section = page.locator('section').filter({ hasText: heading });
      await section.getByRole('button', { name: 'Play' }).click();
      await expect(section.getByTestId('playhead')).toBeVisible();
      await section.getByRole('button', { name: 'Stop' }).click();
    }
  });

  test('starting one example stops the one already playing', async ({ page }) => {
    // There is a single engine and a single clock, so two phrases must never
    // sound at once.
    const first = page.locator('section').filter({ hasText: 'SCALE RUN' });
    const second = page.locator('section').filter({ hasText: 'CHORDS' });

    await first.getByRole('button', { name: 'Play' }).click();
    await expect(first.getByTestId('playhead')).toBeVisible();

    await second.getByRole('button', { name: 'Play' }).click();
    await expect(second.getByTestId('playhead')).toBeVisible();
    await expect(first.getByTestId('playhead')).toHaveCount(0);
  });

  test('returns to Play when a phrase reaches its end', async ({ page }) => {
    // Chords is the shortest example, so this does not need long to finish.
    const section = page.locator('section').filter({ hasText: 'CHORDS' });
    await section.getByRole('button', { name: 'Play' }).click();

    // Ending used to pause the transport past every scheduled event, leaving a
    // "Resume" button that toggled forever and played nothing.
    await expect(section.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 15000 });
    await expect(section.getByTestId('playhead')).toHaveCount(0);

    // And it is genuinely replayable.
    await section.getByRole('button', { name: 'Play' }).click();
    await expect(section.getByTestId('playhead')).toBeVisible();
  });

  test('a short example does not cut a longer one short afterwards', async ({ page }) => {
    // The end-of-phrase callback is scheduled straight onto the clock, so it
    // has to be cleared explicitly. Left registered, the one-bar example's
    // callback fired at bar 1 of the two-bar one and paused it half way.
    const short = page.locator('section').filter({ hasText: 'CHORDS' });
    const long = page.locator('section').filter({ hasText: 'SCALE RUN' });

    await short.getByRole('button', { name: 'Play' }).click();
    await short.getByRole('button', { name: 'Stop' }).click();

    await long.getByRole('button', { name: 'Play' }).click();
    const playhead = long.getByTestId('playhead');

    // Run past where the short example would have ended and confirm it is
    // still going, well past the halfway column.
    await expect
      .poll(async () => Number(await playhead.getAttribute('data-column')), { timeout: 10000 })
      .toBeGreaterThan(9);
  });

  test('keeps the playhead visible through every pass of a repeat', async ({ page }) => {
    // The playhead used to run off the end of the drawn phrase on the second
    // pass, so playback continued with nothing to look at.
    const section = page.locator('section').filter({ hasText: 'PICKED VS LEGATO' });
    await section.getByRole('button', { name: 'Play' }).click();

    await expect(section.getByText('Pass 1 of 2')).toBeVisible();
    await expect(section.getByText('Pass 2 of 2')).toBeVisible({ timeout: 15000 });
    await expect(section.getByTestId('playhead')).toBeVisible();
  });

  test('pauses and resumes the active example', async ({ page }) => {
    const section = page.locator('section').filter({ hasText: 'SCALE RUN' });
    await section.getByRole('button', { name: 'Play' }).click();
    await section.getByRole('button', { name: 'Pause' }).click();

    const playhead = section.getByTestId('playhead');
    const paused = await playhead.getAttribute('data-column');
    await page.waitForTimeout(400);
    // A paused clock is frozen, so the playhead does not move.
    expect(await playhead.getAttribute('data-column')).toBe(paused);

    await section.getByRole('button', { name: 'Resume' }).click();
    await expect
      .poll(async () => playhead.getAttribute('data-column'), { timeout: 5000 })
      .not.toBe(paused);
  });
});
