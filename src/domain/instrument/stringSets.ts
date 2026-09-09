import type { Instrument, StringSet } from './types';
import { stringCount } from './fretboard';

/**
 * String sets are generated from the instrument rather than hard-coded, so a
 * 7-string gets 7-string sets and a bass gets bass sets without a special case.
 *
 * Names use guitarist numbering — string 1 is the HIGHEST — while `strings`
 * holds model indices, where 0 is the lowest. The inversion lives here so
 * nothing downstream has to think about it.
 */

/** Guitarist's name for a string index: on a 6-string, index 0 is "6". */
export function stringLabel(instrument: Instrument, index: number): string {
  return String(stringCount(instrument) - index);
}

function adjacentSets(instrument: Instrument, size: number): StringSet[] {
  const n = stringCount(instrument);
  const sets: StringSet[] = [];
  for (let low = 0; low + size <= n; low += 1) {
    const strings = Array.from({ length: size }, (_, k) => low + k);
    const name = strings
      .map((s) => stringLabel(instrument, s))
      .reverse()
      .join('-');
    sets.push({ id: `adj-${size}-${low}`, name, strings });
  }
  return sets;
}

/** Every adjacent set of `size` strings, plus the whole neck. */
export function stringSetsOfSize(instrument: Instrument, size: number): StringSet[] {
  return adjacentSets(instrument, size);
}

export function allStrings(instrument: Instrument): StringSet {
  return {
    id: 'all',
    name: 'All strings',
    strings: Array.from({ length: stringCount(instrument) }, (_, i) => i),
  };
}

/**
 * Non-adjacent sets, for string-skipping work: every pair of strings with
 * `skip` strings between them.
 */
export function skippedSets(instrument: Instrument, skip = 1): StringSet[] {
  const n = stringCount(instrument);
  const step = skip + 1;
  const sets: StringSet[] = [];
  for (let low = 0; low + step * 2 < n + step; low += 1) {
    const strings = [low, low + step, low + step * 2].filter((s) => s < n);
    if (strings.length < 2) continue;
    sets.push({
      id: `skip-${skip}-${low}`,
      name: strings
        .map((s) => stringLabel(instrument, s))
        .reverse()
        .join('-'),
      strings,
    });
  }
  return sets;
}

/** The candidate pool the `stringSet` variation axis rolls from. */
export function defaultStringSets(instrument: Instrument): StringSet[] {
  return [
    ...stringSetsOfSize(instrument, 3),
    ...stringSetsOfSize(instrument, 4),
    allStrings(instrument),
  ];
}
