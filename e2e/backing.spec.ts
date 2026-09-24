import { expect, test, type Page } from '@playwright/test';
import { answerSet, open, readStore, writeRow } from './helpers';

/**
 * A stand-in for YouTube's IFrame API, so these tests never touch the network.
 * It keeps time as a video would — from when it starts playing, at its rate —
 * and says it is playing a moment after being asked, as YouTube does.
 */
async function fakeYouTube(page: Page, { blocking = false } = {}) {
  await page.addInitScript((blocking: boolean) => {
    type Events = { onReady: () => void; onStateChange: (e: { data: number }) => void };
    class Player {
      private state = -1;
      private rate = 1;
      private base: number;
      private startedAt: number | null = null;
      /** A strict browser: nothing plays until the video itself is clicked once. */
      private allowed = !blocking;
      /** Like the real API: the player has no methods to call until onReady. */
      private loaded = false;
      private readonly stand: HTMLElement;
      private readonly events: Events;
      constructor(
        element: HTMLElement,
        options: { playerVars: { start?: number }; events: Events },
      ) {
        this.events = options.events;
        this.base = options.playerVars.start ?? 0;
        const stand = document.createElement('div');
        stand.dataset.testid = 'fake-youtube';
        stand.style.cssText = 'width:100%;height:100%;background:#222';
        stand.addEventListener('click', () => {
          this.allowed = true;
          this.playVideo();
        });
        element.replaceWith(stand);
        this.stand = stand;
        // The player's own controls, for a test to press.
        (window as unknown as { fakePlayer: unknown }).fakePlayer = this;
        // Like the real iframe: nothing loads until it is on the page.
        const whenMounted = () => {
          if (!stand.isConnected) return void setTimeout(whenMounted, 20);
          this.loaded = true;
          this.events.onReady();
        };
        setTimeout(whenMounted, 0);
      }
      private live() {
        if (!this.loaded) throw new TypeError('YouTube player method called before onReady');
      }
      private get time() {
        return this.startedAt === null
          ? this.base
          : this.base + ((performance.now() - this.startedAt) / 1000) * this.rate;
      }
      private set(state: number) {
        this.state = state;
        this.stand.dataset.state = String(state);
        this.events.onStateChange({ data: state });
      }
      playVideo() {
        this.live();
        if (this.state === 1 || !this.allowed) return;
        setTimeout(() => {
          this.startedAt = performance.now();
          this.set(1);
        }, 150);
      }
      pauseVideo() {
        this.live();
        this.base = this.time;
        this.startedAt = null;
        this.set(2);
      }
      seekTo(seconds: number) {
        this.live();
        this.base = seconds;
        if (this.startedAt !== null) this.startedAt = performance.now();
      }
      setPlaybackRate(rate: number) {
        this.live();
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
  }, blocking);
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

test.beforeEach(async ({ page }, testInfo) => {
  await fakeYouTube(page, { blocking: testInfo.title.includes('holds the video back') });
});

test('a backing track takes the tempo over, and the metronome waits it out', async ({
  page,
}) => {
  await inAMinor(page, 'Modes up the neck');
  await expect(page.getByTestId('backing-menu')).toContainText('None');

  await page.getByTestId('backing-menu').click();
  await page.getByRole('option', { name: /A minor backing track/ }).click();
  await expect(page.getByTestId('backing-panel')).toBeVisible();
  // Target 70 over a 100 bpm track: 70% speed, 70 bpm.
  await expect(page.getByTestId('tempo')).toHaveText('70');
  await expect(page.getByTestId('track-speed')).toHaveText('70% speed');
  await expect(page.getByTestId('metronome-menu')).toBeDisabled();

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

test('pausing on the video pauses the exercise, and playing there starts it again', async ({
  page,
}) => {
  await inAMinor(page, 'Modes up the neck');
  await page.getByTestId('backing-menu').click();
  await page.getByRole('option', { name: /A minor backing track/ }).click();
  await page.getByTestId('play').click();
  await expect(page.getByTestId('pause')).toBeVisible();

  // YouTube's own controls, as the player would use them.
  const own = (playing: boolean) =>
    page.evaluate((play: boolean) => {
      const player = (window as unknown as { fakePlayer: Record<string, () => void> })
        .fakePlayer;
      player[play ? 'playVideo' : 'pauseVideo']!();
    }, playing);

  await own(false);
  await expect(page.getByTestId('pause')).toHaveAttribute('aria-label', 'Resume');

  await own(true);
  await expect(page.getByTestId('pause')).toHaveAttribute('aria-label', 'Pause');
});

test('the drone plays under the notes, and the metronome keeps the beat', async ({ page }) => {
  await inAMinor(page, 'Modes up the neck');
  await page.getByTestId('backing-menu').click();
  await page.getByRole('option', { name: /Drone/ }).click();
  await expect(page.getByTestId('backing-menu')).toContainText('Drone');
  await expect(page.getByTestId('backing-panel')).toHaveCount(0);
  await expect(page.getByTestId('metronome-menu')).toBeEnabled();
  await page.getByTestId('play').click();
  await expect(page.getByTestId('pause')).toBeVisible();
});

test('a key with no track offers none, and says where to add one', async ({ page }) => {
  await open(page, 'Modes up the neck');
  const key = await page.getByTestId('axis-key').textContent();
  test.skip(key?.includes('A Aeolian') ?? false, 'rolled the one key with a track');
  await page.getByTestId('backing-menu').click();
  await expect(page.getByText(/No tracks in .* yet/)).toBeVisible();
  // None, the drone and generated: they fit every key.
  await expect(page.getByRole('option')).toHaveCount(3);
});

test('a shared track is added from Settings, and fills its cell of the grid', async ({
  page,
}) => {
  await page.goto('/#/settings');
  const grid = page.getByTestId('coverage-grid');
  await expect(grid.getByRole('button', { name: 'A Aeolian, 1 track' })).toBeVisible();

  await page.getByRole('button', { name: 'Add a track' }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('YouTube link')
    .fill('https://www.youtube.com/watch?v=abcdefghijk&t=12s');
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

test('a browser that holds the video back asks for a click on it, then plays', async ({
  page,
}) => {
  await inAMinor(page, 'Modes up the neck');
  await page.getByTestId('backing-menu').click();
  await page.getByRole('option', { name: /A minor backing track/ }).click();
  await page.getByTestId('play').click();
  await expect(page.getByTestId('starting-track')).toHaveText('Press play on the video');
  await expect(page.getByTestId('needs-click')).toBeVisible();

  await page.getByTestId('fake-youtube').click();
  await expect(page.getByTestId('pause')).toBeVisible();
  await expect(page.getByTestId('needs-click')).toHaveCount(0);
  await expect(page.getByTestId('backing-error')).toHaveCount(0);
});

test('a routine starts its track with the first item, and brings it back after a theory set', async ({
  page,
}) => {
  await page.goto('/#/exercises');
  await expect(
    page.getByRole('link', { name: 'Modes up the neck', exact: true }),
  ).toBeVisible();
  // Straight into the database: the routine builder's own flow is tested elsewhere.
  const exercises = await readStore<{ id: string; definitionId: string; params: unknown }>(
    page,
    'exercises',
  );
  const item = (definitionId: string) => {
    const exercise = exercises.find((e) => e.definitionId === definitionId)!;
    return {
      id: crypto.randomUUID(),
      exerciseId: exercise.id,
      definitionId,
      reps: 1,
      params: exercise.params,
      tempo: { targetTempo: 80, maxTempo: null },
      countInBars: 1,
      axisPolicies: {},
      heldAxisValues: {},
    };
  };
  const routineId = crypto.randomUUID();
  await writeRow(page, 'routines', {
    id: routineId,
    name: 'With a track',
    items: [item('modes-through-key'), item('circle-of-fifths'), item('modes-through-key')],
    sessionAxisPolicies: {
      key: { mode: 'fixed', value: 'A' },
      mode: { mode: 'fixed', value: 'aeolian' },
    },
    backing: { kind: 'video', id: '6d0f3f5e-7a51-4c1e-9a55-0a1b2c3d4e5f' },
    createdAt: 1,
    updatedAt: 1,
  });

  await page.goto(`/#/practice/routine/${routineId}`);
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByTestId('fake-youtube')).toHaveAttribute('data-state', '1');
  await expect(page.getByTestId('pause')).toBeVisible();

  // Skipping to the theory set puts the track away; answering it brings one back.
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByTestId('theory-question')).toBeVisible();
  await answerSet(page);
  await expect(page.getByTestId('fake-youtube')).toHaveAttribute('data-state', '1');
  await expect(page.getByTestId('pause')).toBeVisible();
});

test('a track added in another tab is offered on the next visit to a practice screen', async ({
  page,
  context,
}) => {
  // The video table was read once per tab and kept, so a tab that had already
  // opened a practice screen never saw a track added anywhere else — only a
  // reload brought it in, which is what this test must not do.
  await inAMinor(page, 'Modes up the neck');
  await page.getByTestId('backing-menu').click();
  // None, the drone, generated, and the track this app ships with.
  await expect(page.getByRole('option')).toHaveCount(4);
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Home' }).click();
  await page.evaluate(() => ((window as Window & { stayed?: boolean }).stayed = true));

  const other = await context.newPage();
  await other.goto('/#/settings');
  await expect(other.getByTestId('track-list')).toBeVisible();
  await writeRow(other, 'videos', {
    id: 'd9a1c0b2-1111-4222-8333-444455556666',
    videoId: 'zzzzzzzzzzz',
    title: 'Another tab’s A minor track',
    scope: { kind: 'shared' },
    playAlong: true,
    startSec: 0,
    keyMode: { tonic: 'A', mode: 'aeolian' },
    bpm: 100,
    beatsPerBar: 4,
    tags: [],
    createdAt: 2,
    updatedAt: 2,
  });
  await other.close();

  // Back to the practice screen through the app, never reloading the document.
  await page.getByRole('link', { name: 'Exercises' }).click();
  await page
    .locator('li', { hasText: 'Modes up the neck' })
    .getByRole('link', { name: 'Practice', exact: true })
    .click();
  await expect(page.getByTestId('backing-menu')).toBeVisible();
  await page.getByTestId('backing-menu').click();
  await expect(page.getByRole('option', { name: /Another tab’s A minor track/ })).toBeVisible();

  // A reload would have picked the track up whatever the store did, so the
  // test only means something if this tab is the one it started as.
  expect(await page.evaluate(() => (window as Window & { stayed?: boolean }).stayed)).toBe(
    true,
  );
});
