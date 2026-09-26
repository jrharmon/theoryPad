import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { TheoryPadDB } from '../db';
import { createRepositories } from '../repositories/dexie';
import { applyImport, exportData, parseExport, planImport } from '../transfer';

const databases: TheoryPadDB[] = [];
function fresh(): TheoryPadDB {
  const db = new TheoryPadDB(`transfer-${Math.random()}`);
  databases.push(db);
  return db;
}

afterEach(async () => {
  for (const db of databases.splice(0)) await db.delete();
});

/** A database with a little of everything in it, including a soft delete. */
async function populated(now = () => 1_000) {
  const db = fresh();
  const repos = createRepositories(db, now);
  const exercise = await repos.exercises.add({
    definitionId: 'modes-through-key',
    params: { variant: 'plain' },
    axisPolicies: {},
    heldAxisValues: {},
    tempo: { targetTempo: 70, maxTempo: 90 },
    defaultReps: 2,
    generatedBacking: {
      source: {
        kind: 'custom',
        progressions: [
          [
            { degree: 2, bars: 1 },
            { degree: 5, bars: 2 },
          ],
        ],
      },
      style: 'pulse',
      chords: 'triads',
    },
  });
  const gone = await repos.exercises.add({ ...exercise, definitionId: 'interval-sequences' });
  await repos.exercises.softDelete(gone.id);
  await repos.routines.add({ name: 'Morning', items: [], sessionAxisPolicies: {} });
  const session = await repos.sessions.add({
    routineId: null,
    seed: 1,
    startedAt: 1_000,
    endedAt: 2_000,
    sessionKey: 'D' as never,
    sessionMode: 'dorian',
  });
  for (let i = 0; i < 3; i += 1) {
    await repos.reps.add({
      sessionId: session.id,
      exerciseId: exercise.id,
      definitionId: 'modes-through-key',
      index: i,
      startedAt: 1_000 + i * 60_000,
      endedAt: 61_000 + i * 60_000,
      tempo: 70,
      freeTime: false,
      axes: { key: 'D' },
      seed: 1,
      status: 'completed',
    });
  }
  await repos.settings.get();
  return { db, repos, exercise };
}

