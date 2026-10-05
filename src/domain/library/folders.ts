import { freeName, nameTaken } from './names';

/** A folder as the library needs it: a name, under a parent or at the top level. */
export interface FolderLike {
  id: string;
  name: string;
  parentId: string | null;
}

/** An exercise as the library needs it. */
export interface PlacedLike {
  id: string;
  name: string;
  folderId: string | null;
  favorite?: boolean;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Alphabetical, numbers by value: "2 Triplets" before "10 Sextuplets". */
export function compareNames(a: string, b: string): number {
  return collator.compare(a, b);
}

export function byName<T extends { name: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => compareNames(a.name, b.name));
}

/**
 * Where an exercise or folder really sits: its folder if that exists, else the
 * top level — so nothing is ever lost under a folder that is gone.
 */
function placeOf(folders: readonly FolderLike[], id: string | null): string | null {
  return id !== null && folders.some((f) => f.id === id) ? id : null;
}

export function childFolders<F extends FolderLike>(
  folders: readonly F[],
  parentId: string | null,
): F[] {
  return byName(folders.filter((f) => placeOf(folders, f.parentId) === parentId));
}

export function exercisesIn<E extends PlacedLike>(
  folders: readonly FolderLike[],
  exercises: readonly E[],
  folderId: string | null,
): E[] {
  return byName(exercises.filter((e) => placeOf(folders, e.folderId) === folderId));
}

/** The folders from the top level down to this one; empty for the top level. */
export function folderPath<F extends FolderLike>(
  folders: readonly F[],
  folderId: string | null,
): F[] {
  const path: F[] = [];
  let at = placeOf(folders, folderId);
  while (at !== null && !path.some((f) => f.id === at)) {
    const folder = folders.find((f) => f.id === at)!;
    path.unshift(folder);
    at = placeOf(folders, folder.parentId);
  }
  return path;
}

/** The folder and every folder below it. */
export function folderAndBelow(folders: readonly FolderLike[], folderId: string): Set<string> {
  const ids = new Set([folderId]);
  for (let grew = true; grew;) {
    grew = false;
    for (const f of folders) {
      if (f.parentId !== null && ids.has(f.parentId) && !ids.has(f.id)) {
        ids.add(f.id);
        grew = true;
      }
    }
  }
  return ids;
}

/** How many exercises sit in this folder or anywhere below it. */
export function countBeneath(
  folders: readonly FolderLike[],
  exercises: readonly PlacedLike[],
  folderId: string,
): number {
  const ids = folderAndBelow(folders, folderId);
  return exercises.filter((e) => {
    const at = placeOf(folders, e.folderId);
    return at !== null && ids.has(at);
  }).length;
}

/** Deleting a folder deletes everything in it, as in any file system. */
export function deletionOf(
  folders: readonly FolderLike[],
  exercises: readonly PlacedLike[],
  folderId: string,
): { folderIds: string[]; exerciseIds: string[] } {
  const ids = folderAndBelow(folders, folderId);
  return {
    folderIds: [...ids],
    exerciseIds: exercises
      .filter((e) => e.folderId !== null && ids.has(e.folderId))
      .map((e) => e.id),
  };
}

/** What is wrong with a name, if anything: blank, or already used beside it. */
export function nameProblem(name: string, taken: readonly string[]): 'empty' | 'taken' | null {
  if (name.trim() === '') return 'empty';
  return nameTaken(name, taken) ? 'taken' : null;
}

/** The names already used by exercises in a folder, leaving one out (the one being renamed). */
export function exerciseNamesIn(
  folders: readonly FolderLike[],
  exercises: readonly PlacedLike[],
  folderId: string | null,
  except?: string,
): string[] {
  return exercisesIn(folders, exercises, folderId)
    .filter((e) => e.id !== except)
    .map((e) => e.name);
}

/** The names already used by folders under a parent, leaving one out. */
export function folderNamesIn(
  folders: readonly FolderLike[],
  parentId: string | null,
  except?: string,
): string[] {
  return childFolders(folders, parentId)
    .filter((f) => f.id !== except)
    .map((f) => f.name);
}

export interface MovePlan {
  folders: { id: string; name: string; parentId: string | null }[];
  exercises: { id: string; name: string; folderId: string | null }[];
}

/**
 * Moving exercises and folders into a folder (null: the top level). A name
 * already taken there gets " - 2", " - 3"… Anything already there is left
 * alone. Null if a folder would move into itself or below itself.
 */
export function planMove(
  folders: readonly FolderLike[],
  exercises: readonly PlacedLike[],
  move: { folderIds: readonly string[]; exerciseIds: readonly string[] },
  to: string | null,
): MovePlan | null {
  const target = placeOf(folders, to);
  if (target !== null && move.folderIds.some((id) => folderAndBelow(folders, id).has(target)))
    return null;

  const plan: MovePlan = { folders: [], exercises: [] };
  const folderNames = folderNamesIn(folders, target);
  for (const folder of byName(folders.filter((f) => move.folderIds.includes(f.id)))) {
    if (placeOf(folders, folder.parentId) === target) continue;
    const name = freeName(folder.name, folderNames, ' - ');
    folderNames.push(name);
    plan.folders.push({ id: folder.id, name, parentId: target });
  }
  const exerciseNames = exerciseNamesIn(folders, exercises, target);
  for (const exercise of byName(exercises.filter((e) => move.exerciseIds.includes(e.id)))) {
    if (placeOf(folders, exercise.folderId) === target) continue;
    const name = freeName(exercise.name, exerciseNames, ' - ');
    exerciseNames.push(name);
    plan.exercises.push({ id: exercise.id, name, folderId: target });
  }
  return plan;
}

export interface ListGroup<E> {
  /** Unique among the groups: 'favorites', 'top', or the folder's id. */
  key: string;
  kind: 'favorites' | 'top' | 'folder';
  /** Folder names from the top level down; empty for Favorites and the top level. */
  path: string[];
  exercises: E[];
}

/**
 * The library as one list, for the side panel and the routine picker:
 * Favorites first, then the top level, then every folder with exercises in
 * it, depth-first, each sorted by name. Empty groups are left out. A favorite
 * is in Favorites and in its own folder both.
 */
export function listGroups<F extends FolderLike, E extends PlacedLike>(
  folders: readonly F[],
  exercises: readonly E[],
): ListGroup<E>[] {
  const groups: ListGroup<E>[] = [];
  const add = (group: ListGroup<E>) => {
    if (group.exercises.length > 0) groups.push(group);
  };
  add({
    key: 'favorites',
    kind: 'favorites',
    path: [],
    exercises: byName(exercises.filter((e) => e.favorite)),
  });
  add({ key: 'top', kind: 'top', path: [], exercises: exercisesIn(folders, exercises, null) });
  const walk = (parentId: string | null, path: string[]) => {
    for (const folder of childFolders(folders, parentId)) {
      const here = [...path, folder.name];
      add({
        key: folder.id,
        kind: 'folder',
        path: here,
        exercises: exercisesIn(folders, exercises, folder.id),
      });
      walk(folder.id, here);
    }
  };
  walk(null, []);
  return groups;
}
