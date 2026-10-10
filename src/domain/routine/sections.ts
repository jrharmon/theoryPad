/**
 * A routine's list: its items in order, with section dividers between them.
 *
 * A section is a divider, not a folder. Everything after it, up to the next
 * one or the end, is in it; items above the first divider are in none. It
 * labels, and it switches what is under it on or off — it never changes how a
 * run moves through what plays.
 *
 * Switches are stored only when off: absent is on, so a routine from before
 * sections is a valid list as it stands.
 */
export interface RoutineSection {
  kind: 'section';
  id: string;
  name: string;
  /** Off leaves everything under it out of a run, whatever their own switches say. */
  enabled?: boolean;
}

/** What a list holds between its sections. */
export interface SwitchedItem {
  id: string;
  kind?: undefined;
  /** Off leaves it out of a run; it keeps its place and settings. */
  enabled?: boolean;
}

export type RoutineEntry<I extends SwitchedItem> = I | RoutineSection;

export function isSection<I extends SwitchedItem>(
  entry: RoutineEntry<I>,
): entry is RoutineSection {
  return entry.kind === 'section';
}

export function isOn(entry: { enabled?: boolean }): boolean {
  return entry.enabled !== false;
}

/** Every item with the section it falls under, or null above the first. */
export function itemsWithSections<I extends SwitchedItem>(
  entries: readonly RoutineEntry<I>[],
): { item: I; section: RoutineSection | null }[] {
  let section: RoutineSection | null = null;
  const out: { item: I; section: RoutineSection | null }[] = [];
  for (const entry of entries) {
    if (isSection(entry)) section = entry;
    else out.push({ item: entry, section });
  }
  return out;
}

/** Every item, sections left out. */
export function itemsOf<I extends SwitchedItem>(entries: readonly RoutineEntry<I>[]): I[] {
  return entries.filter((e): e is I => !isSection(e));
}

/** Whether an item plays: it is on, and so is its section, if it has one. */
export function plays(item: SwitchedItem, section: RoutineSection | null): boolean {
  return isOn(item) && (section === null || isOn(section));
}

/** What a run plays, in order. */
export function playedItems<I extends SwitchedItem>(entries: readonly RoutineEntry<I>[]): I[] {
  return itemsWithSections(entries)
    .filter(({ item, section }) => plays(item, section))
    .map(({ item }) => item);
}

/** The items under a section, up to the next one. */
export function sectionItems<I extends SwitchedItem>(
  entries: readonly RoutineEntry<I>[],
  sectionId: string,
): I[] {
  return itemsWithSections(entries)
    .filter(({ section }) => section?.id === sectionId)
    .map(({ item }) => item);
}

/**
 * Move an item up (-1) or down (+1) one place, stopping at the ends. Past a
 * divider is a place too: up from a section's first item puts it at the end
 * of the section above.
 */
export function moveItem<E extends { id: string }>(
  entries: readonly E[],
  itemId: string,
  delta: -1 | 1,
): E[] {
  const from = entries.findIndex((e) => e.id === itemId);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= entries.length) return [...entries];
  const next = [...entries];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

/**
 * The list cut at each divider: first whatever sits above the first section
 * (perhaps nothing), then each section with its items.
 */
function blocks<I extends SwitchedItem>(
  entries: readonly RoutineEntry<I>[],
): RoutineEntry<I>[][] {
  const out: RoutineEntry<I>[][] = [[]];
  for (const entry of entries) {
    if (isSection(entry)) out.push([entry]);
    else out[out.length - 1]!.push(entry);
  }
  return out;
}

/**
 * Move a section, with its items, past the section above (-1) or below (+1).
 * Items above the first section have no divider to stay under, so a section
 * never moves above them.
 */
export function moveSection<I extends SwitchedItem>(
  entries: readonly RoutineEntry<I>[],
  sectionId: string,
  delta: -1 | 1,
): RoutineEntry<I>[] {
  const all = blocks(entries);
  const from = all.findIndex((b) => b[0]?.id === sectionId && isSection(b[0]));
  const to = from + delta;
  if (from < 1 || to < 1 || to >= all.length) return [...entries];
  [all[from], all[to]] = [all[to]!, all[from]!];
  return all.flat();
}

/** A new divider before an entry, or at the end with no entry named. */
export function insertSection<I extends SwitchedItem>(
  entries: readonly RoutineEntry<I>[],
  section: RoutineSection,
  beforeId: string | null,
): RoutineEntry<I>[] {
  const at = beforeId === null ? -1 : entries.findIndex((e) => e.id === beforeId);
  if (at === -1) return [...entries, section];
  return [...entries.slice(0, at), section, ...entries.slice(at)];
}

/** An item at the end of a section, or at the end of the list with none named. */
export function addItem<I extends SwitchedItem>(
  entries: readonly RoutineEntry<I>[],
  item: I,
  sectionId: string | null,
): RoutineEntry<I>[] {
  const start = sectionId === null ? -1 : entries.findIndex((e) => e.id === sectionId);
  if (start === -1) return [...entries, item];
  const next = entries.findIndex((e, i) => i > start && isSection(e));
  const at = next === -1 ? entries.length : next;
  return [...entries.slice(0, at), item, ...entries.slice(at)];
}

/**
 * Delete a divider. On its own, its items stay where they are — under the
 * section above, or none. With its items, they go too.
 */
export function removeSection<I extends SwitchedItem>(
  entries: readonly RoutineEntry<I>[],
  sectionId: string,
  withItems: boolean,
): RoutineEntry<I>[] {
  const gone = new Set([
    sectionId,
    ...(withItems ? sectionItems(entries, sectionId).map((i) => i.id) : []),
  ]);
  return entries.filter((e) => !gone.has(e.id));
}
