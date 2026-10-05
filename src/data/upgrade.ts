import { freeName } from '@/domain/library';
import type { Exercise } from './entities';

/** What the data layer needs to know about a blueprint (an exercise definition). */
export interface BlueprintInfo {
  name: string;
  tags: readonly string[];
}

/** Looks a blueprint up by id; undefined for one that is gone from the code. */
export type BlueprintCatalog = (definitionId: string) => BlueprintInfo | undefined;

/**
 * The blueprints, handed in by the app at start-up. The data layer sits below
 * the exercise definitions, so it is told about them rather than importing them.
 */
let catalog: BlueprintCatalog = () => undefined;

export function setBlueprintCatalog(next: BlueprintCatalog): void {
  catalog = next;
}

export function blueprintCatalog(): BlueprintCatalog {
  return catalog;
}

/**
 * Exercise rows from before blueprints — the Dexie v7 upgrade, and an import
 * of a v1 export. One function for both, so the two cannot drift.
 *
 * Each row gets its blueprint's name (its definition id if the blueprint is
 * gone) and tags, the top level, and nothing locked. Names are unique in a
 * folder, so a second exercise from one blueprint becomes "Name 2" — the older
 * keeps the plain name. Deleted rows are named but take no name from a live
 * one. A row that already has the new fields passes through.
 */
export function upgradeExercises(
  rows: readonly Record<string, unknown>[],
  lookup: BlueprintCatalog = catalog,
): Exercise[] {
  const taken = rows
    .filter((row) => typeof row.name === 'string' && row.deletedAt === undefined)
    .filter((row) => (row.folderId ?? null) === null)
    .map((row) => row.name as string);

  const named = new Map<unknown, string>();
  const needsName = rows
    .filter((row) => typeof row.name !== 'string')
    .sort((a, b) => (a.createdAt as number) - (b.createdAt as number));
  for (const row of needsName) {
    const definitionId = row.definitionId as string;
    const base = lookup(definitionId)?.name ?? definitionId;
    if (row.deletedAt !== undefined) {
      named.set(row, base);
      continue;
    }
    const name = freeName(base, taken);
    taken.push(name);
    named.set(row, name);
  }

  return rows.map((row) => {
    const info = lookup(row.definitionId as string);
    return {
      ...row,
      name: named.get(row) ?? (row.name as string),
      tags: Array.isArray(row.tags) ? (row.tags as string[]) : [...(info?.tags ?? [])],
      folderId: (row.folderId as string | null | undefined) ?? null,
      locked: (row.locked as Exercise['locked'] | undefined) ?? { params: [], axes: [] },
    } as Exercise;
  });
}
