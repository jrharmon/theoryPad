import { expect, test, type Page } from '@playwright/test';
import { open } from './helpers';

/**
 * A stand-in for YouTube's IFrame API, so these tests never touch the network.
 * It keeps time as a video would — from when it starts playing, at its rate —
 * and says it is playing a moment after being asked, as YouTube does.
 */
async function fakeYouTube(page: Page) {
  await page.addInitScript(() => {
    type Events = { onReady: () => void; onStateChange: (e: { data: number }) => void };
    class Player {
      private state = -1;
      private rate = 1;
      private base: number;
      private startedAt: number | null = null;
      private readonly events: Events;
      constructor(element: HTMLElement, options: { playerVars: { start?: number }; events: Events }) {
        this.events = options.events;
        this.base = options.playerVars.start ?? 0;
        const stand = document.createElement('div');
        stand.dataset.testid = 'fake-youtube';
        stand.style.cssText = 'width:100%;height:100%;background:#222';
        element.replaceWith(stand);
        setTimeout(() => this.events.onReady(), 0);
      }
      private get time() {
        return this.startedAt === null ? this.base : this.base + ((performance.now() - this.startedAt) / 1000) * this.rate;
      }
      private set(state: number) {
        this.state = state;
        this.events.onStateChange({ data: state });
      }
      playVideo() {
        if (this.state === 1) return;
        setTimeout(() => {
          this.startedAt = performance.now();
          this.set(1);
        }, 150);
      }
      pauseVideo() {
        this.base = this.time;
        this.startedAt = null;
        this.set(2);
      }
      seekTo(seconds: number) {
        this.base = seconds;
        if (this.startedAt !== null) this.startedAt = performance.now();
      }
      setPlaybackRate(rate: number) {
        this.base = this.time;
        if (this.startedAt !== null) this.startedAt = performance.now();
        this.rate = rate;
      }
      getCurrentTime() {
        return this.time;
      }
      getDuration() {
        return 600;
      }
      getPlayerState() {
        return this.state;
      }
      destroy() {}
    }
    (window as unknown as { YT: unknown }).YT = { Player };
  });
}

/** Pin an exercise to A Aeolian — the key the first-run track is in — and open it. */
async function inAMinor(page: Page, name: string) {
  await page.goto('/#/exercises');
  await page.getByRole('link', { name, exact: true }).click();
  for (const [axis, value] of [
    ['Mode', 'Aeolian'],
    ['Key', 'A'],
  ] as const) {
    await page.getByRole('combobox', { name: `${axis} policy` }).click();
    await page.getByRole('option', { name: 'Fixed' }).click();
    await page.getByRole('combobox', { name: `${axis} value` }).click();
    await page.getByRole('option', { name: value, exact: true }).click();
    await expect(page.getByRole('combobox', { name: `${axis} value` })).toHaveText(value);
  }
  await page.getByRole('link', { name: 'Practice this' }).click();
}

test.beforeEach(async ({ page }) => {
  await fakeYouTube(page);
});

test('a backing track takes the tempo over, and the metronome waits it out', async ({ page }) => {
  await inAMinor(page, 'Modes up the neck');
  await expect(page.getByTestId('backing-menu')).toContainText('None');

  await page.getByTestId('backing-menu').click();
  await page.getByRole('option', { name: /A minor backing track/ }).click();
  await expect(page.getByTestId('backing-panel')).toBeVisible();
  // Target 70 over a 100 bpm track: 70% speed, 70 bpm.
  await expect(page.getByTestId('tempo')).toHaveText('70');
  await expect(page.getByTestId('track-speed')).toHaveText('70% speed');
  await expect(page.getByRole('button', { name: 'Metronome' })).toBeDisabled();

  // The tempo moves in the track's own steps.
  await page.keyboard.press(']');
  await expect(page.getByTestId('track-speed')).toHaveText('75% speed');
  await expect(page.getByTestId('tempo')).toHaveText('75');

  await page.getByTestId('play').click();
  await expect(page.getByTestId('pause')).toBeVisible();
  await expect(page.getByText('Counting in…')).toBeVisible();

  // Remembered on the exercise.
  await page.reload();
  await expect(page.getByTestId('backing-menu')).toContainText('A minor backing track');
});

test('the drone plays instead of the notes, and the metronome keeps the beat', async ({ page }) => {
  await inAMinor(page, 'Modes up the neck');
  await page.getByTestId('backing-menu').click();
  await page.getByRole('option', { name: /Drone/ }).click();
  await expect(page.getByTestId('backing-menu')).toContainText('Drone');
  await expect(page.getByTestId('backing-panel')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Metronome' })).toBeEnabled();
  await page.getByTestId('play').click();
  await expect(page.getByTestId('pause')).toBeVisible();
});

test('a key with no track offers none, and says where to add one', async ({ page }) => {
  await open(page, 'Modes up the neck');
  const key = await page.getByTestId('axis-key').textContent();
  test.skip(key?.includes('A Aeolian') ?? false, 'rolled the one key with a track');
  await page.getByTestId('backing-menu').click();
  await expect(page.getByText(/No tracks in .* yet/)).toBeVisible();
  await expect(page.getByRole('option')).toHaveCount(2);
});

test('a shared track is added from Settings, and fills its cell of the grid', async ({ page }) => {
  await page.goto('/#/settings');
  const grid = page.getByTestId('coverage-grid');
  await expect(grid.getByRole('button', { name: 'A Aeolian, 1 track' })).toBeVisible();

  await page.getByRole('button', { name: 'Add a track' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('YouTube link').fill('https://www.youtube.com/watch?v=abcdefghijk&t=12s');
  await expect(dialog.getByLabel('Bar 1', { exact: true })).toHaveValue('0:12');
  await expect(dialog.getByTestId('fake-youtube')).toBeVisible();
  await dialog.getByLabel('Title', { exact: true }).fill('D Dorian funk');
  await dialog.getByRole('combobox', { name: 'Mode' }).click();
  await page.getByRole('option', { name: 'Dorian' }).click();
  await dialog.getByRole('combobox', { name: 'Key' }).click();
  await page.getByRole('option', { name: 'D', exact: true }).click();
  await dialog.getByLabel('Tempo', { exact: true }).fill('96');
  await dialog.getByLabel('Tags', { exact: true }).fill('funk');
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('track-list')).toContainText('D Dorian funk');
  await expect(grid.getByRole('button', { name: 'D Dorian, 1 track' })).toBeVisible();
});

test('improvising counts phrases and names the note to land on', async ({ page }) => {
  await open(page, 'Improvise to a target');
  await expect(page.getByTestId('phrase-counter')).toContainText('8');
  await expect(page.getByTestId('tab-staff')).toHaveCount(0);
  await expect(page.getByTestId('landing-target')).toContainText('End each phrase on');
  await page.getByTestId('play').click();
  await expect(page.getByTestId('phrase-counter')).toContainText('1 of 8', { timeout: 10_000 });
  await expect(page.getByTestId('phrase-counter')).toContainText('Bar 1 of 4');
});
