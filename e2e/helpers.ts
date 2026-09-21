import { expect, type Page } from '@playwright/test';

/** Answer whatever is on screen with the keyboard: 1 for picks, then Enter for anything submitted whole. */
export async function answerSet(page: Page) {
  await page.getByTestId('theory-question').waitFor();
  for (let i = 0; i < 40; i += 1) {
    // Standalone, the set ends on its score; in a routine, on the next exercise.
    if (await page.getByTestId('theory-ready').isVisible()) return;
    if (!(await page.getByTestId('theory-question').isVisible())) return;
    if (await page.getByTestId('submit-table').isVisible()) {
      const rows = await page.getByTestId('table-row').count();
      for (let r = 0; r < rows; r += 1) await page.keyboard.press('1');
      await page.keyboard.press('Enter');
    } else if (await page.getByTestId('submit-multi').isVisible()) {
      // Tick the first option and submit: right or wrong, the set moves on.
      await page.keyboard.press('1');
      await page.keyboard.press('Enter');
    } else {
      await page.keyboard.press('1');
    }
    // A wrong answer waits for Enter; a right one moves on by itself.
    const wrong = page.getByTestId('theory-continue');
    const right = page.getByTestId('theory-right');
    const over = page.getByTestId('theory-ready').or(page.getByTestId('tab-staff'));
    await expect(wrong.or(right).or(over).first()).toBeVisible();
    if (await wrong.isVisible()) await page.keyboard.press('Enter');
    else if (await right.isVisible()) await expect(right).toBeHidden();
  }
}

/** Open an exercise's practice screen from the library. */
export async function open(page: Page, name: string) {
  await page.goto('/#/exercises');
  await page
    .locator('li', { hasText: name })
    .getByRole('link', { name: 'Practice', exact: true })
    .click();
}

/**
 * Rows straight out of IndexedDB, as the app actually wrote them.
 *
 * The spec files each grew their own copy of this plumbing; it lives here so
 * a store name is the only thing a test has to say.
 */
export async function readStore<T = Record<string, unknown>>(
  page: Page,
  store: string,
): Promise<T[]> {
  return page.evaluate<T[], string>(
    (name) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('theorypad');
        open.onerror = () => reject(new Error('cannot open db'));
        open.onsuccess = () => {
          const request = open.result.transaction(name).objectStore(name).getAll();
          request.onsuccess = () => resolve(request.result as never);
          request.onerror = () => reject(new Error(`cannot read ${name}`));
        };
      }),
    store,
  );
}

/** Put a row straight into a store, for state the UI cannot reach. */
export async function writeRow(page: Page, store: string, row: unknown): Promise<void> {
  await page.evaluate<void, [string, unknown]>(
    ([name, value]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('theorypad');
        open.onerror = () => reject(new Error('cannot open db'));
        open.onsuccess = () => {
          const tx = open.result.transaction(name, 'readwrite');
          tx.objectStore(name).put(value);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(new Error(`cannot write ${name}`));
        };
      }),
    [store, row],
  );
}

/** A logged rep, as the specs read it back. */
export interface StoredRep {
  exerciseId: string;
  routineItemId?: string;
  status: string;
  tempo: number | null;
  freeTime: boolean;
  axes: Record<string, string>;
  score?: { correct: number; total: number };
  answers?: unknown[];
}

/** Reps as they were logged. */
export const storedReps = (page: Page) => readStore<StoredRep>(page, 'reps');

/**
 * Wait until the settings row on disk matches, before a reload.
 *
 * Settings are applied on screen at once and written a moment later; a reload
 * in between loses the write, and the app makes no promise about that gap.
 */
export async function savedSettings(
  page: Page,
  matches: (settings: {
    ui: Record<string, unknown>;
    audio: Record<string, unknown>;
  }) => boolean,
): Promise<void> {
  await expect
    .poll(async () => {
      const [row] = await readStore<{
        ui: Record<string, unknown>;
        audio: Record<string, unknown>;
      }>(page, 'settings');
      return row ? matches(row) : false;
    })
    .toBe(true);
}