describe('export and import', () => {
  it('exports every row, soft-deleted ones included', async () => {
    const { db } = await populated();
    const file = await exportData(db);
    expect(file.formatVersion).toBe(1);
    expect(file.data.exercises).toHaveLength(2);
    expect(file.data.exercises.some((e) => e.deletedAt !== undefined)).toBe(true);
    expect(file.data.routines).toHaveLength(1);
    expect(file.data.reps).toHaveLength(3);
    expect(file.data.settings?.key).toBe('settings');
  });

  it('round-trips through JSON into an empty database exactly', async () => {
    const { db } = await populated();
    const file = parseExport(JSON.parse(JSON.stringify(await exportData(db))));

    const target = fresh();
    await applyImport(target, file, 'replace');
    const back = await exportData(target, file.exportedAt);
    expect(back.data).toEqual(file.data);

    // Stats are rebuilt from the reps rather than trusted from anywhere.
    const stats = await createRepositories(target).stats.all();
    expect(stats).toHaveLength(1);
    expect(stats[0]!.repCount).toBe(3);
    // So are the practice days.
    expect(await createRepositories(target).days.all()).toEqual(
      await createRepositories(db).days.all(),
    );
  });

  it('merges by keeping whichever copy changed last', async () => {
    const { db, exercise } = await populated();
    const file = await exportData(db);

    // Locally, the exercise is edited later than the file's copy, and a new
    // routine exists that the file has never seen.
    const target = fresh();
    await applyImport(target, file, 'replace');
    const local = createRepositories(target, () => 5_000);
    await local.exercises.update(exercise.id, { tempo: { targetTempo: 100, maxTempo: 90 } });
    await local.routines.add({ name: 'Local only', items: [], sessionAxisPolicies: {} });

    // The file also has a newer version of something else.
    const incoming = structuredClone(file);
    incoming.data.routines[0] = {
      ...incoming.data.routines[0]!,
      name: 'Renamed',
      updatedAt: 9_000,
    };

    const plan = await planImport(target, incoming, 'merge');
    expect(plan.exercises).toEqual({ added: 0, updated: 0, removed: 0 });
    expect(plan.routines).toEqual({ added: 0, updated: 1, removed: 0 });

    await applyImport(target, incoming, 'merge');
    expect((await local.exercises.byId(exercise.id))!.tempo.targetTempo).toBe(100);
    const names = (await local.routines.all()).map((r) => r.name).sort();
    expect(names).toEqual(['Local only', 'Renamed']);
  });

  it('replaces everything when asked, and says what it will remove first', async () => {
    const { db } = await populated();
    const file = await exportData(db);
    const target = fresh();
    const repos = createRepositories(target);
    await repos.routines.add({ name: 'Local only', items: [], sessionAxisPolicies: {} });

    const plan = await planImport(target, file, 'replace');
    expect(plan.routines).toEqual({ added: 1, updated: 0, removed: 1 });
    expect(plan.reps.added).toBe(3);

    await applyImport(target, file, 'replace');
    expect((await repos.routines.all()).map((r) => r.name)).toEqual(['Morning']);
  });

  it('refuses a file that is not an export, saying why', () => {
    expect(() => parseExport({ hello: 'world' })).toThrow(/not a TheoryPad export/);
    expect(() => parseExport({ formatVersion: 2 })).toThrow(/formatVersion/);
  });

  it('imports settings from before Appearance as following the system', async () => {
    const { db } = await populated();
    await createRepositories(db).settings.get();
    const file = JSON.parse(JSON.stringify(await exportData(db))) as {
      data: { settings: { ui: Record<string, unknown> } };
    };
    delete file.data.settings.ui.appearance;
    const target = fresh();

    await applyImport(target, parseExport(file), 'replace');
    expect((await createRepositories(target).settings.get()).ui.appearance).toBe('system');
  });

  it('carries videos, deleted ones included', async () => {
    const { db, repos } = await populated();
    const own = await repos.videos.add({
      videoId: 'abcdefghijk',
      title: 'How to shift',
      scope: { kind: 'exercise', exerciseId: 'ex-1' },
      playAlong: false,
      startSec: 40,
      beatsPerBar: 4,
      tags: [],
    });
    const gone = await repos.videos.add({ ...own, title: 'Old lesson' });
    await repos.videos.softDelete(gone.id);

    const file = parseExport(JSON.parse(JSON.stringify(await exportData(db))));
    expect(file.data.videos).toHaveLength(3); // with the first-run track

    const target = fresh();
    await applyImport(target, file, 'replace');
    expect((await createRepositories(target).videos.all()).map((v) => v.title).sort()).toEqual([
      'A minor backing track',
      'How to shift',
    ]);
  });

  it('leaves videos alone when the file predates them, even replacing', async () => {
    const { db } = await populated();
    const file = JSON.parse(JSON.stringify(await exportData(db))) as {
      data: Record<string, unknown>;
    };
    delete file.data.videos;
    const target = fresh();
    const repos = createRepositories(target);
    await repos.videos.add({
      videoId: 'abcdefghijk',
      title: 'Mine',
      scope: { kind: 'shared' },
      playAlong: true,
      startSec: 0,
      keyMode: { tonic: 'E' as never, scale: 'major', mode: 'phrygian' },
      bpm: 120,
      beatsPerBar: 4,
      tags: [],
    });

    const plan = await planImport(target, parseExport(file), 'replace');
    expect(plan.videos).toEqual({ added: 0, updated: 0, removed: 0 });
    await applyImport(target, parseExport(file), 'replace');
    expect((await repos.videos.all()).map((v) => v.title)).toContain('Mine');
  });

  it('accepts an export from before routines existed', async () => {
    const { db } = await populated();
    const file = JSON.parse(JSON.stringify(await exportData(db))) as {
      data: Record<string, unknown>;
    };
    delete file.data.routines;
    expect(parseExport(file).data.routines).toEqual([]);
  });
});
