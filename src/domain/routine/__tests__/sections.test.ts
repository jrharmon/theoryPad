import { describe, expect, it } from 'vitest';
import {
  addItem,
  insertSection,
  itemsWithSections,
  moveItem,
  moveSection,
  playedItems,
  removeSection,
  type RoutineEntry,
  type RoutineSection,
  type SwitchedItem,
} from '..';

const section = (id: string, enabled?: boolean): RoutineSection => ({
  kind: 'section',
  id,
  name: id,
  ...(enabled === undefined ? {} : { enabled }),
});
const item = (id: string, enabled?: boolean): SwitchedItem => ({
  id,
  ...(enabled === undefined ? {} : { enabled }),
});
const ids = (entries: readonly { id: string }[]) => entries.map((e) => e.id).join(' ');

// a, then Warmup (b, c), then Speed (d), then an empty Theory.
const list: RoutineEntry<SwitchedItem>[] = [
  item('a'),
  section('Warmup'),
  item('b'),
  item('c'),
  section('Speed'),
  item('d'),
  section('Theory'),
];

describe('a routine’s sections', () => {
  it('play what is on, under a section that is on, and leave the rest in place', () => {
    expect(itemsWithSections(list).map(({ item, section }) => [item.id, section?.id])).toEqual([
      ['a', undefined],
      ['b', 'Warmup'],
      ['c', 'Warmup'],
      ['d', 'Speed'],
    ]);
    expect(ids(playedItems(list))).toEqual('a b c d');

    // An item off, and a section off whatever its items say.
    const switched = [item('a', false), section('Warmup', false), item('b'), item('c', true)];
    expect(ids(playedItems(switched))).toEqual('');
    expect(ids(playedItems([...switched, section('Speed'), item('d')]))).toEqual('d');
  });

  it('move an item one place at a time, across a divider into the section beside it', () => {
    // Up from Warmup's first item: the last thing above Warmup — here, no section.
    const up = moveItem(list, 'b', -1);
    expect(ids(up)).toEqual('a b Warmup c Speed d Theory');
    expect(itemsWithSections(up).find((x) => x.item.id === 'b')?.section).toBeNull();
    // Down from Warmup's last: the top of Speed.
    expect(ids(moveItem(list, 'c', 1))).toEqual('a Warmup b Speed c d Theory');
    expect(ids(moveItem(list, 'a', -1))).toEqual(ids(list));
  });

  it('move a section with its items, but never above the items in none', () => {
    expect(ids(moveSection(list, 'Speed', -1))).toEqual('a Speed d Warmup b c Theory');
    expect(ids(moveSection(list, 'Warmup', 1))).toEqual('a Speed d Warmup b c Theory');
    expect(ids(moveSection(list, 'Warmup', -1))).toEqual(ids(list));
    expect(ids(moveSection(list, 'Theory', 1))).toEqual(ids(list));
  });

  it('insert a divider anywhere, and add an item at the end of a section', () => {
    expect(ids(insertSection(list, section('New'), 'c'))).toEqual(
      'a Warmup b New c Speed d Theory',
    );
    expect(ids(insertSection(list, section('New'), null))).toMatch(/ New$/);
    expect(ids(addItem(list, item('e'), 'Warmup'))).toEqual('a Warmup b c e Speed d Theory');
    expect(ids(addItem(list, item('e'), 'Theory'))).toMatch(/Theory e$/);
    expect(ids(addItem(list, item('e'), null))).toMatch(/Theory e$/);
  });

  it('delete a divider alone, its items joining the section above, or with its items', () => {
    const alone = removeSection(list, 'Speed', false);
    expect(ids(alone)).toEqual('a Warmup b c d Theory');
    expect(itemsWithSections(alone).find((x) => x.item.id === 'd')?.section?.id).toBe('Warmup');
    expect(ids(removeSection(list, 'Warmup', true))).toEqual('a Speed d Theory');
  });
});
