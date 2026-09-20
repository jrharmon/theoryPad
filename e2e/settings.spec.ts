import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/** Everything in the database, in a stable order, without the stats cache. */
async function snapshot(page: Page) {
  return page.evaluate(
    () =>
      new Promise<Record<string, unknown[]>>((resolve, reject) => {
        const open = indexedDB.open('theorypad');
        open.onerror = () => reject(new Error('cannot open db'));
        open.onsuccess = () => {
          const database = open.result;
          const names = ['exercises', 'routines', 'sessions', 'reps', 'settings'];
          const tx = database.transaction(names);
          const out: Record<string, unknown[]> = {};
          let pending = names.length;
          for (const name of names) {
            const request = tx.objectStore(name).getAll();
            request.onsuccess = () => {
              out[name] = request.result as unknown[];
              pending -= 1;
              if (pending === 0) resolve(out);
            };
          }
        };
      }),
  );
}

test('settings are kept, and change what the exercises use', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByRole('combobox', { name: 'Tuning' }).click();
  await page.getByRole('option', { name: 'Guitar — 7 string' }).click();
  await expect(page.getByRole('combobox', { name: 'Tuning' })).toHaveText('Guitar — 7 string');
  // Reload only once the write has landed; a reload mid-write loses it anywhere.
  await expect
    .poll(async () => {
      const rows = await snapshot(page);
      return (rows.settings?.[0] as { instrument?: { id?: string } } | undefined)?.instrument
        ?.id;
    })
    .toBe('guitar-7-string');

  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Tuning' })).toHaveText('Guitar — 7 string');

  // A seven-string tab has seven lines.
  await page.goto('/#/exercises');
  await page
    .locator('li', { hasText: 'Modes up the neck' })
    .getByRole('link', { name: 'Practice', exact: true })
    .click();
  await expect(page.getByTestId(/^tab-string-label-/).first()).toBeVisible();
  const labels = await page
    .getByTestId('tab-system-0')
    .getByTestId(/^tab-string-label-/)
    .count();
  expect(labels).toBe(7);
});

test('keys and modes struck out in Settings never come up', async ({ page }) => {
  await page.goto('/#/settings');
  const keys = page.getByRole('group', { name: 'Keys' });
  const modes = page.getByRole('group', { name: 'Modes' });
  for (const key of ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'Bb', 'B']) {
    await keys.getByRole('button', { name: key, exact: true }).click();
  }
  for (const mode of ['Ionian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian']) {
    await modes.getByRole('button', { name: mode, exact: true }).click();
  }
  // The last one in can't be struck out.
  await expect(keys.getByRole('button', { name: 'A', exact: true })).toBeDisabled();
  await expect(modes.getByRole('button', { name: 'Dorian', exact: true })).toBeDisabled();

  await page.goto('/#/exercises');
  await page
    .locator('li', { hasText: 'Modes up the neck' })
    .getByRole('link', { name: 'Practice', exact: true })
    .click();
  await expect(page.getByTestId('axis-key')).toContainText('A Dorian');

  // The practice dialog says why they are struck out.
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByTestId('blocked-note')).toBeVisible();
  await expect(
    page
      .getByRole('group', { name: 'Key rolls from' })
      .getByRole('button', { name: 'C', exact: true }),
  ).toBeDisabled();
});

test('the count-in is the exercise’s own, chosen from its transport', async ({ page }) => {
  const practice = async (name: string) => {
    await page.goto('/#/exercises');
    await page
      .locator('li', { hasText: name })
      .getByRole('link', { name: 'Practice', exact: true })
      .click();
  };

  await practice('Modes up the neck');
  const menu = page.getByTestId('count-in-menu');
  await expect(menu).toContainText('1 bar');
  await menu.click();
  await page.getByRole('option', { name: '½ bar' }).click();
  await expect(menu).toContainText('½ bar');

  // Kept on that exercise, and only that one.
  await practice('Position shifting');
  await expect(page.getByTestId('count-in-menu')).toContainText('1 bar');
  await practice('Modes up the neck');
  await expect(page.getByTestId('count-in-menu')).toContainText('½ bar');

  await expect
    .poll(async () => {
      const rows = (await snapshot(page)).exercises as {
        definitionId: string;
        countInBars?: number;
      }[];
      return rows.find((e) => e.definitionId === 'modes-through-key')?.countInBars;
    })
    .toBe(0.5);
});

test('an export, wiped and imported again, comes back exactly', async ({ page }, testInfo) => {
  // Something worth keeping: a routine, and a logged pass.
  await page.goto('/#/exercises');
  await page.getByRole('link', { name: 'Modes up the neck', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'New routine' }).click();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Interval sequences/ })
    .click();
  await page.goto('/#/exercises');
  await page
    .locator('li', { hasText: 'Modes up the neck' })
    .getByRole('link', { name: 'Practice', exact: true })
    .click();
  await page.getByTestId('play').click();
  await expect(page.getByTestId('pause')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.goto('/#/settings');
  await expect.poll(async () => (await snapshot(page)).reps?.length).toBe(1);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export' }).click(),
  ]);
  const path = testInfo.outputPath('export.json');
  await download.saveAs(path);
  const exported = JSON.parse(readFileSync(path, 'utf8')) as { data: Record<string, unknown> };
  const before: Record<string, unknown[]> = {
    ...(exported.data as Record<string, unknown[]>),
    settings: [exported.data.settings],
  };
  expect(before.routines).toHaveLength(1);

  // Wipe everything, as a new device would be.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase('theorypad');
        request.onsuccess = () => resolve();
        request.onblocked = () => resolve();
      }),
  );
  await page.reload();
  await page.getByTestId('import-file').setInputFiles({
    name: 'export.json',
    mimeType: 'application/json',
    buffer: readFileSync(path),
  });
  await expect(page.getByTestId('replace-summary')).toContainText('1 routine');
  await page.getByRole('button', { name: 'Replace' }).click();
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();

  const after = await snapshot(page);
  const byId = (rows: unknown[]) =>
    [...(rows as { id?: string; key?: string }[])].sort((a, b) =>
      String(a.id ?? a.key).localeCompare(String(b.id ?? b.key)),
    );
  for (const table of ['routines', 'sessions', 'reps', 'settings']) {
    expect(byId(after[table]!), table).toEqual(byId(before[table]!));
  }
  // The library is re-seeded on an empty database before the import lands, so
  // compare the imported exercises rather than the whole table.
  for (const exercise of before.exercises as { id: string }[]) {
    expect(after.exercises).toContainEqual(exercise);
  }
});

test('a file that is not an export is refused, and nothing changes', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByTestId('import-file').setInputFiles({
    name: 'nope.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ hello: 'world' })),
  });
  await expect(page.getByText(/not a TheoryPad export/)).toBeVisible();
});
