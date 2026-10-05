import { describe, expect, it } from 'vitest';
import {
  countBeneath,
  deletionOf,
  folderPath,
  freeName,
  listGroups,
  nameProblem,
  normalizeTag,
  planMove,
  type FolderLike,
  type PlacedLike,
} from '..';

// Scales › Modes › Rhythms, and Arpeggios, at the top level.
const folders: FolderLike[] = [
  { id: 'scales', name: 'Scales', parentId: null },
  { id: 'modes', name: 'Modes', parentId: 'scales' },
  { id: 'rhythms', name: 'Rhythms', parentId: 'modes' },
  { id: 'arps', name: 'Arpeggios', parentId: null },
];

const exercises: PlacedLike[] = [
  { id: 'e10', name: '10 Sextuplets', folderId: 'rhythms' },
  { id: 'e2', name: '2 Triplets', folderId: 'rhythms', favorite: true },
  { id: 'dorian', name: 'Dorian', folderId: 'modes' },
  { id: 'warm', name: 'warm-up', folderId: null, favorite: true },
  { id: 'circle', name: 'Circle', folderId: null },
  { id: 'lost', name: 'Lost', folderId: 'gone' },
];

describe('names', () => {
  it('clash trimmed and ignoring case, and number the next free one', () => {
    expect(nameProblem('  dorian ', ['Dorian'])).toBe('taken');
    expect(nameProblem('   ', [])).toBe('empty');
    expect(nameProblem('Lydian', ['Dorian'])).toBeNull();
    expect(freeName('Dorian', ['dorian', 'Dorian 2'])).toBe('Dorian 3');
    expect(freeName('Dorian', ['Dorian'], ' - ')).toBe('Dorian - 2');
  });

  it('store a typed tag lowercase-kebab', () => {
    expect(normalizeTag('  String Skipping! ')).toBe('string-skipping');
    expect(normalizeTag('My triplets')).toBe('my-triplets');
    expect(normalizeTag(' -- ')).toBe('');
  });
});

describe('the folder tree', () => {
  it('knows paths and counts, and puts anything under a missing folder at the top', () => {
    expect(folderPath(folders, 'rhythms').map((f) => f.name)).toEqual([
      'Scales',
      'Modes',
      'Rhythms',
    ]);
    expect(countBeneath(folders, exercises, 'scales')).toBe(3);
    expect(listGroups(folders, exercises).find((g) => g.kind === 'top')!.exercises).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'lost' })]),
    );
  });

  it('lists favorites, then the top level, then each folder depth-first, sorted naturally', () => {
    const groups = listGroups(folders, exercises);
    expect(
      groups.map((g) => [g.kind, g.path.join(' › '), g.exercises.map((e) => e.name)]),
    ).toEqual([
      ['favorites', '', ['2 Triplets', 'warm-up']],
      ['top', '', ['Circle', 'Lost', 'warm-up']],
      // Scales holds no exercises of its own, and Arpeggios none at all.
      ['folder', 'Scales › Modes', ['Dorian']],
      ['folder', 'Scales › Modes › Rhythms', ['2 Triplets', '10 Sextuplets']],
    ]);
  });

  it('deletes a folder with everything below it', () => {
    expect(deletionOf(folders, exercises, 'modes')).toEqual({
      folderIds: ['modes', 'rhythms'],
      exerciseIds: ['e10', 'e2', 'dorian'],
    });
  });
});

describe('moving', () => {
  it('renames a clash with " - 2", and leaves what is already there alone', () => {
    const plan = planMove(
      folders,
      [...exercises, { id: 'top-dorian', name: 'dorian', folderId: null }],
      { folderIds: ['arps'], exerciseIds: ['dorian', 'top-dorian'] },
      'modes',
    );
    expect(plan).toEqual({
      folders: [{ id: 'arps', name: 'Arpeggios', parentId: 'modes' }],
      exercises: [{ id: 'top-dorian', name: 'dorian - 2', folderId: 'modes' }],
    });
  });

  it('refuses to move a folder into itself or below itself', () => {
    expect(
      planMove(folders, exercises, { folderIds: ['scales'], exerciseIds: [] }, 'rhythms'),
    ).toBeNull();
    expect(
      planMove(folders, exercises, { folderIds: ['modes'], exerciseIds: [] }, 'modes'),
    ).toBeNull();
    expect(
      planMove(folders, exercises, { folderIds: ['modes'], exerciseIds: [] }, null),
    ).not.toBeNull();
  });
});
